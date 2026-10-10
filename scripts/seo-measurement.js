const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const cheerio = require("cheerio");
const { siteUrl } = require("./seo-identity");
const { digest, prepararVerificacao } = require("./verify-deployment");

function validarUrlMedicao(valor) {
  const url = new URL(valor, `${siteUrl}/`);
  if (url.origin !== siteUrl || url.search || url.hash || url.username || url.password ||
      !(url.pathname === "/" || /^\/[a-z0-9/-]+\.html$/.test(url.pathname))) throw new Error(`URL fora do escopo da medicao: ${valor}`);
  return url.href;
}

function criarObservacao({ url, html, status, destino, headers, esperado, revisao, verificadoEm, erro = null }) {
  const $ = cheerio.load(html || "");
  const metaRobots = $("meta[name='robots']").attr("content") || null;
  const headerRobots = headers?.get("x-robots-tag") || null;
  const ok = status === 200 && html !== null;
  return {
    url, revisaoEsperada: revisao, verificadoEm, origem: "HTTP publico e HTML Git da revisao esperada",
    http: { status, destino: destino || null, erro },
    pagina: { canonical: ok ? $("link[rel='canonical']").attr("href") || null : null,
      title: ok ? $("title").text().trim() || null : null, h1: ok ? $("h1").first().text().trim() || null : null,
      metaRobots: ok ? metaRobots : null, headerRobots,
      permiteIndexacaoDeclarada: ok ? !/\bnoindex\b/i.test(`${metaRobots || ""},${headerRobots || ""}`) : null,
      correspondeAoGit: ok && typeof esperado === "string" ? digest(html) === digest(esperado) : null },
    google: { fonte: null, observadoEm: null, periodoInicio: null, periodoFim: null, ultimoRastreamento: null,
      indexacao: null, canonicalEscolhida: null, impressoes: null, cliques: null, ctr: null, posicaoMedia: null, consultas: null }
  };
}

async function capturarMedicao({ urls, revisao, lerEsperado, fetchImpl = fetch, agora = new Date() }) {
  const unicas = [...new Set(urls.map(validarUrlMedicao))];
  if (!unicas.length || unicas.length > 60) throw new Error("Medicao exige de uma a 60 URLs do site.");
  const observacoes = [];
  for (const url of unicas) {
    const arquivo = new URL(url).pathname === "/" ? "index.html" : new URL(url).pathname.slice(1);
    const esperado = lerEsperado(arquivo);
    let html = null, status = null, destino = null, headers = null, erro = null;
    try {
      const resposta = await fetchImpl(url, { signal: AbortSignal.timeout(20000), redirect: "follow", headers: { "Cache-Control": "no-cache" } });
      status = resposta.status;
      destino = resposta.url || url;
      headers = resposta.headers;
      html = await resposta.text();
    } catch { erro = "falha-de-rede-ou-timeout"; }
    observacoes.push(criarObservacao({ url, html, status, destino, headers, esperado, revisao, verificadoEm: agora.toISOString(), erro }));
  }
  const deployConfirmado = observacoes.every(o => o.pagina.correspondeAoGit === true);
  return { versao: 1, geradoEm: agora.toISOString(), revisaoEsperada: revisao, deployConfirmado,
    limites: "HTTP 200 e diretivas nao demonstram indexacao, posicionamento ou ausencia de penalizacao. Dados Google nao consultados permanecem null, nunca zero. Comparar periodos equivalentes apos novo rastreamento, com cautela para amostras pequenas.",
    checkpointsPropostos: deployConfirmado ? [2, 4, 8].map(semanas => ({ semanas, aPartirDe: new Date(agora.getTime() + semanas * 7 * 86400000).toISOString(),
      acao: "Conferir rastreamento, indexacao e desempenho por URL no Search Console; registrar origem e periodo. Sem automacao de lembrete criada." })) : [],
    observacoes };
}

if (require.main === module) (async () => {
  if (!process.argv.includes("--capture")) {
    console.log("Uso: node scripts/seo-measurement.js --capture [arquivo-json-com-urls]. EXPECTED_REVISION define a revisao Git; padrao HEAD. Nao consulta Search Console.");
    return;
  }
  const revisao = process.env.EXPECTED_REVISION || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const lerEsperado = arquivo => execFileSync("git", ["show", `${revisao}:${arquivo}`], { encoding: "utf8", maxBuffer: 20e6 });
  const lista = process.argv.slice(2).find(a => !a.startsWith("--"));
  const lerBinario = arquivo => execFileSync('git', ['show', `${revisao}:${arquivo}`], { maxBuffer: 20e6 });
  const urls = lista ? JSON.parse(fs.readFileSync(lista, "utf8")) : ["/", "/sobre.html", ...prepararVerificacao({ ler: lerEsperado, lerBinario, revisao }).recentes];
  const resultado = await capturarMedicao({ urls, revisao, lerEsperado });
  const pasta = path.join(process.cwd(), ".editorial", "medicoes");
  fs.mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, `${resultado.geradoEm.replace(/[:.]/g, "-")}-${revisao.slice(0, 12)}.json`);
  fs.writeFileSync(arquivo, `${JSON.stringify(resultado, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify({ arquivo, urls: urls.length, deployConfirmado: resultado.deployConfirmado, dadosGoogle: "nao consultados" }, null, 2));
  if (!resultado.deployConfirmado) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });

module.exports = { validarUrlMedicao, criarObservacao, capturarMedicao };
