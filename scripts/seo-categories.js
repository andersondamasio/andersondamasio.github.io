const categoriasCanonicas = [
  "Arquitetura",
  "Automação",
  "Back-end",
  "Banco de Dados",
  "Blockchain",
  "Carreira",
  "Ciência",
  "Cloud",
  "Desenvolvimento de Software",
  "DevOps",
  "Economia e Mercado",
  "Educação",
  "Empreendedorismo",
  "Ética e Tecnologia",
  "Fintech",
  "Front-end",
  "Inteligência Artificial",
  "Logística",
  "Negócios",
  "Observabilidade",
  "Outros",
  "Produtividade",
  "Programação",
  "Robótica",
  "Saúde",
  "Segurança",
  "Tecnologia",
  "Tecnologia Automotiva",
  "Tecnologia Vestível",
  "Visualização de Dados"
];

const minArtigosCategoriaIndexavel = 3;

function normalizarChaveCategoria(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

const aliasesCategorias = new Map([
  ["ciberseguranca", "Segurança"],
  ["cybersecurity", "Segurança"],
  ["segurancacibernetica", "Segurança"],
  ["segurancaonline", "Segurança"],
  ["tecnologiadomestica", "Tecnologia"],
  ["tecnologiaedesenvolvimento", "Desenvolvimento de Software"],
  ["desenvolvimento", "Desenvolvimento de Software"],
  ["software", "Desenvolvimento de Software"]
].map(([alias, categoria]) => [normalizarChaveCategoria(alias), categoria]));

function limparCategoria(raw) {
  return String(raw || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoriaInvalida(raw, limpa = limparCategoria(raw)) {
  const normalizada = normalizarChaveCategoria(limpa);
  const valorBruto = String(raw || "").trim();

  return !limpa ||
    limpa.length > 50 ||
    /[<>{}[\]\r\n]/.test(valorBruto) ||
    /^(categoria|rdf:type|rdf type|type|null|undefined|nan)$/i.test(limpa) ||
    /^(categoria|rdftype|type|null|undefined|nan)$/.test(normalizada);
}

function descobrirCategoria(titulo, categoriasPermitidas = categoriasCanonicas) {
  const texto = normalizarChaveCategoria(titulo);

  const categorias = [
    { padrao: /arquitetura|microservices|microservico|serverless|hexagonal|eventos|distribuid/, nome: "Arquitetura" },
    { padrao: /csharp|dotnet|maui|aspnet|blazor|codigo|programacao/, nome: "Programação" },
    { padrao: /docker|kubernetes|devops|cicd|terraform|ansible/, nome: "DevOps" },
    { padrao: /chatgpt|openai|ia|inteligenciaartificial|llm|machinelearning|deeplearning/, nome: "Inteligência Artificial" },
    { padrao: /seguranca|ciberseguranca|lgpd|jwt|criptografia|privacidade|ciberataque|cyber|vazamento|hacker|vpn/, nome: "Segurança" },
    { padrao: /carreira|techlead|vaga|curriculo|entrevista|softskills|mentoria/, nome: "Carreira" },
    { padrao: /frontend|html|css|javascript|react|vue|angular/, nome: "Front-end" },
    { padrao: /backend|api|rest|graphql|webapi/, nome: "Back-end" },
    { padrao: /bancodedados|postgres|mysql|sqlite|nosql|mongodb/, nome: "Banco de Dados" },
    { padrao: /cloud|aws|azure|gcp|nuvem/, nome: "Cloud" },
    { padrao: /blockchain|ethereum|bitcoin|cripto|nft|web3/, nome: "Blockchain" },
    { padrao: /empreendedorismo|startup|pitch|investidor/, nome: "Empreendedorismo" },
    { padrao: /negocio|gestao|okrs|kpis|estrategia/, nome: "Negócios" },
    { padrao: /ciencia|pesquisa|universidade|academico|academica/, nome: "Ciência" },
    { padrao: /robot|robotica|arduino|automacao/, nome: "Robótica" },
    { padrao: /logistica|supplychain|transporte|entrega/, nome: "Logística" },
    { padrao: /observabilidade|monitoramento|opentelemetry|logging|logs|metricas|tracing/, nome: "Observabilidade" },
    { padrao: /saude|medicina|hospital|health/, nome: "Saúde" },
    { padrao: /fintech|financeiro|pagamento|pix|bancodigital/, nome: "Fintech" },
    { padrao: /veiculoeletrico|carroautonomo|automovel|tesla/, nome: "Tecnologia Automotiva" },
    { padrao: /wearable|oculosinteligente|smartwatch|vestivel/, nome: "Tecnologia Vestível" },
    { padrao: /visualizacao|grafico|dashboard|powerbi|dataviz/, nome: "Visualização de Dados" },
    { padrao: /etica|moral|filosofia|bias|preconceitoalgoritmico/, nome: "Ética e Tecnologia" },
    { padrao: /educacao|ensino|ead|plataformaeducacional|mooc/, nome: "Educação" },
    { padrao: /automation|automacaodeprocessos|rpa/, nome: "Automação" },
    { padrao: /excel|planilha|vba|spreadsheet/, nome: "Produtividade" },
    { padrao: /tarifa|preco|mercado|economia|imposto|taxa|aumento|vendas|comercial/, nome: "Economia e Mercado" },
    { padrao: /tecnologia|ipad|iphone|apple|android|google|microsoft/, nome: "Tecnologia" }
  ];

  for (const item of categorias) {
    if (item.padrao.test(texto) && categoriasPermitidas.includes(item.nome)) {
      return item.nome;
    }
  }

  return categoriasPermitidas.includes("Outros") ? "Outros" : categoriasPermitidas[0];
}

function normalizarCategoria(categoria, tituloFallback = "") {
  const limpa = limparCategoria(categoria);

  if (categoriaInvalida(categoria, limpa)) {
    return descobrirCategoria(tituloFallback, categoriasCanonicas);
  }

  const normalizada = normalizarChaveCategoria(limpa);
  const alias = aliasesCategorias.get(normalizada);
  if (alias) return alias;

  const canonica = categoriasCanonicas.find(item => normalizarChaveCategoria(item) === normalizada);
  if (canonica) return canonica;

  return descobrirCategoria(`${tituloFallback} ${limpa}`, categoriasCanonicas);
}

module.exports = {
  categoriasCanonicas,
  minArtigosCategoriaIndexavel,
  normalizarChaveCategoria,
  limparCategoria,
  categoriaInvalida,
  descobrirCategoria,
  normalizarCategoria
};
