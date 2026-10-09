const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { estimarReserva, executarComOrcamento } = require("./model-evaluation-budget");
const payload = { model: "gpt-5.6-terra", messages: [{ role: "user", content: "Uma analise baseada em fontes." }], max_completion_tokens: 4000 };

async function fixture(run) {
  const base = fs.realpathSync(os.tmpdir());
  const diretorio = fs.mkdtempSync(path.join(base, "perfil-budget-test-"));
  try { await run(diretorio); } finally {
    if (path.dirname(path.resolve(diretorio)) !== base || !path.basename(diretorio).startsWith("perfil-budget-test-")) throw new Error("Pasta temporaria fora de escopo");
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
}
const ler = dir => JSON.parse(fs.readFileSync(path.join(dir, "orcamento.json"), "utf8"));

test("reserva antes da chamada e registra uso sem esconder tokens de raciocinio", async () => fixture(async diretorio => {
  await executarComOrcamento({ payload, diretorio, enviar: async enviado => {
    assert.equal(enviado.service_tier, "default");
    assert.equal(ler(diretorio).chamadas[0].estado, "reservada");
    return { usage: { prompt_tokens: 100, completion_tokens: 1000, completion_tokens_details: { reasoning_tokens: 800 } } };
  }});
  const chamada = ler(diretorio).chamadas[0];
  assert.equal(chamada.estado, "concluida");
  assert.ok(chamada.comprometidoUsd < chamada.reservaUsd);
  assert.ok(chamada.comprometidoUsd >= 0.012);
}));

test("teto de US$ 2 impede requisicao e persiste entre chamadas", async () => fixture(async diretorio => {
  fs.writeFileSync(path.join(diretorio, "orcamento.json"), JSON.stringify({ limiteUsd: 2, chamadas: [{ id: "anterior", comprometidoUsd: 1.99 }] }));
  let chamadas = 0;
  await assert.rejects(() => executarComOrcamento({ payload, diretorio, enviar: async () => { chamadas++; } }), /Orcamento insuficiente/);
  assert.equal(chamadas, 0);
  assert.equal(ler(diretorio).chamadas.length, 1);
}));

test("timeout e resposta sem uso conservam a reserva; nao ha retry automatico", async () => fixture(async diretorio => {
  let chamadas = 0;
  await assert.rejects(() => executarComOrcamento({ payload, diretorio, enviar: async () => { chamadas++; throw new Error("timeout"); } }), /timeout/);
  await executarComOrcamento({ payload, diretorio, enviar: async () => ({ choices: [] }) });
  assert.equal(chamadas, 1);
  for (const chamada of ler(diretorio).chamadas) assert.equal(chamada.comprometidoUsd, estimarReserva(payload));
}));

test("nao permite precos desconhecidos, saida ilimitada ou ferramentas extras", () => {
  for (const extras of [{ model: "desconhecido" }, { max_completion_tokens: undefined }, { tools: [{ type: "web_search" }] }, { service_tier: "priority" }, { n: 2 }, { messages: [{ role: "user", content: [] }] }]) {
    assert.throws(() => estimarReserva({ ...payload, ...extras }));
  }
});

test("ledger corrompido ou lock existente bloqueia chamadas sem redefinir consumo", async () => fixture(async diretorio => {
  fs.writeFileSync(path.join(diretorio, "orcamento.json"), '{"limiteUsd":2,"chamadas":[{}]}');
  await assert.rejects(() => executarComOrcamento({ payload, diretorio, enviar: async () => assert.fail("nao deveria chamar") }), /Ledger invalido/);
  fs.writeFileSync(path.join(diretorio, "orcamento.lock"), "");
  await assert.rejects(() => executarComOrcamento({ payload, diretorio, enviar: async () => assert.fail("nao deveria chamar") }), /EEXIST/);
}));
