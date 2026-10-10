const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const cheerio = require("cheerio");
const { siteUrl } = require("./seo-identity");
const { hashArquivo } = require("./article-lifecycle");

function digest(text) {
  return createHash("sha256").update(String(text).replace(/\r\n/g, "\n")).digest("hex");
}

function digestBinario(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error('Verificacao de binario exige Buffer, sem decodificar como texto.');
  return createHash('sha256').update(bytes).digest('hex');
}

function prepararVerificacao({ ler, lerBinario, revisao }) {
  if (!/^[a-f0-9]{40}$/.test(revisao)) throw new Error("Informe a revisao Git completa esperada.");
  const registros = JSON.parse(ler("titulos.json"));
  const recentes = registros.filter(item => item.localizacao?.estado !== "pendente" && /^artigos\/[a-z0-9/-]+\.html$/.test(item.url || ""))
    .sort((a, b) => String(b.dataISO || b.data || "").localeCompare(String(a.dataISO || a.data || "")))
    .map(item => item.url);
  const selecionados = [];
  for (const arquivo of recentes) {
    const $ = cheerio.load(ler(arquivo));
    if (!/\bnoindex\b/i.test($("meta[name='robots']").attr("content") || "") && !$("meta[http-equiv='refresh']").length) selecionados.push(arquivo);
    if (selecionados.length === 3) break;
  }
  recentes.splice(0, recentes.length, ...selecionados);
  if (!recentes.length) throw new Error("Nenhum artigo recente com URL explicita para verificar.");
  const home = cheerio.load(ler("index.html"));
  let arquivosNavegacao = [];
  if (home('a[href="/arquivo/index.html"]').length) {
    const arquivo = cheerio.load(ler("arquivo/index.html"));
    const meses = arquivo('a[href]').map((_, el) => arquivo(el).attr("href")).get().filter(href => /^\/arquivo\/\d{4}-\d{2}\.html$/.test(href));
    if (!meses.length) throw new Error("Arquivo cronologico sem meses para verificar.");
    arquivosNavegacao = [...new Set(["artigos/index.html", "arquivo/index.html", meses[0].slice(1), meses.at(-1).slice(1)])];
  }
  let arquivosLeituras = [];
  if (home('a[href="/guias.html"]').length) {
    const guias = cheerio.load(ler("guias.html"));
    const destinos = guias('.reading-list a[href]').map((_, el) => guias(el).attr("href")).get();
    if (!destinos.length || destinos.some(url => !/^\/artigos\/[a-z0-9/-]+\.html$/.test(url))) throw new Error("Selecao de guias sem destinos validos para verificar.");
    arquivosLeituras = [...new Set(["guias.html", ...destinos.map(url => url.slice(1))])];
  }
  const arquivos = ["index.html", "sobre.html", "sitemap.xml", "rss.xml", "robots.txt", "ads.txt", ...recentes, ...arquivosNavegacao, ...arquivosLeituras];
  let controlaDocumentos = false;
  try { controlaDocumentos = Boolean(ler("_config.yml")); } catch { /* Older revisions predate the Pages publication policy. */ }
  const ausentes = controlaDocumentos ? ["EDITORIAL_OPERACAO", "SEO_MELHORIAS_REALIZADAS", "dados/humanizer-rules", "exemplos/reservoir-sampling/README", "exemplos/design-tokens/README", "exemplos/fila-cpp/README", "exemplos/health-checks/README"]
    .flatMap(nome => [`${nome}.md`, `${nome}.html`]) : [];
  let exemploHealth;
  try { exemploHealth = ler('exemplos/health-checks/HealthChecks.csproj'); } catch { /* The example is absent in older revisions. */ }
  if (exemploHealth) {
    for (const nome of ['HealthChecks.csproj', 'HealthExample.cs', 'Program.cs', 'global.json']) {
      const arquivo = `exemplos/health-checks/${nome}`;
      if (!ler(arquivo)?.trim()) throw new Error(`Arquivo do exemplo ausente: ${arquivo}`);
      arquivos.push(arquivo);
    }
    ausentes.push('exemplos/health-checks/bin/Release/net10.0/HealthChecks.dll', 'exemplos/health-checks/obj/project.assets.json');
  }
  let manifestoTexto;
  let exemploMetricas;
  try { exemploMetricas = ler('exemplos/metricas-exatas/medir.js'); } catch { /* Example absent in older revisions. */ }
  if (exemploMetricas) {
    for (const nome of ['medir.js', 'dados.json', 'executar.js', 'test.js']) {
      const arquivo = `exemplos/metricas-exatas/${nome}`;
      if (!ler(arquivo)?.trim()) throw new Error(`Arquivo do exemplo ausente: ${arquivo}`);
      arquivos.push(arquivo);
    }
    if (controlaDocumentos) ausentes.push('exemplos/metricas-exatas/README.md', 'exemplos/metricas-exatas/README.html');
  }
  let exemploEstado;
  try { exemploEstado = ler('exemplos/estado-versionado/aplicar.js'); } catch { /* Example absent in older revisions. */ }
  if (exemploEstado) {
    for (const nome of ['aplicar.js', 'dados.json', 'executar.js', 'test.js']) {
      const arquivo = `exemplos/estado-versionado/${nome}`;
      if (!ler(arquivo)?.trim()) throw new Error(`Arquivo do exemplo ausente: ${arquivo}`);
      arquivos.push(arquivo);
    }
    if (controlaDocumentos) ausentes.push('exemplos/estado-versionado/README.md', 'exemplos/estado-versionado/README.html');
  }
  let exemplosNativos;
  try { exemplosNativos = ler('exemplos/temporal/comparar.js'); } catch { /* Examples absent in older revisions. */ }
  if (exemplosNativos) {
    for (const arquivo of ['exemplos/temporal/comparar.js', 'exemplos/web-nativa/detalhes.txt']) {
      if (!ler(arquivo)?.trim()) throw new Error(`Arquivo do exemplo ausente: ${arquivo}`);
      arquivos.push(arquivo);
    }
  }
  const arquivosNoindex = [];
  try { manifestoTexto = ler("dados/indexacao.json"); } catch { /* Revisions before the indexation manifest are still verifiable. */ }
  if (manifestoTexto) {
    const manifesto = JSON.parse(manifestoTexto);
    arquivosNoindex.push(...manifesto.decisoes.filter(d => d.acao === "noindex").map(d => d.url));
    arquivos.push(...arquivosNoindex);
    for (const d of manifesto.decisoes.filter(d => ["retirar", "consolidar"].includes(d.acao))) {
      const origens = [d.url, ...(d.aliases || []).map(a => a.url)];
      if (d.acao === "retirar") ausentes.push(...origens);
      else arquivos.push(...origens, d.destino);
      ausentes.push(`dados/editorial/arquivados/${hashArquivo(`${d.url}\n${d.arquivoHash}`)}.json`);
    }
  }
  if (controlaDocumentos && /dados\/editorial\/arquivados/.test(ler("_config.yml"))) ausentes.push("dados/editorial/arquivados/historicos-2026-10.json");
  const verificaveis = [...new Set(arquivos)].map(arquivo => ({ arquivo, hash: digest(ler(arquivo)) }));
  if (controlaDocumentos && /^\s*-\s*_assets\/\s*$/m.test(ler('_config.yml'))) {
    if (!lerBinario) throw new Error('Leitor binario obrigatorio para verificar favicon.');
    verificaveis.push({ arquivo: 'favicon.ico', hash: digestBinario(lerBinario('favicon.ico')), binario: true });
    ausentes.push('_assets/brand-ad.png');
  }
  return { revisao, recentes, arquivosNavegacao, arquivosLeituras, arquivosNoindex, ausentes: [...new Set(ausentes)], arquivos: verificaveis };
}

async function verificarPublicacao({ esperado, fetchImpl = fetch, baseUrl = siteUrl, tentativas = 4, intervaloMs = 15000, esperar = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!Number.isInteger(tentativas) || tentativas < 1 || tentativas > 10) throw new Error("Tentativas devem estar entre 1 e 10.");
  let resultado;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const paginas = new Map();
    const verificacoes = [];
    for (const { arquivo, hash, binario } of esperado.arquivos) {
      const url = new URL(arquivo === "index.html" ? "/" : `/${arquivo}`, baseUrl).href;
      try {
        const resposta = await fetchImpl(url, { signal: AbortSignal.timeout(20000), headers: { "Cache-Control": "no-cache" }, redirect: "follow" });
        const conteudo = binario ? Buffer.from(await resposta.arrayBuffer()) : await resposta.text();
        if (!binario) paginas.set(arquivo, conteudo);
        const hashAtual = binario ? digestBinario(conteudo) : digest(conteudo);
        verificacoes.push({ arquivo, url, status: resposta.status, hashEsperado: hash, hashAtual, aceita: resposta.status === 200 && hash === hashAtual });
      } catch (error) {
        verificacoes.push({ arquivo, url, aceita: false, erro: error.message });
      }
    }
    for (const arquivo of esperado.ausentes || []) {
      const url = new URL(`/${arquivo}`, baseUrl).href;
      try {
        const resposta = await fetchImpl(url, { method: "HEAD", signal: AbortSignal.timeout(20000), headers: { "Cache-Control": "no-cache" }, redirect: "manual" });
        verificacoes.push({ arquivo, url, status: resposta.status, esperado: "nao publicado no site", aceita: [404, 410].includes(resposta.status) });
      } catch (error) {
        verificacoes.push({ arquivo, url, aceita: false, erro: error.message });
      }
    }
    const problemas = [];
    const sitemap = cheerio.load(paginas.get("sitemap.xml") || "", { xmlMode: true });
    const feed = cheerio.load(paginas.get("rss.xml") || "", { xmlMode: true });
    const home = cheerio.load(paginas.get("index.html") || "");
    const locais = sitemap("url > loc").map((_, el) => sitemap(el).text()).get();
    const itens = feed("item > link").map((_, el) => feed(el).text()).get();
    const linksHome = home("a[href]").map((_, el) => {
      try { return new URL(home(el).attr("href"), baseUrl).href; } catch { return ""; }
    }).get();
    for (const arquivo of esperado.recentes) {
      const url = new URL(`/${arquivo}`, baseUrl).href;
      if (!locais.includes(url)) problemas.push(`Artigo ausente do sitemap: ${arquivo}`);
      if (!itens.includes(url)) problemas.push(`Artigo ausente do RSS: ${arquivo}`);
      if (!linksHome.includes(url)) problemas.push(`Artigo ausente da home: ${arquivo}`);
    }
    for (const arquivo of new Set(["index.html", "sobre.html", ...esperado.recentes, ...(esperado.arquivosNavegacao || []), ...(esperado.arquivosLeituras || [])])) {
      const $ = cheerio.load(paginas.get(arquivo) || "");
      const canonical = new URL(arquivo === "index.html" ? "/" : `/${arquivo}`, baseUrl).href;
      if ($("link[rel='canonical']").attr("href") !== canonical) problemas.push(`Canonical incorreto: ${arquivo}`);
      if (!$('title').text().trim() || !$('h1').text().trim()) problemas.push(`Titulo/H1 ausente: ${arquivo}`);
      if (/noindex/i.test($("meta[name='robots']").attr("content") || "")) problemas.push(`Noindex inesperado: ${arquivo}`);
      if (esperado.arquivosNavegacao?.includes(arquivo) && !locais.includes(canonical)) problemas.push(`Arquivo ausente do sitemap: ${arquivo}`);
      if (esperado.arquivosLeituras?.includes(arquivo) && !locais.includes(canonical)) problemas.push(`Leitura selecionada ausente do sitemap: ${arquivo}`);
    }
    const descoberta = new Set(["index.html", ...(esperado.arquivosNavegacao || []), "guias.html"]);
    for (const arquivo of esperado.arquivosNoindex || []) {
      const $ = cheerio.load(paginas.get(arquivo) || "");
      const url = new URL(`/${arquivo}`, baseUrl).href;
      if ($("link[rel='canonical']").attr("href") !== url) problemas.push(`Canonical de noindex incorreto: ${arquivo}`);
      if (!/\bnoindex\b/i.test($("meta[name='robots' i]").attr("content") || "")) problemas.push(`Noindex esperado ausente: ${arquivo}`);
      if (locais.includes(url) || itens.includes(url)) problemas.push(`Noindex em sitemap/RSS: ${arquivo}`);
      for (const origem of descoberta) {
        const pagina = cheerio.load(paginas.get(origem) || "");
        const promovido = pagina("a[href]").toArray().some(a => {
          try {
            const destino = new URL(pagina(a).attr("href"), new URL(`/${origem}`, baseUrl));
            destino.search = "";
            destino.hash = "";
            return destino.href === url;
          }
          catch { return false; }
        });
        if (promovido) problemas.push(`Noindex promovido em ${origem}: ${arquivo}`);
      }
    }
    resultado = { revisaoEsperada: esperado.revisao, verificadoEm: new Date().toISOString(), tentativa, aceita: verificacoes.every(item => item.aceita) && !problemas.length, verificacoes, problemas };
    if (resultado.aceita) return resultado;
    if (tentativa < tentativas) await esperar(intervaloMs);
  }
  return resultado;
}

if (require.main === module) {
  (async () => {
    const revisao = process.env.EXPECTED_REVISION || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const ler = arquivo => execFileSync("git", ["show", `${revisao}:${arquivo}`], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
    const lerBinario = arquivo => execFileSync('git', ['show', `${revisao}:${arquivo}`], { maxBuffer: 20 * 1024 * 1024 });
    const esperado = prepararVerificacao({ ler, lerBinario, revisao });
    const resultado = await verificarPublicacao({ esperado });
    fs.mkdirSync(".editorial", { recursive: true });
    fs.writeFileSync(path.join(".editorial", "deploy-verification.json"), `${JSON.stringify(resultado, null, 2)}\n`);
    console.log(JSON.stringify(resultado, null, 2));
    if (!resultado.aceita) process.exitCode = 1;
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { digest, digestBinario, prepararVerificacao, verificarPublicacao };
