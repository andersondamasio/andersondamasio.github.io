const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const cheerio = require("cheerio");

function capturarAcervo(root = process.cwd()) {
  const titulos = JSON.parse(fs.readFileSync(path.join(root, "titulos.json"), "utf8"));
  const registros = {};
  for (const item of titulos) {
    if (!item.url || item.localizacao?.estado === "pendente" || registros[item.url]) continue;
    if (!/^artigos\/[a-z0-9/-]+\.html$/.test(item.url)) throw new Error(`URL fora do acervo: ${item.url}`);
    const $ = cheerio.load(fs.readFileSync(path.join(root, item.url), "utf8"));
    const corpo = $(".article-body").first().clone();
    if (!corpo.length) throw new Error(`Corpo nao encontrado: ${item.url}`);
    corpo.find("section.article-validation, section.article-usefulness").remove();
    registros[item.url] = {
      corpo: createHash("sha256").update(corpo.html().replace(/\r\n/g, "\n").replace(/>\s+</g, "><").trim()).digest("hex"),
      titulo: $("h1").first().text(),
      canonical: $("link[rel=canonical]").attr("href"),
      robots: $("meta[name=robots]").attr("content"),
      publicado: $("meta[property='article:published_time']").attr("content"),
      modificado: $("meta[property='article:modified_time']").attr("content")
    };
  }
  return registros;
}

function comparar(antes, depois) {
  return [...new Set([...Object.keys(antes), ...Object.keys(depois)])]
    .filter(url => JSON.stringify(antes[url]) !== JSON.stringify(depois[url]));
}

if (require.main === module) {
  const arquivo = path.join(".editorial", "antes-migracao-templates.json");
  try {
    const atual = capturarAcervo();
    fs.mkdirSync(".editorial", { recursive: true });
    if (process.argv.includes("--capture")) {
      fs.writeFileSync(arquivo, JSON.stringify(atual), { flag: "wx" });
      console.log(`Linha de base preservada para ${Object.keys(atual).length} artigos.`);
    } else {
      const antes = JSON.parse(fs.readFileSync(arquivo, "utf8"));
      const alterados = comparar(antes, atual);
      const resultado = { verificadoEm: new Date().toISOString(), artigos: Object.keys(atual).length,
        aceita: !alterados.length, alterados, escopo: "corpo sem blocos gerados, H1, canonical, robots e datas" };
      fs.writeFileSync(path.join(".editorial", "validacao-migracao-templates.json"), JSON.stringify(resultado, null, 2));
      console.log(JSON.stringify(resultado, null, 2));
      if (!resultado.aceita) process.exitCode = 1;
    }
  } catch (erro) { console.error(erro.message); process.exitCode = 1; }
}

module.exports = { capturarAcervo, comparar };
