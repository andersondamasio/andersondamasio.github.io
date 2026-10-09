const test = require("node:test");
const assert = require("node:assert/strict");
const { prepararVerificacao, verificarPublicacao } = require("./verify-deployment");
const baseUrl = "https://www.andersondamasio.com.br";
const artigo = "artigos/arquitetura/exemplo.html";
const html = (url, body = "") => `<html><head><title>Exemplo</title><link rel="canonical" href="${baseUrl}${url}"></head><body><h1>Exemplo</h1>${body}</body></html>`;
const arquivos = {
  "titulos.json": JSON.stringify([{ url: artigo, dataISO: "2026-10-05T12:00:00Z" }]),
  "index.html": html("/", `<a href="/${artigo}">Artigo</a>`),
  "sobre.html": html("/sobre.html"),
  [artigo]: html(`/${artigo}`),
  "sitemap.xml": `<urlset><url><loc>${baseUrl}/${artigo}</loc></url></urlset>`,
  "rss.xml": `<rss><channel><item><link>${baseUrl}/${artigo}</link></item></channel></rss>`,
  "robots.txt": "User-agent: *\nAllow: /\n",
  "ads.txt": "google.com, pub-3323198858252165, DIRECT, f08c47fec0942fa0\n"
};
const esperado = prepararVerificacao({ ler: file => arquivos[file], revisao: "a".repeat(40) });
function mockFetch(alteracoes = {}) {
  return async url => {
    const file = new URL(url).pathname.slice(1) || "index.html";
    const value = Object.hasOwn(alteracoes, file) ? alteracoes[file] : arquivos[file];
    return { status: value === null ? 404 : 200, text: async () => value || "Not found" };
  };
}
test("publicacao deve corresponder a revisao e as superficies de descoberta", async () => {
  const resultado = await verificarPublicacao({ esperado, fetchImpl: mockFetch(), tentativas: 1 });
  assert.equal(resultado.aceita, true);
  assert.equal(resultado.revisaoEsperada, "a".repeat(40));
});
test("falha explicitamente quando artigo novo esta ausente ou o conteudo esta antigo", async () => {
  for (const alteracoes of [{ [artigo]: null }, { [artigo]: html(`/${artigo}`, "versao antiga") }, { "sitemap.xml": "<urlset/>" }, { "rss.xml": "<rss/>" }, { "index.html": html("/") }]) {
    assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch(alteracoes), tentativas: 1 })).aceita, false);
  }
});
test("recusa canonical/noindex incorretos e limita tentativas de propagacao", async () => {
  let esperas = 0;
  const resultado = await verificarPublicacao({ esperado, fetchImpl: mockFetch({ [artigo]: html("/errado") }), tentativas: 3, esperar: async () => { esperas++; } });
  assert.equal(resultado.aceita, false);
  assert.equal(esperas, 2);
  assert.equal(resultado.tentativa, 3);
  assert.ok(resultado.problemas.some(x => x.includes("Canonical")));
  const noindex = await verificarPublicacao({ esperado, fetchImpl: mockFetch({ [artigo]: html(`/${artigo}`).replace("</head>", '<meta name="robots" content="noindex"></head>') }), tentativas: 1 });
  assert.ok(noindex.problemas.some(x => x.includes("Noindex")));
});
test("falha de rede nao equivale a publicacao e CRLF nao causa falso erro", async () => {
  const falha = await verificarPublicacao({ esperado, fetchImpl: async () => { throw new Error("timeout"); }, tentativas: 1 });
  assert.equal(falha.aceita, false);
  assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch({ "robots.txt": arquivos['robots.txt'].replace(/\n/g, '\r\n') }), tentativas: 1 })).aceita, true);
});
