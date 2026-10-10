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
    ['artigos/design-tokens-a-arquitetura-secreta-por-tras-de-interfaces-de-usuario-incriveis.html', [
      ['code.language-json', 'exemplos/design-tokens/tokens.json'],
      ['code.language-javascript', 'exemplos/design-tokens/converter.js']]],
    ['artigos/desenvolvendo-sistemas-de-baixa-latencia-com-c-desafios-e-oportunidades.html', [
      ['code.language-cpp', 'exemplos/fila-cpp/fila.hpp'],
      ['code.language-cpp', 'exemplos/fila-cpp/main.cpp']]],
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

test('exemplo de NaN e JSON executa as assercoes sem dependencias externas', () => {
  const saida = require('node:child_process').execFileSync(process.execPath,
    [path.join(root, 'exemplos/nan-json/verificar.js')], { encoding: 'utf8' });
  assert.equal(saida.trim(), 'Contrato JSON verificado.');
});

test('CSS publicado e a saida real do conversor', () => {
  const $ = cheerio.load(ler('artigos/design-tokens-a-arquitetura-secreta-por-tras-de-interfaces-de-usuario-incriveis.html'));
  assert.equal($('.article-body code.language-css').text(), converter(JSON.parse(ler('exemplos/design-tokens/tokens.json'))));
  assert.match($('.contribuicao-editorial').text(), /não implementa o formato DTCG/);
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
