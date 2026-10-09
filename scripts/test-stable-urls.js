const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { planejarEstabilizacao } = require("./stabilize-article-urls");
const { prepararArtigosPublicaveis, reconstruirPaginasSeo } = require("../gerar-conteudo");
const { siteUrl } = require("./seo-identity");

function fixture(run) {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, "perfil-url-test-"));
  const cwd = process.cwd();
  try {
    const url = "artigos/arquitetura/titulo-antigo.html";
    fs.mkdirSync(path.dirname(path.join(root, url)), { recursive: true });
    fs.mkdirSync(path.join(root, "dados"));
    const html = `<html><head><title>Titulo antigo</title><link rel="canonical" href="${siteUrl}/${url}"></head><body><h1>Titulo antigo</h1><div class="article-body"><p>Artigo sobre contratos e integracao de sistemas.</p></div></body></html>`;
    fs.writeFileSync(path.join(root, url), html);
    fs.writeFileSync(path.join(root, "titulos.json"), JSON.stringify([{ titulo: "Titulo antigo", categoria: "Arquitetura", data: "2026-10-05T12:00:00Z" }]));
    process.chdir(root);
    run({ root, url, html });
  } finally {
    process.chdir(cwd);
    if (path.dirname(path.resolve(root)) !== base || !path.basename(root).startsWith("perfil-url-test-")) throw new Error("Pasta temporaria fora de escopo");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("dry-run e idempotencia; editar titulo nao muda URL ou descoberta apos dois rebuilds", () => fixture(({ root, url, html }) => {
  const antes = fs.readFileSync("titulos.json", "utf8");
  const plano = planejarEstabilizacao(root);
  assert.equal(plano.resolucoes[0].estado, "resolvido");
  assert.equal(fs.readFileSync("titulos.json", "utf8"), antes);
  assert.equal(plano.registros[0].url, url);
  fs.writeFileSync("titulos.json", JSON.stringify(plano.registros));
  assert.equal(planejarEstabilizacao(root).alterado, false);
  plano.registros[0].titulo = "Novo titulo editorial sem renomear endereco";
  fs.writeFileSync("titulos.json", JSON.stringify(plano.registros));
  assert.equal(prepararArtigosPublicaveis(plano.registros)[0].url, url);
  reconstruirPaginasSeo();
  const sitemap = fs.readFileSync("sitemap.xml", "utf8");
  const rss = fs.readFileSync("rss.xml", "utf8");
  const home = fs.readFileSync("index.html", "utf8");
  reconstruirPaginasSeo();
  assert.equal(fs.readFileSync(url, "utf8"), html);
  for (const [file, snapshot] of [["sitemap.xml", sitemap], ["rss.xml", rss], ["index.html", home]]) {
    assert.equal(fs.readFileSync(file, "utf8"), snapshot);
    assert.ok(snapshot.includes(url));
  }
}));

test("nao escolhe entre homonimos", () => fixture(({ root, url, html }) => {
  fs.mkdirSync("artigos/outros");
  fs.writeFileSync("artigos/outros/titulo-antigo.html", html.replace(url, "artigos/outros/titulo-antigo.html"));
  const plano = planejarEstabilizacao(root);
  assert.equal(plano.resolucoes[0].estado, "pendente");
  assert.equal(plano.registros[0].url, undefined);
  assert.equal(prepararArtigosPublicaveis(plano.registros).length, 0);
}));

test("nao aceita canonical divergente", () => fixture(({ root, url, html }) => {
  fs.writeFileSync(url, html.replace(`${siteUrl}/${url}`, `${siteUrl}/outro.html`));
  assert.equal(planejarEstabilizacao(root).resolucoes[0].estado, "pendente");
}));

test("cadastro com endereco obsoleto e resolvido pelo HTML comprovado e preserva alias", () => fixture(({ root, url }) => {
  const anterior = "artigos/outros/titulo-antigo.html";
  fs.writeFileSync("titulos.json", JSON.stringify([{ titulo: "Titulo antigo", url: anterior, data: "2026-10-01T12:00:00Z" }]));
  const plano = planejarEstabilizacao(root);
  assert.equal(plano.registros[0].url, url);
  assert.deepEqual(plano.registros[0].aliasesLegados, [anterior]);
  fs.writeFileSync("titulos.json", JSON.stringify(plano.registros));
  reconstruirPaginasSeo();
  const alias = fs.readFileSync(anterior, "utf8");
  assert.ok(alias.includes(`content="0; url=${siteUrl}/${url}"`));
  reconstruirPaginasSeo();
  assert.equal(fs.readFileSync(anterior, "utf8"), alias);
}));

test("URL explicita ausente nao e substituida por outro arquivo derivado do titulo", () => fixture(({ url }) => {
  assert.equal(prepararArtigosPublicaveis([{ titulo: "Titulo antigo", categoria: "Arquitetura", url: "artigos/arquitetura/inexistente.html" }]).length, 0);
  assert.equal(prepararArtigosPublicaveis([{ titulo: "Novo titulo", categoria: "Arquitetura", url }])[0].url, url);
}));

test("arquivo inexistente fica pendente, sem fabricar URL nem remover cadastro", () => fixture(({ root }) => {
  fs.writeFileSync("titulos.json", JSON.stringify([{ titulo: "Outro inexistente" }]));
  const plano = planejarEstabilizacao(root);
  assert.equal(plano.registros.length, 1);
  assert.equal(plano.registros[0].url, undefined);
  assert.equal(plano.registros[0].localizacao.motivo, "arquivo-nao-localizado");
}));

test("rebuild interrompe antes de remover artigo que perdeu vinculo no cadastro", () => fixture(({ url, html }) => {
  fs.writeFileSync("titulos.json", "[]");
  assert.throws(() => reconstruirPaginasSeo(), /Nenhum conteudo sera removido automaticamente/);
  assert.equal(fs.readFileSync(url, "utf8"), html);
  assert.equal(fs.existsSync("index.html"), false);
  assert.equal(fs.existsSync("sitemap.xml"), false);
}));

test("noindex preserva corpo, URL e cadastro em dois rebuilds sem ser divulgado", () => fixture(({ url, html }) => {
  const noindex = html.replace("</head>", '<meta name="robots" content="noindex, follow"></head>');
  fs.writeFileSync(url, noindex);
  const outro = "artigos/arquitetura/outro-contrato.html";
  const antigoRelacionado = `<section class="related-articles"><a href="/${url}">Anterior</a></section>`;
  fs.writeFileSync(outro, html.replaceAll(url, outro).replace("</body>", `${antigoRelacionado}</body>`));
  const cadastro = [{ titulo: "Titulo antigo", categoria: "Arquitetura", data: "2026-10-05T12:00:00Z", url },
    { titulo: "Outro contrato", categoria: "Arquitetura", data: "2026-10-06T12:00:00Z", url: outro }];
  fs.writeFileSync("titulos.json", JSON.stringify(cadastro));
  for (let i = 0; i < 2; i++) {
    reconstruirPaginasSeo();
    assert.equal(fs.readFileSync(url, "utf8"), noindex);
    assert.deepEqual(JSON.parse(fs.readFileSync("titulos.json", "utf8")), cadastro);
    for (const file of ["index.html", "sitemap.xml", "rss.xml", "arquivo/2026-10.html", outro]) {
      assert.ok(!fs.readFileSync(file, "utf8").includes(url), `${file} nao deve promover o artigo noindex`);
    }
  }
}));
