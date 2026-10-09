const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { siteUrl } = require("./seo-identity");

function slug(titulo) {
  return String(titulo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function listar(dir, arquivos = []) {
  if (!fs.existsSync(dir)) return arquivos;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) listar(file, arquivos);
    else if (item.isFile() && item.name.endsWith(".html")) arquivos.push(file);
  }
  return arquivos;
}

function planejarEstabilizacao(root = process.cwd()) {
  const registros = JSON.parse(fs.readFileSync(path.join(root, "titulos.json"), "utf8"));
  const possuiCorpo = url => {
    if (!/^artigos\/[a-z0-9/-]+\.html$/.test(url || "")) return false;
    const arquivo = path.join(root, url);
    return fs.existsSync(arquivo) && /class=["'][^"']*\barticle-body\b/i.test(fs.readFileSync(arquivo, "utf8"));
  };
  const pendentes = new Set(registros.map((x, indice) => possuiCorpo(x.url) ? -1 : indice).filter(indice => indice >= 0));
  const procurados = new Set([...pendentes].map(indice => slug(registros[indice].titulo)));
  const porSlug = new Map();
  for (const file of listar(path.join(root, "artigos"))) {
    const chave = path.basename(file, ".html");
    if (!procurados.has(chave)) continue;
    const $ = cheerio.load(fs.readFileSync(file, "utf8"));
    if (!$(".article-body").length) continue;
    const url = path.relative(root, file).replace(/\\/g, "/");
    const candidato = { url, titulo: $("h1").first().text(), canonical: $("link[rel='canonical']").attr("href") || null };
    if (!porSlug.has(chave)) porSlug.set(chave, []);
    porSlug.get(chave).push(candidato);
  }
  const resolucoes = [];
  const atualizados = registros.map((registro, indice) => {
    if (!pendentes.has(indice)) return registro;
    const candidatos = porSlug.get(slug(registro.titulo)) || [];
    const compativeis = candidatos.filter(x => slug(x.titulo) === slug(registro.titulo) && x.canonical === `${siteUrl}/${x.url}`);
    if (candidatos.length === 1 && compativeis.length === 1) {
      resolucoes.push({ indice, titulo: registro.titulo, estado: "resolvido", urlAnterior: registro.url || null, url: compativeis[0].url, evidencia: "slug, H1 e canonical conferidos no HTML existente" });
      const novo = { ...registro, url: compativeis[0].url };
      if (registro.url) novo.aliasesLegados = [...new Set([...(registro.aliasesLegados || []), registro.url])];
      delete novo.localizacao;
      return novo;
    }
    const motivo = !candidatos.length ? "arquivo-nao-localizado" : "candidatos-ambiguos-ou-divergentes";
    resolucoes.push({ indice, titulo: registro.titulo, estado: "pendente", motivo, candidatos });
    return { ...registro, localizacao: { estado: "pendente", motivo, tituloConsultado: registro.titulo } };
  });
  return { registros: atualizados, resolucoes, alterado: JSON.stringify(registros) !== JSON.stringify(atualizados) };
}

if (require.main === module) {
  const plano = planejarEstabilizacao();
  const aplicar = process.argv.includes("--apply");
  fs.mkdirSync(".editorial", { recursive: true });
  fs.writeFileSync(".editorial/estabilizacao-urls.json", `${JSON.stringify({ aplicar, resolucoes: plano.resolucoes }, null, 2)}\n`);
  if (aplicar && plano.alterado) fs.writeFileSync("titulos.json", JSON.stringify(plano.registros, null, 2) + "\n");
  console.log(JSON.stringify({ modo: aplicar ? "aplicacao" : "dry-run", resolvidos: plano.resolucoes.filter(x => x.estado === "resolvido").length, pendentes: plano.resolucoes.filter(x => x.estado === "pendente").length, cadastroAlterado: aplicar && plano.alterado }, null, 2));
}

module.exports = { planejarEstabilizacao };
