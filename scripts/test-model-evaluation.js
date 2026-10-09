const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { prepararPlano, avaliarResposta, reservarExecucaoRemota, enviarOpenAI, executarAvaliacao } = require("./model-evaluation");
const plano = prepararPlano();
const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_RUN_ATTEMPT: "1", GITHUB_RUN_ID: "123",
  GITHUB_SHA: "a".repeat(40), GITHUB_REPOSITORY: "andersondamasio/andersondamasio.github.io", GITHUB_TOKEN: "fixture-token", OPENAI_API_KEY: "fixture-key" };

async function fixture(run) {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, "perfil-eval-test-"));
  fs.writeFileSync(path.join(root, "titulos.json"), "[]");
  try { await run(root); } finally {
    if (path.dirname(path.resolve(root)) !== base || !path.basename(root).startsWith("perfil-eval-test-")) throw new Error("Pasta temporaria fora do escopo");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function artigo(caso) {
  const fato = "A fonte descreve o comportamento dentro dos limites do protocolo.";
  const contribuicao = "Como exemplo hipotetico, conferir o estado antes de repetir a operacao.";
  const limites = "Este exemplo nao foi executado e nao demonstra uma implementacao real.";
  return { titulo: "Confirmacao e resultado da operacao", resumo: "Uma explicacao curta dos limites da confirmacao.",
    corpoArtigo: `<p>${fato} <a href="${caso.fonte.url}">Documentacao</a></p><p>${contribuicao}</p><p>${limites}</p>`,
    afirmacoes: [{ tipo: "fato", trecho: fato, fonteUrl: caso.fonte.url, localizacaoNaFonte: caso.fonte.localizacao,
      verificacao: "Conferir este trecho na documentacao antes de publicar." }],
    contribuicao: { descricao: "Separar confirmacao de execucao antes de repetir a operacao.", trecho: contribuicao }, limites };
}
const resposta = value => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }], usage: { prompt_tokens: 100, completion_tokens: 500 } });

test("cinco pautas iguais para tres variantes com reservas abaixo do teto", () => {
  assert.equal(plano.tarefas.length, 15);
  assert.ok(plano.reservaMatrizUsd + 0.25 < 2);
  for (let i = 0; i < 15; i += 3) {
    assert.deepEqual(plano.tarefas[i].payload.messages, plano.tarefas[i + 1].payload.messages);
    assert.deepEqual(plano.tarefas[i].payload.messages, plano.tarefas[i + 2].payload.messages);
    assert.ok(plano.tarefas[i].payload.messages[0].content.includes("Nao personifique Anderson Damasio"));
  }
  assert.equal(prepararPlano().hash, plano.hash);
});

test("avaliacao estrutural nao e aprovacao factual ou humana", () => {
  const caso = plano.tarefas[0].caso;
  const resultado = avaliarResposta(resposta(artigo(caso)), caso);
  assert.equal(resultado.aceita, true);
  assert.equal(resultado.verificacaoFactual, false);
  assert.equal(resultado.revisaoHumana, null);
  const incompleta = resposta(artigo(caso));
  incompleta.choices[0].finish_reason = "length";
  assert.equal(avaliarResposta(incompleta, caso).aceita, false);
  assert.equal(avaliarResposta(resposta({ titulo: "Sem corpo" }), caso).aceita, false);
  assert.equal(avaliarResposta({ choices: [] }, caso).aceita, false);
});

test("bloqueia fonte inventada, markup ativo e vivencia atribuida", () => {
  const caso = plano.tarefas[0].caso;
  for (const alterar of [
    a => a.afirmacoes[0].fonteUrl = "https://inventada.example/",
    a => a.corpoArtigo += "<script>alert(1)</script>",
    a => a.corpoArtigo += "<p>Implementei isso nos meus projetos.</p>"
  ]) {
    const a = artigo(caso);
    alterar(a);
    assert.equal(avaliarResposta(resposta(a), caso).aceita, false);
  }
});

test("marcador remoto unico bloqueia repeticao e tentativa automatica", async () => {
  const refs = new Set();
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(url);
    const body = JSON.parse(options.body);
    if (url.endsWith("/refs")) {
      if (refs.has(body.ref)) return { ok: false, status: 422 };
      refs.add(body.ref);
    }
    return { ok: true, json: async () => ({ sha: "b".repeat(40) }) };
  };
  await reservarExecucaoRemota({ plano, env, fetchImpl });
  await assert.rejects(reservarExecucaoRemota({ plano, env: { ...env, GITHUB_RUN_ID: "124" }, fetchImpl }), /Reserva remota recusada/);
  const count = calls.length;
  await assert.rejects(reservarExecucaoRemota({ plano, env: { ...env, GITHUB_RUN_ATTEMPT: "2" }, fetchImpl }), /primeira tentativa/);
  assert.equal(calls.length, count);
  assert.equal(refs.size, 1);
});

test("falha de reserva impede chamadas pagas e criacao de ledger", async () => fixture(async root => {
  let chamadas = 0;
  await assert.rejects(executarAvaliacao({ plano, root, reservar: async () => { throw new Error("reserva negada"); }, enviar: async () => { chamadas++; } }), /reserva negada/);
  assert.equal(chamadas, 0);
  assert.equal(fs.existsSync(path.join(root, ".editorial")), false);
}));

test("API rejeitada nao vaza corpo/credencial nem tenta novamente", async () => {
  let chamadas = 0;
  await assert.rejects(enviarOpenAI(plano.tarefas[0].payload, { apiKey: "segredo-fixture", fetchImpl: async () => {
    chamadas++;
    return { ok: false, status: 429, text: async () => "segredo-fixture" };
  }}), error => /HTTP 429/.test(error.message) && !error.message.includes("segredo-fixture"));
  assert.equal(chamadas, 1);
});

test("matriz e revisao geram rascunho pendente sem modificar catalogo", async () => fixture(async root => {
  let chamadas = 0;
  const resultado = await executarAvaliacao({ plano, root, reservar: async () => ({ escopo: plano.escopo }), enviar: async payload => {
    const indice = chamadas++;
    if (indice < 15) return resposta(artigo(plano.tarefas[indice].caso));
    return resposta(JSON.parse(payload.messages[1].content));
  }});
  assert.equal(chamadas, 16);
  assert.equal(resultado.publicado, false);
  assert.equal(resultado.rascunhoGerado, true);
  assert.equal(fs.readFileSync(path.join(root, "titulos.json"), "utf8"), "[]");
  const diretorio = path.join(root, ".editorial/rascunhos");
  const rascunho = JSON.parse(fs.readFileSync(path.join(diretorio, fs.readdirSync(diretorio)[0]), "utf8"));
  assert.equal(rascunho.revisaoHumana, null);
  assert.equal(rascunho.estado, "revisao_pendente");
  assert.equal(rascunho.dossie.duplicidade.decisao, "pendente");
  assert.equal(rascunho.humanizacao.aceita, true);
  await assert.rejects(executarAvaliacao({ plano, root, reservar: async () => assert.fail("Nao reservar novamente") }), /Diretorio de avaliacao ja existe/);
  const ledger = JSON.parse(fs.readFileSync(path.join(root, ".editorial/avaliacao-modelos/orcamento.json"), "utf8"));
  assert.equal(ledger.chamadas.length, 16);
  assert.ok(ledger.chamadas.reduce((s, c) => s + c.comprometidoUsd, 0) < 2);
}));

test("erro apos envio conserva reserva e impede retomada silenciosa", async () => fixture(async root => {
  let chamadas = 0;
  await assert.rejects(executarAvaliacao({ plano, root, reservar: async () => ({}), enviar: async () => { chamadas++; throw new Error("timeout-fixture"); } }), /timeout-fixture/);
  const ledger = JSON.parse(fs.readFileSync(path.join(root, ".editorial/avaliacao-modelos/orcamento.json"), "utf8"));
  assert.equal(chamadas, 1);
  assert.equal(ledger.chamadas[0].estado, "resultado-incerto-reserva-mantida");
  assert.ok(ledger.chamadas[0].comprometidoUsd > 0);
}));
