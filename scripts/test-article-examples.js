const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const { converter } = require('../exemplos/design-tokens/converter');
const root = path.join(__dirname, '..');
const ler = arquivo => fs.readFileSync(path.join(root, arquivo), 'utf8').replace(/\r\n/g, '\n');

test('codigo dos artigos coincide com arquivos executaveis, sem tags espurias', () => {
  const casos = [
    ['artigos/programacao/ja-passei-por-situacoes-em-que-plain-vanilla-web-guide-for-de-frameworking-yourself-foi-o-divisor-entre-sucesso-e-retrabalho.html', [
      ['code.language-html', 'exemplos/web-nativa/detalhes.txt']]],
    ['artigos/programacao/a-nova-era-do-tempo-como-a-temporal-api-pode-revolucionar-o-desenvolvimento-web.html', [
      ['code.language-javascript', 'exemplos/temporal/comparar.js']]],
    ['artigos/design-tokens-a-arquitetura-secreta-por-tras-de-interfaces-de-usuario-incriveis.html', [
      ['code.language-json', 'exemplos/design-tokens/tokens.json'],
      ['code.language-javascript', 'exemplos/design-tokens/converter.js']]],
    ['artigos/desenvolvendo-sistemas-de-baixa-latencia-com-c-desafios-e-oportunidades.html', [
      ['code.language-cpp', 'exemplos/fila-cpp/fila.hpp'],
      ['code.language-cpp', 'exemplos/fila-cpp/main.cpp']]],
    ['artigos/seguranca/a-importancia-da-resiliencia-em-sistemas-aprendizados-do-incidente-da-victoria-s-secret.html', [
      ['code.language-csharp', 'exemplos/health-checks/HealthExample.cs']]],
    ['artigos/desvendando-os-misterios-por-tras-das-propriedades-emergentes-dos-llms.html', [
      ['code.language-javascript', 'exemplos/metricas-exatas/medir.js']]],
    ['artigos/arquitetura/desmistificando-a-arquitetura-orientada-a-eventos-desafios-e-solucoes-em-sistemas-em-tempo-real.html', [
      ['code.language-javascript', 'exemplos/estado-versionado/aplicar.js']]],
    ['artigos/como-a-tendencia-stuffed-na-a-n-se-conecta-a-arquitetura-de-software-moderna.html', [
      ['code.language-javascript', 'exemplos/nan-json/verificar.js']]]
  ];
  for (const [url, arquivos] of casos) {
    const $ = cheerio.load(ler(url));
    for (const [seletor, arquivo] of arquivos) {
      const exemplos = $('.article-body').find(seletor).toArray();
      assert.equal(exemplos.filter(el => $(el).text() === ler(arquivo)).length, 1, arquivo);
      for (const el of exemplos) assert.equal($(el).children().length, 0);
    }
    assert.equal($('.article-body pre br').length, 0);
    assert.equal($('.article-body iostream, .article-body condition_variable').length, 0);
  }
});

test('exemplos nativos publicados preservam resultado executado e hashes das fontes', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-web-nativa-2026-10.json'));
  assert.equal(lote.execucao.testes, 2);
  assert.equal(lote.execucao.resultado, 'passed');
  assert.equal(lote.execucao.chamadaModelo, false);
  assert.equal(lote.execucao.testeProducao, false);
  const exemplos = lote.artigos.filter(a => a.experimentoExecutado);
  assert.equal(exemplos.length, 2);
  for (const a of exemplos) {
    const q = cheerio.load(ler(a.url)), e = a.experimento;
    assert.equal(require('node:crypto').createHash('sha256').update(ler(e.arquivo.caminho)).digest('hex'), e.arquivo.sha256);
    assert.equal(q(`.article-body a[href="/${e.arquivo.caminho}"]`).length, 1);
    assert.equal(e.resultado, 'passed'); assert.equal(e.sintetico, true);
    assert.equal(e.navegador, lote.execucao.navegador);
    assert.match(q('.resultado-executado').text(), /Codex/);
    assert.match(q('.limites-editoriais').text(), /não.*(?:vivência|relatos)/);
    if (e.arquivo.caminho.includes('temporal')) {
      assert.deepEqual(JSON.parse(q('code.language-json').text()), e.saida);
      assert.equal(e.saida.horasTranscorridas, 23);
      assert.equal(e.saida.horarioRepetidoRejeitado, true);
      assert.equal(e.saida.horarioInexistenteRejeitado, true);
    } else {
      assert.equal(e.saida.javascript, false);
      assert.deepEqual(e.saida.estados, [false, true, false, true]);
      assert.deepEqual(e.saida.interacoes, ['inicial', 'clique', 'Enter', 'Space']);
    }
  }
});

test('exemplo de NaN e JSON executa as assercoes sem dependencias externas', () => {
  const saida = require('node:child_process').execFileSync(process.execPath,
    [path.join(root, 'exemplos/nan-json/verificar.js')], { encoding: 'utf8' });
  assert.equal(saida.trim(), 'Contrato JSON verificado.');
});

test('exemplo de metricas publicado corresponde a saida sintetica executada', () => {
  const saida = JSON.parse(require('node:child_process').execFileSync(process.execPath,
    [path.join(root, 'exemplos/metricas-exatas/executar.js')], { encoding: 'utf8' }));
  const lote = JSON.parse(ler('dados/editorial/curadoria-metricas-contexto-2026-10.json'));
  const artigo = lote.artigos.find(a => a.experimento);
  const q = cheerio.load(ler(artigo.url));
  assert.deepEqual(saida, artigo.experimento.saida);
  assert.equal(artigo.experimento.chamadaModelo, false);
  assert.equal(artigo.experimento.sintetico, true);
  assert.equal(artigo.experimento.testeProducao, false);
  assert.equal(artigo.experimento.resultado, 'passed');
  assert.equal(artigo.experimento.testes, 5);
  for (const arquivo of artigo.experimento.arquivos) {
    assert.equal(require('node:crypto').createHash('sha256').update(ler(arquivo.caminho)).digest('hex'), arquivo.sha256);
    assert.ok(q('.article-body a').toArray().some(el => q(el).attr('href') === '/' + arquivo.caminho));
  }
  const linhas = q('.contribuicao-editorial tbody tr').toArray().map(el => q(el).find('td').map((_, td) => q(td).text()).get());
  assert.deepEqual(linhas, [['A', '8/16 = 50%', '0/4 = 0%'], ['B', '12/16 = 75%', '0/4 = 0%'], ['C', '16/16 = 100%', '4/4 = 100%']]);
  assert.match(q('.limites-editoriais').text(), /não comprova nem refuta emergência/);
  assert.match(q('.resultado-executado').text(), /Codex executou.*cinco testes passaram/);
  assert.doesNotMatch(q('.article-body').text(), /GPT3Tokenizer|GPT3Model|enfrentei/);
});

test('CSS publicado e a saida real do conversor', () => {
  const $ = cheerio.load(ler('artigos/design-tokens-a-arquitetura-secreta-por-tras-de-interfaces-de-usuario-incriveis.html'));
  assert.equal($('.article-body code.language-css').text(), converter(JSON.parse(ler('exemplos/design-tokens/tokens.json'))));
  assert.match($('.contribuicao-editorial').text(), /não implementa o formato DTCG/);
});

test('snapshots publicados correspondem ao exemplo executado e explicitam limites', () => {
  const saida = JSON.parse(require('node:child_process').execFileSync(process.execPath,
    [path.join(root, 'exemplos/estado-versionado/executar.js')], { encoding: 'utf8' }));
  const lote = JSON.parse(ler('dados/editorial/curadoria-contratos-2026-10.json'));
  const artigo = lote.artigos.find(a => a.experimento);
  const q = cheerio.load(ler(artigo.url));
  assert.deepEqual(saida, artigo.experimento.saida);
  assert.deepEqual(saida.resultados, ['aplicado', 'atrasado', 'duplicado', 'aplicado', 'conflito']);
  assert.deepEqual(saida.final, { id: 'agente-1', versao: 3, estado: 'disponivel' });
  assert.equal(artigo.experimento.resultado, 'passed');
  assert.equal(artigo.experimento.testes, 8);
  assert.equal(artigo.experimento.chamadaModelo, false);
  assert.equal(artigo.experimento.testeProducao, false);
  assert.equal(artigo.experimento.sintetico, true);
  for (const arquivo of artigo.experimento.arquivos) {
    assert.equal(require('node:crypto').createHash('sha256').update(ler(arquivo.caminho)).digest('hex'), arquivo.sha256);
    assert.ok(q('.article-body a').toArray().some(el => q(el).attr('href') === '/' + arquivo.caminho));
  }
  const resultados = q('.contribuicao-editorial tbody tr').map((_, el) => q(el).find('td').last().text()).get();
  assert.deepEqual(resultados, saida.resultados);
  assert.match(q('.resultado-executado').text(), /oito testes passaram/);
  assert.match(q('.limites-editoriais').text(), /não detecta divergências históricas/);
  assert.match(q('.limites-editoriais').text(), /comparação e a escrita precisariam ser atômicas/);
  for (const a of lote.artigos) {
    const b = cheerio.load(ler(a.url));
    assert.equal(b('.nota-atualizacao time').attr('datetime'), lote.em);
    assert.match(b('.nota-atualizacao').text(), /publicação original foi preservada/);
    assert.equal(b('.contribuicao-editorial').length, 1);
    assert.equal(b('.limites-editoriais').length, 1);
  }
});

test('atualizacoes posteriores e referencia sem data nao falsificam cronologia', () => {
  const r = JSON.parse(ler('dados/editorial/correcoes-contextuais-02-2026-10.json'));
  for (const artigo of r.artigos) {
    const $ = cheerio.load(ler(artigo.url));
    assert.equal($('.nota-atualizacao time').attr('datetime'), r.em);
    assert.match($('.nota-atualizacao').text(), /publicação original foi preservada/);
  }
  const local = r.artigos.find(a => a.url.includes('localstack-'));
  const $ = cheerio.load(ler(local.url));
  assert.match($('.fato-localstack').text(), /retira os limites por créditos de CI/);
  assert.ok(Date.parse(local.depois.fonte.data) > Date.parse(local.antes.data));
  const tokens = r.artigos.find(a => a.url.includes('design-tokens-'));
  assert.ok(Date.parse(tokens.depois.fonte.data) > Date.parse(tokens.antes.data));
  const cpp = r.artigos.find(a => a.url.includes('baixa-latencia-'));
  assert.equal(cpp.depois.fonte.data, undefined);
  assert.match(cheerio.load(ler(cpp.url))('.limites-editoriais').text(), /Não há benchmark/);
});
