const test = require('node:test');
const assert = require('node:assert/strict');
const { maiorJanelaLayoutShifts, resumirAmostras, paginas, perfis } = require('./seo-performance-lab');

test('layout shifts usam maior janela, ignoram input recente e nao somam a visita inteira', () => {
  const e = (startTime, value, hadRecentInput = false) => ({ startTime, value, hadRecentInput });
  assert.equal(maiorJanelaLayoutShifts([]), 0);
  assert.equal(maiorJanelaLayoutShifts([e(0, .1), e(500, .1), e(700, 1, true), e(1700, .15)]), .2);
  assert.equal(maiorJanelaLayoutShifts(Array.from({ length: 7 }, (_, i) => e(i * 900, 1))), 6);
  assert.equal(maiorJanelaLayoutShifts([e(1000, .2), e(0, .1)]), .2);
});

test('resumo mantem dados ausentes desconhecidos e nao declara aprovacao de performance', () => {
  const grupo = [30, 10, 20].map(fcpMs => ({ perfil: 'celular', caminho: '/', coletaCompleta: true, metricas: { fcpMs } }));
  const r = resumirAmostras(grupo)[0];
  assert.deepEqual(r.fcpMs, { minimo: 10, mediana: 20, maximo: 30 });
  assert.equal(r.lcpCandidatoMs, null);
  assert.equal(r.coletaCompleta, true);
  assert.equal(r.aprovado, undefined);
  grupo[1].metricas.fcpMs = null; grupo[1].coletaCompleta = false;
  const parcial = resumirAmostras(grupo)[0];
  assert.equal(parcial.fcpMs, null); assert.equal(parcial.coletaCompleta, false);
});

test('coleta cobre home, categoria e dois artigos em perfis diferentes sem pedidos de publicacao', () => {
  assert.equal(paginas.length, 4); assert.equal(paginas[0], '/');
  assert.ok(paginas.includes('/artigos/inteligencia-artificial.html'));
  assert.deepEqual(perfis.map(p => p.nome), ['desktop', 'celular']);
  assert.ok(perfis.every(p => p.rede.downloadThroughput > 0 && p.cpu >= 1));
});
