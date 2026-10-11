const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const cheerio = require('cheerio');
const { aplicarTemaSite, removerRecursosTema, controleTema } = require('./site-theme');

const script = fs.readFileSync(path.join(__dirname, 'theme-toggle.js'), 'utf8');
const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Teste</title><style>body { color: red }</style></head><body><button id="theme-toggle">Escuro</button><header><nav><a href="/">Inicio</a></nav></header><main><h1>Teste</h1><div class="article-body"><p>Texto &amp; codigo.</p><pre><code>  if (a &lt; b) {\n    teste();\n  }</code></pre></div></main><script src="https://www.andersondamasio.com.br/scripts/theme-toggle.js"></script></body></html>';

function ambiente(t, { dark = false, saved, blocked = false, legacyMedia = false, noMedia = false } = {}) {
  const dom = new JSDOM(`<html><head></head><body>${controleTema}</body></html>`, { url: 'https://example.org', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom;
  if (saved !== undefined) window.localStorage.setItem('theme', saved);
  let onMedia;
  const media = { matches: dark };
  media[legacyMedia ? 'addListener' : 'addEventListener'] = (...args) => { onMedia = args.at(-1); };
  if (!noMedia) window.matchMedia = () => media;
  if (blocked) Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  const select = window.document.getElementById('theme-select');
  return {
    window, select,
    theme: () => window.document.documentElement.dataset.theme,
    choose(value) { select.value = value; select.dispatchEvent(new window.Event('change')); },
    system(value) { media.matches = value; onMedia?.(); }
  };
}

test('tema e aplicado no head antes de existir um body', () => {
  let applied;
  const vm = require('node:vm');
  vm.runInNewContext(script, {
    document: { documentElement: { setAttribute: (_, v) => { applied = v; }, classList: { add() {} } },
      readyState: 'loading', getElementById: () => null, addEventListener() {}, body: null },
    window: { matchMedia: () => ({ matches: true, addEventListener() {} }), localStorage: { getItem: () => null }, addEventListener() {} }
  });
  assert.equal(applied, 'dark');
});

test('primeira visita acompanha sistema e suas mudancas sem salvar escolha implicita', t => {
  const a = ambiente(t, { dark: true });
  assert.equal(a.theme(), 'dark');
  assert.equal(a.select.value, 'system');
  assert.equal(a.window.localStorage.getItem('theme'), null);
  a.system(false); assert.equal(a.theme(), 'light');
});

test('escolha explicita tem prioridade, persiste e Sistema remove override', t => {
  const a = ambiente(t, { saved: 'light', dark: true });
  assert.equal(a.theme(), 'light');
  a.choose('dark'); assert.equal(a.window.localStorage.getItem('theme'), 'dark');
  a.system(false); assert.equal(a.theme(), 'dark');
  a.choose('system'); assert.equal(a.theme(), 'light');
  assert.equal(a.window.localStorage.getItem('theme'), null);
  a.system(true); assert.equal(a.theme(), 'dark');
});

test('preferencia antiga dark e reconhecida e valor invalido volta ao sistema', t => {
  assert.equal(ambiente(t, { saved: 'dark' }).theme(), 'dark');
  const a = ambiente(t, { saved: 'unexpected', dark: true });
  assert.equal(a.theme(), 'dark'); assert.equal(a.select.value, 'system');
});

test('storage bloqueado nao quebra renderizacao nem controle manual', t => {
  const a = ambiente(t, { blocked: true, dark: true });
  assert.equal(a.theme(), 'dark');
  a.choose('light'); assert.equal(a.theme(), 'light');
  a.choose('system'); assert.equal(a.theme(), 'dark');
});

test('troca em outra aba e limpeza do storage sincronizam sem interferir em outras chaves', t => {
  const a = ambiente(t);
  a.window.localStorage.setItem('theme', 'dark');
  a.window.dispatchEvent(new a.window.StorageEvent('storage', { key: 'theme', storageArea: a.window.localStorage }));
  assert.equal(a.theme(), 'dark'); assert.equal(a.select.value, 'dark');
  a.window.localStorage.removeItem('theme');
  a.window.dispatchEvent(new a.window.StorageEvent('storage', { key: 'other' }));
  assert.equal(a.theme(), 'dark');
  a.window.dispatchEvent(new a.window.StorageEvent('storage', { key: null }));
  assert.equal(a.theme(), 'light'); assert.equal(a.select.value, 'system');
});

test('fallback de media query antiga e ausencia de API', t => {
  const a = ambiente(t, { legacyMedia: true });
  a.system(true); assert.equal(a.theme(), 'dark');
  const b = ambiente(t, { noMedia: true });
  assert.equal(b.theme(), 'light'); b.choose('dark'); assert.equal(b.theme(), 'dark');
});

test('integracao preserva bytes do artigo, SEO e links, e e idempotente em LF e CRLF', () => {
  for (const entrada of [html, html.replace(/\n/g, '\r\n')]) {
    const novo = aplicarTemaSite(entrada, 'artigos/teste.html');
    const $ = cheerio.load(novo);
    assert.equal(aplicarTemaSite(novo, 'artigos/teste.html'), novo);
    assert.equal(removerRecursosTema(novo), removerRecursosTema(entrada));
    assert.equal($('#theme-toggle').length, 0);
    assert.equal($('head script[src="/scripts/theme-toggle.js"]').length, 1);
    assert.equal($('head > :last-child').attr('href'), '/scripts/site-theme.css');
    assert.equal($('head meta[charset]').next().attr('name'), 'color-scheme');
    assert.equal($('body > header select#theme-select option').length, 3);
    assert.equal($('label[for="theme-select"]').text(), 'TemaSistemaClaroEscuro');
    const corpo = entrada.match(/<div class="article-body">([\s\S]*?)<\/div>/)[1];
    assert.ok(novo.includes(corpo));
  }
});

test('aliases, conteudo de outro produto, JSON e HTML sem shell ficam intactos', () => {
  for (const file of ['titulos.json', 'beijaoupassa/politica-de-privacidade.html']) assert.equal(aplicarTemaSite(html, file), html);
  const alias = html.replace('<head>', '<head><meta http-equiv="refresh" content="0;url=/">');
  assert.equal(aplicarTemaSite(alias, 'alias.html'), alias);
  assert.equal(aplicarTemaSite('<html><head></head><body><p>Movido</p></body></html>', 'alias.html'), '<html><head></head><body><p>Movido</p></body></html>');
});

test('recusa remocao de elementos de tema dentro do conteudo editorial', () => {
  assert.throws(() => aplicarTemaSite(html.replace('<p>Texto', '<button id="theme-toggle">Exemplo</button><p>Texto'), 'artigos/teste.html'), /dentro do artigo/);
});

test('fallback CSS sem JavaScript tem as mesmas variaveis do modo escuro explicito', () => {
  const css = fs.readFileSync(path.join(__dirname, 'site-theme.css'), 'utf8');
  const manual = css.match(/html\[data-theme="dark"\]\s*\{([^}]+)\}/)[1];
  const automatico = css.match(/html:not\(\[data-theme="light"\]\):not\(\[data-theme="dark"\]\)\s*\{([^}]+)\}/)[1];
  assert.equal(manual.replace(/\s/g, ''), automatico.replace(/\s/g, ''));
});
