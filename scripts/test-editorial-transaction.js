const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { executarPublicacao, escreverPublicacao, recuperarPublicacaoInterrompida } = require("./editorial-transaction");

function workspace(executar) {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, "perfil-transaction-test-"));
  try { return executar(root); } finally {
    if (path.dirname(path.resolve(root)) !== base || !path.basename(root).startsWith("perfil-transaction-test-")) throw new Error("Temporario fora do escopo");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("transacao aplica alteracoes e preserva o primeiro backup para multiplas escritas", () => workspace(root => {
  const arquivo = path.join(root, "index.html");
  fs.writeFileSync(arquivo, "anterior");
  executarPublicacao(() => {
    escreverPublicacao(arquivo, "intermediario");
    escreverPublicacao(arquivo, "final");
  }, root);
  assert.equal(fs.readFileSync(arquivo, "utf8"), "final");
  assert.equal(fs.existsSync(path.join(root, ".editorial", "publicacao-em-andamento")), false);
}));

test("falha no rebuild restaura bytes anteriores e remove somente os arquivos criados", () => workspace(root => {
  const arquivo = path.join(root, "index.html");
  const criado = path.join(root, "artigos", "novo.html");
  const bytes = Buffer.from([0xef, 0xbb, 0xbf, 0x61, 0x0d, 0x0a]);
  fs.writeFileSync(arquivo, bytes);
  assert.throws(() => executarPublicacao(() => {
    escreverPublicacao(arquivo, "intermediario");
    escreverPublicacao(criado, "novo artigo");
    escreverPublicacao(arquivo, "final");
    throw new Error("falha simulada");
  }, root), /falha simulada/);
  assert.deepEqual(fs.readFileSync(arquivo), bytes);
  assert.equal(fs.existsSync(criado), false);
}));

test("transacao bloqueia concorrencia e caminhos fora do site", () => workspace(root => {
  executarPublicacao(() => {
    assert.throws(() => executarPublicacao(() => {}, root), /andamento/);
    assert.throws(() => escreverPublicacao(path.join(root, "..", "escape.txt"), "x"), /fora do site/);
    assert.throws(() => escreverPublicacao(path.join(root, ".git", "config"), "x"), /fora do site/);
  }, root);
  const lock = path.join(root, ".editorial", "publicacao-em-andamento");
  fs.mkdirSync(lock);
  assert.throws(() => executarPublicacao(() => {}, root), /EEXIST/);
}));

test("recuperacao explicita restaura journal de processo interrompido", () => workspace(root => {
  const pasta = path.join(root, ".editorial", "publicacao-em-andamento");
  fs.mkdirSync(pasta, { recursive: true });
  const destino = path.join(root, "index.html");
  fs.writeFileSync(destino, "escrita parcial");
  fs.writeFileSync(path.join(pasta, "0.bak"), "antes");
  fs.writeFileSync(path.join(pasta, "journal.json"), JSON.stringify([{ destino, backup: "0.bak", existia: true }]));
  recuperarPublicacaoInterrompida(root);
  assert.equal(fs.readFileSync(destino, "utf8"), "antes");
  assert.equal(fs.existsSync(pasta), false);
}));
