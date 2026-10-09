const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cheerio = require("cheerio");
const { gerarPrevia, salvarPrevia } = require("./editorial-preview");

const rascunho = { titulo: "Confirmacoes & <teste>", resumo: "Resumo seguro", corpoArtigo: "<p>Texto do artigo para conferencia.</p>", estado: "revisao_pendente", revisaoHumana: null };

test("previa escapa metadados, nao declara aprovacao e bloqueia scripts e recursos externos", () => {
  const $ = cheerio.load(gerarPrevia(rascunho));
  assert.equal($("h1").text(), rascunho.titulo);
  assert.equal($("article").text(), "Texto do artigo para conferencia.");
  assert.equal($("script").length, 0);
  assert.match($("aside").text(), /Revisao humana registrada: nao/);
  assert.equal($('meta[name="robots"]').attr("content"), "noindex,nofollow");
  assert.match($('meta[http-equiv="Content-Security-Policy"]').attr("content"), /default-src 'none'/);
  for (const corpoArtigo of ['<script>alert(1)</script>', '<a href="javascript:alert(1)">x</a>', '<p onclick="alert(1)">x</p>']) {
    assert.throws(() => gerarPrevia({ ...rascunho, corpoArtigo }), /HTML inseguro/);
  }
});

test("previa e idempotente, privada e nao altera rascunho nem catalogo", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "editorial-preview-"));
  try {
    const conteudo = JSON.stringify(rascunho);
    fs.writeFileSync(path.join(root, "draft.json"), conteudo);
    fs.writeFileSync(path.join(root, "titulos.json"), "[]");
    const primeira = salvarPrevia("draft.json", { root });
    assert.ok(primeira.startsWith(path.join(root, ".editorial", "previas")));
    assert.equal(salvarPrevia("draft.json", { root }), primeira);
    assert.equal(fs.readFileSync(path.join(root, "draft.json"), "utf8"), conteudo);
    assert.equal(fs.readFileSync(path.join(root, "titulos.json"), "utf8"), "[]");
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
