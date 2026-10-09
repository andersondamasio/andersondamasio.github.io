const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { siteUrl } = require("./seo-identity");

function caminhoLocal(href, origem) {
  try {
    const url = new URL(href, `${siteUrl}/${origem}`);
    if (url.origin !== siteUrl) return null;
    let local = decodeURIComponent(url.pathname).replace(/^\//, "");
    if (!local || local.endsWith("/")) local += "index.html";
    return local.endsWith(".html") ? local : null;
  } catch { return null; }
}

function montarGrafo(root) {
  const grafo = new Map();
  function visitar(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.name.startsWith(".") || item.name === "node_modules") continue;
      const arquivo = path.join(dir, item.name);
      if (item.isDirectory()) visitar(arquivo);
      else if (item.isFile() && item.name.endsWith(".html")) {
        const local = path.relative(root, arquivo).replace(/\\/g, "/");
        const $ = cheerio.load(fs.readFileSync(arquivo, "utf8"));
        const robots = $("meta[name='robots' i]").attr("content") || "";
        const links = new Set();
        if (!/nofollow/i.test(robots)) $("a[href]").each((_, a) => {
          if (/\bnofollow\b/.test($(a).attr("rel") || "")) return;
          const destino = caminhoLocal($(a).attr("href"), local);
          if (destino && destino !== local) links.add(destino);
        });
        grafo.set(local, { indexavel: !/noindex/i.test(robots), links });
      }
    }
  }
  visitar(root);
  return grafo;
}

function distancias(grafo, apenasIndexaveis = false) {
  const fila = ["index.html"];
  const resultado = new Map([["index.html", 0]]);
  for (let i = 0; i < fila.length; i++) {
    const origem = fila[i];
    for (const url of grafo.get(origem)?.links || []) {
      if (resultado.has(url) || !grafo.has(url) || (apenasIndexaveis && !grafo.get(url).indexavel)) continue;
      resultado.set(url, resultado.get(origem) + 1);
      fila.push(url);
    }
  }
  return resultado;
}

function medirNavegacao(root = process.cwd()) {
  const grafo = montarGrafo(root);
  const todos = distancias(grafo);
  const indexaveis = distancias(grafo, true);
  const cadastro = JSON.parse(fs.readFileSync(path.join(root, "titulos.json"), "utf8"));
  const registrosSemPagina = cadastro.filter(a => a.url && a.localizacao?.estado !== "pendente" && !grafo.has(a.url)).map(a => a.url);
  const urls = [...new Set(cadastro.filter(a => a.url && a.localizacao?.estado !== "pendente" && grafo.get(a.url)?.indexavel).map(a => a.url))];
  const artigos = urls.map(url => ({ url, profundidade: todos.get(url) ?? null, viaIndexaveis: indexaveis.get(url) ?? null }));
  const valores = artigos.map(a => a.profundidade).filter(n => n !== null).sort((a, b) => a - b);
  return {
    verificadoEm: new Date().toISOString(), paginas: grafo.size, artigos: artigos.length,
    resumo: { mediana: valores[Math.floor(valores.length / 2)] ?? null, p90: valores[Math.floor(valores.length * 0.9)] ?? null,
      maximo: valores.at(-1) ?? null, acimaDeCinco: valores.filter(n => n > 5).length,
      orfaos: artigos.filter(a => a.profundidade === null).length, semCaminhoIndexavel: artigos.filter(a => a.viaIndexaveis === null).length,
      acimaDeCincoIndexaveis: artigos.filter(a => a.viaIndexaveis !== null && a.viaIndexaveis > 5).length, registrosSemPagina: registrosSemPagina.length },
    registrosSemPagina,
    observacao: "Distancia no grafo HTML local, nao medida de rastreamento nem garantia de indexacao do Google.", urls: artigos
  };
}

if (require.main === module) {
  const baseline = process.argv.includes("--baseline");
  const arquivo = `.editorial/navegacao${baseline ? "-antes" : ""}.json`;
  if (baseline && fs.existsSync(arquivo)) throw new Error("Linha de base ja existe; nao sera sobrescrita.");
  const resultado = medirNavegacao();
  fs.mkdirSync(".editorial", { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify(resultado, null, 2), { flag: baseline ? "wx" : "w" });
  console.log(JSON.stringify({ ...resultado, urls: undefined, relatorio: arquivo }, null, 2));
  if (process.argv.includes("--strict") && (resultado.resumo.orfaos || resultado.resumo.semCaminhoIndexavel || resultado.resumo.acimaDeCinco || resultado.resumo.acimaDeCincoIndexaveis || resultado.resumo.registrosSemPagina)) process.exitCode = 1;
}

module.exports = { caminhoLocal, distancias, medirNavegacao };
