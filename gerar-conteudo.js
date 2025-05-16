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
const { buscarImagemCapa } = require('./scripts/buscarImagemCapa_unsplash');
const { extrairResumoDaNoticia } = require('./scripts/extrairResumoDaNoticia');

const parser = new Parser({
  requestOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Node.js RSS Reader)',
      'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8'
    }
  }
});

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

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Categoria: ${categoria}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; background-color: #f0f2f5; color: #333; }
    main { max-width: 800px; margin: 2rem auto; background-color: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    h1 { font-size: 1.8rem; margin-bottom: 1rem; color: #0a66c2; }
    ul { padding-left: 1.5rem; line-height: 1.8; }
    a { text-decoration: none; font-weight: bold; color: #0a66c2; }
    a:hover { text-decoration: underline; }
    footer { text-align: center; margin-top: 3rem; font-size: 0.95rem; color: #666; }
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
  color: #0a66c2;
  border: 1px solid #0a66c2;
  padding: 6px 12px;
  border-radius: 8px;
  transition: background-color 0.3s, color 0.3s;
}
.scroll-container a:hover {
  background-color: #0a66c2;
  color: white;
}
.scroll-container a.active {
  background-color: #0a66c2;
  color: white;
}
  </style>
   ${gerarGoogleAnalyticsTag()}
</head>
<body>
  ${gerarHeaderNavegacao("..")}
  <main>
    <h1>Categoria: ${categoria}</h1>
    <ul>
      ${links}
    </ul>
    ${paginacao}
  </main>
  ${gerarFooterNavegacao("..")}
</body>
</html>`;

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

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Artigos</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; background-color: #f0f2f5; color: #333; }
    main { max-width: 800px; margin: 2rem auto; background-color: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    ul { padding-left: 1.5rem; line-height: 1.8; }
    a { text-decoration: none; font-weight: bold; color: #0a66c2; }
    a:hover { text-decoration: underline; }
  </style>
   ${gerarGoogleAnalyticsTag()}
</head>
<body>
${gerarHeaderNavegacao("..")}
<main>
  <h1>Artigos</h1>
  <ul>
    ${links}
  </ul>
</main>
${gerarFooterNavegacao("..")}
</body>
</html>`;

  fs.writeFileSync("artigos/index.html", html);
}


const siteUrl = "https://www.andersondamasio.com.br";
const apiKey = process.env.OPENAI_API_KEY;
const twitterBearer = process.env.TWITTER_BEARER_TOKEN;
const artigosPorPagina = 10;

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
  const query = encodeURIComponent("arquitetura de software OR .NET OR PostgreSQL OR MAUI lang:pt -is:retweet");
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
    
const resumoFonte = await extrairResumoDaNoticia(noticia.url,noticia.noticiaOriginal);

 console.error("DEBUG: noticia.titulo:", noticia.titulo);
 console.error("DEBUG: resumoFonte:", resumoFonte);
     
const textoCategoriasExistentes = categoriasExistentes.length
  ? `As categorias já usadas até agora no site são: ${categoriasExistentes.join(", ")}. Dê preferência a reutilizar uma delas.`
  : "";

const prompt = `
Você é Anderson Damasio, um Arquiteto de Software com mais de 19 anos de experiência prática em sistemas escaláveis.
Você acaba de ler uma notícia técnica internacional sobre: "${noticia.titulo}". 
Resumo da notícia original: "${resumoFonte}"


Seu objetivo é criar um conteúdo editorial **com aparência 100% humana e autoral**, publicado em seu blog pessoal no Brasil.

**O que você deve produzir:**

1. Um **título original e criativo**, em português, inspirado na notícia, mas:
   - Sem tradução literal, use palavras diferentes sem distorcer a original.
   - Com estilo natural para o público brasileiro de tecnologia.
   - Que traga um olhar técnico, provocativo ou prático, e como a Arquitetura e Desenvolvimento de Software pode colaborar com isso, como se fosse você mesmo escrevendo.

2. Em seguida, **um artigo completo**, com:
   - Uma introdução natural e humanizada.
   - Uma explicação técnica clara e aprofundada sobre o tema.
   - Trechos de código reais que tenham usabilidade prática e inteligente ligada ao artigo (preferencialmente em C# ou outra linguagem prática, com APIs úteis quando possível).
   - Dicas avançadas que mostrem domínio prático, indo além do básico.
   - Uma conclusão com reflexões ou recomendações suas.

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
Programação, Segurança, Inteligência Artificial, Banco de Dados, DevOps, Blockchain, Carreira, Front-end, Back-end, Robótica, Cloud, Tecnologia

${textoCategoriasExistentes}

Exemplo de categoria: |Segurança|

**Importante:**
- Não inicie com “Título:” ou similares. Apenas escreva o título direto na primeira linha.
- Pule uma linha e inicie o artigo.
- O conteúdo deve parecer escrito por um humano experiente, com estilo natural, fluente e levemente opinativo.
- O conteúdo deve ser retornado já com **HTML semântico completo**, sem usar **asteriscos** ou sintaxe de Markdown.

`;

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

    let resumo = corpoArtigo.split("\n").slice(0, 2).join(" ").substring(0, 160).replace(/\s+/g, ' ').trim();
    const matchResumo = corpoArtigo.match(/Resumo:\s*(.+)/i);
    if (matchResumo) {
        resumo = matchResumo[1].substring(0, 160).trim();
        corpoArtigo = corpoArtigo.replace(/Resumo:\s*.+/i, '').trim(); // remove do corpo
       }

    const dataHoraFormatada = formatDateTime(now);
    const dataISO = new Date(now).toISOString();
    const imagemCapaUrl = null;//await buscarImagemCapa(titulo, slug);
    const escapeJson = str => (str || "").replace(/"/g, '\\"');

    

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${titulo} – Artigo Técnico por Anderson Damasio</title>
<meta name="description" content="${resumo}">
<link rel="icon" href="../favicon.ico" type="image/x-icon" />

<!-- Open Graph -->
<meta property="og:type" content="article">
<meta property="og:title" content="${titulo}">
<meta property="og:description" content="${resumo}">
<meta property="og:url" content="https://www.andersondamasio.com.br/${categoriaSlug}/${slug}.html">
<meta property="og:image" content="https://www.andersondamasio.com.br/images/capa_anderson-damasio.png">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titulo}">
<meta name="twitter:description" content="${resumo}">
<meta name="twitter:image" content="https://www.andersondamasio.com.br/images/capa_anderson-damasio.png">



<!-- Schema.org -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "${titulo}",
  "description": "${resumo}",
  "datePublished": "${dataISO}",
  "author": {
    "@type": "Person",
    "name": "Anderson Damasio"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Anderson Damasio",
    "logo": {
      "@type": "ImageObject",
      "url": "https://www.andersondamasio.com.br/favicon.ico"
    }
  }
}
</script>

<!-- Schema.org: BreadcrumbList -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Início",
      "item": "https://www.andersondamasio.com.br/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Artigos",
      "item": "https://www.andersondamasio.com.br/artigos/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "${categoria}",
      "item": "https://www.andersondamasio.com.br/artigos/${categoriaSlug}"
    },
    {
      "@type": "ListItem",
      "position": 4,
      "name": "${escapeJson(titulo)}",
      "item": "https://www.andersondamasio.com.br/${categoriaSlug}/${slug}.html"
    }
  ]
}
</script>


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
body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; background-color: #f0f2f5; color: #333; }
h1 { font-size: 1.8rem; margin-bottom: 1rem; }

 a {
      color: #0a66c2;
      text-decoration: none;
      font-weight: bold;
    }
    a:hover {
      text-decoration: underline;
    }

.article-meta { color: #777; font-size: 0.95rem; margin-bottom: 1.5rem; }
.article-body { font-size: 1.05rem; line-height: 1.7; }
pre { background: #272822; color: #f8f8f2; padding: 1rem; border-radius: 8px; overflow-x: auto; margin-bottom: 1.5rem; position: relative; }
code { font-family: 'Fira Code', 'Courier New', Courier, monospace; font-size: 0.95rem; }
.copy-button { position: absolute; top: 8px; right: 8px; background: #0a66c2; color: white; border: none; padding: 0.3rem 0.8rem; font-size: 0.8rem; border-radius: 5px; cursor: pointer; opacity: 0.8; }
.copy-button:hover { opacity: 1; background-color: #084e91; }
.back-link { text-align: center; margin-top: 2rem; }
.back-link a { font-weight: bold; color: #0a66c2; font-size: 1.05rem; border: 1px solid #0a66c2; padding: 0.4rem 1rem; border-radius: 6px; display: inline-block; text-decoration: none; }
.back-link a:hover { background-color: #0a66c2; color: white; }
main { max-width: 800px; margin: 2rem auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
</style>
</head>
<body>
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

</body>
</html>`;



    if (!fs.existsSync('artigos')) fs.mkdirSync('artigos');
    fs.writeFileSync(filename, html);

   
// Verifica se o título já existe no titulosGerados
const urlLocal = `artigos/${categoriaSlug}/${slug}.html`;

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
    gerarSitemap(titulosGerados);
gerarPaginasPorCategoria(titulosGerados);

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
    
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Anderson Damasio – Arquiteto de Software e Desenvolvedor</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- SEO Padrão -->
<meta name="description" content="Anderson Damasio – Arquiteto de Software com mais de 19 anos de experiência em soluções modernas e escaláveis.">
<meta name="keywords" content="Anderson Damasio, arquiteto de software, artigos de tecnologia, desenvolvimento, sistemas escaláveis">
<meta name="author" content="Anderson Damasio">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://www.andersondamasio.com.br/">

<!-- Open Graph (Facebook, LinkedIn, etc.) -->
<meta property="og:title" content="Anderson Damasio – Arquiteto de Software">
<meta property="og:description" content="Artigos técnicos e insights sobre desenvolvimento de software moderno, arquitetura escalável e boas práticas.">
<meta property="og:image" content="https://www.andersondamasio.com.br/images/capa_anderson-damasio.png">
<meta property="og:url" content="https://www.andersondamasio.com.br/">
<meta property="og:type" content="website">
<meta property="og:updated_time" content="${updated_time}" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@andersondamasio">
<meta name="twitter:title" content="Anderson Damasio – Arquiteto de Software">
<meta name="twitter:description" content="Mais de 19 anos de experiência em desenvolvimento de sistemas, arquitetura moderna e artigos técnicos.">
<meta name="twitter:image" content="https://www.andersondamasio.com.br/images/capa_anderson-damasio.png">

 ${gerarGoogleAnalyticsTag()}

<!-- Ezoic Standalone -->
<script src="https://cmp.gatekeeperconsent.com/min.js" data-cfasync="false"></script>
<script src="https://the.gatekeeperconsent.com/cmp.min.js" data-cfasync="false"></script>
<script async src="//www.ezojs.com/ezoic/sa.min.js"></script>
<script>
  window.ezstandalone = window.ezstandalone || {};
  ezstandalone.cmd = ezstandalone.cmd || [];
</script>

<!-- Schema.org -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Anderson Damasio",
  "url": "https://www.andersondamasio.com.br"
}
</script>

<link rel="icon" href="favicon.ico" type="image/x-icon" />
<style>
body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; background-color: #f0f2f5; color: #333; }
header { background-color: #0a66c2; color: white; padding: 2rem 1rem; text-align: center; }
header a { color: white; font-weight: bold; text-decoration: underline; }
header a:hover {
  text-decoration: underline;
  color: #f1c40f;
}
main { max-width: 800px; margin: 2rem auto; background-color: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
footer { text-align: center; margin-top: 3rem; font-size: 0.95rem; color: #666; }
ul { padding-left: 1.5rem; line-height: 1.8; }
 a {
      color: #0a66c2;
      text-decoration: none;
      font-weight: bold;
    }
    a:hover {
      text-decoration: underline;
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
  color: #0a66c2;
  border: 1px solid #0a66c2;
  padding: 6px 12px;
  border-radius: 8px;
  transition: background-color 0.3s, color 0.3s;
}
.scroll-container a:hover {
  background-color: #0a66c2;
  color: white;
}
.scroll-container a.active {
  background-color: #0a66c2;
  color: white;
}
</style>
</head>
<body>
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
<p>Arquiteto de Software com mais de 19 anos de experiência em desenvolvimento de sistemas, soluções escaláveis e arquitetura moderna.</p>

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

</body>
</html>`;


    const nome = i === 0 ? "index.html" : `index${i + 1}.html`;
    fs.writeFileSync(nome, html);
  }
}

function gerarSitemap(titulos) {
  const sitemapLinks = [
    `<url><loc>${siteUrl}/index.html</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    ...titulos.map(t => {
      const slug = slugify(t.titulo);
      const urlFinal = t.url || `artigos/${slug}.html`;
      return `<url><loc>${siteUrl}/${urlFinal}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    })
  ].join("\n");

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapLinks}
</urlset>`;

  fs.writeFileSync("sitemap.xml", sitemapContent);
}


gerar();
