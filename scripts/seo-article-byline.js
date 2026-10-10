const cheerio = require("cheerio");
const { authorName } = require("./seo-identity");

function gerarAutoriaVisivel() {
  const nome = authorName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p class="article-byline" style="font-size:0.95rem;line-height:1.6;margin:0.5rem 0 1rem">Respons&aacute;vel pelo site: <a href="/sobre.html" rel="author">${nome}</a>. Conte&uacute;do produzido com apoio de IA. <a href="/sobre.html#criterios-editoriais">Crit&eacute;rios editoriais</a>.</p>`;
}

function inserirAutoriaVisivel(html) {
  const $ = cheerio.load(html, { sourceCodeLocationInfo: true });
  const titulo = $("main > h1");
  const corpo = $(".article-body");
  const existente = $(".article-byline");
  const local = titulo[0]?.sourceCodeLocation;
  if (titulo.length !== 1 || corpo.length !== 1 || !local?.endTag ||
      !corpo[0].sourceCodeLocation || local.endOffset > corpo[0].sourceCodeLocation.startOffset) {
    throw new Error("Autoria visivel exige titulo unico antes do corpo: backfill interrompido.");
  }
  const novo = gerarAutoriaVisivel();
  if (!existente.length) {
    const eol = html.slice(local.endOffset).startsWith('\r\n') ? '\r\n' : '\n';
    return `${html.slice(0, local.endOffset)}${eol}${novo}${html.slice(local.endOffset)}`;
  }
  if (existente.length !== 1 || !existente.is("p") || !titulo.next().is(existente) || !existente[0].sourceCodeLocation?.endTag) {
    throw new Error("Autoria visivel fora do local esperado: backfill interrompido.");
  }
  const trecho = existente[0].sourceCodeLocation;
  const entre = html.slice(local.endOffset, trecho.startOffset);
  const separador = entre === '\n' && html.slice(trecho.endOffset).startsWith('\r\n') ? '\r\n' : entre;
  return `${html.slice(0, local.endOffset)}${separador}${novo}${html.slice(trecho.endOffset)}`;
}

function avaliarAutoriaVisivel($) {
  const linha = $(".article-byline");
  const esperado = cheerio.load(gerarAutoriaVisivel(), null, false);
  return linha.length === 1 && linha.is("main > h1 + p.article-byline") &&
    linha.text() === esperado("p").text() && linha.find("a").length === 2 &&
    linha.find('a[rel="author"][href="/sobre.html"]').text() === authorName &&
    linha.find('a[href="/sobre.html#criterios-editoriais"]').length === 1 &&
    !linha.is("[hidden], [aria-hidden=true]") && linha.attr("style") === esperado("p").attr("style");
}

module.exports = { gerarAutoriaVisivel, inserirAutoriaVisivel, avaliarAutoriaVisivel };
