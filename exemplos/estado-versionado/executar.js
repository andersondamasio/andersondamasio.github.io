'use strict';

const { aplicarSnapshot } = require('./aplicar');
const entradas = require('./dados.json');
let atual = null;
const resultados = [];
for (const entrada of entradas) {
  const saida = aplicarSnapshot(atual, entrada);
  atual = saida.snapshot;
  resultados.push(saida.resultado);
}
console.log(JSON.stringify({ resultados, final: atual }, null, 2));
