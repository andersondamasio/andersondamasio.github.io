const cheerio = require("cheerio");
const { createHash } = require("node:crypto");
const { normalizarFonteUrl } = require("./seo-source-citation");
const { authorName } = require("./seo-identity");
const { checklistObrigatorio } = require("./editorial-review");

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function hashCorpoEditorial(html) {
  const $ = cheerio.load(String(html || "").replace(/\r\n/g, "\n"), null, false);
  $("img").removeAttr("loading").removeAttr("decoding").removeAttr("fetchpriority");
  return createHash("sha256").update($.html().trim()).digest("hex");
}

function revisaoCorresponde(editorial, corpoArtigo) {
  const revisao = editorial?.revisaoHumana;
  return Boolean(revisao?.responsavel && Number.isFinite(Date.parse(revisao.aprovadaEm)) &&
    revisao.declaracao === "REVISEI INTEGRALMENTE" && revisao.hash === editorial.hash &&
    editorial.conteudoHash === hashCorpoEditorial(corpoArtigo) &&
    checklistObrigatorio.every(chave => revisao.checklist?.[chave] === true));
}

function dataLegivel(value) {
  return Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("pt-BR", {
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : "America/Sao_Paulo", dateStyle: "short"
  }).format(new Date(value)) : null;
}

function gerarSecoesConteudoUtil({ sourceUrl, sourceTitle, sourceDate, editorial, corpoArtigo = "" }) {
  const url = normalizarFonteUrl(sourceUrl);
  const revisado = revisaoCorresponde(editorial, corpoArtigo);
  const fonte = url ? `<a href="${escapeHtml(url)}" rel="noopener noreferrer">${escapeHtml(sourceTitle || url)}</a>` : "URL n&atilde;o cadastrada no acervo.";
  const dataFonte = dataLegivel(sourceDate);
  const outrasFontes = revisado ? (editorial.dossie?.fontes || []).filter(f => f.url !== sourceUrl && normalizarFonteUrl(f.url)) : [];
  return [
    '<section class="article-validation" data-editorial-status="' + (revisado ? "revisado" : "acervo-sem-revisao-registrada") + '" aria-labelledby="article-validation-title">',
    '<h2 id="article-validation-title">Fontes e responsabilidade editorial</h2>',
    `<p>Respons&aacute;vel pelo site: <a href="/sobre.html" rel="author">${escapeHtml(authorName)}</a>. Conte&uacute;do produzido com apoio de IA.</p>`,
    `<p><strong>Fonte principal:</strong> ${fonte}${dataFonte ? ` Data da fonte registrada: ${escapeHtml(dataFonte)}.` : ""}</p>`,
    ...outrasFontes.map(f => `<p><strong>Fonte complementar:</strong> <a href="${escapeHtml(f.url)}" rel="noopener noreferrer">${escapeHtml(f.titulo)}</a>.</p>`),
    revisado
      ? `<p><strong>Revis&atilde;o editorial:</strong> ${escapeHtml(editorial.revisaoHumana.responsavel)}, em ${dataLegivel(editorial.revisaoHumana.aprovadaEm)}.</p><p><strong>Limites:</strong> ${escapeHtml(editorial.dossie?.limites)}</p>`
      : '<p><strong>Status editorial:</strong> artigo do acervo sem registro de revis&atilde;o humana individual nesta vers&atilde;o. A indica&ccedil;&atilde;o da fonte n&atilde;o comprova cada afirma&ccedil;&atilde;o do texto.</p>',
    '<p><a href="/sobre.html#criterios-editoriais">Crit&eacute;rios editoriais</a> &middot; <a href="/contato.html">Sugerir uma corre&ccedil;&atilde;o</a></p>',
    '</section>'
  ].join("\n");
}

function removerSecoesConteudoUtil(html) {
  const $ = cheerio.load(html, { sourceCodeLocationInfo: true });
  const trechos = $("section.article-validation, section.article-usefulness").toArray()
    .filter(el => !$(el).parents("section.article-validation, section.article-usefulness").length)
    .map(el => el.sourceCodeLocation);
  if (trechos.some(t => !t?.endTag)) throw new Error("Bloco editorial sem fechamento: corrigir HTML antes do backfill.");
  let resultado = html;
  for (const trecho of trechos.sort((a, b) => b.startOffset - a.startOffset)) {
    resultado = resultado.slice(0, trecho.startOffset) + resultado.slice(trecho.endOffset);
  }
  return resultado;
}

function inserirSecoesConteudoUtil(html, options) {
  const semAntigas = removerSecoesConteudoUtil(html);
  const $ = cheerio.load(semAntigas, { sourceCodeLocationInfo: true });
  const corpo = $(".article-body").first();
  if (!corpo.length || !corpo[0].sourceCodeLocation?.endTag) throw new Error("Corpo do artigo sem fechamento: backfill interrompido.");
  const posicao = corpo[0].sourceCodeLocation.endOffset;
  const secoes = gerarSecoesConteudoUtil({ ...options, corpoArtigo: corpo.html() });
  return `${semAntigas.slice(0, posicao)}\n${secoes}\n${semAntigas.slice(posicao).replace(/^\s*/, "")}`;
}

function avaliarSecoesConteudoUtil($) {
  const secao = $(".article-validation");
  const status = secao.attr("data-editorial-status");
  return {
    validationOk: secao.length === 1 && ["revisado", "acervo-sem-revisao-registrada"].includes(status) &&
      secao.find('a[rel="author"][href="/sobre.html"]').length === 1 &&
      /fonte principal/i.test(secao.text()) && !/o que foi verificado/i.test(secao.text()),
    // Practical value belongs in the article, not in a repeated category checklist.
    usefulnessOk: $(".article-usefulness").length === 0
  };
}

module.exports = { avaliarSecoesConteudoUtil, gerarSecoesConteudoUtil, inserirSecoesConteudoUtil,
  removerSecoesConteudoUtil, hashCorpoEditorial, revisaoCorresponde };
