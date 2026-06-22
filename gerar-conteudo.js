const fs = require('fs');
const axios = require('axios');
const Parser = require('rss-parser');
const { marked } = require('marked'); // Conversão de markdown para HTML
// Configuração do marked para permitir HTML direto e bom SEO
marked.setOptions({
  mangle: false,        // Evita alterar e-mails ou conteúdo textual
  headerIds: false,     // Não adiciona IDs automáticos em títulos (evita poluição de SEO)
  gfm: true,            // Ativa suporte a GitHub Flavored Markdown
  breaks: true          // Permite quebra de linha simples
});

const { escolherIntroducao } = require('./dados/selecionar-introducao');
const { extrairResumoDaNoticia, extrairResumoDaNoticiaReadability } = require('./scripts/extrairResumoDaNoticia');
const { errorsMaps } = require('./dados/selecionar-errorsMaps');
const errosUsadosPath = './dados/erros_usados.json';

const parser = new Parser({
  requestOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Node.js RSS Reader)',
      'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8'
    }
  }
});

const ERROS_HISTORICO_MAX = 20;

function lerErrosUsados() {
  if (!fs.existsSync(errosUsadosPath)) return [];
  try {
    const arr = JSON.parse(fs.readFileSync(errosUsadosPath, "utf-8"));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function salvarErrosUsados(novosErros) {
  // Lê o histórico, adiciona o novo, mantém no máximo 20
  let historico = lerErrosUsados();
  historico.push(novosErros);
  if (historico.length > ERROS_HISTORICO_MAX) {
    historico = historico.slice(-ERROS_HISTORICO_MAX);
  }
  fs.writeFileSync(errosUsadosPath, JSON.stringify(historico, null, 2));
}

function inserirErrosOrtograficosSutis(texto) {
  const errosMap = errorsMaps;
  
  let blocos = texto.split(/(<[^>]+>)/g);
  let textoIdxs = blocos
    .map((t, i) => (t.startsWith('<') ? null : i))
    .filter(i => i !== null);

  let todasPalavras = [];
  textoIdxs.forEach(idx => {
    const palavras = blocos[idx]
      .split(/\b/)
      .filter(p => /^[a-zA-Zãõáéíóúàâêôçü-]{4,}$/.test(p.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
    todasPalavras.push(...palavras);
  });
  if (todasPalavras.length < 6) return texto;

  const meio = todasPalavras.slice(Math.floor(todasPalavras.length * 0.15), Math.floor(todasPalavras.length * 0.85));
  let candidatos = meio.filter(p => errosMap[p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()]);
  if (candidatos.length < 3) {
    candidatos = todasPalavras.filter(p => errosMap[p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()]);
  }
  
  // Evita repetir palavras do último artigo
let errosHistorico = lerErrosUsados();
let palavrasJaUsadas = [];
errosHistorico.forEach(obj => {
  palavrasJaUsadas.push(...Object.keys(obj));
});
palavrasJaUsadas = [...new Set(palavrasJaUsadas)];

  let candidatosFiltrados = candidatos.filter(p =>
    !palavrasJaUsadas.includes(p.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase())
  );

  let escolhidas = [];
  while (escolhidas.length < 3 && candidatosFiltrados.length) {
    let idx = Math.floor(Math.random() * candidatosFiltrados.length);
    if (!escolhidas.includes(candidatosFiltrados[idx])) {
      escolhidas.push(candidatosFiltrados[idx]);
    }
    candidatosFiltrados.splice(idx, 1);
  }

  if (escolhidas.length < 3) {
    let faltam = 3 - escolhidas.length;
    while (faltam-- && candidatos.length) {
      let idx = Math.floor(Math.random() * candidatos.length);
      if (!escolhidas.includes(candidatos[idx])) {
        escolhidas.push(candidatos[idx]);
      }
      candidatos.splice(idx, 1);
    }
  }

  let usadasEsteArtigo = {};
  escolhidas.forEach(word => {
    const base = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const erroOpcoes = errosMap[base];
    let erro;
// Pega o último artigo do histórico (pode ser undefined se vazio)
let ultimoErros = errosHistorico.length ? errosHistorico[errosHistorico.length - 1] : {};

if (ultimoErros[base]) {
  const restantes = erroOpcoes.filter(e => e !== ultimoErros[base]);
  erro = restantes.length > 0
    ? restantes[Math.floor(Math.random() * restantes.length)]
    : erroOpcoes[Math.floor(Math.random() * erroOpcoes.length)];
} else {
  erro = erroOpcoes[Math.floor(Math.random() * erroOpcoes.length)];
}

    usadasEsteArtigo[base] = erro;
   let erroSubstituido = false;
   blocos = blocos.map((bl, i) => {
  if (!textoIdxs.includes(i)) return bl;
  if (erroSubstituido) return bl;
  // Substitui só a primeira ocorrência no bloco
  if (bl.includes(word)) {
    erroSubstituido = true;
    return bl.replace(new RegExp("\\b" + word + "\\b"), erro);
  }
  return bl;
});

  });

  salvarErrosUsados(usadasEsteArtigo);
  return blocos.join('');
}


function slugify(str) {
  if (!str || typeof str !== "string") return "artigo";
  return str.toLowerCase()
    .trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function escapeHTML(code) {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function limparTitulo(raw) {
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&[^;]+;/g, '')
    .replace(/^\*{1,2}(.+?)\*{1,2}$/, '$1')
    .trim();
}

function extrairCategoriaDoConteudo(conteudo, tituloFallback) {
  
const match = conteudo.match(/\|([^|]+)\|/);
const categoriaSugerida = match ? match[1].trim() : null;

const conteudoLimpo = conteudo.replace(/\|([^|]+)\|/, '').trim();

  // Carrega categorias já utilizadas
  const titulosPath = "titulos.json";
  let categoriasExistentes = [];

  if (fs.existsSync(titulosPath)) {
    const titulosGerados = JSON.parse(fs.readFileSync(titulosPath, "utf-8"));
    categoriasExistentes = [...new Set(titulosGerados.map(t => t.categoria).filter(Boolean))];
  }

  let categoriaFinal;

  if (categoriasExistentes.length >= 30) {
    // Limita a categorias já existentes
    const candidata = descobrirCategoria(tituloFallback, categoriasExistentes);
    categoriaFinal = categoriasExistentes.includes(categoriaSugerida) ? categoriaSugerida : candidata;
  } else {
    // Ainda pode criar novas categorias
    categoriaFinal = categoriaSugerida || descobrirCategoria(tituloFallback);
  }

  return { categoriaFinal, conteudoLimpo };
}

function descobrirCategoria(titulo, categoriasPermitidas = null) {
  const texto = normalizarTexto(titulo);

  const categorias = [
    { padrao: /csharp|dotnet|maui|aspnet|blazor/, nome: "Programação" },
    { padrao: /docker|kubernetes|devops|ci\/cd|terraform|ansible/, nome: "DevOps" },
    { padrao: /chatgpt|openai|ia|inteligenciaartificial|llm|machinelearning|deeplearning/, nome: "Inteligência Artificial" },
    { padrao: /seguranca|ciberseguranca|lgpd|jwt|criptografia|privacidade|ciberataque|cyber|vazamento|hacker/, nome: "Segurança" },
    { padrao: /carreira|techlead|vaga|curriculo|entrevista|softskills|mentoria/, nome: "Carreira" },
    { padrao: /frontend|html|css|javascript|react|vue|angular/, nome: "Front-end" },
    { padrao: /backend|api|rest|graphql|microservico[s]?|webapi/, nome: "Back-end" },
    { padrao: /banco[s]?dedados|postgres|mysql|sqlite|nosql|mongodb/, nome: "Banco de Dados" },
    { padrao: /cloud|aws|azure|gcp|nuvem/, nome: "Cloud" },
    { padrao: /blockchain|ethereum|bitcoin|cripto|nft|web3/, nome: "Blockchain" },
    { padrao: /empreendedorismo|startup|pitch|investidor/, nome: "Empreendedorismo" },
    { padrao: /negocio|gestao|okrs|kpis|estrategia/, nome: "Negócios" },
    { padrao: /ci[êe]ncia|pesquisa|universidade|academic[oa]?/, nome: "Ciência" },
    { padrao: /robot|robotica|arduino|automacao/, nome: "Robótica" },
    { padrao: /veiculoeletrico|carroautonomo|automovel|tesla/, nome: "Tecnologia Automotiva" },
    { padrao: /wearable|oculosinteligente|smartwatch|vestivel/, nome: "Tecnologia Vestível" },
    { padrao: /visualizacao|grafico|dashboard|powerbi|dataviz/, nome: "Visualização de Dados" },
    { padrao: /etica|moral|filosofia|bias|preconceitoalgoritmico/, nome: "Ética e Tecnologia" },
    { padrao: /educacao|ensino|ead|plataformaeducacional|mooc/, nome: "Educação" },
    { padrao: /automation|automacao\s?de\s?processos|rpa/, nome: "Automação" },
    { padrao: /excel|planilha|vba|spreadsheet/, nome: "Produtividade" },
    { padrao: /tarifa[s]?|preço[s]?|mercado|economia|imposto[s]?|taxa[s]?|aumento|vendas|comercial/, nome: "Economia e Mercado" }
  ];

  for (const item of categorias) {
    if (item.padrao.test(texto)) {
      if (!categoriasPermitidas || categoriasPermitidas.includes(item.nome)) {
        return item.nome;
      }
    }
  }

  return categoriasPermitidas?.includes("Outros") ? "Outros" : (categoriasPermitidas ? categoriasPermitidas[0] : "Outros");
}



function gerarFooterNavegacao(base = ".") {
  return `
<footer style="text-align: center; margin-top: 3rem; font-size: 0.95rem; color: #666;">
  <nav style="margin-bottom: 1rem;">
    <a href="${base}/index.html">Início</a> |
    <a href="${base}/artigos/index.html">Artigos</a> |
    <a href="${base}/sobre.html">Sobre</a> |
    <a href="${base}/contato.html">Contato</a> |
    <a href="${base}/termos.html">Termos</a> |
    <a href="${base}/politica.html">Privacidade</a> |
    <a href="${base}/politica.html">Política de Privacidade</a>
  </nav>
  &copy; 2025 Anderson Damasio – Todos os direitos reservados
</footer>`;
}

function gerarGoogleAnalyticsTag(gaId = 'G-T15623VZYE') {
  return `
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${gaId}');
</script>
`;
}

function gerarPaginasPorCategoria(titulos) {
  const artigosPorPagina = 10;
  const agrupados = {};

  for (const artigo of titulos) {
    const cat = artigo.categoria || "Outros";
    if (!agrupados[cat]) agrupados[cat] = [];
    agrupados[cat].push(artigo);
  }

  if (!fs.existsSync("categoria")) fs.mkdirSync("categoria", { recursive: true });

  for (const [categoria, artigos] of Object.entries(agrupados)) {
    const slugCat = slugify(categoria);
    artigos.sort((a, b) => new Date(b.data) - new Date(a.data));
    const paginas = Math.ceil(artigos.length / artigosPorPagina);

    for (let i = 0; i < paginas; i++) {
      const paginaArtigos = artigos.slice(i * artigosPorPagina, (i + 1) * artigosPorPagina);

      const links = paginaArtigos.map(t => {
        const slug = slugify(t.titulo);
        const url = t.url || `artigos/${slug}.html`;
        return `<li><a href="../${url}">${t.titulo}</a></li>`;
      }).join("\n");

      const paginacao = paginas > 1
        ? `
<div class="scroll-container">
  ${Array.from({ length: paginas }).map((_, idx) => {
    const nomePagina = idx === 0 ? `${slugCat}.html` : `${slugCat}${idx + 1}.html`;
    const ativa = idx === i ? 'active' : '';
    return `<a href="${nomePagina}" class="${ativa}">Página ${idx + 1}</a>`;
  }).join('')}
</div>`
        : '';

      const pagePath = `artigos/${slugCat}${i === 0 ? '' : (i + 1)}.html`;
      const pageTitle = i === 0
        ? `Categoria: ${categoria} | ${siteName}`
        : `Categoria: ${categoria} - Página ${i + 1} | ${siteName}`;
      const pageDescription = i === 0
        ? `Artigos sobre ${categoria} escritos por Anderson Damasio, com análises sobre arquitetura de software, tecnologia e desenvolvimento.`
        : `Página ${i + 1} dos artigos sobre ${categoria} escritos por Anderson Damasio.`;
      const categoryUrl = absoluteUrl(pagePath);

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${gerarSeoHead({
    title: pageTitle,
    description: pageDescription,
    canonicalPath: pagePath,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": pageTitle,
        "description": pageDescription,
        "url": categoryUrl,
        "isPartOf": {
          "@type": "WebSite",
          "name": siteName,
          "url": siteUrl
        }
      },
      criarBreadcrumbJsonLd([
        { name: "Início", url: "/" },
        { name: "Artigos", url: "artigos/index.html" },
        { name: categoria, url: pagePath }
      ])
    ]
  })}
  <style>
    :root {
      --bg: #f0f2f5;
      --text: #333;
      --main-bg: #fff;
      --link: #0a66c2;
      --link-hover: #084e91;
      --footer: #666;
      --box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    body.dark-theme {
      --bg: #181b1f;
      --text: #ddd;
      --main-bg: #23262d;
      --link: #67aaff;
      --link-hover: #f1c40f;
      --footer: #b3b3b3;
      --box-shadow: 0 4px 16px rgba(0,0,0,0.22);
    }
    body {
      font-family: 'Segoe UI', sans-serif;
      margin: 0; padding: 0;
      background-color: var(--bg);
      color: var(--text);
    }
    main {
      max-width: 800px; margin: 2rem auto;
      background-color: var(--main-bg);
      padding: 2rem;
      border-radius: 12px;
      box-shadow: var(--box-shadow);
    }
    h1 {
      font-size: 1.8rem;
      margin-bottom: 1rem;
      color: var(--link);
    }
    ul { padding-left: 1.5rem; line-height: 1.8; }
    a {
      text-decoration: none;
      font-weight: bold;
      color: var(--link);
    }
    a:hover { text-decoration: underline; color: var(--link-hover);}
    footer { text-align: center; margin-top: 3rem; font-size: 0.95rem; color: var(--footer); }
    .scroll-container {
      display: flex;
      overflow-x: auto;
      padding: 8px 16px;
      margin-top: 2rem;
      justify-content: flex-start;
      scroll-padding-left: 16px;
      gap: 12px;
    }
    .scroll-container a {
      flex-shrink: 0;
      white-space: nowrap;
      font-weight: bold;
      text-decoration: none;
      color: var(--link);
      border: 1px solid var(--link);
      padding: 6px 12px;
      border-radius: 8px;
      transition: background-color 0.3s, color 0.3s;
    }
    .scroll-container a:hover, .scroll-container a.active {
      background-color: var(--link);
      color: var(--main-bg);
    }
  </style>
  ${gerarGoogleAnalyticsTag()}
</head>
<body>
<!-- NOVO: Botão de tema escuro/claro -->
<button id="theme-toggle" aria-label="Alternar tema"
  style="position: fixed; top: 1.5rem; right: 1.5rem; z-index: 2000;
         background: var(--main-bg); border: 1px solid var(--link); color: var(--link);
         padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: bold; box-shadow: var(--box-shadow);">
  🌙 Escuro
</button>
  ${gerarHeaderNavegacao("..")}
  <main>
    <h1>Categoria: ${categoria}</h1>
    <ul>
      ${links}
    </ul>
    ${paginacao}
  </main>
  ${gerarFooterNavegacao("..")}

<script src="https://www.andersondamasio.com.br/scripts/theme-toggle.js"></script>

</body>
</html>
`;

      const filename = `artigos/${slugCat}${i === 0 ? '' : (i + 1)}.html`;
      fs.writeFileSync(filename, html);
    }
  }

  gerarIndiceCategorias(agrupados);
}



function gerarIndiceCategorias(agrupados) {
  // Cria um array com categoria e data mais recente
  const categoriasOrdenadas = Object.entries(agrupados)
    .map(([categoria, artigos]) => {
      const dataMaisRecente = artigos
        .map(a => new Date(a.data))
        .reduce((max, d) => d > max ? d : max, new Date(0));
      return { categoria, artigos, dataMaisRecente };
    })
    .sort((a, b) => b.dataMaisRecente - a.dataMaisRecente); // Ordem decrescente

  // Gera os links com base na ordem
  const links = categoriasOrdenadas.map(({ categoria, artigos }) => {
    const slug = slugify(categoria);
    return `<li><a href="${slug}.html">${categoria}</a> (${artigos.length})</li>`;
  }).join("\n");

  const pagePath = "artigos/index.html";
  const pageTitle = `Artigos por categoria | ${siteName}`;
  const pageDescription = "Índice de categorias dos artigos de Anderson Damasio sobre arquitetura de software, tecnologia, desenvolvimento e carreira.";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${gerarSeoHead({
    title: pageTitle,
    description: pageDescription,
    canonicalPath: pagePath,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": pageTitle,
        "description": pageDescription,
        "url": absoluteUrl(pagePath),
        "isPartOf": {
          "@type": "WebSite",
          "name": siteName,
          "url": siteUrl
        }
      },
      criarBreadcrumbJsonLd([
        { name: "Início", url: "/" },
        { name: "Artigos", url: pagePath }
      ])
    ]
  })}
 <style>
  :root {
    --bg: #f0f2f5;
    --text: #333;
    --main-bg: #fff;
    --link: #0a66c2;
    --link-hover: #084e91;
    --box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  }
  body.dark-theme {
    --bg: #181b1f;
    --text: #ddd;
    --main-bg: #23262d;
    --link: #67aaff;
    --link-hover: #f1c40f;
    --box-shadow: 0 4px 16px rgba(0,0,0,0.22);
  }
  body {
    font-family: 'Segoe UI', sans-serif;
    margin: 0; padding: 0;
    background-color: var(--bg);
    color: var(--text);
  }
  main {
    max-width: 800px; margin: 2rem auto;
    background-color: var(--main-bg);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: var(--box-shadow);
  }
  ul { padding-left: 1.5rem; line-height: 1.8; }
  a {
    text-decoration: none;
    font-weight: bold;
    color: var(--link);
  }
  a:hover {
    text-decoration: underline;
    color: var(--link-hover);
  }
</style>

  ${gerarGoogleAnalyticsTag()}
</head>
<body>
<button id="theme-toggle" aria-label="Alternar tema"
  style="position: fixed; top: 1.5rem; right: 1.5rem; z-index: 2000;
         background: var(--main-bg); border: 1px solid var(--link); color: var(--link);
         padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: bold; box-shadow: var(--box-shadow);">
  🌙 Escuro
</button>

${gerarHeaderNavegacao("..")}
<main>
  <h1>Artigos</h1>
  <ul>
    ${links}
  </ul>
</main>
${gerarFooterNavegacao("..")}

<script src="https://www.andersondamasio.com.br/scripts/theme-toggle.js"></script>

</body>
</html>`;

  fs.writeFileSync("artigos/index.html", html);
}


const siteUrl = "https://www.andersondamasio.com.br";
const siteName = "Anderson Damasio";
const authorName = "Anderson Damasio";
const defaultSeoImage = `${siteUrl}/images/capa_anderson-damasio.png`;
const anoInicioExperiencia = 2005;
const anosExperiencia = new Date().getFullYear() - anoInicioExperiencia;
const textoAnosExperiencia = `mais de ${anosExperiencia} anos`;
const apiKey = process.env.OPENAI_API_KEY;
const twitterBearer = process.env.TWITTER_BEARER_TOKEN;
const artigosPorPagina = 10;

function escapeAttribute(value) {
  return String(value || "")
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizarUrlLocal(url) {
  if (!url) return "/";
  let caminho = String(url).trim().replace(/\\/g, "/");

  if (/^https?:\/\//i.test(caminho)) {
    try {
      caminho = new URL(caminho).pathname;
    } catch {
      return null;
    }
  }

  caminho = caminho.replace(/^\/+/, "");
  if (!caminho || caminho === "index.html") return "/";
  return caminho;
}

function absoluteUrl(url) {
  if (!url) return `${siteUrl}/`;
  if (/^https?:\/\//i.test(url)) return url;

  const local = normalizarUrlLocal(url);
  if (!local || local === "/") return `${siteUrl}/`;
  return `${siteUrl}/${local}`;
}

function urlLocalParaArquivo(url) {
  const local = normalizarUrlLocal(url);
  if (!local || local === "/") return "index.html";
  return local;
}

function limparTextoSeo(texto) {
  return String(texto || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/^[-*#>\s]+/gm, " ")
    .replace(/\b(t[ií]tulo|resumo|introdu[cç][aã]o)\s*:/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function limitarTextoSeo(texto, max = 160) {
  const limpo = String(texto || "").replace(/\s+/g, " ").trim();
  if (limpo.length <= max) return limpo;

  const corte = limpo.slice(0, max - 3);
  const ultimoEspaco = corte.lastIndexOf(" ");
  return `${corte.slice(0, ultimoEspaco > 90 ? ultimoEspaco : corte.length).trim()}...`;
}

function gerarDescricaoSeo(texto, tituloFallback = "") {
  const textoLimpo = limparTextoSeo(texto);
  const descricaoInvalida =
    !textoLimpo ||
    textoLimpo.length < 70 ||
    /^[-–—]+$/.test(textoLimpo) ||
    /^introdu[cç][aã]o:?$/i.test(textoLimpo);

  const descricao = descricaoInvalida
    ? `Artigo de Anderson Damasio sobre ${limparTextoSeo(tituloFallback)}, com reflexões práticas para arquitetura de software, tecnologia e desenvolvimento.`
    : textoLimpo;

  return limitarTextoSeo(descricao, 160);
}

function jsonLdScript(data) {
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/<\/script/gi, '<\\/script')}\n</script>`;
}

function criarBreadcrumbJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": absoluteUrl(item.url)
    }))
  };
}

function gerarSeoHead({
  title,
  description,
  canonicalPath,
  type = "website",
  image = defaultSeoImage,
  robots = "index, follow",
  publishedTime = null,
  modifiedTime = null,
  structuredData = []
}) {
  const canonicalUrl = absoluteUrl(canonicalPath);
  const imageUrl = absoluteUrl(image);
  const descricao = gerarDescricaoSeo(description, title);
  const titulo = limitarTextoSeo(title, 70);
  const dados = Array.isArray(structuredData) ? structuredData : [structuredData];

  return `<title>${escapeHTML(titulo)}</title>
<meta name="description" content="${escapeAttribute(descricao)}">
<meta name="author" content="${escapeAttribute(authorName)}">
<meta name="robots" content="${escapeAttribute(robots)}">
<link rel="canonical" href="${escapeAttribute(canonicalUrl)}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="${escapeAttribute(siteName)}">
<meta property="og:type" content="${escapeAttribute(type)}">
<meta property="og:title" content="${escapeAttribute(titulo)}">
<meta property="og:description" content="${escapeAttribute(descricao)}">
<meta property="og:url" content="${escapeAttribute(canonicalUrl)}">
<meta property="og:image" content="${escapeAttribute(imageUrl)}">
${publishedTime ? `<meta property="article:published_time" content="${escapeAttribute(publishedTime)}">` : ""}
${modifiedTime ? `<meta property="${type === "article" ? "article:modified_time" : "og:updated_time"}" content="${escapeAttribute(modifiedTime)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@andersondamasio">
<meta name="twitter:title" content="${escapeAttribute(titulo)}">
<meta name="twitter:description" content="${escapeAttribute(descricao)}">
<meta name="twitter:image" content="${escapeAttribute(imageUrl)}">
${dados.filter(Boolean).map(jsonLdScript).join("\n")}`;
}

const hackerNewsUrl = "https://hacker-news.firebaseio.com/v0/topstories.json";
const devBlogsFeeds = [
  "https://devblogs.microsoft.com/visualstudio/feed/",
  "https://devblogs.microsoft.com/devops/feed/",
  "https://martinfowler.com/feed.atom",
  "https://feed.infoq.com",
  "https://feeds.bbci.co.uk/news/technology/rss.xml",
  "https://feeds.arstechnica.com/arstechnica/technology-lab",
  "https://www.wired.com/feed/tag/ai/latest/rss",
  "https://techcrunch.com/feed/",
  "https://www.zdnet.com/topic/artificial-intelligence/rss.xml"
];

function arquivoIndexavel(arquivo) {
  try {
    const stats = fs.statSync(arquivo);
    return stats.isFile() && stats.size > 100;
  } catch {
    return false;
  }
}

async function verificarTweetOriginalViaApi(tweetUrl) {
  const match = tweetUrl.match(/status\/(\d+)/);
  if (!match) return null;

  const tweetId = match[1];
  const apiUrl = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=referenced_tweets`;

  try {
    const res = await axios.get(apiUrl, {
      headers: { Authorization: `Bearer ${twitterBearer}` }
    });

    const referenced = res.data.data?.referenced_tweets?.find(t => t.type === 'replied_to');
    return referenced?.id ? `https://twitter.com/i/web/status/${referenced.id}` : null;

  } catch (e) {
    console.warn(`⚠️ Erro na API do Twitter: ${e.message}`);
    return null;
  }
}

function formatDateTime(date) {
  const brasiliaDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

  const pad = n => n.toString().padStart(2, '0');
  return `${pad(brasiliaDate.getDate())}/${pad(brasiliaDate.getMonth() + 1)}/${brasiliaDate.getFullYear()} ${pad(brasiliaDate.getHours())}:${pad(brasiliaDate.getMinutes())}`;
}


function normalizarTexto(str) {
  return str?.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, '') || "";
}

async function buscarNoticia() {
const titulosPath = "titulos.json";
let titulosGerados = fs.existsSync(titulosPath)
  ? JSON.parse(fs.readFileSync(titulosPath, "utf-8"))
  : [];

  const noticiasAntigas = titulosGerados.map(t =>
    normalizarTexto(t.noticiaOriginal)
  );

  const fontes = [buscarNoticiaDevBlogs,buscarNoticiaX];
  let todasNoticias = [];

  for (const fonte of fontes) {
    try {
      console.log(`📡 Buscando notícias da fonte: ${fonte.name || 'anônima'}`);
      const lista = await fonte();
      todasNoticias.push(...lista);
    } catch (e) {
      console.warn(`⚠️ Erro ao buscar notícias da fonte: ${e.message}`);
    }
  }

  // Ordena pela data, da mais recente para a mais antiga
  todasNoticias.sort((a, b) => b.data - a.data);

  for (const noticia of todasNoticias) {
    const normalizada = normalizarTexto(noticia.titulo);
    if (!noticiasAntigas.includes(normalizada)) {
      console.log(`🔍 Notícias encontradas (filtradas):`, todasNoticias.length);
      return noticia;
    }
  }

  return null;
}

async function buscarNoticiaX() {
  const query = encodeURIComponent("arquitetura de software OR .NET OR PostgreSQL OR  lang:pt -is:retweet");
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&tweet.fields=created_at,author_id&expansions=author_id&user.fields=username`;

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${twitterBearer}` }
    });

    const tweets = res.data.data || [];
    const users = res.data.includes?.users || [];

    const lista = tweets.map(tweet => {
      const user = users.find(u => u.id === tweet.author_id);
      return {
        titulo: tweet.text.slice(0, 80).replace(/\n/g, ' ') + '...',
        url: `https://twitter.com/${user?.username}/status/${tweet.id}`,
        data: new Date(tweet.created_at).getTime()
      };
    });

    return lista;
  } catch (e) {
    console.warn(`⚠️ Erro ao buscar tweets do X: ${e.message}`);
    return [];
  }
}


async function buscarNoticiaHackerNews() {
  const lista = [];

  try {
    const ids = await axios.get(hackerNewsUrl).then(res => res.data.slice(0, 30));

    for (const id of ids) {
      try {
        const item = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(res => res.data);
        if (item?.title && !item.deleted && !item.dead) {
          lista.push({
            titulo: item.title,
            url: item.url || '',
            data: item.time ? item.time * 1000 : Date.now()
          });
        }
      } catch (err) {
        console.warn(`⚠️ Erro ao carregar item HackerNews ID ${id}: ${err.message}`);
      }
    }

  } catch (err) {
    console.warn(`⚠️ Erro ao carregar lista de IDs do Hacker News: ${err.message}`);
  }

  // Ordena também
  lista.sort((a, b) => b.data - a.data);

  return lista;
}



async function buscarNoticiaDevBlogs() {
  const lista = [];

  for (const url of devBlogsFeeds) {
    try {
      const feed = await parser.parseURL(url);
      for (const item of feed.items) {
        if (item.title && item.link) {
          let finalLink = item.link;
          if (finalLink.includes('twitter.com/')) {
            const linkOriginal = await verificarTweetOriginalViaApi(finalLink);
            if (linkOriginal) {
              console.log(`🔁 Substituindo resposta por tweet original: ${linkOriginal}`);
              finalLink = linkOriginal;
            }
          }

          lista.push({
            titulo: item.title,
            url: finalLink,
            data: new Date(item.pubDate || item.isoDate || Date.now()).getTime()
          });
        }
      }
    } catch (erro) {
      console.error(`Erro ao buscar feed ${url}: ${erro.message}`);
    }
  }

  return lista;
}


function gerarHeaderNavegacao(base = ".") {
  return `
<header style="background: #0a66c2; padding: 1rem 2rem; position: sticky; top: 0; z-index: 1000; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
  <nav style="display: flex; justify-content: center; gap: 2rem; flex-wrap: wrap;">
    <a href="${base}/index.html" style="color: white; font-weight: 600; text-decoration: none;">Início</a>
    <a href="${base}/artigos/index.html" style="color: white; font-weight: 600; text-decoration: none;">Artigos</a>
    <a href="${base}/sobre.html" style="color: white; font-weight: 600; text-decoration: none;">Sobre</a>
    <a href="${base}/contato.html" style="color: white; font-weight: 600; text-decoration: none;">Contato</a>
  </nav>
</header>`;
}

function limparTitulo(raw) {
  return raw
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&[^;]+;/g, '')
    .replace(/^\*{1,2}(.+?)\*{1,2}$/, '$1')
    .trim();
}

function processarArtigoComCodigo(content) {
  const linhas = content.trim().split('\n');

  const tituloRaw = linhas.find(l => !/^t[ií]tulo[:：]/i.test(l) && l.trim().length > 10);
  const titulo = limparTitulo(tituloRaw || "");

  let tituloRemovido = false;

  const corpoArtigoOriginal = linhas
    .filter(l => {
      const linhaLimpa = limparTitulo(l);
      if (!tituloRemovido && linhaLimpa === titulo) {
        tituloRemovido = true;
        return false;
      }
      return true;
    })
    .join('\n');

  const corpoComCodigo = corpoArtigoOriginal
    .replace(/```csharp\n([\s\S]*?)```/g, (match, code) => {
      return `<pre><code class="language-csharp">${escapeHTML(code)}</code></pre>`;
    })
    .replace(/```\n([\s\S]*?)```/g, (match, code) => {
      return `<pre><code>${escapeHTML(code)}</code></pre>`;
    });

  const corpoLimpo = corpoComCodigo
    .split('\n')
    .filter(l => {
      const linha = l.trim();
      return linha.length > 0 && !/^\*{2,}$/.test(linha);
    })
    .join('\n')
    .trim();

  return { titulo, corpo: corpoLimpo };
}

function removerTagsHtml(texto) {
  return texto.replace(/<[^>]*>/g, '');
}

async function gerar() {
  try {
    const now = new Date();
    const titulosPath = "titulos.json";
    let titulosGerados = fs.existsSync(titulosPath) ? JSON.parse(fs.readFileSync(titulosPath, "utf-8")) : [];

const noticia = await buscarNoticia();
if (!noticia || !noticia.titulo) {
  console.log("⚠️ Nenhuma notícia válida encontrada. Abortando com segurança.");
  return; // ou process.exit(0);
}


    const tematica = noticia.titulo;
    const introducaoVaria = escolherIntroducao(tematica);

   if (!noticia || typeof noticia.titulo !== 'string') {
      console.log("⚠️ Nenhuma notícia válida encontrada. Abortando.");
      process.exit(0);
    }


const categoriasExistentes = [...new Set(
  titulosGerados
    .map(t => t.categoria)
    .filter(c => c && c !== "Outros")
)];

console.error("ORIGEM",noticia);

const { resumoFonte, textoPrincipal }  = await extrairResumoDaNoticiaReadability(noticia.url);
    


if(textoPrincipal == ''){ 
  console.error("resumoFonte",resumoFonte);
  console.error("resumoFonte",textoPrincipal);
  return;
   }
 
const textoCategoriasExistentes = categoriasExistentes.length
  ? `As categorias já usadas até agora no site são: ${categoriasExistentes.join(", ")}. Dê preferência a reutilizar uma delas.`
  : "";

const prompt = `
Você é Anderson Damasio, um Arquiteto de Software com ${textoAnosExperiencia} de experiência prática em sistemas escaláveis.
Você acaba de ler uma notícia técnica internacional sobre: "${noticia.titulo}". 
Resumo da notícia original: "${textoPrincipal}"

Seu objetivo é criar um conteúdo editorial **com aparência 100% humana e autoral**, publicado em seu blog pessoal no Brasil.

**O que você deve produzir:**

IMPORTANTE:
- Só escreva o conteúdo se conseguir inserir erros ortográficos leves e naturais.
LEMBRE-SE: Se não conseguir inserir erros ortográficos, NÃO produza o texto.


1. Um **título original e criativo**, em português, inspirado na notícia, mas:
   - Sem tradução literal, use palavras diferentes sem distorcer a original.
   - Com estilo natural para o público brasileiro de tecnologia.
   - Que traga um olhar técnico, provocativo ou prático, e como a Arquitetura e Desenvolvimento de Software pode colaborar com isso, como se fosse você mesmo escrevendo.

2. Em seguida, **um artigo completo**, com:
   - Uma introdução natural e humanizada.
   - Uma explicação técnica clara e aprofundada sobre o tema.
   - Dicas avançadas que mostrem domínio prático, indo além do básico.
   - Uma conclusão com reflexões ou recomendações suas.
   - Escreva com alguns erros de ortografia sutis.

3. Ao longo do artigo, use marcações HTML semânticas para melhorar o SEO:
- Use <h2> apenas para títulos principais de seções (ex: Introdução, Conclusão, Dicas, etc).
- Use <h3> para subtítulos dentro de seções.
- Nunca inclua mais de uma frase ou parágrafo dentro de uma única tag <h2>. 
- Nunca coloque parágrafos, blocos de código ou listas dentro de <h2> ou <h3>.
- Use <p> para conteúdo descritivo e <h2>/<h3> apenas para títulos curtos. 
- Use listas com <ul> ou <ol> sempre que houver itens.
- Destaque palavras com <strong> ou <em>.

4. Ao final do artigo, inclua:
   - Um resumo objetivo com até 150 caracteres, começando com: Resumo: 
   - A categoria mais adequada entre barras verticais, no formato: |Categoria|

Nunca escreva \'|Categoria|\'
Use exatamente uma destas categorias (sem criar novas):
Programação, Segurança, Inteligência Artificial, Banco de Dados, DevOps, Blockchain, Carreira, Front-end, Back-end, Robótica, Cloud, Tecnologia,
${textoCategoriasExistentes}

Exemplo de categoria: |Segurança|

**Importante:**

*Regras importantes a seguir no conteúdo*
- **Evite qualquer estrutura repetitiva, previsível ou padrão de respostas típicas de IA**.
- Utilize *erros ou gírias leves*, frases de efeito ou construções que soem autênticas e pessoais, incluindo observações subjetivas e experiências reais quando cabível.
- Intercale períodos curtos e longos, utilize pausas com reticências, perguntas retóricas e comentários próprios.
- Evite frases perfeitas demais; permita pequenas quebras de estilo, repetições naturais e uso espontâneo de conectivos.
- Evite iniciar frases como "Nos últimos anos".
- Ao trazer exemplos, busque analogias práticas, histórias rápidas, curiosidades ou opiniões pessoais, mesmo que breves.
- Sempre insira pelo menos uma frase que traga uma visão ou comentário seu, como se estivesse realmente opinando sobre o tema.
- Não inicie com “Título:” ou similares. Apenas escreva o título direto na primeira linha.
- Pule uma linha e inicie o artigo.
- O conteúdo deve parecer escrito por um humano experiente, com estilo natural, fluente e levemente opinativo, porém pode eventuamente cometer erros sutis de ortografia.
- O conteúdo deve ser retornado já com **HTML semântico completo**, sem usar **asteriscos** ou sintaxe de Markdown.

- **IMPORTANTE:** é obrigatório que o texto possua erros ortográficos leves e naturais.`;

 console.error("DEBUG: PROMPT:", prompt);
 console.error("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
 console.error("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
   
    
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
 const content = response.data.choices[0].message.content;

 console.error("DEBUG: content:", content);


let { titulo, corpo: corpoArtigo } = processarArtigoComCodigo(content);

titulo = removerTagsHtml(titulo);
    
 /*   
const linhas = content.trim().split('\n').map(l => l.trim()).filter(Boolean);

let titulo = linhas.find(l => !/^t[ií]tulo[:：]/i.test(l) && l.length > 10)?.replace(/^\*{1,2}(.+?)\*{1,2}$/, '$1').replace(/<[^>]*>/g, '').trim();

let tituloRaw = linhas.find(l => !/^t[ií]tulo[:：]/i.test(l) && l.length > 10);
titulo = limparTitulo(tituloRaw || "");

let tituloRemovido = false;

let corpoArtigo = linhas.filter(l => {
  const linhaLimpa = limparTitulo(l);
  if (!tituloRemovido && linhaLimpa === titulo) {
    tituloRemovido = true;
    return false;
  }
  return true;
}).join('\n').trim();

  corpoArtigo = corpoArtigo
  .replace(/```csharp\n([\s\S]*?)```/g, (match, code) => {
    return `<pre><code class="language-csharp">${escapeHTML(code)}</code></pre>`;
  })
  .replace(/```\n([\s\S]*?)```/g, (match, code) => {
    return `<pre><code>${escapeHTML(code)}</code></pre>`;
  });
*/
    const slug = slugify(titulo);
  

const { categoriaFinal: categoria, conteudoLimpo } = extrairCategoriaDoConteudo(corpoArtigo, titulo);
corpoArtigo = conteudoLimpo;
corpoArtigo = inserirErrosOrtograficosSutis(corpoArtigo);   
corpoArtigo = corpoArtigo
  .split('\n')
  .filter(l => {
    const linha = l.trim();
    return linha.length > 0 && !/^\*{2,}$/.test(linha);
  })
  .join('\n')
  .trim();

const categoriaSlug = slugify(categoria);

const pastaCategoria = `artigos/${categoriaSlug}`;
if (!fs.existsSync(pastaCategoria)) fs.mkdirSync(pastaCategoria, { recursive: true });
const filename = `${pastaCategoria}/${slug}.html`;
const urlLocal = `artigos/${categoriaSlug}/${slug}.html`;

    const matchResumo = corpoArtigo.match(/Resumo:\s*(.+)/i);
    let resumo = gerarDescricaoSeo(matchResumo ? matchResumo[1] : corpoArtigo, titulo);
    if (matchResumo) {
        corpoArtigo = corpoArtigo.replace(/Resumo:\s*.+/i, '').trim(); // remove do corpo
       }

    const dataHoraFormatada = formatDateTime(now);
    const dataISO = new Date(now).toISOString();
    const imagemCapaUrl = null;//await buscarImagemCapa(titulo, slug);
    const articleUrl = absoluteUrl(urlLocal);
    const articleImage = imagemCapaUrl || defaultSeoImage;

    

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
${gerarSeoHead({
  title: `${titulo} | ${siteName}`,
  description: resumo,
  canonicalPath: urlLocal,
  type: "article",
  image: articleImage,
  publishedTime: dataISO,
  modifiedTime: dataISO,
  structuredData: [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": titulo,
      "description": resumo,
      "image": [absoluteUrl(articleImage)],
      "url": articleUrl,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": articleUrl
      },
      "datePublished": dataISO,
      "dateModified": dataISO,
      "articleSection": categoria,
      "inLanguage": "pt-BR",
      "author": {
        "@type": "Person",
        "name": authorName,
        "url": siteUrl
      },
      "publisher": {
        "@type": "Organization",
        "name": siteName,
        "logo": {
          "@type": "ImageObject",
          "url": defaultSeoImage
        }
      }
    },
    criarBreadcrumbJsonLd([
      { name: "Início", url: "/" },
      { name: "Artigos", url: "artigos/index.html" },
      { name: categoria, url: `artigos/${categoriaSlug}.html` },
      { name: titulo, url: urlLocal }
    ])
  ]
})}
<link rel="icon" href="https://www.andersondamasio.com.br/favicon.ico" type="image/x-icon" />


 ${gerarGoogleAnalyticsTag()}

<!-- Script principal da Ezoic (Standalone) no <head> -->
<script src="https://cmp.gatekeeperconsent.com/min.js" data-cfasync="false"></script>
<script src="https://the.gatekeeperconsent.com/cmp.min.js" data-cfasync="false"></script>
<script async src="//www.ezojs.com/ezoic/sa.min.js"></script>
<script>
  window.ezstandalone = window.ezstandalone || {};
  ezstandalone.cmd = ezstandalone.cmd || [];
</script>

<style>
:root {
  --bg: #f0f2f5;
  --text: #333;
  --main-bg: #fff;
  --link: #0a66c2;
  --link-hover: #084e91;
  --footer: #666;
  --meta: #777;
  --pre-bg: #272822;
  --pre-color: #f8f8f2;
  --copy-bg: #0a66c2;
  --copy-color: #fff;
  --copy-bg-hover: #084e91;
  --box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
body.dark-theme {
  --bg: #181b1f;
  --text: #ddd;
  --main-bg: #23262d;
  --link: #67aaff;
  --link-hover: #f1c40f;
  --footer: #b3b3b3;
  --meta: #b3b3b3;
  --pre-bg: #22262b;
  --pre-color: #e0e7ef;
  --copy-bg: #67aaff;
  --copy-color: #11131a;
  --copy-bg-hover: #f1c40f;
  --box-shadow: 0 4px 16px rgba(0,0,0,0.22);
}
body {
  font-family: 'Segoe UI', sans-serif;
  margin: 0; padding: 0;
  background-color: var(--bg);
  color: var(--text);
}
h1 { font-size: 1.8rem; margin-bottom: 1rem; color: var(--link); }
a { color: var(--link); text-decoration: none; font-weight: bold; }
a:hover { text-decoration: underline; color: var(--link-hover);}
.article-meta { color: var(--meta); font-size: 0.95rem; margin-bottom: 1.5rem; }
.article-body { font-size: 1.05rem; line-height: 1.7; }
pre { background: var(--pre-bg); color: var(--pre-color); padding: 1rem; border-radius: 8px; overflow-x: auto; margin-bottom: 1.5rem; position: relative; }
code { font-family: 'Fira Code', 'Courier New', Courier, monospace; font-size: 0.95rem; }
.copy-button { position: absolute; top: 8px; right: 8px; background: var(--copy-bg); color: var(--copy-color); border: none; padding: 0.3rem 0.8rem; font-size: 0.8rem; border-radius: 5px; cursor: pointer; opacity: 0.8; }
.copy-button:hover { opacity: 1; background-color: var(--copy-bg-hover); color: var(--main-bg); }
.back-link { text-align: center; margin-top: 2rem; }
.back-link a { font-weight: bold; color: var(--link); font-size: 1.05rem; border: 1px solid var(--link); padding: 0.4rem 1rem; border-radius: 6px; display: inline-block; text-decoration: none; }
.back-link a:hover { background-color: var(--link); color: var(--main-bg); }
main { max-width: 800px; margin: 2rem auto; background: var(--main-bg); padding: 2rem; border-radius: 12px; box-shadow: var(--box-shadow); }
footer { text-align: center; margin-top: 3rem; font-size: 0.95rem; color: var(--footer); }
</style>

</head>
<body>
<button id="theme-toggle" aria-label="Alternar tema"
  style="position: fixed; top: 1.5rem; right: 1.5rem; z-index: 2000;
         background: var(--main-bg); border: 1px solid var(--link); color: var(--link);
         padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: bold; box-shadow: var(--box-shadow);">
  🌙 Escuro
</button>
${gerarHeaderNavegacao("../..")}
<main>
<h1>${titulo}</h1>
${imagemCapaUrl ? `<img src="${imagemCapaUrl}" alt="Imagem relacionada" style="width:100%; max-width:600px; border-radius:8px; margin: 0 auto 1.5rem; display:block;" />` : ''}
<p class="article-meta">Publicado em: ${dataHoraFormatada}</p>

<!-- Ezoic Placeholder: incontent_5 (ID 115) -->
<div id="ezoic-pub-ad-placeholder-115" style="margin: 2rem 0;"></div>
<script>
  ezstandalone.cmd.push(function() {
    ezstandalone.showAds(115);
  });
</script>

<div class="article-body">${marked.parse(corpoArtigo)}</div>
<p class="back-link"><a href="/index.html">← Voltar para a página inicial</a></p>

<footer style="text-align: center; margin-top: 3rem; font-size: 0.95rem; color: #666;">
  <nav style="margin-bottom: 1rem;">
    <a href="../sobre.html">Sobre</a> |
    <a href="../contato.html">Contato</a> |
    <a href="../termos.html">Termos de Uso</a> |
    <a href="../politica.html">Política de Privacidade</a>
  </nav>
  &copy; 2025 Anderson Damasio – Todos os direitos reservados
</footer>
</main>


<!-- Aviso de Cookies -->
<div id="cookie-banner" style="
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #2c2c2c;
  color: #fff;
  padding: 15px;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 9999;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.3);
">
  <span>
    Este site utiliza cookies para melhorar a experiência do usuário. Ao continuar navegando, você concorda com nossa 
    <a href="/politica.html" style="color: #f1c40f; text-decoration: underline;">Política de Privacidade</a>.
  </span>
  <button onclick="aceitarCookies()" style="
    background: #f1c40f;
    border: none;
    padding: 8px 12px;
    font-weight: bold;
    cursor: pointer;
    color: #000;
    border-radius: 5px;
    margin-left: 15px;
  ">Aceitar</button>
</div>

<script src="/scripts/cookies-banner.js"></script>

<script>
document.addEventListener("DOMContentLoaded", function() {
  document.querySelectorAll('pre').forEach(pre => {
    const button = document.createElement('button');
    button.innerText = 'Copiar';
    button.className = 'copy-button';
    button.addEventListener('click', () => {
      const code = pre.querySelector('code').innerText;
      navigator.clipboard.writeText(code);
      button.innerText = 'Copiado!';
      setTimeout(() => button.innerText = 'Copiar', 2000);
    });
    pre.appendChild(button);
  });
});
</script>


<script src="https://www.andersondamasio.com.br/scripts/theme-toggle.js"></script>


</body>
</html>`;



    if (!fs.existsSync('artigos')) fs.mkdirSync('artigos');
    fs.writeFileSync(filename, html);

   
// Verifica se o título já existe no titulosGerados
const existe = titulosGerados.some(t => normalizarTexto(t.titulo) === normalizarTexto(titulo));
if (!existe) {
  titulosGerados.push({
    titulo,
    noticiaOriginal: noticia.titulo,
    url: urlLocal,
    data: now.toISOString(),
    dataFonte: noticia.data ? new Date(noticia.data).toISOString() : null,
    categoria,
    urlFonte: noticia.url 
  });
}


    fs.writeFileSync(titulosPath, JSON.stringify(titulosGerados, null, 2));

    gerarIndicesPaginados(titulosGerados);
    gerarPaginasPorCategoria(titulosGerados);
    gerarSitemap(titulosGerados);

   // Registrar introdução usada
    const usadasPath = './dados/usadas.json';
    const usadas = fs.existsSync(usadasPath) ? JSON.parse(fs.readFileSync(usadasPath, 'utf-8')) : {};
    usadas[`${now.toISOString().split('T')[0]}-${slug}`] = {
  intro: introducaoVaria.intro,
  introOriginal: introducaoVaria.introOriginal,
  data: now.toISOString().split('T')[0]
};
    fs.writeFileSync(usadasPath, JSON.stringify(usadas, null, 2));
    
    console.log(`✅ Artigo gerado: ${titulo}`);
  } catch (error) {
    console.error("❌ Erro inesperado:",error.message);
    console.error("📌 Stacktrace:", error.stack);
    process.exit(1);
  }
}



function gerarIndicesPaginados(titulos) {
  const ordenados = titulos.slice().sort((a, b) => new Date(b.data) - new Date(a.data));
  const paginas = Math.ceil(ordenados.length / artigosPorPagina);

  for (let i = 0; i < paginas; i++) {
    const artigosPagina = ordenados.slice(i * artigosPorPagina, (i + 1) * artigosPorPagina);
    const links = artigosPagina.map(t => {
      const slug = slugify(t.titulo);
      const data = formatDateTime(new Date(t.data));
      return `<li><a href="${t.url}">${t.titulo}</a> <span style="color:#777;">(${data})</span></li>`;
    }).join("\n");

    const paginacao = paginas > 1 ? `
<div class="scroll-container">
  ${Array.from({ length: paginas }).map((_, idx) => {
    const pageName = idx === 0 ? "index.html" : `index${idx + 1}.html`;
    const paginaLabel = `Página ${idx + 1}`;
    const isActive = i === idx;
    return `<a href="${pageName}" class="${isActive ? 'active' : ''}">${paginaLabel}</a>`;
  }).join("")}
</div>
` : '';

 const updated_time = new Date().toISOString();
    const pagePath = i === 0 ? "/" : `index${i + 1}.html`;
    const pageTitle = i === 0
      ? `${siteName} - Arquiteto de Software e Desenvolvedor`
      : `Artigos de ${siteName} - Página ${i + 1}`;
    const pageDescription = i === 0
      ? `Anderson Damasio, arquiteto de software com ${textoAnosExperiencia} de experiência em soluções modernas, escaláveis e artigos técnicos.`
      : `Página ${i + 1} da lista de artigos técnicos de Anderson Damasio sobre arquitetura de software, tecnologia e desenvolvimento.`;
    
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- SEO Padrão -->
${gerarSeoHead({
  title: pageTitle,
  description: pageDescription,
  canonicalPath: pagePath,
  modifiedTime: updated_time,
  structuredData: [
    {
      "@context": "https://schema.org",
      "@type": i === 0 ? "ProfilePage" : "CollectionPage",
      "name": pageTitle,
      "description": pageDescription,
      "url": absoluteUrl(pagePath),
      "isPartOf": {
        "@type": "WebSite",
        "name": siteName,
        "url": siteUrl
      },
      "about": {
        "@type": "Person",
        "name": authorName,
        "url": siteUrl,
        "jobTitle": "Arquiteto de Software",
        "sameAs": [
          "https://www.linkedin.com/in/andersondamasio/"
        ]
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": siteName,
      "url": siteUrl,
      "inLanguage": "pt-BR"
    }
  ]
})}

 ${gerarGoogleAnalyticsTag()}

<!-- Ezoic Standalone -->
<script src="https://cmp.gatekeeperconsent.com/min.js" data-cfasync="false"></script>
<script src="https://the.gatekeeperconsent.com/cmp.min.js" data-cfasync="false"></script>
<script async src="//www.ezojs.com/ezoic/sa.min.js"></script>
<script>
  window.ezstandalone = window.ezstandalone || {};
  ezstandalone.cmd = ezstandalone.cmd || [];
</script>

<link rel="icon" href="favicon.ico" type="image/x-icon" />
<style>
:root {
  --bg: #f0f2f5;
  --text: #333;
  --main-bg: #fff;
  --header-bg: #0a66c2;
  --header-color: #fff;
  --link: #0a66c2;
  --link-hover: #f1c40f;
  --footer: #666;
  --box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
body.dark-theme {
  --bg: #181b1f;
  --text: #ddd;
  --main-bg: #23262d;
  --header-bg: #181b1f;
  --header-color: #f1c40f;
  --link: #67aaff;
  --link-hover: #f1c40f;
  --footer: #b3b3b3;
  --box-shadow: 0 4px 16px rgba(0,0,0,0.22);
}
body {
  font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0;
  background-color: var(--bg);
  color: var(--text);
}
header {
  background-color: var(--header-bg);
  color: var(--header-color);
  padding: 2rem 1rem;
  text-align: center;
}
header a {
  color: var(--header-color);
  font-weight: bold;
  text-decoration: underline;
}
header a:hover {
  text-decoration: underline;
  color: var(--link-hover);
}
main {
  max-width: 800px; margin: 2rem auto;
  background-color: var(--main-bg);
  padding: 2rem;
  border-radius: 12px;
  box-shadow: var(--box-shadow);
}
footer { text-align: center; margin-top: 3rem; font-size: 0.95rem; color: var(--footer); }
ul { padding-left: 1.5rem; line-height: 1.8; }
a {
  color: var(--link);
  text-decoration: none;
  font-weight: bold;
}
a:hover {
  text-decoration: underline;
  color: var(--link-hover);
}
.scroll-container {
  display: flex;
  overflow-x: auto;
  padding: 8px 16px;
  margin-top: 2rem;
  justify-content: flex-start;
  scroll-padding-left: 16px;
  gap: 12px;
}
.scroll-container a {
  flex-shrink: 0;
  white-space: nowrap;
  font-weight: bold;
  text-decoration: none;
  color: var(--link);
  border: 1px solid var(--link);
  padding: 6px 12px;
  border-radius: 8px;
  transition: background-color 0.3s, color 0.3s;
}
.scroll-container a:hover, .scroll-container a.active {
  background-color: var(--link);
  color: var(--main-bg);
}
</style>

</head>
<body>
<button id="theme-toggle" aria-label="Alternar tema"
  style="position: fixed; top: 1.5rem; right: 1.5rem; z-index: 2000;
         background: var(--main-bg); border: 1px solid var(--link); color: var(--link);
         padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: bold; box-shadow: var(--box-shadow);">
  🌙 Escuro
</button>

${gerarHeaderNavegacao(".")}

<main>
<section>
<div style="text-align: center; margin: 2rem auto 1rem;">
  <h1 style="font-size: 2rem; margin-bottom: 0.2rem;">Anderson Damasio</h1>
  <p style="font-size: 1.1rem; color: #444; margin-bottom: 0.5rem;">Arquiteto de Software</p>
  <p><a href="https://www.linkedin.com/in/andersondamasio/" target="_blank" rel="noopener" style="color: #0a66c2; font-weight: bold;">Acesse o perfil no LinkedIn</a></p>
</div>


<!-- Sobre Mim -->
<div style="background:white; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); padding:2rem; margin-bottom:2rem;">
<h2>Sobre Mim</h2>
<p>Arquiteto de Software com ${textoAnosExperiencia} de experiência em desenvolvimento de sistemas, soluções escaláveis e arquitetura moderna.</p>

<h3>Contato</h3>
<p>E-mail: <a href="mailto:anderson@andersondamasio.com.br">anderson@andersondamasio.com.br</a></p>
</div>

<!-- Ezoic Ad Placeholder (ID 115) -->
<div id="ezoic-pub-ad-placeholder-115" style="margin: 2rem 0;"></div>
<script>
  ezstandalone.cmd.push(function() {
    ezstandalone.showAds(115);
  });
</script>

<!-- Artigos -->
<div style="background:white; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); padding:2rem; margin-bottom:2rem;">
<h2>📚 Artigos</h2>
<ul>
${links}
</ul>
${paginacao}
</div>

</section>
</main>

<footer>
  <nav style="margin-bottom: 1rem;">
    <a href="sobre.html">Sobre</a> |
    <a href="contato.html">Contato</a> |
    <a href="termos.html">Termos de Uso</a> |
    <a href="politica.html">Política de Privacidade</a>
  </nav>
  &copy; 2025 Anderson Damasio – Todos os direitos reservados
</footer>

<!-- Aviso de Cookies -->
<div id="cookie-banner" style="
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #2c2c2c;
  color: #fff;
  padding: 15px;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 9999;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.3);
">
  <span>
    Este site utiliza cookies para melhorar a experiência do usuário. Ao continuar navegando, você concorda com nossa 
    <a href="/politica.html" style="color: #f1c40f; text-decoration: underline;">Política de Privacidade</a>.
  </span>
  <button onclick="aceitarCookies()" style="
    background: #f1c40f;
    border: none;
    padding: 8px 12px;
    font-weight: bold;
    cursor: pointer;
    color: #000;
    border-radius: 5px;
    margin-left: 15px;
  ">Aceitar</button>
</div>

<script src="/scripts/cookies-banner.js"></script>

<script src="/scripts/theme-toggle.js"></script>


</body>
</html>`;


    const nome = i === 0 ? "index.html" : `index${i + 1}.html`;
    fs.writeFileSync(nome, html);
  }
}

function gerarSitemap(titulos) {
  const entradas = new Map();

  const adicionar = (url, data = null, exigirArquivo = true) => {
    const local = normalizarUrlLocal(url);
    if (!local) return;

    const arquivo = urlLocalParaArquivo(local);
    if (exigirArquivo && !arquivoIndexavel(arquivo)) return;

    const loc = absoluteUrl(local);
    const dataValida = data ? new Date(data) : null;
    const lastmod = dataValida && !Number.isNaN(dataValida.getTime())
      ? dataValida.toISOString()
      : null;

    const atual = entradas.get(loc);
    if (!atual || (lastmod && (!atual.lastmod || lastmod > atual.lastmod))) {
      entradas.set(loc, { loc, lastmod });
    }
  };

  const datasValidas = titulos
    .map(t => t.data ? new Date(t.data) : null)
    .filter(d => d && !Number.isNaN(d.getTime()));
  const ultimaData = datasValidas.length
    ? new Date(Math.max(...datasValidas.map(d => d.getTime()))).toISOString()
    : null;

  adicionar("/", ultimaData, false);
  ["artigos/index.html", "sobre.html", "contato.html", "termos.html", "politica.html"].forEach(url => {
    adicionar(url, ultimaData);
  });

  const agrupados = {};
  titulos.forEach(t => {
    const urlFinal = t.url || `artigos/${slugify(t.titulo)}.html`;
    adicionar(urlFinal, t.data);

    const categoria = t.categoria || "Outros";
    if (!agrupados[categoria]) agrupados[categoria] = [];
    agrupados[categoria].push(t);
  });

  Object.entries(agrupados).forEach(([categoria, artigos]) => {
    const slugCat = slugify(categoria);
    const paginas = Math.ceil(artigos.length / artigosPorPagina);

    for (let i = 0; i < paginas; i++) {
      const artigosPagina = artigos.slice(i * artigosPorPagina, (i + 1) * artigosPorPagina);
      const dataMaisRecente = artigosPagina
        .map(t => t.data ? new Date(t.data) : null)
        .filter(d => d && !Number.isNaN(d.getTime()))
        .sort((a, b) => b - a)[0];

      adicionar(`artigos/${slugCat}${i === 0 ? "" : (i + 1)}.html`, dataMaisRecente);
    }
  });

  const sitemapLinks = [...entradas.values()]
    .sort((a, b) => a.loc.localeCompare(b.loc))
    .map(({ loc, lastmod }) => [
      "<url>",
      `<loc>${escapeXml(loc)}</loc>`,
      lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "",
      "</url>"
    ].filter(Boolean).join(""))
    .join("\n");

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapLinks}
</urlset>`;

  fs.writeFileSync("sitemap.xml", sitemapContent);
}

function carregarTitulosGerados() {
  const titulosPath = "titulos.json";
  if (!fs.existsSync(titulosPath)) return [];

  try {
    const titulos = JSON.parse(fs.readFileSync(titulosPath, "utf-8"));
    return Array.isArray(titulos) ? titulos : [];
  } catch {
    return [];
  }
}

function reconstruirPaginasSeo() {
  const titulosGerados = carregarTitulosGerados();
  gerarIndicesPaginados(titulosGerados);
  gerarPaginasPorCategoria(titulosGerados);
  gerarSitemap(titulosGerados);
  console.log(`SEO reconstruído para ${titulosGerados.length} artigos cadastrados.`);
}

if (process.argv.includes("--rebuild-seo")) {
  reconstruirPaginasSeo();
} else {
  gerar();
}
