'use strict';
const assert = require('node:assert/strict');

function prepararLeitura(valor) {
  if (valor === null) return { estado: 'ausente', valor: null };
  if (typeof valor !== 'number') throw new TypeError('Esperado numero ou null');
  if (!Number.isFinite(valor)) return { estado: 'invalida', valor: null };
  return { estado: 'valida', valor };
}

assert.equal(Number.isNaN(NaN), true);
assert.equal(Number.isNaN(null), false);
assert.equal(Number.isNaN('NaN'), false);
assert.deepEqual(JSON.parse(JSON.stringify({ valor: NaN })), { valor: null });
assert.deepEqual(prepararLeitura(null), { estado: 'ausente', valor: null });
for (const valor of [NaN, Infinity, -Infinity]) {
  assert.deepEqual(prepararLeitura(valor), { estado: 'invalida', valor: null });
}
for (const valor of [0, 3.5, -2]) {
  assert.deepEqual(prepararLeitura(valor), { estado: 'valida', valor });
}
for (const valor of ['NaN', '2', undefined, {}, true]) {
  assert.throws(() => prepararLeitura(valor), TypeError);
}
const leituras = [null, NaN, 0].map(prepararLeitura);
assert.deepEqual(JSON.parse(JSON.stringify(leituras)), leituras);
console.log('Contrato JSON verificado.');
