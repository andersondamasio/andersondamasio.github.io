const fs = require("fs");
const path = require("path");

const humanizerSkill = Object.freeze({
  name: "blader/humanizer",
  version: "2.11.2",
  source: "https://github.com/blader/humanizer"
});

const padroesPontuados = [
  {
    id: "texto-de-chatbot",
    peso: 30,
    limite: 1,
    pattern: /\b(?:espero que (?:isso )?ajude|claro[!,]|certamente[!,]|deixe-me saber|gostaria que eu|vamos mergulhar|vamos explorar|aqui esta o que voce precisa saber)\b/gi
  },
  {
    id: "experiencia-pessoal-nao-verificavel",
    peso: 30,
    limite: 2,
    pattern: /\b(?:em meus? (?:projetos?|clientes?|times?)|com meus? clientes?|na minha carreira|na minha experiencia|eu (?:implementei|liderei|participei|presenciei|vivenciei)|ja (?:passei|vivi|enfrentei|implementei))\b/gi
  },
  {
    id: "fonte-vaga",
    peso: 14,
    limite: 2,
    pattern: /\b(?:especialistas (?:dizem|afirmam|acreditam)|estudos mostram|pesquisas indicam|relatorios indicam|observadores apontam|segundo especialistas)\b/gi
  },
  {
    id: "cliche-de-ia",
    peso: 6,
    limite: 4,
    pattern: /\b(?:papel crucial|cenario em constante evolucao|divisor de aguas|futuro promissor|momento crucial|mudanca de paradigma|nova era|jornada transformadora|abordagem inovadora|desafios e oportunidades|guia completo|em suma|vale ressaltar|e importante destacar|a medida que avancamos)\b/gi
  },
  {
    id: "profundidade-encenada",
    peso: 5,
    limite: 3,
    pattern: /\b(?:a verdadeira questao|no cerne|em sua essencia|o que realmente importa|fundamentalmente|a questao mais profunda|o coracao da questao)\b/gi
  },
  {
    id: "alternativa-ou-objecao-ficticia",
    peso: 5,
    limite: 3,
    pattern: /\b(?:nao se trata apenas de|nao estou dizendo que|para ser claro|nao me entenda mal|pode parecer tentador|voce pode pensar que|alguns podem dizer)\b/gi
  },
  {
    id: "nao-apenas-mas-tambem",
    peso: 4,
    limite: 3,
    pattern: /\bnao apenas\b[\s\S]{0,100}\bmas tambem\b/gi
  }
];

function carregarRegrasHumanizer(root = path.resolve(__dirname, "..")) {
  const rulesPath = path.join(root, "dados", "humanizer-rules.md");
  if (!fs.existsSync(rulesPath)) {
    throw new Error(`Regras Humanizer nao encontradas em ${rulesPath}.`);
  }

  const rules = fs.readFileSync(rulesPath, "utf8").trim();
  if (rules.length < 500) {
    throw new Error("Arquivo de regras Humanizer esta vazio ou incompleto.");
  }

  return rules;
}

function textoNormalizado(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function contarOcorrencias(value, pattern) {
  return (value.match(pattern) || []).length;
}

function adicionarSinal(sinais, id, ocorrencias, pesoUnitario, limite) {
  if (!ocorrencias) return 0;

  const ocorrenciasPontuadas = Math.min(ocorrencias, limite);
  const penalidade = ocorrenciasPontuadas * pesoUnitario;
  sinais.push({ id, ocorrencias, penalidade });
  return penalidade;
}

function avaliarSinaisHumanizer({ titulo, corpoArtigo }) {
  const bruto = `${titulo || ""}\n${corpoArtigo || ""}`;
  const normalizado = textoNormalizado(bruto);
  const tituloNormalizado = textoNormalizado(titulo);
  const sinais = [];
  let penalidade = 0;

  const titulosFormulaicos = contarOcorrencias(
    tituloNormalizado,
    /(?:^(?:desvendando|descubra|explorando|navegando)\b|\b(?:licoes cruciais|papel crucial|nova era|a revolucao|o futuro (?:de|da|do)|guia completo|tudo o que voce precisa saber|mudanca de paradigma)\b)/gi
  );
  penalidade += adicionarSinal(sinais, "titulo-formulaico", titulosFormulaicos, 24, 3);

  for (const item of padroesPontuados) {
    const ocorrencias = contarOcorrencias(normalizado, item.pattern);
    penalidade += adicionarSinal(sinais, item.id, ocorrencias, item.peso, item.limite);
  }

  const frasesFormulaicas = contarOcorrencias(
    normalizado,
    /\b(?:levantou questoes importantes|a medida que (?:as )?tecnologias avancam|torna-se cada vez mais|neste artigo (?:exploraremos|veremos|vamos)|ressalta a importancia|destaca a necessidade|detalhes valiosos|mudancas significativas|e vital que|e fundamental que|mais critic[oa] do que nunca|cenario dinamico|somente assim poderemos|um lembrete da complexidade|explorar o potencial|prioridade em todas as fases)\b/gi
  );
  penalidade += adicionarSinal(sinais, "frase-formulaica", frasesFormulaicas, 5, 8);

  const travessoes = contarOcorrencias(bruto, /[\u2013\u2014]|\s--\s/g);
  penalidade += adicionarSinal(sinais, "travessao", travessoes, 4, 4);

  const strongTags = contarOcorrencias(bruto, /<strong\b/gi);
  if (strongTags > 8) {
    penalidade += adicionarSinal(sinais, "negrito-em-excesso", strongTags - 8, 2, 5);
  }

  const listasComRotuloEmNegrito = contarOcorrencias(bruto, /<li\b[^>]*>\s*<strong\b[^>]*>[^<]+:\s*<\/strong>/gi);
  penalidade += adicionarSinal(sinais, "lista-com-rotulos-em-negrito", listasComRotuloEmNegrito, 4, 4);

  const headingsFormulaicos = contarOcorrencias(
    normalizado,
    /\b(?:perspectivas futuras|olhando para o futuro|conclusao: um futuro|o futuro e agora|explicacao tecnica aprofundada|dicas avancadas para|aplicacao pratica para|riscos e cuidados)\b/gi
  );
  penalidade += adicionarSinal(sinais, "secao-formulaica", headingsFormulaicos, 4, 4);

  const trechoFinal = normalizado.slice(-650);
  const finaisGenericos = contarOcorrencias(
    trechoFinal,
    /\b(?:o futuro (?:e|parece) promissor|tempos empolgantes estao por vir|um passo na direcao certa|as possibilidades sao infinitas)\b/gi
  );
  penalidade += adicionarSinal(sinais, "final-generico", finaisGenericos, 15, 1);

  return {
    score: Math.max(0, 100 - penalidade),
    penalidade,
    sinais
  };
}

function ordenarValores(values) {
  return values.map(value => String(value)).sort((a, b) => a.localeCompare(b));
}

function mesmosValores(left, right) {
  return JSON.stringify(ordenarValores(left)) === JSON.stringify(ordenarValores(right));
}

function extrairUrls(value) {
  return String(value || "").match(/https?:\/\/[^\s"'<>]+/gi) || [];
}

function extrairNumeros(value) {
  return String(value || "").match(/\b\d+(?:[.,]\d+)?%?\b/g) || [];
}

function extrairBlocosCodigo(value) {
  return String(value || "").match(/<pre\b[\s\S]*?<\/pre>/gi) || [];
}

function validarPreservacaoHumanizer(original, revisado) {
  const originalCompleto = `${original?.titulo || ""}\n${original?.corpoArtigo || ""}`;
  const revisadoCompleto = `${revisado?.titulo || ""}\n${revisado?.corpoArtigo || ""}`;
  const motivos = [];

  if (!String(revisado?.titulo || "").trim()) motivos.push("titulo-ausente");
  if (!String(revisado?.corpoArtigo || "").trim()) motivos.push("corpo-ausente");

  if (!mesmosValores(extrairUrls(originalCompleto), extrairUrls(revisadoCompleto))) {
    motivos.push("urls-alteradas");
  }

  if (!mesmosValores(extrairNumeros(originalCompleto), extrairNumeros(revisadoCompleto))) {
    motivos.push("numeros-alterados");
  }

  if (!mesmosValores(extrairBlocosCodigo(originalCompleto), extrairBlocosCodigo(revisadoCompleto))) {
    motivos.push("blocos-de-codigo-alterados");
  }

  if (/<(?:script|style|iframe)\b/i.test(String(revisado?.corpoArtigo || ""))) {
    motivos.push("html-nao-permitido");
  }

  return {
    aceita: motivos.length === 0,
    motivos
  };
}

module.exports = {
  avaliarSinaisHumanizer,
  carregarRegrasHumanizer,
  humanizerSkill,
  validarPreservacaoHumanizer
};
