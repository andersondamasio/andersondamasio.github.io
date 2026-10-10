const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const cheerio = require("cheerio");
const { descricaoSeoUtilizavel } = require("./seo-description");
const { gerarDescricaoSeo, gerarSeoHead, reconstruirPaginasSeo, publicarRascunhoAprovado } = require("../gerar-conteudo");
const { rascunhoFixture, aprovacaoFixture } = require("./fixtures/editorial-review");

function workspace(run) {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, "perfil-description-test-"));
  const cwd = process.cwd();
  try { process.chdir(root); return run(root); } finally {
    process.chdir(cwd);
    if (path.dirname(path.resolve(root)) !== base || !path.basename(root).startsWith("perfil-description-test-")) throw new Error("Temporario fora do escopo.");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function descricoes(html) {
  const q = cheerio.load(html);
  return [q('meta[name=description]').attr('content'), q('meta[property="og:description"]').attr('content'), q('meta[name="twitter:description"]').attr('content')];
}

test("descricao valida nao depende de um minimo de caracteres", () => {
  for (const texto of ["Fila duravel e confirmacoes de entrega.", "Contatos e criterios editoriais de Anderson Damasio.",
    "a".repeat(69), "b".repeat(70), "c".repeat(71)]) {
    assert.equal(descricaoSeoUtilizavel(texto), true);
    assert.equal(gerarDescricaoSeo(texto, "Titulo de teste"), texto);
  }
  // Syntactic acceptance does not certify that a description is useful.
  for (const texto of [null, undefined, "", "  ", "---", "...", "***", "?!", "Introdu\u00e7\u00e3o:", "Resumo", "T\u00edtulo.", "Descri\u00e7\u00e3o:"]) {
    assert.equal(descricaoSeoUtilizavel(texto), false, String(texto));
  }
});

test("head preserva descricao curta e escape em artigos e paginas de colecao", () => {
  const description = 'Fila & broker: "confirmacoes" para pedidos.';
  for (const type of ["website", "article"]) {
    const html = gerarSeoHead({ title: "Contrato", description, canonicalPath: "/contrato.html", type });
    assert.deepEqual(descricoes(html), [description, description, description]);
    assert.equal(cheerio.load(html)("script:not([type='application/ld+json'])").length, 0);
  }
});

test("fallback respeita tipo de pagina e mantem limpeza e limite editorial existente", () => {
  assert.equal(gerarDescricaoSeo("Introducao:", "Arquivo de artigos", "website"), "Arquivo de artigos");
  assert.match(gerarDescricaoSeo("---", "Contratos", "article"), /^Artigo de Anderson Damasio sobre Contratos/);
  assert.equal(gerarDescricaoSeo('<script>alert(1)</script><p>Contrato da fila.</p>', "Contrato"), "Contrato da fila.");
  const longa = "Uma descricao especifica sobre estados de entrega e confirmacoes da aplicacao. ".repeat(5);
  const limitada = gerarDescricaoSeo(longa, "Contrato");
  assert.ok(limitada.length <= 160);
  assert.match(limitada, /\.\.\.$/);
});

test("categoria paginada usa descricao propria em meta, redes e JSON-LD apos dois rebuilds", () => workspace(() => {
  fs.mkdirSync("artigos/cloud", { recursive: true });
  const cadastro = Array.from({ length: 11 }, (_, i) => ({ titulo: `Contrato cloud ${i}`, url: `artigos/cloud/contrato-${i}.html`, categoria: "Cloud", data: "2026-10-01T12:00:00Z" }));
  for (const r of cadastro) fs.writeFileSync(r.url, `<html><head><title>${r.titulo}</title></head><body><h1>${r.titulo}</h1><div class="article-body"><p>Contrato de teste de configuracao.</p></div></body></html>`);
  fs.writeFileSync("titulos.json", JSON.stringify(cadastro));
  reconstruirPaginasSeo();
  const html = fs.readFileSync("artigos/cloud2.html", "utf8");
  const description = "P\u00e1gina 2 dos artigos sobre Cloud escritos por Anderson Damasio.";
  assert.ok(description.length < 70);
  assert.deepEqual(descricoes(html), [description, description, description]);
  const q = cheerio.load(html), schema = JSON.parse(q("script[type='application/ld+json']").first().text());
  assert.equal(schema["@type"], "CollectionPage");
  assert.equal(schema.description, description);
  assert.match(q('meta[name=robots]').attr("content"), /noindex/);
  assert.equal(q('link[rel=canonical]').attr('href'), 'https://www.andersondamasio.com.br/artigos/cloud2.html');
  reconstruirPaginasSeo();
  assert.equal(fs.readFileSync("artigos/cloud2.html", "utf8"), html);
}));

test("publicacao de fixture aprovada preserva resumo curto no backfill, RSS e schema", () => workspace(root => {
  fs.writeFileSync("titulos.json", "[]");
  const resumo = "Contratos de eventos para comparar consumidores.";
  const aprovado = aprovacaoFixture(rascunhoFixture({ resumo }));
  const { url } = publicarRascunhoAprovado(aprovado, { agora: new Date("2026-10-02T12:00:00Z") });
  const original = cheerio.load(fs.readFileSync(url, "utf8"));
  assert.deepEqual(descricoes(original.html()), [resumo, resumo, resumo]);
  const manter = () => execFileSync(process.execPath, [path.join(__dirname, "seo-backfill-articles.js")], { cwd: root, stdio: "pipe" });
  manter();
  const primeiro = fs.readFileSync(url, "utf8");
  manter();
  assert.equal(fs.readFileSync(url, "utf8"), primeiro);
  const q = cheerio.load(primeiro);
  assert.deepEqual(descricoes(primeiro), [resumo, resumo, resumo]);
  assert.equal(q('.article-body').html(), original('.article-body').html());
  assert.equal(q('.article-validation').attr('data-editorial-status'), 'revisado');
  assert.equal(JSON.parse(q("script[type='application/ld+json']").first().text()).description, resumo);
  reconstruirPaginasSeo();
  const rss = cheerio.load(fs.readFileSync("rss.xml", "utf8"), { xmlMode: true });
  assert.equal(rss('item description').text(), resumo);
}));

test("backfill usa prosa curta sem substituir por texto padrao ou alterar o corpo", () => workspace(root => {
  const url = 'artigos/cloud/contrato.html', corpo = '<p>Confirmacao da mensagem nao prova pagamento.</p>';
  fs.mkdirSync("artigos/cloud", { recursive: true });
  fs.writeFileSync('titulos.json', JSON.stringify([{ titulo: 'Contrato da mensagem', url, categoria: 'Cloud', data: '2026-10-01T12:00:00Z' }]));
  fs.writeFileSync(url, `<html><head><title>Contrato</title><meta name="description" content="Introducao"></head><body><main><h1>Contrato da mensagem</h1><div class="article-body">${corpo}</div></main></body></html>`);
  execFileSync(process.execPath, [path.join(__dirname, 'seo-backfill-articles.js')], { cwd: root, stdio: 'pipe' });
  const html = fs.readFileSync(url, 'utf8');
  assert.deepEqual(descricoes(html), Array(3).fill('Confirmacao da mensagem nao prova pagamento.'));
  assert.equal(cheerio.load(html)('.article-body').html(), corpo);
}));

test("auditoria aceita descricoes curtas e acusa placeholders e fallback de artigo em colecoes", () => workspace(root => {
  const casos = { curta: 'Contrato de entrega de mensagens.', placeholder: 'Introducao', pontuacao: '...',
    colecao: 'Artigo de Anderson Damasio sobre Categoria Cloud, com reflexoes praticas.', ausente: '' };
  for (const [nome, content] of Object.entries(casos)) {
    fs.writeFileSync(`${nome}.html`, `<html><head><title>${nome}</title><meta name="description" content="${content}"><script type="application/ld+json">{"@type":"CollectionPage"}</script></head><body><h1>${nome}</h1></body></html>`);
  }
  const r = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'seo-audit.js')], { cwd: root, encoding: 'utf8' }));
  assert.deepEqual(r.issues.weakDescription.map(s => s.split(':')[0]).sort(), ['colecao.html', 'placeholder.html', 'pontuacao.html']);
  assert.deepEqual(r.issues.missingDescription, ['ausente.html']);
}));
