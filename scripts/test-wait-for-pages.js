const test = require("node:test");
const assert = require("node:assert/strict");
const { esperarPages } = require("./wait-for-pages");
const revisao = "b".repeat(40);
const base = { repositorio: "owner/repo", revisao, tentativas: 3, esperar: async () => {} };
const resposta = (commit, status) => ({ status: 200, json: async () => ({ commit, status }) });

test("Pages exige build da revisao exata antes de conferir o site", async () => {
  const etapas = [resposta("a".repeat(40), "built"), resposta(revisao, "building"), resposta(revisao, "built")];
  const result = await esperarPages({ ...base, fetchImpl: async (url, options) => {
    assert.equal(new URL(url).hostname, "api.github.com");
    assert.equal(options.redirect, "error");
    return etapas.shift();
  } });
  assert.equal(result.tentativa, 3);
  assert.equal(result.revisao, revisao);
});

test("build antigo, inexistente, falho e acesso negado nunca contam como deploy", async () => {
  for (const result of [resposta("a".repeat(40), "built"), { status: 404 }, resposta(revisao, "errored"), { status: 403 }]) {
    let chamadas = 0;
    await assert.rejects(esperarPages({ ...base, fetchImpl: async () => { chamadas++; return result; } }));
    assert.ok(chamadas <= 3);
  }
  await assert.rejects(esperarPages({ ...base, repositorio: "https://other.example/repo" }), /Repositorio/);
  await assert.rejects(esperarPages({ ...base, tentativas: 25 }), /Tentativas/);
});
