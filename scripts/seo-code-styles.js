const cheerio = require("cheerio");

const estilosCodigoInline = ".article-body code { overflow-wrap: anywhere; } .article-body pre code { overflow-wrap: normal; }";

function aplicarEstilosCodigoInline(html) {
  if (html.includes(estilosCodigoInline) || !/<code\b/i.test(html)) return html;
  const $ = cheerio.load(html);
  const temCodigoInline = $(".article-body code").toArray().some(el => !$(el).parents("pre").length);
  if (!temCodigoInline) return html;
  return html.replace(/<\/style>/i, `${estilosCodigoInline}\n</style>`);
}

module.exports = { estilosCodigoInline, aplicarEstilosCodigoInline };
