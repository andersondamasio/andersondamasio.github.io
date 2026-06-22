const stopwords = new Set([
  "ainda",
  "alem",
  "algo",
  "anos",
  "apenas",
  "apos",
  "aqui",
  "arquitetura",
  "assim",
  "ate",
  "cada",
  "como",
  "com",
  "contra",
  "das",
  "de",
  "dei",
  "dele",
  "dela",
  "delas",
  "desde",
  "desse",
  "dessa",
  "deste",
  "desta",
  "deles",
  "depois",
  "dos",
  "e",
  "ela",
  "eles",
  "em",
  "entre",
  "era",
  "essa",
  "esse",
  "esta",
  "este",
  "isso",
  "mais",
  "mas",
  "mesmo",
  "meu",
  "minha",
  "muito",
  "nao",
  "nas",
  "nos",
  "novo",
  "nova",
  "para",
  "pela",
  "pelo",
  "pode",
  "por",
  "porque",
  "quando",
  "que",
  "se",
  "sem",
  "seu",
  "seus",
  "sera",
  "sua",
  "suas",
  "sobre",
  "software",
  "tambem",
  "tem",
  "ter",
  "uma",
  "nosso",
  "nossa",
  "voce",
  "with",
  "from",
  "that",
  "this",
  "into",
  "your"
]);

function normalizarTexto(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function limparTextoArtigo(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/^[-*#>\s]+/gm, " ")
    .replace(/\b(t[ií]tulo|resumo|introdu[cç][aã]o)\s*:/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contarPalavras(value) {
  const matches = limparTextoArtigo(value).match(/[\p{L}\p{N}]+(?:[-'][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

function palavrasChaveDoTexto(value) {
  return normalizarTexto(value)
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/\s+/)
    .map(word => word.replace(/^-+|-+$/g, ""))
    .filter(word =>
      word.length >= 4 &&
      word.length <= 32 &&
      !/^\d+$/.test(word) &&
      !stopwords.has(word)
    );
}

function adicionarUnico(lista, visto, value) {
  const termo = String(value || "").replace(/\s+/g, " ").trim();
  if (!termo) return;

  const chave = normalizarTexto(termo);
  if (!chave || visto.has(chave)) return;

  visto.add(chave);
  lista.push(termo);
}

function gerarPalavrasChaveArtigo({ title, category, articleText, max = 10 }) {
  const keywords = [];
  const seen = new Set();
  adicionarUnico(keywords, seen, category);

  const text = limparTextoArtigo(articleText);
  const scores = new Map();
  const addScore = (word, score) => scores.set(word, (scores.get(word) || 0) + score);

  palavrasChaveDoTexto(title).forEach(word => addScore(word, 5));
  palavrasChaveDoTexto(category).forEach(word => addScore(word, 4));
  palavrasChaveDoTexto(text.slice(0, 4000)).forEach(word => addScore(word, 1));

  [
    ["arquitetura de software", /\barquitetura de software\b/i],
    ["desenvolvimento de software", /\bdesenvolvimento de software\b/i],
    ["inteligência artificial", /\bintelig[eê]ncia artificial\b/i],
    ["segurança", /\bseguran[cç]a\b/i],
    ["cloud", /\bcloud\b|\bnuvem\b/i],
    ["devops", /\bdevops\b/i]
  ].forEach(([term, pattern]) => {
    if (pattern.test(`${title} ${category} ${text}`)) adicionarUnico(keywords, seen, term);
  });

  [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([word]) => {
      if (keywords.length < max) adicionarUnico(keywords, seen, word);
    });

  return keywords.slice(0, max);
}

function criarMetadadosArtigo({ title, category, articleText, publishedDate }) {
  const text = limparTextoArtigo(articleText);
  const keywords = gerarPalavrasChaveArtigo({ title, category, articleText: text });
  const wordCount = contarPalavras(text);
  const published = publishedDate ? new Date(publishedDate) : null;
  const copyrightYear = published && !Number.isNaN(published.getTime())
    ? published.getUTCFullYear()
    : new Date().getUTCFullYear();
  const mentions = keywords
    .filter(keyword => normalizarTexto(keyword) !== normalizarTexto(category))
    .slice(0, 6)
    .map(keyword => ({
      "@type": "Thing",
      "name": keyword
    }));

  return {
    ...(keywords.length ? { "keywords": keywords } : {}),
    ...(wordCount ? { "wordCount": wordCount } : {}),
    ...(category ? { "about": { "@type": "Thing", "name": category } } : {}),
    ...(mentions.length ? { "mentions": mentions } : {}),
    "isAccessibleForFree": true,
    "copyrightYear": copyrightYear
  };
}

function keywordsMetaContent(keywords) {
  const values = Array.isArray(keywords) ? keywords : [keywords];
  return values
    .map(value => String(value || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 10)
    .join(", ");
}

function artigoTemMetadadosDeRelevancia(item) {
  const keywords = Array.isArray(item?.keywords)
    ? item.keywords
    : String(item?.keywords || "").split(",");
  const wordCount = Number(item?.wordCount);

  return keywords.filter(value => String(value || "").trim()).length >= 3 &&
    Number.isFinite(wordCount) &&
    wordCount >= 100 &&
    item?.about &&
    item?.isAccessibleForFree === true &&
    Number.isInteger(Number(item?.copyrightYear)) &&
    item?.copyrightHolder &&
    Array.isArray(item?.mentions) &&
    item.mentions.length > 0;
}

module.exports = {
  artigoTemMetadadosDeRelevancia,
  contarPalavras,
  criarMetadadosArtigo,
  gerarPalavrasChaveArtigo,
  keywordsMetaContent,
  limparTextoArtigo
};
