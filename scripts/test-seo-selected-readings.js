const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cheerio = require("cheerio");
const { hashCorpoEditorial } = require("./seo-helpful-content");
const { carregarLeituras, gerarResumoLeituras, gerarConteudoLeituras, criarSchemaLeituras } = require("./seo-selected-readings");
const { reconstruirPaginasSeo } = require("../gerar-conteudo");
const { medirNavegacao } = require("./seo-navigation");

function workspace(run) {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, "perfil-readings-test-"));
  const cwd = process.cwd();
  try { process.chdir(root); return run(root); } finally {
    process.chdir(cwd);
    if (path.dirname(root) !== base || !path.basename(root).startsWith("perfil-readings-test-")) throw new Error("Temporario fora do escopo.");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function preparar() {
  const artigo = { url: "artigos/arquitetura/contratos.html", titulo: "Contratos & limites <T>", categoria: "Arquitetura", data: "2026-01-01T12:00:00.000Z" };
  const corpo = "<p>Exemplo hipotetico de regras de um contrato.</p>";
  fs.mkdirSync("artigos/arquitetura", { recursive: true });
  fs.mkdirSync("dados");
  fs.writeFileSync(artigo.url, `<html><head><title>Contrato</title><meta name="robots" content="index, follow"><link rel="canonical" href="https://www.andersondamasio.com.br/${artigo.url}"></head><body><h1>Contrato</h1><div class="article-body">${corpo}</div></body></html>`);
  fs.writeFileSync("titulos.json", JSON.stringify([artigo]));
  const selecao = { versao: 1, titulo: "Guias e exemplos", descricao: "Guias de contratos entre servicos e exemplos com limites explicitos para a avaliacao de uma decisao tecnica.",
    atualizadoEm: "2026-02-01T12:00:00.000Z", introducao: "Uma introducao & uma pergunta <concreta>.", limites: "Exemplo hipotetico, nao executado.",
    grupos: [{ id: "contratos", titulo: "Contratos", pergunta: "Qual regra precisa ser preservada?", contexto: "Distinguir regra, evidencia e resultado.",
      leituras: [{ url: artigo.url, tipo: "exercicio-proposto", resumo: "Resumo <sem> HTML ativo.", conteudoHash: hashCorpoEditorial(corpo) }] }] };
  const salvar = () => fs.writeFileSync("dados/leituras-selecionadas.json", JSON.stringify(selecao));
  salvar();
  return { artigo, selecao, salvar, corpo };
}

test("selecao valida preserva escopo e usa titulo atual do cadastro com escape", () => workspace(root => {
  const { artigo } = preparar();
  const selecao = carregarLeituras([artigo], root);
  const $ = cheerio.load(gerarConteudoLeituras(selecao));
  assert.equal($(".reading-list h3").text(), artigo.titulo);
  assert.equal($("concreta, sem, t").length, 0);
  assert.match($(".reading-kind").text(), /Exerc/);
  const schema = criarSchemaLeituras(selecao);
  assert.equal(schema["@type"], "CollectionPage");
  assert.equal(schema.mainEntity.itemListElement[0].name, artigo.titulo);
  assert.equal(schema.review, undefined);
  const home = cheerio.load(gerarResumoLeituras(selecao));
  assert.equal(home('a[href="/guias.html#contratos"]').length, 1);
  assert.equal(home(".article-body").length, 0);
  assert.equal(gerarResumoLeituras(null), "");
}));

test("recusa artigos ausentes, duplicados, noindex, alias e corpo modificado", () => workspace(root => {
  const { artigo } = preparar();
  assert.throws(() => carregarLeituras([], root), /nao publicavel/);
  assert.throws(() => carregarLeituras([artigo, artigo], root), /ambiguo/);
  const html = fs.readFileSync(artigo.url, "utf8");
  for (const [alterado, mensagem] of [
    [html.replace("index, follow", "noindex, follow"), /noindex/],
    [html.replace("</head>", '<meta http-equiv="refresh" content="0; url=/"></head>'), /conteudo ausente/],
    [html.replace(artigo.url, "outro.html"), /canonical/],
    [html.replace("Exemplo hipotetico", "Outra proposta"), /reconferir resumo/]
  ]) {
    fs.writeFileSync(artigo.url, alterado);
    assert.throws(() => carregarLeituras([artigo], root), mensagem);
  }
}));

test("recusa configuracao incompleta, repetida, futura e URLs fora do acervo", () => workspace(root => {
  const { artigo, selecao, salvar } = preparar();
  const original = structuredClone(selecao);
  for (const alterar of [
    s => { s.grupos[0].id = '../fora'; }, s => { s.grupos[0].leituras = []; },
    s => { s.grupos.push(structuredClone(s.grupos[0])); },
    s => { s.grupos[0].leituras.push(structuredClone(s.grupos[0].leituras[0])); },
    s => { s.grupos[0].leituras[0].url = 'https://example.org/'; },
    s => { s.grupos[0].leituras[0].tipo = 'revisado-por-anderson'; },
    s => { s.grupos[0].leituras[0].conteudoHash = ''; },
    s => { s.atualizadoEm = '2126-02-01T12:00:00.000Z'; }
  ]) {
    Object.assign(selecao, structuredClone(original)); alterar(selecao); salvar();
    assert.throws(() => carregarLeituras([artigo], root), /Selecao de leituras invalida/);
  }
}));

test("ausencia de selecao so e aceita antes de existir uma pagina publicada", () => workspace(root => {
  assert.equal(carregarLeituras([], root), null);
  fs.writeFileSync("guias.html", "Pagina existente");
  assert.throws(() => carregarLeituras([], root), /Selecao ausente/);
}));

test("rebuild liga home e assuntos aos guias, preserva corpo e datas e e estavel", () => workspace(root => {
  const { artigo, selecao, corpo } = preparar();
  reconstruirPaginasSeo();
  const arquivos = ["index.html", "guias.html", "artigos/index.html", "sitemap.xml", "rss.xml", artigo.url, "titulos.json"];
  const antes = arquivos.map(p => fs.readFileSync(p, "utf8"));
  reconstruirPaginasSeo();
  assert.deepEqual(arquivos.map(p => fs.readFileSync(p, "utf8")), antes);
  const guias = cheerio.load(fs.readFileSync("guias.html", "utf8"));
  assert.equal(guias('link[rel=canonical]').attr('href'), 'https://www.andersondamasio.com.br/guias.html');
  assert.doesNotMatch(guias('meta[name=robots]').attr('content'), /noindex/);
  assert.equal(guias('h1').length, 1);
  assert.equal(guias('.reading-list a').attr('href'), `/${artigo.url}`);
  const schema = JSON.parse(guias('script[type="application/ld+json"]').first().text());
  assert.equal(schema['@type'], 'CollectionPage');
  assert.equal(schema.dateModified, selecao.atualizadoEm);
  for (const p of ['index.html', 'artigos/index.html']) assert.ok(cheerio.load(fs.readFileSync(p, 'utf8'))('a[href="/guias.html"]').length);
  const sitemap = cheerio.load(fs.readFileSync('sitemap.xml', 'utf8'), { xmlMode: true });
  const loc = sitemap('url').filter((_, el) => sitemap(el).find('loc').text().endsWith('/guias.html'));
  assert.equal(loc.find('lastmod').text(), selecao.atualizadoEm);
  assert.doesNotMatch(fs.readFileSync('rss.xml', 'utf8'), /guias.html/);
  assert.equal(cheerio.load(fs.readFileSync(artigo.url, 'utf8'))('.article-body').html(), corpo);
  assert.deepEqual(JSON.parse(fs.readFileSync('titulos.json')), [artigo]);
  assert.ok(medirNavegacao(root).urls.every(a => a.viaIndexaveis <= 2));
}));

test("configuracao invalida interrompe rebuild antes de alterar arquivos publicos", () => workspace(() => {
  const { selecao, salvar } = preparar();
  fs.writeFileSync('index.html', 'Home anterior');
  selecao.grupos[0].leituras[0].conteudoHash = 'a'.repeat(64); salvar();
  assert.throws(() => reconstruirPaginasSeo(), /reconferir resumo/);
  assert.equal(fs.readFileSync('index.html', 'utf8'), 'Home anterior');
  assert.equal(fs.existsSync('guias.html'), false);
  assert.equal(fs.existsSync('sitemap.xml'), false);
}));
