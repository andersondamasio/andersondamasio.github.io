const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const { JSDOM } = require('jsdom');
const { aplicarApresentacaoSite, aplicarLayoutSite } = require('./site-presentation');
const { gerarApresentacaoPerfil, gerarSobrePerfil, anosMinimosDeExperiencia } = require('./seo-profile');
const corpo = '<div class="article-body"><p>Texto &amp; exemplo.</p><pre><code>  if (a &lt; b) {\n    exemplo();\n  }</code></pre>' + [1, 2, 3, 4].map(n => `<h2${n === 1 ? ' id="existente"' : ''}>Secao ${n}</h2><p>Texto ${n}</p>`).join('') + '</div>';
const entrada = `<!doctype html><html><head><meta charset="UTF-8"><title>Artigo</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="https://www.andersondamasio.com.br/artigos/exemplo.html"></head><body><header><nav><a href="/index.html">Inicio</a></nav></header><main><h1>Artigo</h1>${corpo}<footer><nav><a href="/politica.html">Privacidade</a> | <a href="/politica.html">Politica</a></nav></footer></main></body></html>`;
const runtime = fs.readFileSync(path.join(__dirname, 'site-interactions.js'), 'utf8');
const cookies = fs.readFileSync(path.join(__dirname, 'cookies-banner.js'), 'utf8');

test('paginas principais mantem rodape completo e contato ligado a privacidade', () => {
  for (const file of ['sobre.html', 'contato.html', 'politica.html', 'termos.html', 'obrigado.html']) {
    const $ = cheerio.load(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { sourceCodeLocationInfo: true });
    assert.equal($('footer').length, 1, file);
    assert.ok($('footer')[0].sourceCodeLocation.endTag, `Rodape fechado: ${file}`);
    assert.equal($('footer nav a[href="/politica.html"]').length, 1, file);
    assert.equal($('#cookie-banner').closest('footer').length, 0, file);
    assert.match($('footer').text(), /Anderson Damasio/, file);
    if (file === 'contato.html') {
      assert.equal($('#contact-form').attr('aria-describedby'), 'contact-privacy');
      assert.equal($('#contact-privacy a').attr('href'), '/politica.html');
    }
    if (file === 'politica.html') {
      assert.match($('main').text(), /nome, e-mail e o conte\u00fado da mensagem/);
      assert.equal($('main a[href="https://formsubmit.co/privacy.pdf"]').length, 1);
      assert.doesNotMatch($('main').text(), /n\u00e3o coleta informa\u00e7\u00f5es pessoais diretamente|coleta dados an\u00f4nimos|garantir a prote\u00e7\u00e3o/);
    }
  }
});

test('home usa marca discreta e rodape sem chamada comercial; sobre permanece explicito', () => {
  const entradaHome = '<html><head><meta charset="UTF-8"><title>Anderson Damasio</title></head><body><header><nav><a href="/">Inicio</a></nav></header><main class="home-page">' + gerarApresentacaoPerfil(new Date('2026-10-11T12:00:00Z')) + '</main><footer><nav></nav></footer></body></html>';
  const saida = aplicarLayoutSite(entradaHome, 'index.html');
  assert.equal(aplicarLayoutSite(saida, 'index.html'), saida);
  const $ = cheerio.load(saida);
  assert.equal($('.site-brand').text(), '');
  assert.match($('.site-brand').attr('aria-label'), /Anderson Damasio/);
  assert.equal($('.profile-description').text(), 'Atuo no desenvolvimento de sistemas h\u00e1 mais de 20 anos.');
  assert.equal($('.profile-links a').length, 2);
  assert.equal($('.home-footer a[href="/contato.html"]').length, 1);
  assert.equal($('.home-footer a[href="https://www.linkedin.com/in/andersondamasio/"]').length, 1);
  assert.doesNotMatch($('main').text(), /desde 2005|contrata|servi\u00e7os/i);
  assert.match(cheerio.load(gerarSobrePerfil())('main, body').text(), /desde 2005/);
  assert.equal(cheerio.load(aplicarLayoutSite(entrada, 'sobre.html'))('.site-brand').text(), 'Anderson Damasio');
});

test('experiencia atualiza pelo ano brasileiro sem antecipar aniversario ou regredir fallback', t => {
  for (const [data, esperado] of [
    ['2026-10-11T12:00:00Z', 20], ['2027-01-01T02:59:59Z', 20],
    ['2027-01-01T03:00:00Z', 21], ['2028-06-01T00:00:00Z', 22], ['2025-10-01T00:00:00Z', 20]
  ]) {
    const dom = new JSDOM(`<main class="home-page">${gerarApresentacaoPerfil(new Date('2026-10-11T12:00:00Z'))}</main>`, { runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    dom.window.Date = class extends Date { constructor() { super(data); } };
    dom.window.eval(runtime);
    assert.equal(Number(dom.window.document.querySelector('[data-experience-start]').textContent), esperado);
    assert.equal(Math.max(20, anosMinimosDeExperiencia(new Date(data))), esperado);
  }
});

test('layout preserva corpo bruto e metadados e e idempotente inclusive apos tema', () => {
  for (const source of [entrada, entrada.replace(/\n/g, '\r\n')]) {
    const saida = aplicarLayoutSite(source, 'artigos/exemplo.html');
    assert.equal(aplicarLayoutSite(saida, 'artigos/exemplo.html'), saida);
    assert.ok(saida.includes(corpo.replace(/\n/g, source.includes('\r\n') ? '\r\n' : '\n')));
    const $ = cheerio.load(saida);
    assert.equal($('meta[name="robots"]').attr('content'), 'noindex,follow');
    assert.equal($('link[rel="canonical"]').attr('href'), 'https://www.andersondamasio.com.br/artigos/exemplo.html');
    assert.equal($('head link[href="/scripts/site-presentation.css"]').length, 1);
    assert.equal($('head script[src="/scripts/site-interactions.js"]').length, 1);
    assert.equal($('footer nav a[href="/politica.html"]').length, 1);
    assert.equal($('header a[aria-current]').attr('href'), '/artigos/index.html');
    assert.equal($('.article-breadcrumbs a').length, 2);
    assert.equal($('header #theme-select').length, 1);
    assert.equal($('header img').length, 0, 'Marca decorativa nao disputa a prioridade das imagens do artigo');
    assert.equal($('header .brand-mark[aria-hidden="true"]').length, 1);
  }
});

test('aliases, produto independente e arquivos nao HTML permanecem intactos', () => {
  for (const f of ['beijaoupassa/index.html', 'titulos.json']) assert.equal(aplicarLayoutSite(entrada, f), entrada);
  const alias = entrada.replace('<head>', '<head><meta http-equiv="refresh" content="0;url=/">');
  assert.equal(aplicarLayoutSite(alias, 'alias.html'), alias);
});

test('breadcrumb usa categoria existente no schema sem executar HTML ou URLs externas', () => {
  const schema = { '@type': 'BreadcrumbList', itemListElement: [{ name: 'Inicio', item: 'https://www.andersondamasio.com.br/' }, { name: 'Ruim', item: 'https://example.org/' }, { name: 'A & B', item: 'https://www.andersondamasio.com.br/artigos/arquitetura.html' }, { name: 'Atual', item: 'https://www.andersondamasio.com.br/artigos/exemplo.html' }] };
  const $ = cheerio.load(aplicarApresentacaoSite(entrada.replace('</head>', `<script type="application/ld+json">${JSON.stringify(schema)}</script></head>`), 'artigos/exemplo.html'));
  assert.deepEqual($('.article-breadcrumbs a').map((i, e) => $(e).attr('href')).get(), ['/', '/artigos/arquitetura.html']);
  assert.equal($('.article-breadcrumbs').text(), 'InicioA & B');
});

test('nao cria link de guias quando nao existe colecao e identifica pagina atual', () => {
  const $ = cheerio.load(aplicarApresentacaoSite(entrada, 'sobre.html', { guias: false }));
  assert.equal($('header a[href="/guias.html"]').length, 0);
  assert.equal($('header a[aria-current="page"]').attr('href'), '/sobre.html');
});

test('contato tem titulo curto e preserva formulario', () => {
  const original = entrada.replace(corpo, '<h2>Ou envie uma mensagem diretamente pelo formul\u00e1rio:</h2><form action="https://formsubmit.co/example"><textarea name="mensagem" required></textarea></form>');
  const $ = cheerio.load(aplicarApresentacaoSite(original, 'contato.html'));
  assert.equal($('main h2').text(), 'Envie uma mensagem');
  assert.equal($('textarea').is('[required]'), true);
  assert.equal($('form').attr('action'), 'https://formsubmit.co/example');
});

test('menu acessivel abre, fecha com Escape, clique externo e navegacao', t => {
  const dom = new JSDOM(aplicarLayoutSite(entrada, 'artigos/exemplo.html'), { url: 'https://example.org', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.eval(runtime);
  const d = dom.window.document, button = d.querySelector('.nav-toggle');
  assert.equal(button.hidden, false);
  button.click(); assert.equal(button.getAttribute('aria-expanded'), 'true');
  d.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  assert.equal(d.activeElement, button);
  button.click(); d.querySelector('h1').click(); assert.equal(button.getAttribute('aria-expanded'), 'false');
  button.click();
  d.querySelector('#site-navigation a').addEventListener('click', e => e.preventDefault());
  d.querySelector('#site-navigation a').click(); assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('sumario usa texto seguro, preserva IDs existentes e evita colisoes', t => {
  const html = aplicarLayoutSite(entrada.replace('<h1>', '<span id="secao-2"></span><h1>'), 'artigos/exemplo.html');
  const dom = new JSDOM(html, { url: 'https://example.org', runScripts: 'outside-only' });
  t.after(() => dom.window.close()); dom.window.eval(runtime);
  const d = dom.window.document;
  assert.equal(d.querySelector('.article-body h2').id, 'existente');
  assert.equal(d.querySelectorAll('.article-toc a').length, 4);
  assert.equal(d.querySelectorAll('.article-body h2')[1].id, 'secao-2-1');
  assert.equal(new Set([...d.querySelectorAll('[id]')].map(e => e.id)).size, d.querySelectorAll('[id]').length);
  assert.equal(d.querySelector('.article-toc').open, false);
  dom.window.eval(runtime); assert.equal(d.querySelectorAll('.article-toc').length, 1);
});

test('sumario nao e adicionado em textos curtos', t => {
  const dom = new JSDOM(entrada.replaceAll(/<h2[^>]*>.*?<\/h2>/g, ''), { runScripts: 'outside-only' });
  t.after(() => dom.window.close()); dom.window.eval(runtime);
  assert.equal(dom.window.document.querySelector('.article-toc'), null);
});

test('banner reserva altura real e remove reserva ao aceitar, inclusive sem ResizeObserver', t => {
  const dom = new JSDOM('<html><body><div id="cookie-banner"><button>Aceitar</button></div></body></html>', { url: 'https://example.org', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const d = dom.window.document, banner = d.querySelector('#cookie-banner');
  let height = 144;
  banner.getBoundingClientRect = () => ({ height });
  dom.window.eval(cookies); dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  assert.equal(d.documentElement.style.getPropertyValue('--cookie-space'), '144px');
  height = 170; dom.window.dispatchEvent(new dom.window.Event('resize'));
  assert.equal(d.documentElement.style.getPropertyValue('--cookie-space'), '170px');
  dom.window.aceitarCookies();
  assert.equal(banner.style.display, 'none');
  assert.equal(d.documentElement.style.getPropertyValue('--cookie-space'), '');
  assert.match(d.cookie, /cookieConsent=true/);
});

test('banner reconhece consentimento anterior e ausencia de elemento', t => {
  for (const html of ['<div id="cookie-banner"></div>', '<main>Artigo</main>']) {
    const dom = new JSDOM(html, { url: 'https://example.org', runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    dom.window.document.cookie = 'cookieConsent=true';
    dom.window.eval(cookies);
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    assert.equal(dom.window.document.documentElement.style.getPropertyValue('--cookie-space'), '');
    if (dom.window.document.querySelector('#cookie-banner')) assert.equal(dom.window.document.querySelector('#cookie-banner').style.display, 'none');
  }
});
