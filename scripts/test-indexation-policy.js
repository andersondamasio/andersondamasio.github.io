const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const cheerio = require("cheerio");
const { execFileSync } = require("node:child_process");
const { planejarIndexacao, exigirManifestoAplicado, aplicarIndexacao } = require("./indexation-policy");
const { hashCorpoEditorial } = require("./seo-helpful-content");
const { reconstruirPaginasSeo } = require("../gerar-conteudo");

function fixture(run) {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, "perfil-indexation-test-"));
  const cwd = process.cwd();
  try {
    process.chdir(root);
    fs.mkdirSync("dados");
    fs.mkdirSync("artigos/arquitetura", { recursive: true });
    const cadastro = ["revisar", "preservar"].map(nome => ({ url: `artigos/arquitetura/${nome}.html`, titulo: `Contratos para ${nome}`, categoria: "Arquitetura", data: "2026-10-01T12:00:00Z" }));
    const corpo = "<p>Exemplo de conteudo cujo valor precisa de revisao individual.</p>";
    for (const a of cadastro) fs.writeFileSync(a.url, `<html><head><title>${a.titulo}</title><link rel="canonical" href="https://www.andersondamasio.com.br/${a.url}"><meta name="robots" content="index, follow"></head><body><h1>${a.titulo}</h1><div class="article-body">${corpo}</div></body></html>`);
    fs.writeFileSync("titulos.json", JSON.stringify(cadastro));
    const manifesto = { versao: 1, protegidas: ["index.html", "sobre.html", "contato.html"], decisoes: [{
      url: cadastro[0].url, acao: "noindex", motivo: "Conteudo retido para revisao editorial especifica, sem conclusao sobre penalizacao.",
      evidencia: "Trecho e contexto conferidos para esta decisao de teste, sem servir de criterio global.",
      revisao: { responsavel: "Revisor fixture", em: "2026-01-01T00:00:00Z" }, conteudoHash: hashCorpoEditorial(corpo)
    }] };
    const salvar = () => fs.writeFileSync("dados/indexacao.json", JSON.stringify(manifesto));
    salvar();
    run({ root, cadastro, corpo, manifesto, salvar });
  } finally {
    process.chdir(cwd);
    if (path.dirname(root) !== base || !path.basename(root).startsWith("perfil-indexation-test-")) throw new Error("Temporario fora do escopo.");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("dry-run nao escreve; aplicacao transacional mantem texto e decisoes em dois rebuilds", () => fixture(({ cadastro, corpo }) => {
  const url = cadastro[0].url;
  const antes = fs.readFileSync(url, "utf8");
  const plano = planejarIndexacao();
  assert.equal(plano.resumo.alteracoes, 1);
  assert.equal(fs.readFileSync(url, "utf8"), antes);
  assert.throws(exigirManifestoAplicado, /diverge do HTML/);
  assert.throws(reconstruirPaginasSeo, /diverge do HTML/);
  assert.equal(fs.readFileSync(url, "utf8"), antes);
  aplicarIndexacao({ hashConferido: plano.hash, rebuild: reconstruirPaginasSeo });
  const aplicado = fs.readFileSync(url, "utf8");
  execFileSync(process.execPath, [path.join(__dirname, "seo-backfill-articles.js")], { stdio: "pipe" });
  assert.equal(fs.readFileSync(url, "utf8"), aplicado);
  for (let i = 0; i < 2; i++) {
    reconstruirPaginasSeo();
    const $ = cheerio.load(fs.readFileSync(url, "utf8"));
    assert.equal($(".article-body").html(), corpo);
    assert.match($("meta[name=robots]").attr("content"), /noindex/);
    assert.equal($("link[rel=canonical]").attr("href"), `https://www.andersondamasio.com.br/${url}`);
    for (const arquivo of ["index.html", "arquivo/2026-10.html", "rss.xml", "sitemap.xml", cadastro[1].url]) assert.ok(!fs.readFileSync(arquivo, "utf8").includes(url));
    assert.equal(exigirManifestoAplicado().resumo.alteracoes, 0);
  }
}));

test("mudanca de corpo ou HTML invalida a decisao ou o dry-run", () => fixture(({ cadastro }) => {
  const plano = planejarIndexacao();
  const url = cadastro[0].url;
  fs.appendFileSync(url, "\n");
  assert.throws(() => aplicarIndexacao({ hashConferido: plano.hash, rebuild: () => assert.fail() }), /Dry-run desatualizado/);
  fs.writeFileSync(url, fs.readFileSync(url, "utf8").replace("cujo valor", "alterado cujo valor"));
  assert.throws(planejarIndexacao, /Corpo divergiu/);
}));

test("rejeita URL protegida, sem evidencia, ambigua e operacao destrutiva", () => fixture(({ manifesto, salvar }) => {
  const original = structuredClone(manifesto);
  for (const alterar of [
    m => m.protegidas.push(m.decisoes[0].url),
    m => m.decisoes[0].evidencia = "curto",
    m => m.decisoes.push(structuredClone(m.decisoes[0])),
    m => m.decisoes[0].acao = "consolidar",
    m => m.decisoes[0].acao = "retirar",
    m => m.decisoes[0].url = "../index.html"
  ]) {
    Object.assign(manifesto, structuredClone(original));
    alterar(manifesto);
    salvar();
    assert.throws(planejarIndexacao);
  }
}));

test("falha no rebuild reverte robots e nao modifica corpo", () => fixture(({ cadastro }) => {
  const url = cadastro[0].url;
  const antes = fs.readFileSync(url, "utf8");
  assert.throws(() => aplicarIndexacao({ hashConferido: planejarIndexacao().hash, rebuild: () => { throw new Error("falha fixture"); } }), /falha fixture/);
  assert.equal(fs.readFileSync(url, "utf8"), antes);
  assert.equal(fs.existsSync(".editorial/publicacao-em-andamento"), false);
}));

test("manter ou atualizar requer decisao explicita para retornar a indexacao", () => fixture(({ cadastro, manifesto, salvar }) => {
  aplicarIndexacao({ hashConferido: planejarIndexacao().hash, rebuild: reconstruirPaginasSeo });
  for (const acao of ["atualizar", "manter"]) {
    manifesto.decisoes[0].acao = acao;
    salvar();
    aplicarIndexacao({ hashConferido: planejarIndexacao().hash, rebuild: reconstruirPaginasSeo });
    assert.ok(fs.readFileSync("sitemap.xml", "utf8").includes(cadastro[0].url));
    assert.doesNotMatch(cheerio.load(fs.readFileSync(cadastro[0].url, "utf8"))("meta[name=robots]").attr("content"), /noindex/);
  }
}));
