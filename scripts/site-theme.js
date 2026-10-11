const cheerio = require('cheerio');

const controleTema = '<label class="theme-control" for="theme-select"><span>Tema</span><select id="theme-select" name="theme"><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></select></label>';
const scriptTema = '<script src="/scripts/theme-toggle.js"></script>';
const metaTema = '<meta name="color-scheme" content="light dark">';
const estiloTema = '<link rel="stylesheet" href="/scripts/site-theme.css">';

function recursoTema(elemento) {
  const url = elemento.attribs?.src || elemento.attribs?.href || '';
  try {
    const parsed = new URL(url, 'https://www.andersondamasio.com.br');
    return ['www.andersondamasio.com.br', 'andersondamasio.com.br'].includes(parsed.hostname) &&
      ['/scripts/theme-toggle.js', '/scripts/site-theme.css'].includes(parsed.pathname);
  } catch { return false; }
}

function localizarRecursosTema($) {
  const elementos = $('script[src], link[href]').toArray().filter(recursoTema)
    .concat($('#theme-toggle, label.theme-control, meta[name="color-scheme"]').toArray());
  return elementos.map(el => {
    if ($(el).closest('.article-body').length) throw new Error('Controle de tema dentro do artigo; atualizacao interrompida.');
    if (!el.sourceCodeLocation) throw new Error('Recurso de tema sem localizacao no HTML.');
    return el.sourceCodeLocation;
  }).sort((a, b) => b.startOffset - a.startOffset);
}

function removerRecursosTema(html) {
  const $ = cheerio.load(html, { sourceCodeLocationInfo: true });
  const trechos = localizarRecursosTema($);
  for (const trecho of trechos) html = html.slice(0, trecho.startOffset) + html.slice(trecho.endOffset);
  return html;
}

function aplicarTemaSite(html, arquivo = '') {
  if (!/\.html$/i.test(arquivo) || arquivo.replace(/\\/g, '/').startsWith('beijaoupassa/')) return html;
  // Redirects and retired pages have no navigation shell and keep their exact HTML.
  if (!/<header\b/i.test(html)) return html;
  const $ = cheerio.load(html, { sourceCodeLocationInfo: true });
  const head = $('head')[0]?.sourceCodeLocation;
  const header = $('body > header').first()[0]?.sourceCodeLocation;
  if (!head?.endTag || !header?.endTag || !$('body > header > nav').length || !$('main').length || $('meta[http-equiv="refresh"]').length) return html;
  const charset = $('head meta[charset]').first()[0]?.sourceCodeLocation;
  const alteracoes = localizarRecursosTema($).map(t => ({ pos: t.startOffset, fim: t.endOffset, valor: '' }));
  for (const [pos, valor] of [
    [charset?.endOffset || head.startTag.endOffset, metaTema + scriptTema],
    [head.endTag.startOffset, estiloTema],
    [header.endTag.startOffset, controleTema]
  ]) alteracoes.push({ pos, fim: pos, valor });
  alteracoes.sort((a, b) => b.pos - a.pos || b.fim - a.fim);
  let resultado = html;
  for (const { pos, fim, valor } of alteracoes) resultado = resultado.slice(0, pos) + valor + resultado.slice(fim);
  return resultado;
}

module.exports = { aplicarTemaSite, removerRecursosTema, recursoTema, controleTema };
