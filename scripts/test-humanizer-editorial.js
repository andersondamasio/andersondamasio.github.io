const assert = require("assert");
const {
  avaliarSinaisHumanizer,
  carregarRegrasHumanizer,
  validarPreservacaoHumanizer
} = require("./humanizer-editorial");

const regras = carregarRegrasHumanizer();
assert.ok(regras.includes("Regra principal"));

const artificial = avaliarSinaisHumanizer({
  titulo: "Uma nova era para a arquitetura",
  corpoArtigo: "<h2>Vamos mergulhar</h2><p>Na minha carreira, especialistas afirmam que esta mudanca tera um papel crucial — e o futuro parece promissor.</p>"
});

const natural = avaliarSinaisHumanizer({
  titulo: "O que muda na arquitetura depois desta decisao",
  corpoArtigo: "<h2>O fato reportado</h2><p>A empresa publicou a mudanca. Na minha leitura, o principal efeito esta no contrato entre os servicos.</p>"
});

assert.ok(artificial.score < natural.score);
assert.ok(artificial.sinais.some(item => item.id === "experiencia-pessoal-nao-verificavel"));

const original = {
  titulo: "API reduz latencia em 20%",
  corpoArtigo: '<p>Veja https://example.com/relatorio.</p><pre><code>const limite = 20;</code></pre>'
};

const preservado = validarPreservacaoHumanizer(original, {
  titulo: "API reduz em 20% a latencia",
  corpoArtigo: '<p>O relatorio esta em https://example.com/relatorio.</p><pre><code>const limite = 20;</code></pre>'
});
assert.equal(preservado.aceita, true);

const alterado = validarPreservacaoHumanizer(original, {
  titulo: "API reduz em 30% a latencia",
  corpoArtigo: '<p>O relatorio esta em https://example.com/outro.</p><pre><code>const limite = 30;</code></pre>'
});
assert.equal(alterado.aceita, false);
assert.ok(alterado.motivos.includes("urls-alteradas"));
assert.ok(alterado.motivos.includes("numeros-alterados"));
assert.ok(alterado.motivos.includes("blocos-de-codigo-alterados"));

console.log("Humanizer editorial: testes aprovados.");
