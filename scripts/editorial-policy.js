const cheerio = require("cheerio");
const { normalizarFonteUrl } = require("./seo-source-citation");

const versaoPoliticaEditorial = "2026-10-09.1";
const regrasGeneroEditorial = [
  "Escreva noticias e analises tecnicas baseadas nas fontes fornecidas, em portugues brasileiro.",
  "Voce atua como redator editorial; nao e Anderson Damasio e nao deve assumir sua identidade.",
  "Nao atribua ao autor vivencias, opinioes pessoais, clientes, testes, projetos ou resultados.",
  "Apresente interpretacoes como analise do material, sem as transformar em fatos confirmados.",
  "O artigo deve funcionar sem o prompt: nao abra com um sim/nao isolado se a pergunta nao estiver visivel ao leitor.",
  "O resumo deve ser especifico e autossuficiente. Evite repetir a mesma afirmacao em varias secoes.",
  "Identifique exemplos hipoteticos. Nao declare teste ou revisao humana que nao ocorreu.",
  "Preserve citacoes reais de terceiros com atribuicao e URL da fonte; nao invente citacoes.",
  "Nao troque uma vivencia inventada por uma alegacao impessoal como 'testes comprovaram'.",
  "Se faltar sustentacao, explicite a limitacao ou deixe a afirmacao fora do texto."
].join("\n");

function normalizarTexto(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

function textoCitacao($, elemento) {
  const clone = $(elemento).clone();
  clone.find("cite, a, pre, code").remove();
  return clone.text().replace(/\s+/g, " ").trim();
}

function extrairCitacoes(html) {
  const $ = cheerio.load(String(html || ""));
  $("pre, code, script, style").remove();
  return $("blockquote, q").map((_, elemento) => ({
    texto: textoCitacao($, elemento),
    atribuicao: $(elemento).find("cite").text().replace(/\s+/g, " ").trim(),
    url: normalizarFonteUrl($(elemento).attr("cite") || $(elemento).find("a[href]").first().attr("href"))
  })).get();
}

const padroesVivencia = [
  {
    id: "vivencia-primeira-pessoa",
    pattern: /\b(?:(?:eu\s+)?(?:testei|implementei|implantei|desenvolvi|liderei|participei|presenciei|vivenciei|comprovei|experimentei|enfrentei|instalei|utilizei|usei|troquei|migrei|passei|decidi|consegui|percebi)|(?:nos\s+)?(?:testamos|implementamos|implantamos|vivenciamos|comprovamos)|ja\s+(?:vivi|passei|enfrentei|observei)|(?:(?:na|pela|em)\s+)?minha\s+(?:carreira|experiencia)|(?:em|nos|nas|com)\s+(?:os\s+|as\s+)?(?:meus?|minhas?|nossos?|nossas?)\s+(?:projetos?|clientes?|times?|equipes?|testes?|experiencias?))\b/g
  },
  {
    id: "vivencia-pessoal-implicita",
    pattern: /\b(?:tive\s+(?:a\s+)?oportunidade\s+de\s+(?:usar|utilizar|experimentar|testar)|(?:comecei|passei)\s+a\s+(?:usar|utilizar|experimentar|testar)|(?:mudou|mudaram|transformou|transformaram)\s+(?:o\s+|a\s+)?(?:meus?|minhas?)\s+\w+|meu\s+top\s+\d+|minhas?\s+(?:escolhas?|trajetoria|rotina)|(?:meus?|minhas?)\s+(?:\w+\s+){0,2}(?:favoritos?|favoritas?|preferidos?|preferidas?))\b/g
  },
  {
    id: "vivencia-atribuida-ao-autor",
    pattern: /\b(?:anderson(?:\s+damasio)?|o autor)\s+(?:(?:ja|tambem|pessoalmente)\s+){0,2}(?:testou|implementou|implantou|liderou|vivenciou|comprovou|presenciou|experimentou|desenvolveu)\b/g
  }
];

// Sinais conservadores para revisao, nao prova de erro nem verificacao factual.
function avaliarGeneroEditorial({ titulo = "", corpoArtigo = "", fontes = [] } = {}) {
  const $ = cheerio.load(String(corpoArtigo));
  $("pre, code, script, style").remove();
  const fontesNormalizadas = fontes.map(fonte => ({
    url: normalizarFonteUrl(fonte.url), texto: normalizarTexto(fonte.texto)
  }));
  let citacoesRastreaveis = 0;
  $("blockquote, q").each((_, elemento) => {
    const texto = normalizarTexto(textoCitacao($, elemento));
    const url = normalizarFonteUrl($(elemento).attr("cite") || $(elemento).find("a[href]").first().attr("href"));
    if (url && texto.length >= 15 && fontesNormalizadas.some(fonte =>
      fonte.url === url && fonte.texto.includes(texto))) {
      citacoesRastreaveis++;
      $(elemento).remove();
    }
  });
  const texto = normalizarTexto(`${titulo}\n${$.root().text()}`);
  const sinais = [];
  for (const { id, pattern } of padroesVivencia) {
    for (const match of texto.matchAll(new RegExp(pattern.source, pattern.flags))) {
      sinais.push({ id, trecho: texto.slice(Math.max(0, match.index - 55), match.index + match[0].length + 85) });
    }
  }
  return {
    aceita: sinais.length === 0,
    motivos: [...new Set(sinais.map(sinal => sinal.id))],
    sinais,
    citacoesRastreaveis,
    verificacaoFactual: false,
    politica: versaoPoliticaEditorial
  };
}

async function revisarComPoliticaEditorial({ titulo, corpoArtigo, noticia, textoFonte, humanizar }) {
  const fontes = [{ url: noticia.url, texto: textoFonte }];
  const antes = avaliarGeneroEditorial({ titulo, corpoArtigo, fontes });
  if (!antes.aceita) return { aceita: false, motivos: antes.motivos, antes, depois: null, humanizacao: null };
  const humanizacao = await humanizar({ titulo, corpoArtigo, noticia, textoFonte });
  if (!humanizacao.aceita) {
    return { aceita: false, motivos: humanizacao.motivos, antes, depois: null, humanizacao };
  }
  const depois = avaliarGeneroEditorial({ titulo: humanizacao.titulo, corpoArtigo: humanizacao.corpoArtigo, fontes });
  return { aceita: depois.aceita, motivos: depois.motivos, antes, depois, humanizacao };
}

module.exports = {
  avaliarGeneroEditorial,
  extrairCitacoes,
  regrasGeneroEditorial,
  revisarComPoliticaEditorial,
  versaoPoliticaEditorial
};
