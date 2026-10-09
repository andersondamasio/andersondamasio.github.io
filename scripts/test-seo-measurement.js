const test = require("node:test");
const assert = require("node:assert/strict");
const { validarUrlMedicao, criarObservacao, capturarMedicao } = require("./seo-measurement");
const html = '<html><head><title>Perfil</title><link rel="canonical" href="https://www.andersondamasio.com.br/"></head><body><h1>Anderson Damasio</h1></body></html>';
const parametros = { urls: ["/", "/sobre.html", "/"], revisao: "fixture", lerEsperado: () => html, agora: new Date("2026-10-09T12:00:00Z") };

test("restringe medicao ao site e paginas HTML", () => {
  assert.equal(validarUrlMedicao("artigos/arquitetura/exemplo.html"), "https://www.andersondamasio.com.br/artigos/arquitetura/exemplo.html");
  for (const url of ["https://outro.example/", "//outro.example/", "/?q=privado", "/sobre.html#topo", "/ads.txt"]) assert.throws(() => validarUrlMedicao(url));
});

test("deploy confirmado preserva metricas desconhecidas e propoe checkpoints", async () => {
  const resultado = await capturarMedicao({ ...parametros, fetchImpl: async url => ({ status: 200, url, text: async () => html }) });
  assert.equal(resultado.observacoes.length, 2);
  assert.equal(resultado.deployConfirmado, true);
  assert.deepEqual(resultado.checkpointsPropostos.map(c => c.aPartirDe), ["2026-10-23T12:00:00.000Z", "2026-11-06T12:00:00.000Z", "2026-12-04T12:00:00.000Z"]);
  assert.ok(resultado.observacoes.every(o => o.google.cliques === null && o.google.indexacao === null));
});

test("200 antigo, 404 e erro de rede nao confirmam deploy", async () => {
  for (const fetchImpl of [
    async () => ({ status: 200, text: async () => html.replace("Perfil", "Antigo") }),
    async () => ({ status: 404, text: async () => "ausente" }),
    async () => { throw new Error("rede"); }
  ]) {
    const resultado = await capturarMedicao({ ...parametros, fetchImpl });
    assert.equal(resultado.deployConfirmado, false);
    assert.deepEqual(resultado.checkpointsPropostos, []);
    assert.equal(resultado.observacoes[0].google.impressoes, null);
  }
});

test("noindex HTTP e meta sao observados sem confundir com dado do Google", () => {
  const resultado = criarObservacao({ url: parametros.urls[0], html, esperado: html, status: 200, headers: { get: () => "noindex" } });
  assert.equal(resultado.pagina.permiteIndexacaoDeclarada, false);
  assert.equal(resultado.pagina.correspondeAoGit, true);
  assert.equal(resultado.google.indexacao, null);
});
