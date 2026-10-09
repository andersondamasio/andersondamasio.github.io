const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const cheerio = require("cheerio");
const { siteUrl } = require("./seo-identity");
const { normalizarRobotsMeta } = require("./seo-robots");
const { hashCorpoEditorial } = require("./seo-helpful-content");
const { executarPublicacao, escreverPublicacao } = require("./editorial-transaction");
const digest = valor => createHash("sha256").update(JSON.stringify(valor)).digest("hex");
const obrigatorias = ["index.html", "sobre.html", "contato.html"];

function lerManifesto(root) {
  const arquivo = path.join(root, "dados", "indexacao.json");
  if (!fs.existsSync(arquivo)) return { versao: 1, protegidas: obrigatorias, decisoes: [] };
  const manifesto = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  if (manifesto.versao !== 1 || !Array.isArray(manifesto.protegidas) || !Array.isArray(manifesto.decisoes) ||
      obrigatorias.some(url => !manifesto.protegidas.includes(url))) throw new Error("Manifesto de indexacao invalido ou sem URLs protegidas.");
  return manifesto;
}

function planejarIndexacao(root = process.cwd()) {
  const manifesto = lerManifesto(root);
  const cadastro = JSON.parse(fs.readFileSync(path.join(root, "titulos.json"), "utf8"));
  const vistas = new Set();
  const operacoes = manifesto.decisoes.map(decisao => {
    const { url, acao, motivo, evidencia, revisao, conteudoHash } = decisao;
    if (!/^artigos\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.html$/.test(url || "") || vistas.has(url)) throw new Error("URL de decisao invalida ou repetida.");
    vistas.add(url);
    if (!["manter", "atualizar", "noindex"].includes(acao)) throw new Error("Consolidacao e retirada exigem fluxo proprio; este manifesto nao apaga nem redireciona artigos.");
    if (acao === "noindex" && manifesto.protegidas.includes(url)) throw new Error(`URL protegida: ${url}`);
    if (typeof motivo !== "string" || motivo.length < 25 || typeof evidencia !== "string" || evidencia.length < 30 ||
        !revisao?.responsavel || !Number.isFinite(Date.parse(revisao.em)) || Date.parse(revisao.em) > Date.now() || !/^[a-f0-9]{64}$/.test(conteudoHash || "")) throw new Error(`Decisao sem motivo, evidencia, revisao ou hash: ${url}`);
    const registros = cadastro.filter(a => a.url === url && a.localizacao?.estado !== "pendente");
    if (registros.length !== 1) throw new Error(`URL sem cadastro unico resolvido: ${url}`);
    const arquivo = path.join(root, url);
    const antes = fs.readFileSync(arquivo, "utf8");
    const $ = cheerio.load(antes, { sourceCodeLocationInfo: true });
    if ($(".article-body").length !== 1 || hashCorpoEditorial($(".article-body").html()) !== conteudoHash) throw new Error(`Corpo divergiu da revisao: ${url}`);
    if ($("link[rel=canonical]").length !== 1 || $("link[rel=canonical]").attr("href") !== `${siteUrl}/${url}` || $("meta[http-equiv=refresh]").length) throw new Error(`Canonical ou redirecionamento inesperado: ${url}`);
    const robots = $('meta[name="robots" i]');
    if (robots.length > 1) throw new Error(`Robots duplicado: ${url}`);
    const desejado = normalizarRobotsMeta(acao === "noindex" ? "noindex, follow" : "index, follow");
    let depois = antes;
    if (robots.attr("content") !== desejado) {
      const tag = `<meta name="robots" content="${desejado}">`;
      if (robots.length) {
        const trecho = robots[0].sourceCodeLocation;
        if (!trecho) throw new Error(`Robots sem localizacao: ${url}`);
        depois = antes.slice(0, trecho.startOffset) + tag + antes.slice(trecho.endOffset);
      } else {
        const fimHead = $("head")[0]?.sourceCodeLocation?.endTag?.startOffset;
        if (!Number.isInteger(fimHead)) throw new Error(`Head sem fechamento: ${url}`);
        depois = antes.slice(0, fimHead) + tag + "\n" + antes.slice(fimHead);
      }
    }
    return { url, acao, motivo, antes, depois, alterado: antes !== depois };
  });
  return { versao: 1, hash: digest({ manifesto, arquivos: operacoes.map(o => ({ url: o.url, antes: digest(o.antes) })) }),
    operacoes, resumo: { revisadas: operacoes.length, alteracoes: operacoes.filter(o => o.alterado).length,
      noindex: operacoes.filter(o => o.acao === "noindex").length, exclusoes: 0, redirecionamentos: 0 } };
}

function exigirManifestoAplicado(root = process.cwd()) {
  const plano = planejarIndexacao(root);
  if (plano.resumo.alteracoes) throw new Error("Manifesto de indexacao diverge do HTML. Execute o dry-run e aplique o hash conferido antes do rebuild/backfill.");
  return plano;
}

function aplicarIndexacao({ hashConferido, rebuild, root = process.cwd() }) {
  const plano = planejarIndexacao(root);
  if (hashConferido !== plano.hash) throw new Error("Dry-run desatualizado; conferir o novo plano antes de aplicar.");
  executarPublicacao(() => {
    for (const operacao of plano.operacoes.filter(o => o.alterado)) escreverPublicacao(path.join(root, operacao.url), operacao.depois);
    rebuild();
    exigirManifestoAplicado(root);
  }, root);
  return plano.resumo;
}

if (require.main === module) {
  try {
    if (process.argv.includes("--check")) {
      console.log(JSON.stringify(exigirManifestoAplicado().resumo, null, 2));
    } else if (process.argv.includes("--apply")) {
      const hashConferido = process.argv[process.argv.indexOf("--apply") + 1];
      console.log(JSON.stringify(aplicarIndexacao({ hashConferido, rebuild: () => require("../gerar-conteudo").reconstruirPaginasSeo() }), null, 2));
    } else {
      const plano = planejarIndexacao();
      console.log(JSON.stringify({ hash: plano.hash, ...plano.resumo, operacoes: plano.operacoes.map(({ antes, depois, ...o }) => o), modo: "somente-leitura" }, null, 2));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { lerManifesto, planejarIndexacao, exigirManifestoAplicado, aplicarIndexacao };
