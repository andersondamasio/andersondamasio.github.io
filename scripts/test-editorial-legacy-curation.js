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

test('correcao de atribuicoes preserva publicacao e distingue fontes de propostas nao executadas', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-atribuicoes-2026-10.json'));
  assert.equal(lote.artigos.length, 8);
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.experimentosExecutados, false);
  assert.equal(lote.metricasGoogle, null);
  assert.equal(lote.linksExternosConhecidos, null);
  const corrigidos = lote.artigos.filter(a => a.acao === 'atualizar');
  assert.equal(corrigidos.length, 4);
  for (const a of corrigidos) {
    const $ = cheerio.load(ler(a.url));
    const r = cadastro.find(r => r.url === a.url);
    assert.equal(r.data, a.antes.data);
    assert.equal(r.revisaoHumana, undefined);
    assert.equal(r.correcaoEditorial.revisaoHumana, false);
    assert.equal(r.seo.modifiedAt, lote.em);
    assert.equal($('h1').text(), a.depois.titulo);
    assert.equal($('meta[name=description]').attr('content'), a.depois.descricao);
    assert.equal($('meta[property="article:published_time"]').attr('content'), a.antes.data);
    assert.equal($('.nota-atualizacao time').attr('datetime'), lote.em);
    assert.equal($('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.url}`);
    assert.doesNotMatch($('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(hashCorpoEditorial($('.article-body').html()), a.depois.corpoHash);
    assert.equal(manifesto.decisoes.find(d => d.url === a.url).conteudoHash, a.depois.corpoHash);
    assert.equal($('.contribuicao-editorial').length, 1);
    assert.match($('.limites-editoriais').text(), /não foi executado/);
    for (const e of a.evidencias) {
      assert.equal($(e.seletor).length, 1);
      assert.equal(hashCorpoEditorial($(e.seletor).html()), e.textoHash);
      assert.ok($(e.seletor).find('a').toArray().some(el => $(el).attr('href') === e.fonte));
    }
  }
  const green = cheerio.load(ler(corrigidos.find(a => a.url.includes('revolucao-verde')).url));
  assert.match(green('.fato-caso').text(), /Ludi Akue/);
  assert.match(green('.fato-caso').text(), /não uma experiência profissional de Anderson/);
  assert.doesNotMatch(green('.article-body').text(), /minha equipe|aprendi ao longo da minha jornada|6%/);
  const wiki = cheerio.load(ler(corrigidos.find(a => a.url.includes('wiki-perfeito')).url));
  assert.match(wiki('.fato-fundador').text(), /Ilia Pirozhenko/);
  assert.match(wiki('.fato-fundador').text(), /declaração do fundador/);
  assert.doesNotMatch(wiki('h1').text(), /como eu criei|250 mil/i);
  const busca = cheerio.load(ler(corrigidos.find(a => a.url.includes('chatgpt-a-revolucao')).url));
  assert.equal(busca('.article-body pre').length, 0);
  assert.doesNotMatch(busca('.article-body').text(), /OpenAIApi|GetAnswer|baseada em GPT-3/);
});

test('consolidacoes de nuvem e retiradas de carreira preservam copias e destinos equivalentes', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-atribuicoes-2026-10.json'));
  const ciclos = lote.artigos.filter(a => a.acao !== 'atualizar');
  assert.equal(ciclos.filter(a => a.acao === 'consolidar').length, 2);
  assert.equal(ciclos.filter(a => a.acao === 'retirar').length, 2);
  const sitemap = cheerio.load(ler('sitemap.xml'), { xmlMode: true });
  const urls = sitemap('loc').map((_, e) => sitemap(e).text()).get();
  for (const a of ciclos) {
    const d = manifesto.decisoes.find(d => d.url === a.url);
    assert.equal(d.acao, a.acao);
    assert.equal(d.motivo, a.motivo);
    assert.ok(!manifesto.protegidas.includes(a.url));
    assert.ok(!cadastro.some(r => r.url === a.url));
    assert.ok(!urls.includes(`https://www.andersondamasio.com.br/${a.url}`));
    const copia = JSON.parse(ler(a.arquivoRecuperavel));
    assert.equal(hashRegistros(copia.registros), d.registrosHash);
    assert.equal(hashArquivo(copia.arquivos[0].html), d.arquivoHash);
    assert.equal(hashCorpoEditorial(cheerio.load(copia.arquivos[0].html)('.article-body').html()), a.antes.corpoHash);
    for (const alias of d.aliases) assert.equal(hashArquivo(copia.arquivos.find(p => p.url === alias.url).html), alias.arquivoHash);
    for (const p of [a.url, ...d.aliases.map(b => b.url)]) {
      if (a.acao === 'retirar') {
        assert.ok(!fs.existsSync(path.join(root, p)));
        assert.equal(a.destinoEquivalente, null);
        assert.equal(d.destino, undefined);
      } else {
        const $ = cheerio.load(ler(p));
        assert.equal($('.article-body').length, 0);
        assert.equal($('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.destinoEquivalente}`);
        assert.match($('meta[name=robots]').attr('content'), /noindex/);
        assert.equal($('meta[http-equiv=refresh]').attr('content'), `0; url=https://www.andersondamasio.com.br/${a.destinoEquivalente}`);
        const destino = cheerio.load(ler(a.destinoEquivalente));
        assert.equal(hashCorpoEditorial(destino('.article-body').html()), d.destinoConteudoHash);
        assert.doesNotMatch(destino('meta[name=robots]').attr('content'), /noindex/);
        assert.equal(destino('meta[http-equiv=refresh]').length, 0);
      }
    }
  }
});

test('guias de backup preservam publicacao e indexacao, sem prometer testes ou vivencia inexistentes', () => {
  const lote = JSON.parse(ler('dados/editorial/correcoes-backups-2026-10.json'));
  assert.equal(lote.artigos.length, 2);
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.testesDeRecuperacaoExecutados, false);
  assert.equal(lote.metricasGoogle, null);
  for (const a of lote.artigos) {
    const $ = cheerio.load(ler(a.url));
    const r = cadastro.find(r => r.url === a.url);
    assert.equal(r.data, a.antes.data);
    assert.equal(r.revisaoHumana, undefined);
    assert.equal(r.correcaoEditorial.revisaoHumana, false);
    assert.equal(r.seo.modifiedAt, lote.em);
    assert.equal($('h1').text(), a.depois.titulo);
    assert.equal($('meta[name=description]').attr('content'), a.depois.descricao);
    assert.equal($('.nota-atualizacao time').attr('datetime'), lote.em);
    assert.equal($('meta[property="article:published_time"]').attr('content'), a.antes.data);
    assert.equal($('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.url}`);
    assert.doesNotMatch($('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(hashCorpoEditorial($('.article-body').html()), a.depois.corpoHash);
    assert.equal(manifesto.decisoes.find(d => d.url === a.url).conteudoHash, a.depois.corpoHash);
    assert.equal($('.contribuicao-editorial').length, 1);
    assert.equal($('.limites-editoriais').length, 1);
    assert.match($('.limites-editoriais').text(), /não (?:foi|foram).*test|não foi executado/i);
    const outra = lote.artigos.find(b => b.url !== a.url);
    assert.ok($('.article-body a').toArray().some(el => $(el).attr('href') === `/${outra.url}`));
    for (const e of a.evidencias) {
      assert.equal($(e.seletor).length, 1);
      assert.equal(hashCorpoEditorial($(e.seletor).html()), e.textoHash);
      assert.ok($(e.seletor).find('a').toArray().some(el => $(el).attr('href') === e.fonte));
    }
    assert.doesNotMatch($('.article-body').text(), /que aprendi ao longo da minha carreira|desafios que enfrentei|plano de backup mensal ou trimestral/i);
  }
});

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
