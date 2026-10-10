'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { aplicarSnapshot } = require('./aplicar');
const s = (versao, estado = 'disponivel') => ({ id: 'agente-1', versao, estado });

test('aceita primeiro snapshot e versao maior, inclusive com salto', () => {
  assert.deepEqual(aplicarSnapshot(null, s(0)), { resultado: 'aplicado', snapshot: s(0) });
  assert.deepEqual(aplicarSnapshot(s(0), s(10)), { resultado: 'aplicado', snapshot: s(10) });
});
test('snapshot atrasado nao regride estado', () => {
  assert.deepEqual(aplicarSnapshot(s(2, 'em-chamada'), s(1)), {
    resultado: 'atrasado', snapshot: s(2, 'em-chamada')
  });
});
test('mesma versao e estado e duplicado', () => {
  assert.deepEqual(aplicarSnapshot(s(2), s(2)), { resultado: 'duplicado', snapshot: s(2) });
});
test('mesma versao divergente sinaliza conflito e preserva estado', () => {
  assert.deepEqual(aplicarSnapshot(s(2), s(2, 'indisponivel')), {
    resultado: 'conflito', snapshot: s(2)
  });
});
test('nao mistura entidades', () => {
  assert.throws(() => aplicarSnapshot(s(1), { ...s(2), id: 'agente-2' }), /Entidades diferentes/);
});
test('rejeita contratos invalidos na entrada e no estado atual', () => {
  for (const invalido of [null, undefined, [], {}, { ...s(0), extra: true },
    { ...s(0), id: ' ' }, { ...s(0), id: ' agente-1' }, { ...s(0), estado: 'ocupado' },
    s(-1), s(0.5), s('2'), s(NaN), s(Infinity), s(Number.MAX_SAFE_INTEGER + 1)]) {
    assert.throws(() => aplicarSnapshot(null, invalido), /Snapshot invalido/);
    if (invalido !== null) assert.throws(() => aplicarSnapshot(invalido, s(0)), /Snapshot invalido/);
  }
});
test('nao muda entradas nem devolve a mesma referencia', () => {
  const atual = Object.freeze(s(2)), novo = Object.freeze(s(3));
  for (const recebido of [s(1), s(2), s(2, 'indisponivel'), novo]) {
    const saida = aplicarSnapshot(atual, Object.freeze(recebido));
    assert.notEqual(saida.snapshot, atual);
    assert.notEqual(saida.snapshot, recebido);
    saida.snapshot.estado = 'indisponivel';
    assert.deepEqual(atual, s(2));
    assert.deepEqual(novo, s(3));
  }
});
test('permutacoes convergem com snapshots completos sem conflitos', () => {
  for (const ordem of [[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]) {
    const final = ordem.reduce((atual, v) => aplicarSnapshot(atual, s(v)).snapshot, null);
    assert.deepEqual(final, s(3));
  }
});
