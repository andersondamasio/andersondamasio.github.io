const cheerio = require('cheerio');
const { siteUrl } = require('./seo-identity');

const publisherId = 'pub-3323198858252165';
const scriptUrl = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${publisherId}`;
const snippet = `<script async src="${scriptUrl}" crossorigin="anonymous"></script>`;

function paginaDoPerfil(arquivo) {
  return /\.html$/i.test(arquivo) && !arquivo.startsWith('beijaoupassa/');
}

function scriptsAdsense($) {
  return $('script[src]').toArray().filter(el => {
    try {
      const url = new URL($(el).attr('src'), siteUrl);
      return url.hostname === 'pagead2.googlesyndication.com' && url.pathname === '/pagead/js/adsbygoogle.js';
    } catch { return false; }
  });
}

function paginaComAdsense($, arquivo) {
  arquivo = arquivo.replace(/\\/g, '/');
  if (!paginaDoPerfil(arquivo) || !$('body > header').length || !$('body > main').length || $('meta[http-equiv="refresh" i]').length) return false;
  const robots = $('meta[name="robots" i], meta[name="googlebot" i]').toArray().map(el => $(el).attr('content') || '').join(',');
  if (/\b(noindex|none)\b/i.test(robots)) return false;
  const canonical = $('head link[rel="canonical" i]').attr('href');
  if (canonical !== new URL(arquivo === 'index.html' ? '/' : `/${arquivo}`, siteUrl).href) return false;
  // Listing-only, legal and form pages do not receive automatic ads.
  return ['index.html', 'sobre.html', 'guias.html'].includes(arquivo) ||
    (arquivo.startsWith('artigos/') && Boolean($('.article-body').text().trim()));
}

function normalizarAdsense(html, arquivo) {
  arquivo = arquivo.replace(/\\/g, '/');
  if (!paginaDoPerfil(arquivo)) return html;
  const $ = cheerio.load(html, { sourceCodeLocationInfo: true });
  const head = $('head')[0]?.sourceCodeLocation;
  if (!head?.endTag) return html;
  const edits = scriptsAdsense($).map(el => {
    if ($(el).closest('.article-body').length) throw new Error(`AdSense dentro do corpo editorial: ${arquivo}`);
    const loc = el.sourceCodeLocation;
    if (!loc?.endTag) throw new Error(`Script AdSense sem fechamento: ${arquivo}`);
    return { inicio: loc.startOffset, fim: loc.endOffset, texto: '' };
  });
  if (paginaComAdsense($, arquivo)) edits.push({ inicio: head.endTag.startOffset, fim: head.endTag.startOffset, texto: snippet });
  // Source offsets preserve article bytes, metadata, styles and other integrations.
  for (const edit of edits.sort((a, b) => b.inicio - a.inicio || b.fim - a.fim)) {
    html = html.slice(0, edit.inicio) + edit.texto + html.slice(edit.fim);
  }
  return html;
}

function validarAdsense($, arquivo) {
  arquivo = arquivo.replace(/\\/g, '/');
  if (!paginaDoPerfil(arquivo)) return [];
  const scripts = scriptsAdsense($);
  if (!paginaComAdsense($, arquivo)) return scripts.length ? ['Script em pagina nao elegivel'] : [];
  if (scripts.length !== 1) return [`Esperado um script, encontrados ${scripts.length}`];
  const el = scripts[0], errors = [];
  if (!$(el).closest('head').length) errors.push('Script fora do head');
  if ($(el).attr('src') !== scriptUrl) errors.push('URL ou publisher incorreto');
  if ($(el).attr('async') === undefined || $(el).attr('crossorigin') !== 'anonymous') errors.push('Atributos async/crossorigin incorretos');
  return errors;
}

module.exports = { normalizarAdsense, paginaComAdsense, publisherId, scriptsAdsense, scriptUrl, snippet, validarAdsense };
