const assert = require('node:assert/strict');

function medir(alvos, respostas) {
  assert.ok(Array.isArray(alvos) && alvos.length > 0, 'Alvos devem ser uma lista nao vazia.');
  assert.ok(Array.isArray(respostas), 'Respostas devem ser uma lista.');
  assert.equal(respostas.length, alvos.length, 'Cobertura de respostas incompleta.');
  const porId = new Map();
  for (const alvo of alvos) {
    assert.ok(alvo && typeof alvo.id === 'string' && alvo.id.trim(), 'Id invalido.');
    assert.ok(typeof alvo.texto === 'string' && /^[A-Z]+$/.test(alvo.texto), 'Alvo exige letras ASCII maiusculas.');
    assert.ok(!porId.has(alvo.id), 'Id de alvo repetido.');
    porId.set(alvo.id, alvo.texto);
  }
  const vistos = new Set();
  let exatas = 0, posicoesCorretas = 0, posicoes = 0;
  for (const resposta of respostas) {
    assert.ok(resposta && porId.has(resposta.id), 'Id de resposta desconhecido.');
    assert.ok(!vistos.has(resposta.id), 'Id de resposta repetido.');
    vistos.add(resposta.id);
    const alvo = porId.get(resposta.id);
    assert.ok(typeof resposta.texto === 'string' && /^[A-Z?]+$/.test(resposta.texto), 'Resposta invalida.');
    assert.equal(resposta.texto.length, alvo.length, 'Comprimentos diferentes.');
    exatas += Number(resposta.texto === alvo);
    posicoes += alvo.length;
    for (let i = 0; i < alvo.length; i++) {
      posicoesCorretas += Number(resposta.texto[i] === alvo[i]);
    }
  }
  return { itens: alvos.length, exatas, posicoes, posicoesCorretas,
    fracaoExata: exatas / alvos.length, fracaoPorPosicao: posicoesCorretas / posicoes };
}

module.exports = { medir };
