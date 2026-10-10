const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizarUrlComparacaoFonte: chave, normalizarFonteUrl, criarFonteSchema } = require('./seo-source-citation');

test('chave unifica rastreamento conhecido sem mudar URLs de citacao', () => {
  const url = 'https://EXAMPLE.org:443/artigo/?utm_source=feed&UTM_CAMPAIGN=noticia&fbclid=1&gclid=2&mc_cid=3&mc_eid=4&at_medium=RSS&at_campaign=rss&cmpid=5&guccounter=6#secao';
  assert.equal(chave(url), 'https://example.org/artigo');
  assert.equal(chave('https://example.org/artigo'), chave(url));
  assert.equal(chave(chave(url)), chave(url));
  assert.equal(normalizarFonteUrl(url), new URL(url).href.split('#')[0]);
  assert.equal(criarFonteSchema({ sourceUrl: url }).url, normalizarFonteUrl(url));
});

test('identificadores, idioma, versao, parametros desconhecidos e sua ordem permanecem', () => {
  for (const key of ['id', 'lang', 'version', 'page', 'q', 'ref', 'at_time']) {
    const a = `https://example.org/doc?${key}=1`;
    const b = `https://example.org/doc?${key}=2`;
    assert.notEqual(chave(a), chave(b));
    assert.equal(chave(a + '&utm_source=feed'), chave(a));
  }
  assert.notEqual(chave('https://example.org/doc?tag=a&tag=b'), chave('https://example.org/doc?tag=b&tag=a'));
  assert.equal(new URL(chave('https://example.org/doc?path=dir/')).searchParams.get('path'), 'dir/');
  assert.notEqual(chave('https://example.org/doc?path=dir/'), chave('https://example.org/doc?path=dir'));
});

test('codificacao da query e consistente com e sem parametros de rastreamento', () => {
  for (const query of ['path=dir/', 'q=a%20b', 'q=a+b', 'q=a%2Bb', 'q=~&tag=a&tag=b']) {
    const url = `https://example.org/doc?${query}`;
    assert.equal(chave(url), chave(url + '&utm_source=rss'));
    assert.equal(chave(chave(url)), chave(url));
    assert.deepEqual([...new URL(chave(url)).searchParams], [...new URL(url).searchParams]);
    assert.equal(normalizarFonteUrl(url), url);
  }
  assert.notEqual(chave('https://example.org/doc?q=a+b'), chave('https://example.org/doc?q=a%2Bb'));
});

test('comparacao conserva host, protocolo e caixa do caminho e recusa URL invalida', () => {
  assert.notEqual(chave('http://example.org/doc'), chave('https://example.org/doc'));
  assert.notEqual(chave('https://www.example.org/doc'), chave('https://example.org/doc'));
  assert.notEqual(chave('https://example.org/Doc'), chave('https://example.org/doc'));
  for (const url of [undefined, null, '', 'invalida', '/relativa', 'javascript:alert(1)', 'file:///doc', 'https://user:password@example.org/doc']) assert.equal(chave(url), null);
});
