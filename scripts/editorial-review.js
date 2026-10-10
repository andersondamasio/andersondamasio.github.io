const { createHash } = require("node:crypto");
const cheerio = require("cheerio");
const { avaliarGeneroEditorial, versaoPoliticaEditorial } = require("./editorial-policy");
const { normalizarUrlComparacaoFonte } = require("./seo-source-citation");

const checklistObrigatorio = [
  "liTextoIntegral", "conferiFatosNasFontes", "distinguiInferencias",
  "conferiUtilidade", "conferiDuplicidade", "conferiDireitos", "semVivenciaInventada"
];

function serializarEstavel(valor) {
  if (Array.isArray(valor)) return `[${valor.map(serializarEstavel).join(",")}]`;
  if (valor && typeof valor === "object") return `{${Object.keys(valor).sort().map(chave =>
    `${JSON.stringify(chave)}:${serializarEstavel(valor[chave])}`).join(",")}}`;
  return JSON.stringify(valor);
}

function hashRascunho(rascunho) {
  // Approval/status fields are not content. Everything else invalidates approval on change.
  const { revisaoHumana, estado, publicado, ...conteudo } = rascunho;
  return createHash("sha256").update(serializarEstavel(JSON.parse(JSON.stringify(conteudo)))).digest("hex");
}

function textoHtml(html) {
  const $ = cheerio.load(String(html || ""), null, false);
  $("script,style").remove();
  return $.root().text().normalize("NFC").replace(/\s+/g, " ").trim();
}

function urlPublica(valor) {
  try {
    const url = new URL(valor);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password &&
      !/^(localhost|127\.|0\.|\[|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname);
  } catch { return false; }
}

function avaliarHtmlEditorial(html) {
  const $ = cheerio.load(String(html || ""), null, false);
  const motivos = [];
  const permitidas = new Set("p h2 h3 h4 ul ol li strong em b i a blockquote cite q pre code table thead tbody tfoot tr th td caption figure figcaption img br hr span div dl dt dd sup sub abbr time".split(" "));
  const atributos = new Set("href title cite src alt width height loading decoding datetime lang class scope colspan rowspan start reversed type".split(" "));
  $("*").each((_, elemento) => {
    if (!permitidas.has(elemento.tagName)) motivos.push(`tag-nao-permitida:${elemento.tagName}`);
    for (const [nome, valor] of Object.entries(elemento.attribs || {})) {
      if (!atributos.has(nome)) motivos.push(`atributo-nao-permitido:${nome}`);
      if (["href", "src", "cite"].includes(nome) &&
          !(urlPublica(valor) || /^\/(?!\/)[a-z0-9/_%.-]+(?:#[a-z0-9_-]+)?$/i.test(valor) || /^#[a-z0-9_-]+$/i.test(valor))) {
        motivos.push(`url-nao-permitida:${nome}`);
      }
    }
  });
  const pagina = cheerio.load(`<main data-editorial="outer"><div data-editorial="body">${html}</div><span data-editorial="end"></span></main>`, null, false);
  const principal = pagina('main[data-editorial="outer"]');
  if (pagina.root().contents().length !== 1 || principal.contents().length !== 2 ||
      principal.children().first().attr("data-editorial") !== "body" ||
      principal.children().last().attr("data-editorial") !== "end") motivos.push("html-rompe-container-do-artigo");
  if (!textoHtml(html)) motivos.push("corpo-vazio");
  return { aceita: motivos.length === 0, motivos: [...new Set(motivos)] };
}

function candidatosDuplicidade(rascunho, titulos = []) {
  const tokens = titulo => new Set(String(titulo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 4));
  const pauta = tokens(rascunho.titulo);
  const fonte = normalizarUrlComparacaoFonte(rascunho.fonte?.url);
  const mesmaFonte = item => Boolean(fonte && normalizarUrlComparacaoFonte(item.urlFonte) === fonte);
  return titulos.filter(item => {
    if (item.localizacao?.estado === "pendente" || !item.url) return false;
    if (mesmaFonte(item)) return true;
    const anterior = tokens(item.titulo);
    const comuns = [...pauta].filter(t => anterior.has(t)).length;
    return comuns >= 3 && comuns / Math.max(1, Math.min(pauta.size, anterior.size)) >= 0.6;
  }).map(item => ({ url: item.url, titulo: item.titulo, mesmaFonte: mesmaFonte(item) }));
}

function criarDossie(rascunho, titulos = []) {
  return {
    pauta: { publico: "Desenvolvedores e arquitetos de software", pergunta: "", genero: "analise-baseada-em-fontes" },
    fontes: rascunho.fonte?.url ? [{
      url: rascunho.fonte.url, titulo: rascunho.fonte.titulo || "", tipo: "a-classificar",
      consultadaEm: rascunho.fonte.consultadaEm || null, resumoEvidencia: ""
    }] : [],
    afirmacoes: [],
    contribuicao: { descricao: "", trecho: "" },
    limites: "",
    duplicidade: { candidatos: candidatosDuplicidade(rascunho, titulos), decisao: "pendente", justificativa: "" },
    midias: []
  };
}

function validarDossie(rascunho, titulos = []) {
  const motivos = [];
  const dossie = rascunho.dossie || {};
  const texto = textoHtml(rascunho.corpoArtigo);
  const presente = trecho => typeof trecho === "string" && textoHtml(trecho).length >= 15 && texto.includes(textoHtml(trecho));
  const preenchido = valor => typeof valor === "string" && valor.trim().length >= 15;
  if (rascunho.versao !== 2 || rascunho.politica !== versaoPoliticaEditorial) motivos.push("versao-editorial-incompativel");
  if (typeof rascunho.titulo !== "string" || rascunho.titulo.length < 10 || /[<>]/.test(rascunho.titulo)) motivos.push("titulo-invalido");
  if (!rascunho.categoria || !rascunho.resumo) motivos.push("metadados-incompletos");
  if (rascunho.fonte?.data && !Number.isFinite(Date.parse(rascunho.fonte.data))) motivos.push("data-da-fonte-invalida");
  if (!preenchido(dossie.pauta?.publico) || !preenchido(dossie.pauta?.pergunta) ||
      !["noticia", "analise-baseada-em-fontes", "guia-baseado-em-fontes"].includes(dossie.pauta?.genero)) motivos.push("pauta-incompleta");
  const fontes = Array.isArray(dossie.fontes) ? dossie.fontes : [];
  if (!fontes.length || fontes.some(f => !urlPublica(f.url) || !f.titulo ||
    !["primaria", "secundaria"].includes(f.tipo) || !Number.isFinite(Date.parse(f.consultadaEm)) ||
    !preenchido(f.resumoEvidencia) || f.resumoEvidencia.length > 500)) motivos.push("fontes-sem-evidencia");
  if (!fontes.some(f => f.tipo === "primaria")) motivos.push("fonte-primaria-a-conferir");
  if (!fontes.some(f => f.url === rascunho.fonte?.url)) motivos.push("fonte-original-a-conferir");
  const afirmacoes = Array.isArray(dossie.afirmacoes) ? dossie.afirmacoes : [];
  if (!afirmacoes.length || !afirmacoes.some(a => a.tipo === "fato")) motivos.push("mapa-de-afirmacoes-a-preencher");
  for (const [i, a] of afirmacoes.entries()) {
    if (!["fato", "inferencia", "exemplo-hipotetico"].includes(a.tipo) || !presente(a.trecho) || !preenchido(a.verificacao)) motivos.push(`afirmacao-incompleta:${i}`);
    if (a.tipo === "fato" && (!fontes.some(f => f.url === a.fonteUrl) || !preenchido(a.localizacaoNaFonte))) motivos.push(`fato-sem-suporte:${i}`);
  }
  if (!preenchido(dossie.contribuicao?.descricao) || !presente(dossie.contribuicao?.trecho)) motivos.push("contribuicao-a-comprovar");
  if (!presente(dossie.limites)) motivos.push("limites-a-explicitar-no-artigo");
  const duplicidade = dossie.duplicidade || {};
  if (duplicidade.decisao !== "novo-artigo" || !preenchido(duplicidade.justificativa)) motivos.push("decisao-de-pauta-pendente");
  const candidatos = candidatosDuplicidade(rascunho, titulos);
  if (candidatos.some(c => !duplicidade.candidatos?.some(r => r.url === c.url && preenchido(r.justificativa)))) motivos.push("sobreposicao-a-revisar");
  const $ = cheerio.load(rascunho.corpoArtigo || "", null, false);
  $("img").each((_, imagem) => {
    const src = $(imagem).attr("src");
    const midia = dossie.midias?.find(m => m.src === src);
    if (!midia || !urlPublica(midia.origem) || !preenchido(midia.direitos) || !$(imagem).attr("alt") ||
        !/^[1-9]\d*$/.test($(imagem).attr("width") || "") || !/^[1-9]\d*$/.test($(imagem).attr("height") || "")) motivos.push("imagem-sem-direitos-ou-metadados");
  });
  motivos.push(...avaliarHtmlEditorial(rascunho.corpoArtigo).motivos);
  // Only human-checked short quotations can explain first-person text inside a quotation.
  const fontesCitacoes = fontes.map(f => ({ url: f.url, texto: afirmacoes.filter(a =>
    a.tipo === "fato" && a.fonteUrl === f.url && a.citacaoLiteral === true).map(a => a.trecho).join("\n") }));
  motivos.push(...avaliarGeneroEditorial({ titulo: rascunho.titulo, corpoArtigo: rascunho.corpoArtigo, fontes: fontesCitacoes }).motivos);
  return { aceita: motivos.length === 0, motivos: [...new Set(motivos)], candidatos, verificacaoFactualAutomatica: false };
}

function aprovarRascunho(rascunho, { responsavel, checklist, confirmacaoHumana }, titulos = [], agora = new Date()) {
  const avaliacao = validarDossie(rascunho, titulos);
  if (!avaliacao.aceita) throw new Error(`Dossie incompleto: ${avaliacao.motivos.join(", ")}`);
  if (confirmacaoHumana !== "REVISEI INTEGRALMENTE" || typeof responsavel !== "string" || responsavel.trim().length < 5 ||
      checklistObrigatorio.some(chave => checklist?.[chave] !== true)) throw new Error("Exigida declaracao explicita do revisor humano; a IA nao pode atestar esta revisao.");
  const conteudo = { ...rascunho, pendencias: [] };
  return { ...conteudo, estado: "aprovado", revisaoHumana: {
    responsavel: responsavel.trim(), aprovadaEm: agora.toISOString(),
    hash: hashRascunho(conteudo), politica: versaoPoliticaEditorial, checklist,
    declaracao: confirmacaoHumana
  } };
}

function validarAprovacao(rascunho, titulos = [], agora = new Date()) {
  const resultado = validarDossie(rascunho, titulos);
  const revisao = rascunho.revisaoHumana;
  const data = Date.parse(revisao?.aprovadaEm);
  if (rascunho.estado !== "aprovado" || !revisao || revisao.hash !== hashRascunho(rascunho) ||
      revisao.politica !== versaoPoliticaEditorial || revisao.declaracao !== "REVISEI INTEGRALMENTE" ||
      typeof revisao.responsavel !== "string" || revisao.responsavel.trim().length < 5 ||
      !Number.isFinite(data) || data > agora.getTime() ||
      checklistObrigatorio.some(chave => revisao.checklist?.[chave] !== true)) resultado.motivos.push("aprovacao-humana-ausente-ou-desatualizada");
  if (rascunho.publicado || titulos.some(t => t.editorial?.hash === revisao?.hash && revisao?.hash)) resultado.motivos.push("rascunho-ja-publicado");
  resultado.aceita = resultado.motivos.length === 0;
  return resultado;
}

function avaliarCadenciaSemanal(titulos, agora = new Date()) {
  const datas = titulos.map(t => Date.parse(t.data)).filter(Number.isFinite);
  const ultima = datas.length ? Math.max(...datas) : null;
  const proxima = ultima === null ? agora.getTime() : ultima + 7 * 24 * 60 * 60 * 1000;
  return { aceita: agora.getTime() >= proxima, proximaPublicacao: new Date(proxima).toISOString() };
}

module.exports = { hashRascunho, criarDossie, validarDossie, aprovarRascunho, validarAprovacao,
  avaliarHtmlEditorial, avaliarCadenciaSemanal, candidatosDuplicidade, checklistObrigatorio, textoHtml };
