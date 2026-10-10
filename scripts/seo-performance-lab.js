const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { digest } = require('./verify-deployment');
const { siteUrl } = require('./seo-identity');

const paginas = ['/', '/artigos/inteligencia-artificial.html',
  '/artigos/inteligencia-artificial/engenharia-de-contexto-para-memoria-custo-e-precisao-em-aplicacoes-de-ia-generativa.html',
  '/artigos/explorando-os-segredos-do-reservoir-sampling.html'];
const perfis = [
  { nome: 'desktop', viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 }, cpu: 1,
    rede: { offline: false, latency: 40, downloadThroughput: 10e6 / 8, uploadThroughput: 5e6 / 8 } },
  { nome: 'celular', viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, cpu: 4,
    rede: { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 } }
];

function maiorJanelaLayoutShifts(entradas) {
  let inicio = null, anterior = null, soma = 0, maior = 0;
  for (const e of entradas.filter(e => !e.hadRecentInput).sort((a, b) => a.startTime - b.startTime)) {
    if (inicio === null || e.startTime - anterior >= 1000 || e.startTime - inicio >= 5000) {
      inicio = e.startTime; soma = 0;
    }
    anterior = e.startTime; soma += e.value; maior = Math.max(maior, soma);
  }
  return maior;
}

function resumirAmostras(amostras) {
  const grupos = new Map();
  for (const a of amostras) {
    const chave = `${a.perfil}:${a.caminho}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(a);
  }
  return [...grupos.values()].map(grupo => {
    const resumo = { caminho: grupo[0].caminho, perfil: grupo[0].perfil, amostras: grupo.length,
      coletaCompleta: grupo.every(a => a.coletaCompleta) };
    for (const campo of ['ttfbMs', 'fcpMs', 'lcpCandidatoMs', 'maiorJanelaLayoutShifts', 'tarefasLongasMs', 'bytesTransferidos']) {
      const valores = grupo.map(a => a.metricas?.[campo]).filter(Number.isFinite).sort((a, b) => a - b);
      resumo[campo] = valores.length !== grupo.length ? null : {
        minimo: valores[0], mediana: valores[Math.floor(valores.length / 2)], maximo: valores.at(-1)
      };
    }
    return resumo;
  });
}

function observarCarregamento() {
  const dados = { suportados: [...PerformanceObserver.supportedEntryTypes], lcp: [], shifts: [], tarefas: [], visibilidade: [document.visibilityState] };
  window.__seoLaboratorio = dados;
  document.addEventListener('visibilitychange', () => dados.visibilidade.push(document.visibilityState));
  for (const tipo of ['largest-contentful-paint', 'layout-shift', 'longtask']) {
    if (!dados.suportados.includes(tipo)) continue;
    new PerformanceObserver(lista => {
      for (const e of lista.getEntries()) {
        if (tipo === 'largest-contentful-paint') dados.lcp.push({ startTime: e.startTime, size: e.size,
          elemento: e.element ? `${e.element.tagName.toLowerCase()}${e.element.id ? '#' + e.element.id : ''}` : null });
        if (tipo === 'layout-shift') dados.shifts.push({ startTime: e.startTime, value: e.value, hadRecentInput: e.hadRecentInput });
        if (tipo === 'longtask') dados.tarefas.push({ startTime: e.startTime, duration: e.duration });
      }
    }).observe({ type: tipo, buffered: true });
  }
}

async function capturarAmostra(browser, { caminho, perfil, rodada, esperado, observacaoMs }) {
  const contexto = await browser.createBrowserContext();
  const resultado = { caminho, perfil: perfil.nome, rodada, iniciadoEm: new Date().toISOString(), coletaCompleta: false };
  try {
    const pagina = await contexto.newPage();
    await pagina.setViewport(perfil.viewport);
    await pagina.bringToFront();
    await pagina.setCacheEnabled(false);
    const cdp = await pagina.createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', perfil.rede);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: perfil.cpu });
    const bloqueados = new Set();
    const pendentes = new Set();
    const falhasRecursos = [];
    const falhas = [];
    await pagina.setRequestInterception(true);
    pagina.on('request', req => {
      const u = new URL(req.url());
      if ((u.origin === siteUrl && req.method() === 'GET') || u.protocol === 'data:') { pendentes.add(req); return req.continue(); }
      bloqueados.add(u.origin + u.pathname); return req.abort();
    });
    pagina.on('requestfinished', req => pendentes.delete(req));
    pagina.on('requestfailed', req => { if (pendentes.delete(req)) falhasRecursos.push(req.url()); });
    pagina.on('pageerror', e => falhas.push(e.message));
    await pagina.evaluateOnNewDocument(observarCarregamento);
    const resposta = await pagina.goto(siteUrl + caminho, { waitUntil: 'load', timeout: 45000 });
    const html = await resposta.text();
    let redeOciosa = true;
    try { await pagina.waitForNetworkIdle({ idleTime: 500, timeout: 20000 }); } catch { redeOciosa = false; }
    await new Promise(resolve => setTimeout(resolve, observacaoMs));
    const dados = await pagina.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const recursos = performance.getEntriesByType('resource').filter(r => new URL(r.name).origin === location.origin);
      return { ...window.__seoLaboratorio, navegacao: nav?.toJSON(),
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
        recursos: recursos.map(r => ({ url: r.name, duracaoMs: r.duration, transferSize: r.transferSize })),
        duracaoObservadaMs: performance.now(), h1: document.querySelector('h1')?.textContent.trim(),
        overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    const ultimoLcp = dados.lcp.at(-1);
    resultado.http = resposta.status();
    resultado.urlFinal = pagina.url();
    resultado.correspondeAoGit = digest(html) === digest(esperado);
    resultado.metricas = {
      ttfbMs: dados.navegacao?.responseStart ?? null, fcpMs: dados.fcp,
      lcpCandidatoMs: ultimoLcp?.startTime ?? null, elementoLcp: ultimoLcp?.elemento ?? null,
      maiorJanelaLayoutShifts: dados.suportados.includes('layout-shift') ? maiorJanelaLayoutShifts(dados.shifts) : null,
      tarefasLongasMs: dados.suportados.includes('longtask') ? dados.tarefas.reduce((s, e) => s + e.duration, 0) : null,
      bytesTransferidos: (dados.navegacao?.transferSize ?? 0) + dados.recursos.reduce((s, e) => s + e.transferSize, 0),
      inp: null
    };
    resultado.observacao = dados;
    resultado.requisicoesBloqueadas = [...bloqueados];
    resultado.errosJavaScript = falhas;
    resultado.recursosPendentes = [...pendentes].map(req => req.url());
    resultado.falhasRecursos = falhasRecursos;
    resultado.redeOciosa = redeOciosa;
    resultado.coletaCompleta = resultado.http === 200 && resultado.urlFinal === siteUrl + caminho && resultado.correspondeAoGit &&
      dados.visibilidade.every(v => v === 'visible') && Boolean(ultimoLcp) && dados.fcp !== null && Boolean(dados.h1) && !falhas.length &&
      redeOciosa && !pendentes.size && !falhasRecursos.length && ['largest-contentful-paint', 'layout-shift', 'longtask'].every(t => dados.suportados.includes(t));
  } catch (erro) { resultado.erro = erro.message; }
  finally { await contexto.close(); }
  return resultado;
}

async function main() {
  if (!process.argv.includes('--capture')) { console.log('Use --capture. Medicao publica, sem terceiros, nao executada no CI.'); return; }
  const revisao = process.env.EXPECTED_REVISION || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[a-f0-9]{40}$/.test(revisao)) throw new Error('EXPECTED_REVISION exige SHA completo.');
  const esperados = new Map(paginas.map(p => [p, execFileSync('git', ['show', `${revisao}:${p === '/' ? 'index.html' : p.slice(1)}`], { encoding: 'utf8', maxBuffer: 5e6 })]));
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || puppeteer.executablePath() });
  const amostras = [];
  const observacaoMs = 3000;
  let chrome;
  try {
    chrome = await browser.version();
    for (const perfil of perfis) for (const caminho of paginas) for (let rodada = 1; rodada <= 3; rodada++) {
      const a = await capturarAmostra(browser, { caminho, perfil, rodada, esperado: esperados.get(caminho), observacaoMs });
      amostras.push(a);
      console.log(JSON.stringify({ caminho, perfil: perfil.nome, rodada, coletaCompleta: a.coletaCompleta, erro: a.erro }));
    }
  } finally { await browser.close(); }
  const resultado = { versao: 1, geradoEm: new Date().toISOString(), revisaoEsperada: revisao, chrome,
    condicoes: { perfis, repeticoes: 3, cache: 'contexto novo e cache HTTP desativado por amostra', observacaoAposRedeOciosaMs: observacaoMs,
      esperaRedeOciosa: { idleTimeMs: 500, timeoutMs: 20000 },
      terceiros: 'bloqueados, incluindo anuncios e analytics', interacoes: 'nenhuma', notaLighthouse: null, coreWebVitalsCampo: null },
    limites: 'Laboratorio isolado de terceiros. LCP candidato e layout shifts apenas na janela observada do documento principal, sem iframes. Nao mede a visita inteira, INP, usuarios reais, desempenho de anuncios ou efeito de ranking. Condicoes escolhidas, nao presets Lighthouse nem aparelho fisico. A mediana de tres amostras nao representa o percentil 75 de usuarios.',
    coletaCompleta: amostras.every(a => a.coletaCompleta), resumo: resumirAmostras(amostras), amostras };
  const diretorio = path.join('.editorial', 'desempenho');
  fs.mkdirSync(diretorio, { recursive: true });
  const arquivo = path.join(diretorio, `${resultado.geradoEm.replace(/[:.]/g, '-')}-${revisao.slice(0, 12)}.json`);
  fs.writeFileSync(arquivo, JSON.stringify(resultado, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ arquivo, coletaCompleta: resultado.coletaCompleta, resumo: resultado.resumo }, null, 2));
  if (!resultado.coletaCompleta) process.exitCode = 1;
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { maiorJanelaLayoutShifts, resumirAmostras, paginas, perfis };
