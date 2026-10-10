const test = require('node:test');
const assert = require('node:assert/strict');
const { medir } = require('./medir');
const dados = require('./dados.json');

test('mesmas respostas produzem pontuacoes distintas conforme a metrica', () => {
  const resultados = dados.cenarios.map(c => medir(dados.alvos, c.respostas));
  assert.deepEqual(resultados.map(r => [r.exatas, r.itens, r.posicoesCorretas, r.posicoes]),
    [[0, 4, 8, 16], [0, 4, 12, 16], [4, 4, 16, 16]]);
  assert.deepEqual(resultados.map(r => [r.fracaoExata, r.fracaoPorPosicao]), [[0, 0.5], [0, 0.75], [1, 1]]);
});

test('associa respostas por id, sem depender da ordem ou alterar as entradas', () => {
  const copia = JSON.stringify(dados);
  const alvo = dados.cenarios[0];
  assert.deepEqual(medir(dados.alvos, [...alvo.respostas].reverse()), medir(dados.alvos, alvo.respostas));
  assert.equal(JSON.stringify(dados), copia);
});

test('micro media usa total de posicoes e exata usa total de itens', () => {
  assert.deepEqual(medir([{ id: 'a', texto: 'A' }, { id: 'b', texto: 'BCD' }],
    [{ id: 'a', texto: 'A' }, { id: 'b', texto: 'B??' }]),
  { itens: 2, exatas: 1, posicoes: 4, posicoesCorretas: 2, fracaoExata: 0.5, fracaoPorPosicao: 0.5 });
});

test('recusa cobertura incompleta, ids duplicados ou desconhecidos', () => {
  const a = [{ id: '1', texto: 'AB' }, { id: '2', texto: 'CD' }];
  assert.throws(() => medir(a, a.slice(0, 1)), /Cobertura/);
  assert.throws(() => medir([a[0], a[0]], a), /alvo repetido/);
  assert.throws(() => medir(a, [a[0], a[0]]), /resposta repetido/);
  assert.throws(() => medir(a, [a[0], { id: '3', texto: 'CD' }]), /desconhecido/);
});

test('recusa entrada vazia e texto fora do contrato ASCII, sem normalizacao silenciosa', () => {
  const a = [{ id: '1', texto: 'AB' }];
  for (const valor of [null, [], {}]) assert.throws(() => medir(valor, []), /lista nao vazia/);
  assert.throws(() => medir(a, null), /lista/);
  for (const texto of ['', 'A?', 'ab', ' A', '\u00c1B', 123]) {
    assert.throws(() => medir([{ id: '1', texto }], a), /ASCII/);
  }
  for (const texto of ['', 'ab', '\u00c1B', 123]) {
    assert.throws(() => medir(a, [{ id: '1', texto }]), /Resposta invalida/);
  }
  assert.throws(() => medir(a, [{ id: '1', texto: 'A' }]), /Comprimentos/);
  assert.throws(() => medir([{ id: ' ', texto: 'AB' }], a), /Id invalido/);
  assert.throws(() => medir(a, [null]), /desconhecido/);
});
