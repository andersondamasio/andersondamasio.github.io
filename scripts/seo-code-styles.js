const cheerio = require("cheerio");

const estilosCodigoInline = ".article-body code { overflow-wrap: anywhere; } .article-body pre code { overflow-wrap: normal; }";
const paddingBlocoCodigo = "3rem 1rem 1rem";
const estilosBlocoLegado = ".article-body pre { box-sizing: border-box; max-width: 100%; overflow-x: auto; padding: 1rem; background: var(--pre-bg, #f4f4f4); color: var(--pre-color, #222); border-radius: 4px; }";

function aplicarEstilosBlocoLegado(html) {
  if (!/<pre\b/i.test(html)) return html;
  const $ = cheerio.load(html);
  if (!$(".article-body pre").length) return html;
  // Os templates atuais ja definem pre; o fallback atende o HTML legado sem essa regra.
  if ($("head style").toArray().some(el => /\bpre\s*\{/i.test($(el).text()))) return html;
  return html.replace(/<\/style>/i, `${estilosBlocoLegado}\n</style>`);
}

function aplicarEstilosCodigoInline(html) {
  if (html.includes(estilosCodigoInline) || !/<code\b/i.test(html)) return html;
  const $ = cheerio.load(html);
  const temCodigoInline = $(".article-body code").toArray().some(el => !$(el).parents("pre").length);
  if (!temCodigoInline) return html;
  return html.replace(/<\/style>/i, `${estilosCodigoInline}\n</style>`);
}

function aplicarEspacoBotaoCopiar(html) {
  if (!/<pre\b/i.test(html) || !html.includes(".copy-button")) return html;
  const $ = cheerio.load(html, { sourceCodeLocationInfo: true });
  if (!$(".article-body pre code").length) return html;
  for (const style of $("head style").toArray().reverse()) {
    const local = style.sourceCodeLocation;
    if (!local?.startTag || !local.endTag) continue;
    const antes = html.slice(local.startTag.endOffset, local.endTag.startOffset);
    const depois = antes.replace(/^pre \{[^}\r\n]*\}/gm, regra =>
      regra.replace(/padding: 1rem;/, `padding: ${paddingBlocoCodigo};`));
    if (antes !== depois) html = html.slice(0, local.startTag.endOffset) + depois + html.slice(local.endTag.startOffset);
  }
  return html;
}

module.exports = { estilosCodigoInline, aplicarEstilosCodigoInline, paddingBlocoCodigo, aplicarEspacoBotaoCopiar, estilosBlocoLegado, aplicarEstilosBlocoLegado };
