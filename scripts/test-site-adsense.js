const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const { normalizarAdsense, paginaComAdsense, publisherId, scriptUrl, snippet, validarAdsense } = require('./site-adsense');
const { aplicarLayoutSite } = require('./site-presentation');

const corpo = '<div class="article-body"><p>Texto &amp; limites.</p><pre><code>if (a &lt; b) {\n  exemplo();\n}</code></pre></div>';
function pagina(file, head = '', body = corpo) {
  return `<!doctype html><html><head><meta charset="UTF-8"><title>Exemplo</title><meta name="robots" content="index, follow"><link rel="canonical" href="https://www.andersondamasio.com.br/${file === 'index.html' ? '' : file}">${head}</head><body><header><nav></nav></header><main><h1>Exemplo</h1>${body}</main><footer><nav></nav></footer></body></html>`;
}

test('um script oficial async no head em paginas de conteudo, preservando todo o restante', () => {
  for (const file of ['index.html', 'sobre.html', 'guias.html', 'artigos/arquitetura/exemplo.html']) {
    for (const ending of ['\n', '\r\n']) {
      const original = pagina(file, '<script type="application/ld+json">{"dateModified":"2026-01-01"}</script>').replace(/\n/g, ending);
      const result = normalizarAdsense(original, file);
      assert.equal(result.replace(snippet, ''), original);
      assert.equal(normalizarAdsense(result, file), result);
      assert.deepEqual(validarAdsense(cheerio.load(result), file), []);
      assert.equal(cheerio.load(result)('head script[src]').attr('src'), scriptUrl);
    }
  }
});

test('normaliza duplicatas, publisher incorreto e loader legado no body sem tocar nos outros scripts', () => {
  const file = 'artigos/exemplo.html';
  const antigo = '<script src="//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-0000000000000000"></script>';
  const terceiro = '<script src="https://example.org/adsbygoogle.js"></script>';
  const original = pagina(file, antigo + terceiro, antigo + corpo + snippet);
  const result = normalizarAdsense(original, file);
  assert.equal(result, pagina(file, terceiro + snippet));
  assert.deepEqual(validarAdsense(cheerio.load(result), file), []);
});

test('paginas utilitarias e listagens ficam sem anuncios', () => {
  for (const file of ['contato.html', 'obrigado.html', 'politica.html', 'termos.html', 'artigo.html', 'index2.html', 'arquivo/index.html', 'artigos/index.html', 'artigos/cloud.html']) {
    const original = pagina(file, '', '<p>Pagina utilitaria.</p>');
    assert.equal(normalizarAdsense(original, file), original);
    assert.equal(normalizarAdsense(pagina(file, snippet, '<p>Pagina utilitaria.</p>'), file), original);
    assert.deepEqual(validarAdsense(cheerio.load(original), file), []);
  }
});

test('noindex, redirecionamentos, canonical divergente e conteudo vazio nao recebem anuncios', () => {
  const file = 'artigos/exemplo.html';
  for (const original of [
    pagina(file).replace('index, follow', 'noindex, follow'),
    pagina(file).replace('index, follow', 'none'),
    pagina(file, '<meta name="googlebot" content="noindex">'),
    pagina(file, '<meta http-equiv="refresh" content="0;url=/">'),
    pagina(file).replace(`/${file}">`, '/outro.html">'),
    pagina(file, '', '<div class="article-body"></div>')
  ]) {
    assert.equal(paginaComAdsense(cheerio.load(original), file), false);
    assert.equal(normalizarAdsense(original, file), original);
    assert.equal(normalizarAdsense(original.replace('</head>', snippet + '</head>'), file), original);
  }
});

test('produto independente e nao HTML permanecem intactos; script dentro do artigo bloqueia edicao', () => {
  for (const file of ['beijaoupassa/index.html', 'titulos.json']) {
    const original = pagina(file, snippet);
    assert.equal(normalizarAdsense(original, file), original);
  }
  assert.throws(() => normalizarAdsense(pagina('artigos/exemplo.html', '', `<div class="article-body">${snippet}</div>`), 'artigos/exemplo.html'), /corpo editorial/);
});

test('gerador comum aplica a regra, preserva corpo e permanece idempotente', () => {
  for (const file of ['index.html', 'sobre.html', 'guias.html', 'artigos/exemplo.html', 'contato.html']) {
    const result = aplicarLayoutSite(pagina(file, snippet), file);
    assert.equal(aplicarLayoutSite(result, file), result);
    assert.ok(result.includes(corpo));
    assert.deepEqual(validarAdsense(cheerio.load(result), file), []);
  }
});

test('auditoria detecta ausencia, duplicacao, atributos incorretos e paginas excluidas', () => {
  const file = 'index.html';
  for (const html of [pagina(file), pagina(file, snippet + snippet), pagina(file, snippet.replace(' async', '')), pagina(file, snippet.replace('anonymous', 'use-credentials')), pagina(file, snippet.replace(publisherId, 'pub-0')), pagina(file, '', snippet + corpo)]) {
    assert.ok(validarAdsense(cheerio.load(html), file).length);
  }
  assert.ok(validarAdsense(cheerio.load(pagina('contato.html', snippet)), 'contato.html').length);
});

test('ads.txt autoriza somente o mesmo publisher usado pelo gerador', () => {
  const ads = fs.readFileSync(path.join(__dirname, '..', 'ads.txt'), 'utf8');
  assert.equal(ads.trim(), `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0`);
});
