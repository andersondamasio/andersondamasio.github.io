const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { selecionarPacote } = require("./editorial-queue");
const { aprovacaoFixture, rascunhoFixture } = require("./fixtures/editorial-review");

function fixture(run) {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, "perfil-queue-test-"));
  const gravar = (arquivo, valor) => {
    fs.mkdirSync(path.dirname(path.join(root, arquivo)), { recursive: true });
    fs.writeFileSync(path.join(root, arquivo), JSON.stringify(valor));
  };
  const aprovado = aprovacaoFixture();
  const arquivo = `dados/editorial/aprovados/${aprovado.revisaoHumana.hash}.json`;
  gravar(arquivo, aprovado);
  gravar("titulos.json", []);
  gravar("dados/editorial/fila.json", { versao: 1, pacotes: [arquivo] });
  const selecionar = extra => selecionarPacote({ root, agora: new Date("2026-10-09T12:00:00Z"), ...extra });
  try { run({ root, gravar, aprovado, arquivo, selecionar }); } finally {
    if (path.dirname(path.resolve(root)) !== base || !path.basename(root).startsWith("perfil-queue-test-")) throw new Error("Temporario fora do escopo.");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("fila vazia nao seleciona nem aprova rascunho", () => fixture(({ root, gravar, selecionar }) => {
  gravar("dados/editorial/fila.json", { versao: 1, pacotes: [] });
  gravar(".editorial/rascunhos/pendente.json", rascunhoFixture());
  assert.deepEqual(selecionar(), { elegivel: false, pacote: null, motivo: "fila-vazia" });
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, ".editorial/rascunhos/pendente.json"))).revisaoHumana, null);
}));

test("seleciona versao aprovada, inclusive escolha manual, sem escrever pacote", () => fixture(({ root, arquivo, selecionar }) => {
  const antes = fs.readFileSync(path.join(root, arquivo), "utf8");
  assert.equal(selecionar().pacote, arquivo);
  assert.equal(selecionar({ pacote: arquivo }).pacote, arquivo);
  assert.equal(fs.readFileSync(path.join(root, arquivo), "utf8"), antes);
}));

test("cadencia e respeitada e libera no limite exato de sete dias", () => fixture(({ gravar, selecionar }) => {
  gravar("titulos.json", [{ data: "2026-10-02T12:00:01Z" }]);
  assert.equal(selecionar().motivo, "intervalo-de-sete-dias");
  assert.equal(selecionar({ agora: new Date("2026-10-09T12:00:01Z") }).elegivel, true);
}));

test("fila pula pacote publicado sem permitir replay manual", () => fixture(({ gravar, aprovado, arquivo, selecionar }) => {
  const segundo = aprovacaoFixture(rascunhoFixture({ titulo: "Fronteiras de servicos e suas dependencias" }));
  const caminho = `dados/editorial/aprovados/${segundo.revisaoHumana.hash}.json`;
  gravar(caminho, segundo);
  gravar("dados/editorial/fila.json", { versao: 1, pacotes: [arquivo, caminho] });
  gravar("titulos.json", [{ data: "2026-10-01T12:00:00Z", editorial: { hash: aprovado.revisaoHumana.hash } }]);
  assert.equal(selecionar().pacote, caminho);
  assert.throws(() => selecionar({ pacote: arquivo }), /ja publicado/);
  gravar("dados/editorial/fila.json", { versao: 1, pacotes: [arquivo] });
  assert.equal(selecionar().motivo, "fila-ja-publicada");
}));

test("nova sobreposicao no acervo exige revisao antes de selecionar", () => fixture(({ gravar, aprovado, selecionar }) => {
  gravar("titulos.json", [{ titulo: aprovado.titulo, url: "artigos/existente.html", urlFonte: aprovado.fonte.url, data: "2026-09-01T00:00:00Z" }]);
  assert.throws(selecionar, /sobreposicao-a-revisar/);
}));

test('fila automatica e selecao manual retem mesma fonte com rastreamento diferente', () => fixture(({ root, gravar, aprovado, arquivo, selecionar }) => {
  gravar('titulos.json', [{ titulo: 'Outro recorte sem palavras em comum', url: 'artigos/existente.html',
    urlFonte: aprovado.fonte.url + '?utm_source=feed#secao', data: '2026-09-01T00:00:00Z' }]);
  const antes = fs.readFileSync(path.join(root, arquivo), 'utf8');
  assert.throws(selecionar, /sobreposicao-a-revisar/);
  assert.throws(() => selecionar({ pacote: arquivo }), /sobreposicao-a-revisar/);
  assert.equal(fs.readFileSync(path.join(root, arquivo), 'utf8'), antes);
}));

test("pacote alterado, sem aprovacao ou com revisao futura nao e selecionado", () => fixture(({ gravar, aprovado, arquivo, selecionar }) => {
  gravar(arquivo, { ...aprovado, corpoArtigo: aprovado.corpoArtigo + "<p>Texto diferente.</p>" });
  assert.throws(selecionar, /Hash divergente/);
  gravar(arquivo, { ...aprovado, estado: "revisao_pendente" });
  assert.throws(selecionar, /Pacote nao aprovado/);
  gravar(arquivo, { ...aprovado, revisaoHumana: { ...aprovado.revisaoHumana, aprovadaEm: "2099-01-01T00:00:00Z" } });
  assert.throws(selecionar, /Pacote nao aprovado/);
}));

test("rejeita paths externos, pacotes repetidos e arquivo ausente", () => fixture(({ gravar, arquivo, selecionar }) => {
  for (const pacotes of [["../../privado.json"], [arquivo, arquivo], ["dados/editorial/aprovados/" + "0".repeat(64) + ".json"]]) {
    gravar("dados/editorial/fila.json", { versao: 1, pacotes });
    assert.throws(selecionar);
  }
}));

test("CLI informa ausencia e sucesso ao workflow sem publicar", () => fixture(({ root, gravar }) => {
  gravar("dados/editorial/fila.json", { versao: 1, pacotes: [] });
  const output = path.join(root, "github-output.txt");
  const resposta = execFileSync(process.execPath, [path.join(__dirname, "editorial-queue.js")], {
    cwd: root, encoding: "utf8", env: { ...process.env, PACOTE: "", GITHUB_OUTPUT: output }
  });
  assert.equal(JSON.parse(resposta).motivo, "fila-vazia");
  assert.equal(fs.readFileSync(output, "utf8"), "elegivel=false\npacote=\n");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "titulos.json"))), []);
}));
