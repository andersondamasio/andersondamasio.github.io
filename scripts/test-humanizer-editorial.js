const assert = require("assert");
const {
  avaliarSinaisHumanizer,
  carregarRegrasHumanizer,
  validarPreservacaoHumanizer
} = require("./humanizer-editorial");

const regras = carregarRegrasHumanizer();
assert.ok(regras.includes("Regra principal"));

const artificial = avaliarSinaisHumanizer({
  titulo: "Desvendando o incidente: lições cruciais para arquitetos",
  corpoArtigo: "<p>O incidente levantou questões importantes. À medida que as tecnologias avançam, tudo se torna cada vez mais complexo. Neste artigo, exploraremos os detalhes valiosos.</p><h2>Explicação técnica aprofundada</h2><ul><li><strong>Monitore:</strong> use alertas.</li></ul><p>Na minha carreira, especialistas afirmam que esta mudança terá um papel crucial — e o futuro parece promissor.</p>"
});

const natural = avaliarSinaisHumanizer({
  titulo: "O que muda na arquitetura depois desta decisao",
  corpoArtigo: "<h2>O fato reportado</h2><p>A empresa publicou a mudanca. Na minha leitura, o principal efeito esta no contrato entre os servicos.</p>"
});

assert.ok(artificial.score < natural.score);
assert.ok(artificial.score < 75);
assert.ok(natural.score >= 75);
assert.ok(artificial.sinais.some(item => item.id === "experiencia-pessoal-nao-verificavel"));
assert.ok(artificial.sinais.some(item => item.id === "titulo-formulaico"));
assert.ok(artificial.sinais.some(item => item.id === "frase-formulaica"));

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
