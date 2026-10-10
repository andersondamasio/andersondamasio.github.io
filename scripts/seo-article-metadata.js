const cheerio = require("cheerio");

function limparTextoArtigo(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/^[-*#>\s]+/gm, " ")
    .replace(/\b(t[ií]tulo|resumo|introdu[cç][aã]o)\s*:/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contarPalavras(value) {
  const matches = limparTextoArtigo(value).match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

function contarPalavrasProsa(articleHtml) {
  const $ = cheerio.load(String(articleHtml || ""), null, false);
  $("pre, script, style, template, [hidden], .copy-button, section.article-validation, section.article-usefulness").remove();
  // Preserve inline words, separate blocks, and decode entities only once.
  $("br, hr").replaceWith(" ");
  $("p, div, section, article, h1, h2, h3, h4, h5, h6, li, dt, dd, blockquote, figcaption, tr, th, td")
    .prepend(" ").append(" ");
  return ($.root().text().match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu) || []).length;
}

function criarMetadadosArtigo({ category, articleHtml, publishedDate }) {
  const wordCount = contarPalavrasProsa(articleHtml);
  const published = publishedDate ? new Date(publishedDate) : null;
  const copyrightYear = published && Number.isFinite(published.getTime())
    ? published.getUTCFullYear() : undefined;

  return {
    ...(wordCount ? { wordCount } : {}),
    ...(category ? { about: { "@type": "Thing", name: category } } : {}),
    isAccessibleForFree: true,
    ...(copyrightYear !== undefined ? { copyrightYear } : {})
  };
}

function keywordsMetaContent(keywords) {
  const values = Array.isArray(keywords) ? keywords : [keywords];
  return values
    .map(value => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 10)
    .join(", ");
}

function artigoTemMetadadosCoerentes(item, contexto) {
  if (!item || !contexto || typeof contexto.articleHtml !== "string") return false;
  const esperado = criarMetadadosArtigo(contexto);
  // Local generation policy: no inferred entities or unreviewed keyword lists.
  return !Object.hasOwn(item, "keywords") && !Object.hasOwn(item, "mentions") &&
    item.wordCount === esperado.wordCount &&
    (esperado.about
      ? item.about?.["@type"] === "Thing" && item.about.name === esperado.about.name
      : item.about === undefined) &&
    item.isAccessibleForFree === true &&
    item.copyrightYear === esperado.copyrightYear &&
    Boolean(item.copyrightHolder);
}

module.exports = {
  artigoTemMetadadosCoerentes,
  contarPalavras,
  contarPalavrasProsa,
  criarMetadadosArtigo,
  keywordsMetaContent,
  limparTextoArtigo
};
