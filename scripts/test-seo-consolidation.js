const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const cheerio = require("cheerio");
const { globSync } = require("glob");
const { hashCorpoEditorial } = require("./seo-helpful-content");
const { hashArquivo, hashRegistros } = require("./article-lifecycle");
const { caminhoLocal } = require("./seo-navigation");
const { siteUrl } = require("./seo-identity");

const root = path.join(__dirname, "..");
const ler = arquivo => fs.readFileSync(path.join(root, arquivo), "utf8");
const relatorio = JSON.parse(ler("dados/editorial/consolidacao-generalistas-2026-10.json"));
const cadastro = JSON.parse(ler("titulos.json"));
const manifesto = JSON.parse(ler("dados/indexacao.json"));
const destino = relatorio.destino;
const removidas = new Set(relatorio.consolidadas.flatMap(d => [d.url, ...d.aliases.map(a => a.url)]));

test("guia consolidado preserva URL e publicacao original, sem atribuir revisao humana", () => {
  const $ = cheerio.load(ler(destino.url));
  const registros = cadastro.filter(r => r.url === destino.url);
  assert.equal(registros.length, 1);
  const registro = registros[0];
  assert.equal(relatorio.revisaoHumana, false);
  assert.equal(registro.correcaoEditorial.revisaoHumana, false);
  assert.equal(registro.data, destino.antes.registro.data);
  assert.equal(registro.data, destino.depois.data);
  assert.equal(registro.titulo, destino.depois.titulo);
  assert.equal($("h1").text(), destino.depois.titulo);
  assert.equal(registro.seo.description, destino.depois.descricao);
  assert.equal($("meta[name=description]").attr("content"), destino.depois.descricao);
  assert.equal(registro.seo.modifiedAt, relatorio.em);
  assert.equal($("meta[property='article:published_time']").attr("content"), registro.data);
  assert.equal($("meta[property='article:modified_time']").attr("content"), relatorio.em);
  assert.equal($(".nota-consolidacao time").attr("datetime"), relatorio.em);
  assert.equal($(".article-validation").attr("data-editorial-status"), "acervo-sem-revisao-registrada");
  assert.equal(hashCorpoEditorial($(".article-body").html()), destino.depois.corpoHash);
  assert.equal($("link[rel=canonical]").attr("href"), `${siteUrl}/${destino.url}`);
  assert.equal($("meta[http-equiv='refresh' i]").length, 0);
  assert.doesNotMatch($("meta[name=robots]").attr("content") || "", /noindex/i);
  const decisao = manifesto.decisoes.find(d => d.url === destino.url);
  assert.equal(decisao.acao, "atualizar");
  assert.equal(decisao.conteudoHash, destino.depois.corpoHash);
});

test("atribuicao e contribuicao proposta correspondem ao registro conferido", () => {
  const $ = cheerio.load(ler(destino.url));
  const registro = cadastro.find(r => r.url === destino.url);
  assert.equal(registro.urlFonte, relatorio.fonte.url);
  assert.equal(registro.dataFonte, relatorio.fonte.data);
  assert.equal(registro.noticiaOriginal, relatorio.fonte.titulo);
  // Vinculo estrutural texto-fonte; nao equivale a verificacao factual automatica.
  for (const trecho of [relatorio.fonte, relatorio.contribuicao]) {
    assert.equal($(trecho.seletor).length, 1);
    assert.equal(hashCorpoEditorial($(trecho.seletor).html()), trecho.textoHash);
  }
  assert.ok($(relatorio.fonte.seletor).text().trim().split(/\s+/).length <= 200);
  assert.ok($(".article-body a").toArray().some(a => $(a).attr("href") === relatorio.fonte.url));
  assert.equal($(".contribuicao-editorial pre code").length, 1);
  assert.equal($(".limites-editoriais").length, 1);
});

test("cinco copias arquivadas conservam integralmente os originais e seus aliases", () => {
  assert.equal(relatorio.consolidadas.length, 5);
  for (const decisao of relatorio.consolidadas) {
    const backup = JSON.parse(ler(decisao.backup));
    assert.equal(backup.url, decisao.url);
    assert.equal(hashRegistros(backup.registros), decisao.registrosHash);
    assert.equal(backup.arquivos.length, 1 + decisao.aliases.length);
    for (const origem of [{ url: decisao.url, arquivoHash: decisao.arquivoHash }, ...decisao.aliases]) {
      const original = backup.arquivos.find(a => a.url === origem.url);
      assert.ok(original, origem.url);
      assert.equal(hashArquivo(original.html), origem.arquivoHash);
    }
    const $ = cheerio.load(backup.arquivos.find(a => a.url === decisao.url).html);
    assert.equal(hashCorpoEditorial($(".article-body").html()), decisao.conteudoHash);
    assert.equal(cadastro.some(r => r.url === decisao.url), false);
    assert.deepEqual(manifesto.decisoes.find(d => d.url === decisao.url), (() => {
      const { backup, ...registro } = decisao;
      return registro;
    })());
  }
});

test("dez URLs antigas redirecionam diretamente ao guia sem corpo duplicado", () => {
  assert.equal(removidas.size, 10);
  for (const origem of removidas) {
    const $ = cheerio.load(ler(origem));
    assert.equal($(".article-body").length, 0);
    assert.equal($("link[rel=canonical]").length, 1);
    assert.equal($("link[rel=canonical]").attr("href"), `${siteUrl}/${destino.url}`);
    assert.equal($("meta[http-equiv='refresh' i]").attr("content"), `0; url=${siteUrl}/${destino.url}`);
    assert.ok($("a[href]").toArray().some(a => $(a).attr("href") === `${siteUrl}/${destino.url}`));
  }
});

test("sitemap preserva apenas o guia com a data real de atualizacao", () => {
  const xml = ler("sitemap.xml");
  const $ = cheerio.load(xml, { xmlMode: true });
  const entradas = $("url").filter((_, el) => $(el).find("loc").text() === `${siteUrl}/${destino.url}`);
  assert.equal(entradas.length, 1);
  assert.equal(entradas.find("lastmod").text(), relatorio.em);
  for (const origem of removidas) {
    assert.ok(!xml.includes(`${siteUrl}/${origem}`));
    assert.ok(!ler("rss.xml").includes(`${siteUrl}/${origem}`));
  }
});

test("links publicos nao continuam promovendo URLs consolidadas", () => {
  const nomes = [...removidas].map(url => path.posix.basename(url));
  const referencias = [];
  for (const arquivo of globSync("**/*.html", { cwd: root, ignore: ["node_modules/**"], nodir: true, dot: false })) {
    const html = ler(arquivo);
    if (!nomes.some(nome => html.includes(nome))) continue;
    const $ = cheerio.load(html);
    $("a[href]").each((_, el) => {
      const local = caminhoLocal($(el).attr("href"), arquivo);
      if (removidas.has(local)) referencias.push(`${arquivo} -> ${local}`);
    });
  }
  assert.deepEqual(referencias, []);
});
