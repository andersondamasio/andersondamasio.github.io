const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cheerio = require("cheerio");
const { reconstruirPaginasSeo } = require("../gerar-conteudo");
const { medirNavegacao } = require("./seo-navigation");

function workspace(run) {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, "perfil-navigation-test-"));
  const cwd = process.cwd();
  try { process.chdir(root); return run(root); } finally {
    process.chdir(cwd);
    if (path.dirname(root) !== base || !path.basename(root).startsWith("perfil-navigation-test-")) throw new Error("Temporario fora do escopo.");
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function preparar(quantidade = 61) {
  const artigos = Array.from({ length: quantidade }, (_, n) => ({
    titulo: `Contratos de mensagens ${n}`, url: `artigos/arquitetura/contratos-${n}.html`, categoria: "Arquitetura",
    data: new Date(Date.UTC(2026, n % 6, n % 27 + 1, 12)).toISOString()
  }));
  fs.mkdirSync("artigos/arquitetura", { recursive: true });
  for (const a of artigos) fs.writeFileSync(a.url, `<html><head><title>${a.titulo}</title><meta name="robots" content="index, follow"></head><body><h1>${a.titulo}</h1><div class="article-body"><p>Corpo editorial preservado.</p></div></body></html>`);
  fs.writeFileSync("titulos.json", JSON.stringify(artigos));
  return artigos;
}

function snapshot(dir = ".", resultado = {}) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const arquivo = path.join(dir, item.name);
    if (item.isDirectory()) snapshot(arquivo, resultado);
    else resultado[arquivo] = fs.readFileSync(arquivo, "utf8");
  }
  return resultado;
}

test("arquivo cobre todo o acervo em ate tres links indexaveis e dois rebuilds estaveis", () => workspace(root => {
  const artigos = preparar();
  reconstruirPaginasSeo();
  const primeiro = snapshot();
  reconstruirPaginasSeo();
  assert.deepEqual(snapshot(), primeiro);
  const medicao = medirNavegacao(root);
  assert.equal(medicao.artigos, artigos.length);
  assert.equal(medicao.resumo.orfaos, 0);
  assert.equal(medicao.resumo.semCaminhoIndexavel, 0);
  assert.ok(medicao.urls.every(a => a.viaIndexaveis <= 3));
  for (const arquivo of ["index2.html", "artigos/arquitetura2.html"]) {
    const $ = cheerio.load(fs.readFileSync(arquivo, "utf8"));
    assert.match($("meta[name=robots]").attr("content"), /noindex/);
    assert.equal($("link[rel=canonical]").attr("href"), `https://www.andersondamasio.com.br/${arquivo}`);
    assert.ok($("nav a[rel=prev]").length);
  }
  const sitemap = cheerio.load(fs.readFileSync("sitemap.xml", "utf8"), { xmlMode: true });
  const urls = sitemap("loc").map((_, el) => sitemap(el).text()).get();
  assert.ok(urls.some(u => u.endsWith("/arquivo/2026-01.html")));
  assert.ok(!urls.some(u => /index2.html|arquitetura2.html/.test(u)));
  assert.ok(artigos.every(a => urls.includes(`https://www.andersondamasio.com.br/${a.url}`)));
  for (const a of artigos) assert.equal(cheerio.load(fs.readFileSync(a.url, "utf8"))(".article-body").text(), "Corpo editorial preservado.");
}));

test("mes obsoleto mantem compatibilidade, sem ficar indexavel nem no sitemap", () => workspace(() => {
  preparar(1);
  fs.mkdirSync("arquivo", { recursive: true });
  fs.writeFileSync("arquivo/2025-01.html", "<html><body>Arquivo antigo</body></html>");
  reconstruirPaginasSeo();
  const $ = cheerio.load(fs.readFileSync("arquivo/2025-01.html", "utf8"));
  assert.match($("meta[name=robots]").attr("content"), /noindex/);
  assert.match($("link[rel=canonical]").attr("href"), /arquivo\/index.html$/);
  assert.doesNotMatch(fs.readFileSync("sitemap.xml", "utf8"), /2025-01.html/);
}));

test("data invalida impede escritas e pastas de rascunho nao sao alteradas", () => workspace(() => {
  const artigos = preparar(1);
  fs.mkdirSync(".editorial", { recursive: true });
  fs.writeFileSync(".editorial/index999.html", "Rascunho isolado");
  artigos[0].data = "invalida";
  fs.writeFileSync("titulos.json", JSON.stringify(artigos));
  const antes = snapshot();
  assert.throws(() => reconstruirPaginasSeo(), /data de publicacao valida/);
  assert.deepEqual(snapshot(), antes);
  artigos[0].data = "2026-10-01T12:00:00Z";
  fs.writeFileSync("titulos.json", JSON.stringify(artigos));
  reconstruirPaginasSeo();
  assert.equal(fs.readFileSync(".editorial/index999.html", "utf8"), "Rascunho isolado");
}));
