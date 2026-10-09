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
const { hashArquivo, hashRegistros } = require("./article-lifecycle");

function decidirCiclo({ cadastro, manifesto, salvar }, acao = "retirar") {
  const url = cadastro[0].url;
  Object.assign(manifesto.decisoes[0], { acao, arquivoHash: hashArquivo(fs.readFileSync(url, "utf8")),
    registrosHash: hashRegistros([cadastro[0]]) });
  if (acao === "consolidar") Object.assign(manifesto.decisoes[0], {
    destino: cadastro[1].url, destinoConteudoHash: manifesto.decisoes[0].conteudoHash
  });
  salvar();
}

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

test("CLI aplica o hash e reconstrui sem depender da ordem de require", () => fixture(({ cadastro, corpo }) => {
  const comando = path.join(__dirname, "indexation-policy.js");
  const plano = JSON.parse(execFileSync(process.execPath, [comando], { encoding: "utf8" }));
  const saida = execFileSync(process.execPath, [comando, "--apply", plano.hash], { encoding: "utf8" });
  assert.match(saida, /"noindex": 1/);
  const $ = cheerio.load(fs.readFileSync(cadastro[0].url, "utf8"));
  assert.equal($(".article-body").html(), corpo);
  assert.match($("meta[name=robots]").attr("content"), /noindex/);
  assert.equal(JSON.parse(execFileSync(process.execPath, [comando, "--check"], { encoding: "utf8" })).alteracoes, 0);
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

test("retirada preserva copia recuperavel e remove arquivo e cadastro em dois rebuilds", () => fixture(ctx => {
  const { cadastro } = ctx;
  const url = cadastro[0].url;
  const original = fs.readFileSync(url, "utf8");
  decidirCiclo(ctx);
  const plano = planejarIndexacao();
  assert.equal(plano.resumo.exclusoes, 1);
  assert.equal(plano.resumo.registrosArquivados, 1);
  assert.equal(fs.readFileSync(url, "utf8"), original);
  assert.throws(reconstruirPaginasSeo, /diverge do HTML/);
  aplicarIndexacao({ hashConferido: plano.hash, rebuild: reconstruirPaginasSeo });
  const backup = JSON.parse(fs.readFileSync(plano.operacoes[0].arquivoBackup));
  assert.deepEqual(backup.registros, [cadastro[0]]);
  assert.equal(backup.arquivos[0].html, original);
  for (let i = 0; i < 2; i++) {
    reconstruirPaginasSeo();
    assert.equal(fs.existsSync(url), false);
    assert.equal(JSON.parse(fs.readFileSync("titulos.json")).some(r => r.url === url), false);
    for (const arquivo of ["index.html", "arquivo/2026-10.html", "rss.xml", "sitemap.xml", cadastro[1].url]) assert.ok(!fs.readFileSync(arquivo, "utf8").includes(url));
    assert.equal(exigirManifestoAplicado().resumo.alteracoes, 0);
  }
  execFileSync(process.execPath, [path.join(__dirname, "seo-backfill-articles.js")], { stdio: "pipe" });
  assert.equal(fs.existsSync(url), false);
  fs.writeFileSync(url, original);
  assert.throws(reconstruirPaginasSeo, /diverge do HTML/);
}));

test("consolidacao aponta diretamente para artigo equivalente revisado, nunca categoria", () => fixture(ctx => {
  decidirCiclo(ctx, "consolidar");
  const url = ctx.cadastro[0].url, destino = ctx.cadastro[1].url;
  aplicarIndexacao({ hashConferido: planejarIndexacao().hash, rebuild: reconstruirPaginasSeo });
  for (let i = 0; i < 2; i++) {
    reconstruirPaginasSeo();
    const $ = cheerio.load(fs.readFileSync(url, "utf8"));
    assert.equal($(".article-body").length, 0);
    assert.equal($("link[rel=canonical]").attr("href"), `https://www.andersondamasio.com.br/${destino}`);
    assert.equal($("meta[http-equiv=refresh]").attr("content"), `0; url=https://www.andersondamasio.com.br/${destino}`);
    for (const arquivo of ["index.html", "rss.xml", "sitemap.xml"]) {
      assert.ok(!fs.readFileSync(arquivo, "utf8").includes(url));
      assert.ok(fs.readFileSync(arquivo, "utf8").includes(destino));
    }
    assert.equal(exigirManifestoAplicado().resumo.alteracoes, 0);
  }
  fs.writeFileSync(destino, fs.readFileSync(destino, "utf8").replace(/<h1>[^<]*<\/h1>/, "<h1>Titulo mais claro, mesmo corpo</h1>"));
  assert.equal(exigirManifestoAplicado().resumo.alteracoes, 0);
  execFileSync(process.execPath, [path.join(__dirname, "seo-backfill-articles.js")], { stdio: "pipe" });
  assert.equal(exigirManifestoAplicado().resumo.alteracoes, 0);
}));

test("backup corrompido ou cadastro reintroduzido nao passa como decisao aplicada", () => fixture(ctx => {
  decidirCiclo(ctx);
  const plano = planejarIndexacao();
  aplicarIndexacao({ hashConferido: plano.hash, rebuild: reconstruirPaginasSeo });
  fs.writeFileSync("titulos.json", JSON.stringify(ctx.cadastro));
  assert.throws(exigirManifestoAplicado, /diverge do HTML/);
  fs.writeFileSync("titulos.json", JSON.stringify([ctx.cadastro[1]]));
  const arquivo = plano.operacoes[0].arquivoBackup;
  const backup = JSON.parse(fs.readFileSync(arquivo));
  backup.arquivos[0].html += "alterado";
  fs.writeFileSync(arquivo, JSON.stringify(backup));
  assert.throws(exigirManifestoAplicado, /Arquivo original divergiu/);
}));

test("retirada com alias comprovado exclui ambos; referencias editoriais nao corrigidas revertem tudo", () => fixture(ctx => {
  const url = ctx.cadastro[0].url;
  const alias = "arquitetura/revisar.html";
  fs.mkdirSync("arquitetura");
  const htmlAlias = require("../gerar-conteudo").gerarHtmlAliasLegado({ origem: alias, destino: url, titulo: "Alias" });
  fs.writeFileSync(alias, htmlAlias);
  decidirCiclo(ctx);
  ctx.manifesto.decisoes[0].aliases = [{ url: alias, arquivoHash: hashArquivo(htmlAlias) }];
  ctx.salvar();
  fs.writeFileSync("sobre.html", `<html><body><a href="/${url}">Referencia a corrigir</a></body></html>`);
  const antes = fs.readFileSync(url, "utf8"), cadastroAntes = fs.readFileSync("titulos.json", "utf8");
  const plano = planejarIndexacao();
  assert.throws(() => aplicarIndexacao({ hashConferido: plano.hash, rebuild: reconstruirPaginasSeo }), /Referencias a URLs retiradas/);
  assert.equal(fs.readFileSync(url, "utf8"), antes);
  assert.equal(fs.readFileSync(alias, "utf8"), htmlAlias);
  assert.equal(fs.readFileSync("titulos.json", "utf8"), cadastroAntes);
  assert.equal(fs.existsSync(plano.operacoes[0].arquivoBackup), false);
  fs.writeFileSync("sobre.html", "<html><body>Referencia removida apos revisao.</body></html>");
  aplicarIndexacao({ hashConferido: planejarIndexacao().hash, rebuild: reconstruirPaginasSeo });
  assert.equal(fs.existsSync(url), false);
  assert.equal(fs.existsSync(alias), false);
}));

test("retira aviso sem corpo com cadastro duplicado, mas nao perde registros historicos", () => fixture(ctx => {
  const url = ctx.cadastro[0].url;
  fs.writeFileSync(url, "<html><head><meta name=robots content=noindex></head><body>Indisponivel</body></html>");
  decidirCiclo(ctx);
  const cadastro = [ctx.cadastro[0], { ...ctx.cadastro[0], titulo: "Outro titulo na mesma URL", localizacao: { estado: "pendente" } }, ctx.cadastro[1]];
  fs.writeFileSync("titulos.json", JSON.stringify(cadastro));
  ctx.manifesto.decisoes[0].registrosHash = hashRegistros(cadastro.slice(0, 2));
  delete ctx.manifesto.decisoes[0].conteudoHash;
  ctx.salvar();
  const plano = planejarIndexacao();
  aplicarIndexacao({ hashConferido: plano.hash, rebuild: reconstruirPaginasSeo });
  const backup = JSON.parse(fs.readFileSync(plano.operacoes[0].arquivoBackup));
  assert.deepEqual(backup.registros, cadastro.slice(0, 2));
  assert.equal(JSON.parse(fs.readFileSync("titulos.json")).length, 1);
}));

test("bloqueia hash de arquivo/cadastro, destino alterado, ciclo, categoria e noindex", () => fixture(ctx => {
  decidirCiclo(ctx, "consolidar");
  const original = structuredClone(ctx.manifesto);
  for (const alterar of [
    m => m.decisoes[0].arquivoHash = "a".repeat(64),
    m => m.decisoes[0].registrosHash = "a".repeat(64),
    m => m.decisoes[0].destinoConteudoHash = "a".repeat(64),
    m => m.decisoes[0].destino = m.decisoes[0].url,
    m => m.decisoes[0].destino = "artigos/arquitetura.html",
    m => m.decisoes[0].aliases = [{ url: "../escape.html", arquivoHash: "a".repeat(64) }],
    m => m.protegidas.push(m.decisoes[0].url),
    m => m.decisoes.push({ ...m.decisoes[0], url: ctx.cadastro[1].url, destino: ctx.cadastro[0].url })
  ]) {
    Object.assign(ctx.manifesto, structuredClone(original));
    alterar(ctx.manifesto); ctx.salvar();
    assert.throws(planejarIndexacao);
  }
  Object.assign(ctx.manifesto, structuredClone(original)); ctx.salvar();
  const destino = ctx.cadastro[1].url;
  fs.writeFileSync(destino, fs.readFileSync(destino, "utf8").replace("index, follow", "noindex, follow"));
  assert.throws(planejarIndexacao, /Destino mudou/);
}));
