const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const { hashCorpoEditorial } = require('./seo-helpful-content');
const { hashArquivo, hashRegistros } = require('./article-lifecycle');
const root = path.join(__dirname, '..');
const ler = p => fs.readFileSync(path.join(root, p), 'utf8');
const relatorio = JSON.parse(ler('dados/editorial/curadoria-analogias-2026-10.json'));
const manifesto = JSON.parse(ler('dados/indexacao.json'));
const cadastro = JSON.parse(ler('titulos.json'));

test('curadoria contextual tem decisoes individuais, sem inventar metricas ou aprovacao humana', () => {
  assert.equal(relatorio.revisaoHumana, false);
  assert.equal(relatorio.metricasGoogle, null);
  assert.equal(relatorio.linksExternosConhecidos, null);
  assert.equal(new Set(relatorio.artigos.map(a => a.url)).size, 13);
  assert.deepEqual(Object.fromEntries(['atualizar', 'noindex', 'retirar'].map(acao =>
    [acao, relatorio.artigos.filter(a => a.acao === acao).length])), { atualizar: 3, noindex: 4, retirar: 6 });
  for (const a of relatorio.artigos) {
    const decisao = manifesto.decisoes.find(d => d.url === a.url);
    assert.equal(decisao.acao, a.acao);
    assert.equal(decisao.motivo, a.motivo);
    assert.equal(decisao.evidencia, a.evidencia);
    assert.ok(!manifesto.protegidas.includes(a.url));
  }
});

test('correcoes mantem URL e publicacao, datam a revisao e vinculam trechos as fontes', () => {
  for (const a of relatorio.artigos.filter(a => a.acao === 'atualizar')) {
    const $ = cheerio.load(ler(a.url));
    const r = cadastro.find(r => r.url === a.url);
    assert.equal(r.data, a.antes.data);
    assert.equal(r.revisaoHumana, undefined);
    assert.equal(r.correcaoEditorial.revisaoHumana, false);
    assert.equal(r.seo.modifiedAt, relatorio.em);
    assert.equal($('.nota-atualizacao time').attr('datetime'), relatorio.em);
    assert.equal($('h1').text(), a.depois.titulo);
    assert.equal($('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.url}`);
    assert.equal(hashCorpoEditorial($('.article-body').html()), a.depois.corpoHash);
    assert.notEqual(a.antes.corpoHash, a.depois.corpoHash);
    assert.doesNotMatch($('meta[name=robots]').attr('content'), /noindex/);
    for (const e of a.evidencias) {
      assert.equal($(e.seletor).length, 1);
      assert.equal(hashCorpoEditorial($(e.seletor).html()), e.textoHash);
      const fontes = $(e.seletor).find('a[href]').map((_, el) => $(el).attr('href')).get();
      for (const fonte of e.fontes || [e.fonte]) assert.ok(fontes.includes(fonte));
    }
    assert.equal($('.contribuicao-editorial').length, 1);
    assert.equal($('.limites-editoriais').length, 1);
  }
});

test('noindex preserva corpo e data, mas deixa sitemap e RSS', () => {
  const sitemap = cheerio.load(ler('sitemap.xml'), { xmlMode: true });
  const rss = cheerio.load(ler('rss.xml'), { xmlMode: true });
  const urls = [...sitemap('loc').map((_, e) => sitemap(e).text()).get(), ...rss('item link').map((_, e) => rss(e).text()).get()];
  for (const a of relatorio.artigos.filter(a => a.acao === 'noindex')) {
    const $ = cheerio.load(ler(a.url));
    assert.match($('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(hashCorpoEditorial($('.article-body').html()), a.antes.corpoHash);
    assert.equal(cadastro.find(r => r.url === a.url).data, a.antes.data);
    assert.ok(!urls.includes(`https://www.andersondamasio.com.br/${a.url}`));
  }
});

test('retiradas possuem copias recuperaveis conferidas e nao geram redirecionamento irrelevante', () => {
  for (const a of relatorio.artigos.filter(a => a.acao === 'retirar')) {
    const d = manifesto.decisoes.find(d => d.url === a.url);
    const backup = JSON.parse(ler(a.arquivoRecuperavel));
    assert.equal(backup.url, a.url);
    assert.equal(hashRegistros(backup.registros), d.registrosHash);
    assert.equal(hashArquivo(backup.arquivos[0].html), d.arquivoHash);
    assert.equal(hashCorpoEditorial(cheerio.load(backup.arquivos[0].html)('.article-body').html()), a.antes.corpoHash);
    assert.ok(!fs.existsSync(path.join(root, a.url)));
    assert.ok(!cadastro.some(r => r.url === a.url));
    assert.equal(a.destinoEquivalente, null);
    assert.equal(d.destino, undefined);
  }
});
