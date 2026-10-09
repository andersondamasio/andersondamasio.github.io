const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const cheerio = require("cheerio");
const { siteUrl } = require("./seo-identity");

function digest(text) {
  return createHash("sha256").update(String(text).replace(/\r\n/g, "\n")).digest("hex");
}

function prepararVerificacao({ ler, revisao }) {
  if (!/^[a-f0-9]{40}$/.test(revisao)) throw new Error("Informe a revisao Git completa esperada.");
  const registros = JSON.parse(ler("titulos.json"));
  const recentes = registros.filter(item => /^artigos\/[a-z0-9/-]+\.html$/.test(item.url || ""))
    .sort((a, b) => String(b.dataISO || b.data || "").localeCompare(String(a.dataISO || a.data || "")))
    .slice(0, 3).map(item => item.url);
  if (!recentes.length) throw new Error("Nenhum artigo recente com URL explicita para verificar.");
  const home = cheerio.load(ler("index.html"));
  let arquivosNavegacao = [];
  if (home('a[href="/arquivo/index.html"]').length) {
    const arquivo = cheerio.load(ler("arquivo/index.html"));
    const meses = arquivo('a[href]').map((_, el) => arquivo(el).attr("href")).get().filter(href => /^\/arquivo\/\d{4}-\d{2}\.html$/.test(href));
    if (!meses.length) throw new Error("Arquivo cronologico sem meses para verificar.");
    arquivosNavegacao = [...new Set(["artigos/index.html", "arquivo/index.html", meses[0].slice(1), meses.at(-1).slice(1)])];
  }
  const arquivos = ["index.html", "sobre.html", "sitemap.xml", "rss.xml", "robots.txt", "ads.txt", ...recentes, ...arquivosNavegacao];
  return { revisao, recentes, arquivosNavegacao, arquivos: arquivos.map(arquivo => ({ arquivo, hash: digest(ler(arquivo)) })) };
}

async function verificarPublicacao({ esperado, fetchImpl = fetch, baseUrl = siteUrl, tentativas = 4, intervaloMs = 15000, esperar = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!Number.isInteger(tentativas) || tentativas < 1 || tentativas > 10) throw new Error("Tentativas devem estar entre 1 e 10.");
  let resultado;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const paginas = new Map();
    const verificacoes = [];
    for (const { arquivo, hash } of esperado.arquivos) {
      const url = new URL(arquivo === "index.html" ? "/" : `/${arquivo}`, baseUrl).href;
      try {
        const resposta = await fetchImpl(url, { signal: AbortSignal.timeout(20000), headers: { "Cache-Control": "no-cache" }, redirect: "follow" });
        const texto = await resposta.text();
        paginas.set(arquivo, texto);
        const hashAtual = digest(texto);
        verificacoes.push({ arquivo, url, status: resposta.status, hashEsperado: hash, hashAtual, aceita: resposta.status === 200 && hash === hashAtual });
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
    for (const arquivo of ["index.html", "sobre.html", ...esperado.recentes, ...(esperado.arquivosNavegacao || [])]) {
      const $ = cheerio.load(paginas.get(arquivo) || "");
      const canonical = new URL(arquivo === "index.html" ? "/" : `/${arquivo}`, baseUrl).href;
      if ($("link[rel='canonical']").attr("href") !== canonical) problemas.push(`Canonical incorreto: ${arquivo}`);
      if (!$('title').text().trim() || !$('h1').text().trim()) problemas.push(`Titulo/H1 ausente: ${arquivo}`);
      if (/noindex/i.test($("meta[name='robots']").attr("content") || "")) problemas.push(`Noindex inesperado: ${arquivo}`);
      if (esperado.arquivosNavegacao?.includes(arquivo) && !locais.includes(canonical)) problemas.push(`Arquivo ausente do sitemap: ${arquivo}`);
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
    const esperado = prepararVerificacao({ ler, revisao });
    const resultado = await verificarPublicacao({ esperado });
    fs.mkdirSync(".editorial", { recursive: true });
    fs.writeFileSync(path.join(".editorial", "deploy-verification.json"), `${JSON.stringify(resultado, null, 2)}\n`);
    console.log(JSON.stringify(resultado, null, 2));
    if (!resultado.aceita) process.exitCode = 1;
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { digest, prepararVerificacao, verificarPublicacao };
