const test = require("node:test");
const assert = require("node:assert/strict");
const { prepararVerificacao, verificarPublicacao, digestBinario } = require("./verify-deployment");
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
    return { status: value === null ? 404 : 200, text: async () => value || "Not found", arrayBuffer: async () => Buffer.from(value || 'Not found') };
  };
}
test("publicacao deve corresponder a revisao e as superficies de descoberta", async () => {
  const resultado = await verificarPublicacao({ esperado, fetchImpl: mockFetch(), tentativas: 1 });
  assert.equal(resultado.aceita, true);
  assert.equal(resultado.revisaoEsperada, "a".repeat(40));
});

test('deploy confere bytes do icone e mantem a fonte original fora do Pages', async () => {
  const icone = Buffer.from([0, 0, 1, 0, 13, 10, 255, 128]);
  const ler = f => f === '_config.yml' ? 'exclude:\n  - _assets/\n' : arquivos[f];
  assert.throws(() => prepararVerificacao({ ler, revisao: 'a'.repeat(40) }), /Leitor binario/);
  assert.throws(() => digestBinario(icone.toString()), /Buffer/);
  const esperado = prepararVerificacao({ ler, lerBinario: () => icone, revisao: 'a'.repeat(40) });
  const ausentes = Object.fromEntries(esperado.ausentes.map(f => [f, null]));
  const conferir = alteracoes => verificarPublicacao({ esperado, fetchImpl: mockFetch({ ...ausentes, 'favicon.ico': icone, ...alteracoes }), tentativas: 1 });
  assert.equal((await conferir({})).aceita, true);
  assert.equal((await conferir({ 'favicon.ico': Buffer.from([0, 0, 1, 0, 10, 255, 128]) })).aceita, false);
  assert.equal((await conferir({ 'favicon.ico': null })).aceita, false);
  assert.equal((await conferir({ '_assets/brand-ad.png': icone })).aceita, false);
});

test("deploy confere colecao selecionada e artigos antigos sem exigi-los no RSS", async () => {
  const antigo = 'artigos/arquitetura/antigo.html';
  const extras = {
    'index.html': html('/', `<a href="/${artigo}">Recente</a><a href="/guias.html">Guias</a>`),
    'guias.html': html('/guias.html', `<ul class="reading-list"><li><a href="/${antigo}">Antigo</a></li></ul>`),
    [antigo]: html(`/${antigo}`, 'Conteudo selecionado'),
    'sitemap.xml': `<urlset>${[artigo, antigo, 'guias.html'].map(p => `<url><loc>${baseUrl}/${p}</loc></url>`).join('')}</urlset>`
  };
  const esperado = prepararVerificacao({ ler: f => extras[f] || arquivos[f], revisao: 'f'.repeat(40) });
  assert.deepEqual(esperado.arquivosLeituras, ['guias.html', antigo]);
  assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch(extras), tentativas: 1 })).aceita, true);
  for (const alteracoes of [{ 'guias.html': null }, { [antigo]: null }, { [antigo]: html(`/${antigo}`, 'Antigo desatualizado') },
    { 'sitemap.xml': arquivos['sitemap.xml'] }]) {
    assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch({ ...extras, ...alteracoes }), tentativas: 1 })).aceita, false);
  }
  assert.throws(() => prepararVerificacao({ ler: f => f === 'guias.html' ? html('/guias.html') : extras[f] || arquivos[f], revisao: 'f'.repeat(40) }), /sem destinos validos/);
});

test("documentos do repositorio nao podem virar paginas ou downloads publicos", async () => {
  const esperado = prepararVerificacao({ ler: f => f === "_config.yml" ? "exclude: ['*.md', '**/*.md']" : arquivos[f], revisao: "c".repeat(40) });
  assert.equal(esperado.ausentes.length, 12);
  for (const nome of ['design-tokens', 'fila-cpp']) {
    assert.ok(esperado.ausentes.includes(`exemplos/${nome}/README.md`));
    assert.ok(esperado.ausentes.includes(`exemplos/${nome}/README.html`));
  }
  const ausentes = Object.fromEntries(esperado.ausentes.map(f => [f, null]));
  assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch(ausentes), tentativas: 1 })).aceita, true);
  for (const nome of ['design-tokens', 'fila-cpp']) for (const extensao of ['md', 'html']) {
    assert.equal((await verificarPublicacao({ esperado,
      fetchImpl: mockFetch({ ...ausentes, [`exemplos/${nome}/README.${extensao}`]: 'Documento exposto' }), tentativas: 1 })).aceita, false);
  }
  assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch({ ...ausentes, "EDITORIAL_OPERACAO.html": html("/EDITORIAL_OPERACAO.html") }), tentativas: 1 })).aceita, false);
  for (const status of [301, 403, 500]) {
    const original = mockFetch(ausentes);
    const fetchImpl = (url, options) => url.endsWith("EDITORIAL_OPERACAO.md") ? { status } : original(url, options);
    assert.equal((await verificarPublicacao({ esperado, fetchImpl, tentativas: 1 })).aceita, false);
  }
});

test("verificacao escolhe artigos indexaveis, respeitando curadoria do mais recente", () => {
  const novo = "artigos/arquitetura/retido.html";
  const extras = { ...arquivos, "titulos.json": JSON.stringify([
    { url: novo, dataISO: "2026-10-09T12:00:00Z" },
    { url: artigo, dataISO: "2026-10-05T12:00:00Z" }
  ]), [novo]: html(`/${novo}`).replace("</head>", '<meta name="robots" content="noindex,follow"></head>') };
  const result = prepararVerificacao({ ler: f => extras[f], revisao: "a".repeat(40) });
  assert.deepEqual(result.recentes, [artigo]);
});

test("deploy exige 404/410 para retiradas e nao publica copias arquivadas", async () => {
  const removido = "artigos/arquitetura/retirado.html";
  const extras = { "dados/indexacao.json": JSON.stringify({ decisoes: [{ url: removido, acao: "retirar", arquivoHash: "d".repeat(64), aliases: [{ url: "arquitetura/retirado.html" }] }] }) };
  const esperado = prepararVerificacao({ ler: f => extras[f] || arquivos[f], revisao: "d".repeat(40) });
  assert.equal(esperado.ausentes.length, 3);
  assert.ok(esperado.ausentes.includes(removido));
  const ausentes = Object.fromEntries(esperado.ausentes.map(f => [f, null]));
  assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch(ausentes), tentativas: 1 })).aceita, true);
  assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch({ ...ausentes, [removido]: html(`/${removido}`, "Indisponivel") }), tentativas: 1 })).aceita, false);
});
test("falha explicitamente quando artigo novo esta ausente ou o conteudo esta antigo", async () => {
  for (const alteracoes of [{ [artigo]: null }, { [artigo]: html(`/${artigo}`, "versao antiga") }, { "sitemap.xml": "<urlset/>" }, { "rss.xml": "<rss/>" }, { "index.html": html("/") }]) {
    assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch(alteracoes), tentativas: 1 })).aceita, false);
  }
});

test("deploy confere origem, alias e destino de consolidacao e exclui seu snapshot", async () => {
  const origem = "artigos/arquitetura/consolidado.html";
  const alias = "arquitetura/consolidado.html";
  const destino = "artigos/arquitetura/guia.html";
  const redirect = html(`/${destino}`).replace("</head>", `<meta http-equiv="refresh" content="0; url=${baseUrl}/${destino}"></head>`);
  const extras = {
    "dados/indexacao.json": JSON.stringify({ decisoes: [{ url: origem, acao: "consolidar", arquivoHash: "e".repeat(64), destino, aliases: [{ url: alias }] }] }),
    [origem]: redirect, [alias]: redirect, [destino]: html(`/${destino}`, "Guia consolidado")
  };
  const esperado = prepararVerificacao({ ler: f => extras[f] || arquivos[f], revisao: "e".repeat(40) });
  for (const url of [origem, alias, destino]) assert.ok(esperado.arquivos.some(a => a.arquivo === url));
  assert.equal(esperado.ausentes.length, 1);
  assert.match(esperado.ausentes[0], /^dados\/editorial\/arquivados\/[a-f0-9]{64}\.json$/);
  const versao = { ...extras, [esperado.ausentes[0]]: null };
  assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch(versao), tentativas: 1 })).aceita, true);
  for (const url of [origem, alias, destino, esperado.ausentes[0]]) {
    const alterado = { ...versao, [url]: "Versao divergente ou snapshot publicado" };
    assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch(alterado), tentativas: 1 })).aceita, false);
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

test("novo arquivo cronologico e conferido no deploy e nao apenas na home", async () => {
  const extras = {
    "index.html": html("/", `<a href="/${artigo}">Artigo</a><a href="/arquivo/index.html">Arquivo</a>`),
    "artigos/index.html": html("/artigos/index.html"),
    "arquivo/index.html": html("/arquivo/index.html", '<a href="/arquivo/2026-10.html">Outubro de 2026</a>'),
    "arquivo/2026-10.html": html("/arquivo/2026-10.html", `<a href="/${artigo}">Artigo</a>`),
    "sitemap.xml": `<urlset>${[artigo, "artigos/index.html", "arquivo/index.html", "arquivo/2026-10.html"].map(p => `<url><loc>${baseUrl}/${p}</loc></url>`).join("")}</urlset>`
  };
  const esperado = prepararVerificacao({ ler: file => extras[file] || arquivos[file], revisao: "b".repeat(40) });
  assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch(extras), tentativas: 1 })).aceita, true);
  assert.equal((await verificarPublicacao({ esperado, fetchImpl: mockFetch({ ...extras, "arquivo/2026-10.html": null }), tentativas: 1 })).aceita, false);
  assert.ok(esperado.arquivosNavegacao.includes("arquivo/2026-10.html"));
});
