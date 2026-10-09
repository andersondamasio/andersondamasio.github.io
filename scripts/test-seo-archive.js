const test = require("node:test");
const assert = require("node:assert/strict");
const cheerio = require("cheerio");
const { agruparArquivo, chaveMes, indiceMeses, conteudoMes, politicaListagem } = require("./seo-archive");
const { caminhoLocal, distancias } = require("./seo-navigation");

const artigo = (n, data) => ({ url: `artigos/arquitetura/teste-${n}.html`, titulo: `Artigo ${n}`, data, categoria: "Arquitetura" });

test("mes e dia usam o fuso do site e ordenacao deterministica", () => {
  assert.equal(chaveMes("2026-10-01T01:00:00Z"), "2026-09");
  const grupos = agruparArquivo([artigo(1, "2026-10-01T01:00:00Z"), artigo(2, "2026-10-01T15:00:00Z")]);
  assert.deepEqual(grupos.map(g => g.chave), ["2026-10", "2026-09"]);
  assert.equal(grupos[1].nome, "setembro de 2026");
  assert.match(conteudoMes(grupos[1]), /id="dia-30"/);
});

test("todos os artigos tem link HTML direto, com titulo escapado", () => {
  const artigos = Array.from({ length: 733 }, (_, n) => artigo(n, "2025-05-03T12:00:00Z"));
  artigos[0].titulo = '<script>alert("x")</script>';
  const grupos = agruparArquivo(artigos);
  const $ = cheerio.load(conteudoMes(grupos[0]));
  assert.equal($(".article-index a[href]").length, 733);
  assert.equal($("script").length, 0);
  assert.equal($(".article-index a").first().text(), artigos[0].titulo);
  assert.equal(new Set($(".article-index a").map((_, a) => $(a).attr("href")).get()).size, 733);
  assert.match(indiceMeses(grupos), /href="\/arquivo\/2025-05.html"/);
});

test("datas e URLs invalidas interrompem antes de gerar saidas", () => {
  assert.throws(() => agruparArquivo([artigo(1, "invalida")]), /data/);
  assert.throws(() => agruparArquivo([{ ...artigo(1, "2026-10-01"), url: "../fora.html" }]), /URL/);
  assert.throws(() => agruparArquivo([artigo(1, "2026-10-01"), artigo(1, "2026-10-01")]), /repetida/);
});

test("politica depende da finalidade e nao do corte na terceira pagina", () => {
  for (const papel of ["perfil", "categoria", "arquivo"]) {
    assert.equal(politicaListagem({ papel }).sitemap, true);
    for (const indice of [1, 2, 3, 800]) {
      assert.deepEqual(politicaListagem({ papel, indice }), { robots: "noindex, follow", sitemap: false });
    }
  }
  assert.equal(politicaListagem({ papel: "categoria", categoriaElegivel: false }).sitemap, false);
  assert.throws(() => politicaListagem({ papel: "desconhecido" }), /invalido/);
});

test("grafo distingue caminho por pagina indexavel e ignora destinos externos", () => {
  assert.equal(caminhoLocal("../arquivo/2026-10.html#dia-01", "artigos/index.html"), "arquivo/2026-10.html");
  assert.equal(caminhoLocal("/", "index2.html"), "index.html");
  assert.equal(caminhoLocal("https://example.org/a.html", "index.html"), null);
  const grafo = new Map([
    ["index.html", { indexavel: true, links: new Set(["index2.html", "arquivo/index.html", "ausente.html"]) }],
    ["index2.html", { indexavel: false, links: new Set(["artigo.html"]) }],
    ["arquivo/index.html", { indexavel: true, links: new Set(["arquivo/2026-10.html"]) }],
    ["arquivo/2026-10.html", { indexavel: true, links: new Set(["artigo.html"]) }],
    ["artigo.html", { indexavel: true, links: new Set() }]
  ]);
  assert.equal(distancias(grafo).get("artigo.html"), 2);
  assert.equal(distancias(grafo, true).get("artigo.html"), 3);
  assert.equal(distancias(grafo).has("ausente.html"), false);
});
