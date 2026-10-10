const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const cheerio = require("cheerio");
const { inserirSecoesConteudoUtil, avaliarSecoesConteudoUtil, gerarSecoesConteudoUtil, hashCorpoEditorial } = require("./seo-helpful-content");
const { criarPessoaSchema, criarWebSiteSchema } = require("./seo-identity");
const { estilosCodigoInline, aplicarEstilosCodigoInline, paddingBlocoCodigo, aplicarEspacoBotaoCopiar } = require("./seo-code-styles");
const { defaultSeoImage, defaultArticleImages, getArticleStructuredImages } = require("./seo-assets");
const { aprovacaoFixture } = require("./fixtures/editorial-review");
const { criarMetadadosArtigo, contarPalavrasProsa } = require("./seo-article-metadata");
const { reconstruirPaginasSeo, publicarRascunhoAprovado } = require("../gerar-conteudo");

const fonte = { sourceUrl: "https://example.org/fonte", sourceTitle: "Fonte de teste" };

function workspace(run) {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, "perfil-template-test-"));
  const cwd = process.cwd();
  try { return run(root); } finally {
    process.chdir(cwd);
    if (path.dirname(path.resolve(root)) !== base || !path.basename(root).startsWith("perfil-template-test-")) throw new Error("Temporario fora do escopo.");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("auditoria publica ignora previas privadas sem ignorar HTML publico invalido", () => workspace(root => {
  const audit = () => JSON.parse(execFileSync(process.execPath, [path.join(__dirname, "seo-audit.js")], { cwd: root, encoding: "utf8" }));
  fs.writeFileSync(path.join(root, "publico.html"), "<p>Fragmento publico invalido</p>");
  const antes = audit();
  fs.mkdirSync(path.join(root, ".editorial", "previas"), { recursive: true });
  fs.writeFileSync(path.join(root, ".editorial", "previas", "rascunho.html"), "<p>Previa privada</p>");
  const depois = audit();
  assert.deepEqual(depois, antes);
  assert.equal(depois.htmlFiles, 1);
  assert.deepEqual(depois.issues.missingTitle, ["publico.html"]);
}));

test("bloco legado nao declara revisao e nao injeta checklist generico", () => {
  const html = gerarSecoesConteudoUtil(fonte);
  const $ = cheerio.load(html);
  assert.deepEqual(avaliarSecoesConteudoUtil($), { validationOk: true, usefulnessOk: true });
  assert.match($.text(), /sem registro de revis/i);
  assert.doesNotMatch($.text(), /O que foi verificado|Como aplicar essa leitura/);
  assert.equal($("a[rel=author]").text(), "Anderson Damasio");
});

test("auditoria confere metadados contra corpo e cadastro sem minimo de palavras", () => workspace(root => {
  const corpo = '<p>Fila duravel.</p><pre><code>codigo nao e prosa</code></pre>';
  const registros = ["correto", "contagem", "categoria", "ano", "entidades", "tag", "autoria"].map(nome => ({
    titulo: `Contratos de mensagens ${nome}`, url: `artigos/arquitetura/${nome}.html`,
    categoria: "Arquitetura", data: "2025-10-01T12:00:00Z"
  }));
  fs.mkdirSync(path.join(root, "artigos/arquitetura"), { recursive: true });
  fs.writeFileSync(path.join(root, "titulos.json"), JSON.stringify(registros));
  for (const [i, registro] of registros.entries()) {
    const schema = { "@context": "https://schema.org", "@type": "BlogPosting",
      ...criarMetadadosArtigo({ category: registro.categoria, articleHtml: corpo, publishedDate: registro.data }),
      articleSection: registro.categoria, author: criarPessoaSchema(), copyrightHolder: criarPessoaSchema() };
    if (i === 1) schema.wordCount = 100;
    if (i === 2) schema.about.name = "Outro assunto";
    if (i === 3) schema.copyrightYear = 2026;
    if (i === 4) schema.mentions = [{ "@type": "Thing", name: "quem" }];
    if (i === 6) schema.author = { "@type": "Person", name: "Sem identidade vinculada" };
    fs.writeFileSync(path.join(root, registro.url), `<html lang="pt-BR"><head><title>${registro.titulo}</title>
      ${i === 5 ? '<meta name="keywords" content="quem, fila, contratos">' : ''}
      <script type="application/ld+json">${JSON.stringify(schema)}</script></head>
      <body><main><h1>${registro.titulo}</h1><div class="article-body">${corpo}</div></main></body></html>`);
  }
  const report = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, "seo-audit.js")], { cwd: root, encoding: "utf8" }));
  assert.deepEqual(report.issues.articleJsonLdInconsistentMetadata.sort(), registros.slice(1, 6).map(x => x.url).sort());
  assert.deepEqual(report.issues.articleAuthorMissingLinkedIdentity, [registros[6].url]);
  assert.equal(report.issues.missingCanonical.length, 7);
}));

test("data civil da fonte nao retrocede um dia; timestamp respeita Sao Paulo", () => {
  const data = sourceDate => cheerio.load(gerarSecoesConteudoUtil({ ...fonte, sourceDate })).text();
  assert.match(data("2026-01-22"), /22\/01\/2026/);
  assert.match(data("2026-01-22T01:00:00Z"), /21\/01\/2026/);
  assert.match(data("2026-01-22T12:00:00Z"), /22\/01\/2026/);
  assert.doesNotMatch(data(undefined), /Data da fonte registrada/);
  assert.doesNotMatch(data("invalida"), /Data da fonte registrada/);
});

test("estilo de codigo inline e idempotente, preserva corpo e nao altera blocos pre", () => {
  const corpo = '<p>Opcao <code>WatchCacheInitializationPostStartHook</code>.</p><pre><code>linha 1\n  linha 2</code></pre>';
  const html = `<html><head><style>code { font-size: 1rem; }</style></head><body><div class="article-body">${corpo}</div></body></html>`;
  const novo = aplicarEstilosCodigoInline(html);
  assert.ok(novo.includes(estilosCodigoInline));
  assert.equal(aplicarEstilosCodigoInline(novo), novo);
  assert.equal(cheerio.load(novo)(".article-body").html(), corpo);
  assert.match(estilosCodigoInline, /\.article-body pre code \{ overflow-wrap: normal; \}/);
  const somenteBloco = html.replace('<p>Opcao <code>WatchCacheInitializationPostStartHook</code>.</p>', '');
  assert.equal(aplicarEstilosCodigoInline(somenteBloco), somenteBloco);
  const semCodigo = html.replace(corpo, '<p>Texto.</p>');
  assert.equal(aplicarEstilosCodigoInline(semCodigo), semCodigo);
});

test("insercao respeita divs aninhadas, preserva codigo e e idempotente", () => {
  const corpo = '<p>Texto &amp; codigo.</p><div><pre><code>if (a &lt; b) {\n  return a;\n}</code></pre></div>';
  const antigo = `<main><div class="article-body">${corpo}</div><section class="article-validation"><h2>O que foi verificado</h2></section><section class="article-usefulness"><ul><li>Item generico</li></ul></section><p>Final</p></main>`;
  const novo = inserirSecoesConteudoUtil(antigo, fonte);
  assert.equal(inserirSecoesConteudoUtil(novo, fonte), novo);
  const $ = cheerio.load(novo);
  assert.equal($(".article-body").html(), corpo);
  assert.equal($(".article-body .article-validation").length, 0);
  assert.equal($(".article-validation").length, 1);
});

test("backfill reserva espaco para copiar sem alterar o codigo nem paginas sem blocos", () => {
  const corpo = '<p>Exemplo.</p><pre><code>pre { padding: 1rem; }\n  segunda linha</code></pre>';
  const html = `<html><head><style>\npre { padding: 1rem; overflow-x: auto; }\n.copy-button { top: 8px; }\n</style></head><body><div class="article-body">${corpo}</div></body></html>`;
  const novo = aplicarEspacoBotaoCopiar(html);
  assert.ok(novo.includes(`pre { padding: ${paddingBlocoCodigo}; overflow-x: auto; }`));
  assert.equal(cheerio.load(novo)(".article-body").html(), corpo);
  assert.equal(aplicarEspacoBotaoCopiar(novo), novo);
  const semBloco = html.replace(corpo, '<p>Texto com <code>codigo inline</code>.</p>');
  assert.equal(aplicarEspacoBotaoCopiar(semBloco), semBloco);
  const semBotao = html.replace('.copy-button', '.outro-controle');
  assert.equal(aplicarEspacoBotaoCopiar(semBotao), semBotao);
});

test("bloco antigo dentro do corpo e retirado sem retirar o texto do artigo", () => {
  const antigo = '<main><div class="article-body"><div><p>Primeiro.</p></div><section class="article-usefulness"><p>Checklist antigo.</p></section><p>Ultimo.</p></div></main>';
  const $ = cheerio.load(inserirSecoesConteudoUtil(antigo, fonte));
  assert.equal($(".article-body").text(), "Primeiro.Ultimo.");
  assert.equal($(".article-body .article-validation").length, 0);
});

test("revisao visivel corresponde ao corpo aprovado e deixa de valer se ele muda", () => {
  const aprovado = aprovacaoFixture();
  const editorial = { hash: aprovado.revisaoHumana.hash, revisaoHumana: aprovado.revisaoHumana,
    conteudoHash: hashCorpoEditorial(aprovado.corpoArtigo), dossie: aprovado.dossie };
  const render = corpoArtigo => cheerio.load(gerarSecoesConteudoUtil({ ...fonte, editorial, corpoArtigo }));
  assert.equal(render(aprovado.corpoArtigo)(".article-validation").attr("data-editorial-status"), "revisado");
  assert.equal(render(aprovado.corpoArtigo + "<p>Outra afirmacao.</p>")(".article-validation").attr("data-editorial-status"), "acervo-sem-revisao-registrada");
  assert.equal(hashCorpoEditorial('<img src="/a.png" alt="A">'), hashCorpoEditorial('<img src="/a.png" alt="A" loading="lazy" decoding="async">'));
});

test("imagem de marca nao vira imagem de artigo; imagem propria nao exige tres recortes", () => {
  for (const image of [undefined, defaultSeoImage, ...defaultArticleImages]) assert.equal(getArticleStructuredImages(image), undefined);
  assert.deepEqual(getArticleStructuredImages("https://example.org/diagrama.png"), ["https://example.org/diagrama.png"]);
});

test("identidade liga site e pessoa somente ao perfil social confirmado", () => {
  const pessoa = criarPessoaSchema();
  assert.deepEqual(pessoa.sameAs, ["https://www.linkedin.com/in/andersondamasio/"]);
  assert.equal(criarWebSiteSchema().publisher["@id"], pessoa["@id"]);
  assert.equal(criarWebSiteSchema().publisher["@type"], "Person");
});

test("exemplo executavel de Reservoir Sampling corresponde ao codigo publicado", () => {
  const root = path.join(__dirname, "..");
  const url = "artigos/explorando-os-segredos-do-reservoir-sampling.html";
  const html = cheerio.load(fs.readFileSync(path.join(root, url), "utf8"));
  const codigo = fs.readFileSync(path.join(root, "exemplos/reservoir-sampling/Reservoir.cs"), "utf8").replace(/\r\n/g, "\n");
  assert.equal(html(".article-body code.language-csharp").text(), codigo);
  assert.equal(html(".article-body code.language-csharp").children().length, 0);
  assert.equal(html("link[rel=canonical]").attr("href"), `https://www.andersondamasio.com.br/${url}`);
  const registro = JSON.parse(fs.readFileSync(path.join(root, "titulos.json"), "utf8")).find(x => x.url === url);
  assert.equal(html("h1").text(), registro.titulo);
  assert.equal(html('meta[name="description"]').attr("content"), registro.seo.description);
  assert.equal(hashCorpoEditorial(html(".article-body").html()), registro.correcaoEditorial.hashDepois);
});

[
  ["correcoes-fontes-primarias-2026-10.json", 5],
  ["correcoes-piloto-agentes-2026-10.json", 7],
  ["correcoes-contextuais-01-2026-10.json", 4]
].forEach(([arquivo, quantidade]) => test(`correcoes preservam rastreabilidade sem aprovacao humana: ${arquivo}`, () => {
  const root = path.join(__dirname, "..");
  const cadastro = JSON.parse(fs.readFileSync(path.join(root, "titulos.json"), "utf8"));
  const manifesto = JSON.parse(fs.readFileSync(path.join(root, "dados/indexacao.json"), "utf8"));
  const relatorio = JSON.parse(fs.readFileSync(path.join(root, "dados/editorial", arquivo), "utf8"));
  assert.equal(relatorio.revisaoHumana, false);
  assert.equal(relatorio.artigos.length, quantidade);
  for (const artigo of relatorio.artigos) {
    const $ = cheerio.load(fs.readFileSync(path.join(root, artigo.url), "utf8"));
    const registro = cadastro.find(r => r.url === artigo.url);
    const decisao = manifesto.decisoes.find(r => r.url === artigo.url);
    assert.equal(registro.data, artigo.antes.data);
    assert.equal($("h1").text(), artigo.depois.titulo);
    assert.equal(registro.titulo, artigo.depois.titulo);
    assert.equal($("meta[name=description]").attr("content"), artigo.depois.descricao);
    assert.equal(registro.seo.description, artigo.depois.descricao);
    assert.equal(registro.seo.modifiedAt, relatorio.em);
    assert.equal($("meta[property='article:published_time']").attr("content"), registro.data);
    assert.equal($("meta[property='article:modified_time']").attr("content"), relatorio.em);
    assert.equal($("link[rel=canonical]").attr("href"), `https://www.andersondamasio.com.br/${artigo.url}`);
    assert.equal(hashCorpoEditorial($(".article-body").html()), artigo.depois.corpoHash);
    assert.equal(decisao.conteudoHash, artigo.depois.corpoHash);
    assert.equal(decisao.acao, "atualizar");
    assert.equal(registro.correcaoEditorial.revisaoHumana, false);
    if (artigo.depois.fonte) {
      assert.equal(registro.urlFonte, artigo.depois.fonte.url);
      assert.equal(registro.dataFonte, artigo.depois.fonte.data);
      assert.ok($(".article-validation a").toArray().some(a => $(a).attr("href") === registro.urlFonte));
    }
    if (artigo.antes.qualidadeEditorialAnterior) assert.equal(registro.qualidadeEditorial, undefined);
    assert.equal($(".article-validation").attr("data-editorial-status"), "acervo-sem-revisao-registrada");
    assert.equal($(artigo.contribuicaoProposta).length, 1);
    assert.equal($(artigo.limites).length, 1);
    // Confere o vinculo texto-fonte, nao a veracidade das afirmacoes.
    for (const evidencia of artigo.evidencias) {
      assert.equal($(evidencia.seletor).length, 1);
      assert.equal(hashCorpoEditorial($(evidencia.seletor).html()), evidencia.textoHash);
      assert.ok($(".article-body a").toArray().some(a => $(a).attr("href") === evidencia.fonte));
    }
    for (const a of $(".article-body a[href^='/']").toArray()) {
      assert.ok(fs.existsSync(path.join(root, $(a).attr("href").slice(1))));
    }
  }
}));

test("lote contextual distingue atualizacao, fonte substituida e publicacao original", () => {
  const root = path.join(__dirname, "..");
  const relatorio = JSON.parse(fs.readFileSync(path.join(root, "dados/editorial/correcoes-contextuais-01-2026-10.json"), "utf8"));
  const cadastro = JSON.parse(fs.readFileSync(path.join(root, "titulos.json"), "utf8"));
  for (const artigo of relatorio.artigos) {
    const $ = cheerio.load(fs.readFileSync(path.join(root, artigo.url), "utf8"));
    assert.equal($(".article-body .nota-atualizacao time").attr("datetime"), relatorio.em);
    assert.match($(".article-body .nota-atualizacao").text(), /publicação original foi preservada/);
    assert.equal($("meta[name=robots]").attr("content").includes("noindex"), false);
    assert.ok(artigo.antes.fonte.url && artigo.antes.fonte.data);
    assert.ok(artigo.sobreposicao);
    for (const evidencia of artigo.evidencias) {
      assert.ok($(evidencia.seletor).find("a").toArray().some(a => $(a).attr("href") === evidencia.fonte));
    }
  }
  const gestao = relatorio.artigos.find(a => a.url.includes("como-se-destacar-na-gestao"));
  const registro = cadastro.find(r => r.url === gestao.url);
  assert.match(gestao.antes.fonte.url, /zdnet\.com/);
  assert.match(registro.urlFonte, /handbook\.gitlab\.com/);
  assert.equal(registro.dataFonte, undefined, "Nao herdar a data da fonte substituida");
  assert.equal(gestao.depois.fonte.data, undefined);
  const $ = cheerio.load(fs.readFileSync(path.join(root, gestao.url), "utf8"));
  assert.match($(".limites-editoriais").text(), /ZDNet que não pôde ser conferida/);
  const dados = relatorio.artigos.find(a => a.url.includes("aquisicoes.html"));
  const d = cheerio.load(fs.readFileSync(path.join(root, dados.url), "utf8"));
  assert.match(d(".fato-informatica-acordo").text(), /não comprovava o fechamento/);
  assert.match(d(".fato-informatica-fechamento").text(), /18\/11\/2025/);
  assert.match(d(".fato-informatica-fechamento").text(), /posterior à data original/);
  assert.match(d(".fato-fivetran-posterior").text(), /03\/03\/2026/);
});

test("home e pagina dois possuem finalidade e H1 diferentes, sem repetir biografia", () => workspace(root => {
  process.chdir(root);
  fs.mkdirSync("artigos/arquitetura", { recursive: true });
  const registros = Array.from({ length: 11 }, (_, i) => ({ titulo: `Decisao tecnica de teste ${i}`, url: `artigos/arquitetura/teste-${i}.html`, categoria: "Arquitetura", data: "2026-10-01T12:00:00Z" }));
  for (const r of registros) fs.writeFileSync(r.url, `<html><head><title>${r.titulo}</title></head><body><h1>${r.titulo}</h1><div class="article-body"><p>Conteudo tecnico desta fixture sobre contratos entre servicos e limites de uma decisao.</p></div></body></html>`);
  fs.writeFileSync("titulos.json", JSON.stringify(registros));
  reconstruirPaginasSeo();
  const home = cheerio.load(fs.readFileSync("index.html", "utf8"));
  const pagina = cheerio.load(fs.readFileSync("index2.html", "utf8"));
  assert.equal(home("h1").text(), "Anderson Damasio");
  assert.match(home("main").text(), /desde 2005/);
  assert.match(pagina("h1").text(), /página 2/);
  assert.doesNotMatch(pagina("main").text(), /desde 2005|Atuo com desenvolvimento/);
  assert.equal(home(".article-index li").length, 10);
  assert.equal(pagina(".article-index li").length, 1);
  assert.match(pagina('link[rel=canonical]').attr("href"), /index2.html$/);
}));

test("sobre e gerado de fonte unica, possui contato real e ProfilePage completo", () => workspace(root => {
  fs.copyFileSync(path.join(__dirname, "..", "sobre.html"), path.join(root, "sobre.html"));
  const executar = () => execFileSync(process.execPath, [path.join(__dirname, "seo-backfill-static.js")], { cwd: root, stdio: "pipe" });
  executar();
  const primeiro = fs.readFileSync(path.join(root, "sobre.html"), "utf8");
  executar();
  assert.equal(fs.readFileSync(path.join(root, "sobre.html"), "utf8"), primeiro);
  const $ = cheerio.load(primeiro);
  assert.equal($("h1").text(), "Anderson Damasio");
  assert.equal($("#profile-styles").length, 1);
  assert.equal($("#criterios-editoriais").length, 1);
  assert.match($("main").text(), /desde 2005/);
  assert.equal($("main a[href^='mailto:']").length, 1);
  const schema = JSON.parse($("script[type='application/ld+json']").first().text());
  assert.equal(schema["@type"], "ProfilePage");
  assert.equal(schema.mainEntity["@id"], criarPessoaSchema()["@id"]);
}));

test("publicacao revisada preserva aprovacao, descricao e data em dois backfills", () => workspace(root => {
  process.chdir(root);
  fs.writeFileSync("titulos.json", "[]");
  const aprovado = aprovacaoFixture();
  const { url } = publicarRascunhoAprovado(aprovado, { agora: new Date("2026-10-02T12:00:00Z") });
  const publicado = cheerio.load(fs.readFileSync(url, "utf8"));
  const schemaPublicado = JSON.parse(publicado("script[type='application/ld+json']").first().text());
  assert.equal(schemaPublicado.wordCount, contarPalavrasProsa(aprovado.corpoArtigo));
  assert.equal(schemaPublicado.keywords, undefined);
  assert.equal(schemaPublicado.mentions, undefined);
  assert.equal(publicado("meta[name=keywords]").length, 0);
  const registros = JSON.parse(fs.readFileSync("titulos.json", "utf8"));
  registros[0].seo.modifiedAt = "2026-10-03T12:00:00Z";
  fs.writeFileSync("titulos.json", JSON.stringify(registros));
  const executar = () => execFileSync(process.execPath, [path.join(__dirname, "seo-backfill-articles.js")], { cwd: root, stdio: "pipe" });
  executar();
  const primeiro = fs.readFileSync(url, "utf8");
  assert.ok(primeiro.includes(estilosCodigoInline));
  executar();
  assert.equal(fs.readFileSync(url, "utf8"), primeiro);
  const $ = cheerio.load(primeiro);
  assert.equal($(".article-validation").attr("data-editorial-status"), "revisado");
  assert.equal($("meta[name=description]").attr("content"), aprovado.resumo);
  assert.equal($("meta[property='article:published_time']").attr("content"), "2026-10-02T12:00:00.000Z");
  assert.equal($("meta[property='article:modified_time']").attr("content"), "2026-10-03T12:00:00.000Z");
  const schema = JSON.parse($("script[type='application/ld+json']").first().text());
  assert.equal(schema.image, undefined);
  assert.equal(schema.wordCount, schemaPublicado.wordCount);
  assert.equal(schema.keywords, undefined);
  assert.equal(schema.mentions, undefined);
  assert.equal($("meta[name=keywords]").length, 0);
  assert.equal($(".article-body").html(), publicado(".article-body").html());
  assert.deepEqual(JSON.parse(fs.readFileSync("titulos.json", "utf8")), registros);
  reconstruirPaginasSeo();
  const sitemap = cheerio.load(fs.readFileSync("sitemap.xml", "utf8"), { xmlMode: true });
  assert.equal(sitemap("url").filter((_, el) => sitemap(el).find("loc").text().endsWith(url)).find("lastmod").text(), "2026-10-03T12:00:00.000Z");
}));

test("backfill e rebuild alternados nao disputam espacos perto das fontes", () => workspace(root => {
  process.chdir(root);
  const arquivos = Array.from({ length: 3 }, (_, n) => ({ titulo: `Contratos de mensagens ${n}`, url: `artigos/arquitetura/contratos-${n}.html`, categoria: "Arquitetura", data: "2026-10-01T12:00:00Z", urlFonte: "https://example.org/fonte", noticiaOriginal: "Documento de contratos" }));
  fs.mkdirSync("artigos/arquitetura", { recursive: true });
  for (const a of arquivos) fs.writeFileSync(a.url, `<html><head><title>${a.titulo}</title><style></style></head><body><main><h1>${a.titulo}</h1><div class="article-body"><p>Contratos de mensagens delimitam a responsabilidade do consumidor e os dados esperados em um evento.</p></div><p class="back-link"><a href="/">Inicio</a></p></main></body></html>`);
  fs.writeFileSync("titulos.json", JSON.stringify(arquivos));
  const manter = () => {
    execFileSync(process.execPath, [path.join(__dirname, "seo-backfill-articles.js")], { cwd: root, stdio: "pipe" });
    reconstruirPaginasSeo();
    return arquivos.map(a => fs.readFileSync(a.url, "utf8"));
  };
  const primeira = manter();
  const segunda = manter();
  assert.deepEqual(segunda, primeira);
  execFileSync(process.execPath, [path.join(__dirname, "seo-backfill-articles.js")], { cwd: root, stdio: "pipe" });
  assert.deepEqual(arquivos.map(a => fs.readFileSync(a.url, "utf8")), segunda);
}));
