const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { avaliarGeneroEditorial } = require("./editorial-policy");
const { normalizarUrlComparacaoFonte } = require("./seo-source-citation");

function listarHtml(diretorio, saida = []) {
  if (!fs.existsSync(diretorio)) return saida;
  for (const entrada of fs.readdirSync(diretorio, { withFileTypes: true })) {
    const arquivo = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) listarHtml(arquivo, saida);
    else if (entrada.isFile() && entrada.name.endsWith(".html")) saida.push(arquivo);
  }
  return saida.sort();
}

function slugTitulo(titulo) {
  return String(titulo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function inventariarAcervo(root = process.cwd()) {
  const registros = JSON.parse(fs.readFileSync(path.join(root, "titulos.json"), "utf8"));
  if (!Array.isArray(registros)) throw new Error("titulos.json deve conter uma lista.");
  const porUrl = new Map();
  const fontes = new Map();
  registros.forEach(registro => {
    if (registro.url) {
      const url = String(registro.url).replace(/^\.?\//, "");
      if (!porUrl.has(url)) porUrl.set(url, []);
      porUrl.get(url).push(registro);
    }
    const fonte = normalizarUrlComparacaoFonte(registro.urlFonte);
    if (fonte) {
      if (!fontes.has(fonte)) fontes.set(fonte, []);
      fontes.get(fonte).push({ titulo: registro.titulo, url: registro.url || null });
    }
  });
  const artigos = [];
  const porSlug = new Map();
  for (const arquivo of listarHtml(path.join(root, "artigos"))) {
    const html = fs.readFileSync(arquivo, "utf8");
    if (!html.includes("article-body")) continue;
    const $ = cheerio.load(html);
    const corpo = $(".article-body").first();
    if (!corpo.length) continue;
    const url = path.relative(root, arquivo).replace(/\\/g, "/");
    const registrosUrl = porUrl.get(url) || [];
    const titulo = $("h1").first().text().trim();
    const genero = avaliarGeneroEditorial({ titulo, corpoArtigo: corpo.html() });
    const motivos = [...genero.motivos];
    if (registrosUrl.some(registro => (fontes.get(normalizarUrlComparacaoFonte(registro.urlFonte)) || []).length > 1)) {
      motivos.push("fonte-compartilhada-requer-comparacao");
    }
    if (!registrosUrl.length) motivos.push("sem-registro-com-url-explicita");
    const artigo = {
      url, titulo,
      canonical: $("link[rel='canonical']").attr("href") || null,
      robots: $("meta[name='robots']").attr("content") || null,
      registrosComUrl: registrosUrl.length,
      palavras: corpo.text().trim().split(/\s+/).filter(Boolean).length,
      sinais: genero.sinais,
      motivos,
      decisao: "triagem_pendente",
      indexacaoGoogle: null,
      cliquesGoogle: null,
      exigeConferenciaDeFontes: true
    };
    artigos.push(artigo);
    const slug = path.basename(arquivo, ".html");
    if (!porSlug.has(slug)) porSlug.set(slug, []);
    porSlug.get(slug).push(url);
  }
  const urlsImplicitas = registros.filter(registro => !registro.url).map(registro => ({
    titulo: registro.titulo,
    categoria: registro.categoria || null,
    candidatos: porSlug.get(slugTitulo(registro.titulo)) || [],
    resolucao: "revisao_pendente"
  }));
  const fontesRepetidas = [...fontes].filter(([, itens]) => itens.length > 1)
    .map(([url, itens]) => ({ url, registros: itens }));
  return {
    versao: 1,
    geradoEm: new Date().toISOString(),
    escopo: "HTML locais em artigos; sem consultas HTTP ou ao Search Console",
    limites: "Sinais sao candidatos, nao erros confirmados. URLs de fontes repetidas sao chaves de comparacao sem rastreamento conhecido, nao canonicals verificadas. Fonte compartilhada nao prova duplicidade de intencao. Sem consultar a fonte, citacoes podem ser sinalizadas. Ausencia de sinal nao aprova o artigo. Nenhuma decisao de indexacao e aplicada.",
    resumo: {
      artigos: artigos.length,
      candidatosVivencia: artigos.filter(artigo => artigo.sinais.length).length,
      registrosSemUrlExplicita: urlsImplicitas.length,
      gruposFonteRepetida: fontesRepetidas.length
    },
    urlsImplicitas,
    fontesRepetidas,
    candidatosPiloto: artigos.filter(artigo => artigo.motivos.length)
      .sort((a, b) => b.sinais.length - a.sinais.length || a.url.localeCompare(b.url))
      .slice(0, 50).map(({ url, motivos }) => ({ url, motivos })),
    artigos
  };
}

if (require.main === module) {
  const root = process.cwd();
  const resultado = inventariarAcervo(root);
  const diretorio = path.join(root, ".editorial");
  fs.mkdirSync(diretorio, { recursive: true });
  const arquivo = path.join(diretorio, "inventario.json");
  fs.writeFileSync(arquivo, `${JSON.stringify(resultado, null, 2)}\n`);
  console.log(JSON.stringify({ ...resultado.resumo, arquivo }, null, 2));
}

module.exports = { inventariarAcervo };
