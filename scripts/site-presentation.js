const fs = require('node:fs');
const cheerio = require('cheerio');
const { aplicarTemaSite, controleTema } = require('./site-theme');
const { siteUrl, authorSameAs } = require('./seo-identity');

const escapar = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function secaoAtual(arquivo) {
  if (arquivo === 'index.html') return '/index.html';
  if (/^(sobre|contato|guias)\.html$/.test(arquivo)) return `/${arquivo}`;
  if (/^(artigos\/|arquivo\/|index\d+\.html)/.test(arquivo)) return '/artigos/index.html';
  return null;
}

function linksNavegacao(guias) {
  return [['/index.html', 'In\u00edcio'], ['/artigos/index.html', 'Artigos'],
    ...(guias ? [['/guias.html', 'Guias']] : []), ['/sobre.html', 'Sobre'], ['/contato.html', 'Contato']];
}

function gerarCabecalho(arquivo, guias) {
  const atual = secaoAtual(arquivo);
  return `<header class="site-header"><a class="site-brand" href="/index.html" aria-label="Anderson Damasio, in\u00edcio"><span class="brand-mark" aria-hidden="true"></span>${arquivo === 'index.html' ? '' : '<span>Anderson Damasio</span>'}</a>
<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-navigation" hidden>Menu</button>
<nav id="site-navigation" aria-label="Navega\u00e7\u00e3o principal">${linksNavegacao(guias).map(([href, texto]) => `<a href="${href}"${href === atual ? ` aria-current="${arquivo === href.slice(1) ? 'page' : 'true'}"` : ''}>${texto}</a>`).join('')}</nav>
${controleTema}</header>`;
}

function gerarBreadcrumbs($) {
  let itens = [];
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const json = JSON.parse($(el).text());
      const nodes = Array.isArray(json) ? json : [json, ...(json['@graph'] || [])];
      const breadcrumb = nodes.find(n => n['@type'] === 'BreadcrumbList');
      if (breadcrumb) itens = breadcrumb.itemListElement || [];
    } catch { /* Metadata validation belongs to the SEO audit. */ }
  }
  const caminhos = itens.slice(0, -1).flatMap(item => {
    try {
      const url = new URL(typeof item.item === 'object' ? item.item['@id'] : item.item, siteUrl);
      if (url.origin !== siteUrl || typeof item.name !== 'string') return [];
      return [[url.pathname, item.name]];
    } catch { return []; }
  });
  const links = caminhos.length ? caminhos : [['/', 'In\u00edcio'], ['/artigos/index.html', 'Artigos']];
  return `<nav class="article-breadcrumbs" aria-label="Caminho do artigo"><ol>${links.map(([href, nome]) => `<li><a href="${escapar(href)}">${escapar(nome)}</a></li>`).join('')}</ol></nav>`;
}

function aplicarApresentacaoSite(html, arquivo, { guias = fs.existsSync('guias.html') || fs.existsSync('dados/leituras-selecionadas.json') } = {}) {
  arquivo = arquivo.replace(/\\/g, '/');
  if (!arquivo.endsWith('.html') || arquivo.startsWith('beijaoupassa/') || !/<header\b/i.test(html)) return html;
  const $ = cheerio.load(html, { sourceCodeLocationInfo: true });
  const header = $('body > header').first()[0]?.sourceCodeLocation;
  const head = $('head')[0]?.sourceCodeLocation;
  const main = $('body > main').first()[0]?.sourceCodeLocation;
  if (!header?.endTag || !head?.endTag || !main || $('meta[http-equiv="refresh"]').length) return html;
  const edits = [];
  function substituir(el, valor) {
    if ($(el).closest('.article-body').length) throw new Error('Apresentacao nao pode reescrever o corpo editorial.');
    const loc = el?.sourceCodeLocation;
    if (!loc) throw new Error('Elemento sem localizacao no HTML.');
    edits.push({ inicio: loc.startOffset, fim: loc.endOffset, valor });
  }
  substituir($('body > header')[0], gerarCabecalho(arquivo, guias));
  for (const el of $('link[href="/scripts/site-presentation.css"], script[src="/scripts/site-interactions.js"], .article-breadcrumbs, .article-toc, main > img[src="/favicon.ico"], main .profile-mark').toArray()) substituir(el, '');
  edits.push({ inicio: head.endTag.startOffset, fim: head.endTag.startOffset, valor: '<link rel="stylesheet" href="/scripts/site-presentation.css"><script defer src="/scripts/site-interactions.js"></script>' });
  if ($('.article-body').length) edits.push({ inicio: main.startTag.endOffset, fim: main.startTag.endOffset, valor: gerarBreadcrumbs($) });
  const footerHome = arquivo === 'index.html' ? $('body > footer')[0] : null;
  if (footerHome) substituir(footerHome, `<footer class="home-footer"><div class="home-footer-inner"><span class="brand-mark" aria-hidden="true"></span><nav class="footer-navigation" aria-label="Links do rodap\u00e9"><a href="/contato.html">Contato</a><a href="${authorSameAs[0]}" rel="me noopener noreferrer">LinkedIn</a><a href="/politica.html">Privacidade</a><a href="/termos.html">Termos</a></nav></div></footer>`);
  for (const nav of $('footer nav').toArray()) {
    if (footerHome && $(nav).closest('footer')[0] === footerHome) continue;
    if ($(nav).closest('.article-body').length) continue;
    const links = [...linksNavegacao(guias), ['/termos.html', 'Termos de Uso'], ['/politica.html', 'Pol\u00edtica de Privacidade']];
    substituir(nav, `<nav class="footer-navigation" aria-label="Links do rodap\u00e9">${links.map(([href, texto]) => `<a href="${href}">${texto}</a>`).join('')}</nav>`);
  }
  if (arquivo === 'contato.html') {
    const titulo = $('main h2').toArray().find(el => $(el).text().trim() === 'Ou envie uma mensagem diretamente pelo formul\u00e1rio:');
    if (titulo) substituir(titulo, '<h2>Envie uma mensagem</h2>');
  }
  // Edit only shell ranges. In particular, do not serialize article examples with Cheerio.
  edits.sort((a, b) => b.inicio - a.inicio || b.fim - a.fim);
  for (const { inicio, fim, valor } of edits) html = html.slice(0, inicio) + valor + html.slice(fim);
  return html;
}

const aplicarLayoutSite = (html, arquivo) => aplicarApresentacaoSite(aplicarTemaSite(html, arquivo), arquivo);
module.exports = { aplicarApresentacaoSite, aplicarLayoutSite, gerarCabecalho, secaoAtual };
