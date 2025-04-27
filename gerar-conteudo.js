
const fs = require('fs');
const axios = require('axios');
const Parser = require('rss-parser');
const parser = new Parser();

const siteUrl = "https://www.andersondamasio.com.br";
const apiKey = process.env.OPENAI_API_KEY;
const artigosPorPagina = 10;

const hackerNewsUrl = "https://hacker-news.firebaseio.com/v0/topstories.json";
const devBlogsFeeds = [
  "https://devblogs.microsoft.com/dotnet/feed/",
  "https://devblogs.microsoft.com/azure/feed/",
  "https://devblogs.microsoft.com/visualstudio/feed/",
  "https://devblogs.microsoft.com/devops/feed/",
  "https://devblogs.microsoft.com/opensource/feed/",
  "https://martinfowler.com/feed.atom"
];

function slugify(str) {
  if (!str || typeof str !== "string") return "artigo";
  return str.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
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
  const titulosGerados = fs.existsSync(titulosPath) ? JSON.parse(fs.readFileSync(titulosPath, "utf-8")) : [];
  const noticiasAntigas = titulosGerados.map(t => normalizarTexto(t.noticiaOriginal));

    const fontes = [
    buscarNoticiaHackerNews, 
    buscarNoticiaDevBlogs
  ];

  for (const fonte of fontes) {
    const lista = await fonte();
    for (const noticia of lista) {
      const normalizada = normalizarTexto(noticia.titulo);
      if (!noticiasAntigas.includes(normalizada)) {
        return noticia;
      }
    }
  }
  return null;
}

async function buscarNoticiaHackerNews() {
  const ids = await axios.get(hackerNewsUrl).then(res => res.data.slice(0, 30));
  const lista = [];
  for (const id of ids) {
    const item = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(res => res.data);
    if (item?.title && !item.deleted && !item.dead) {
      lista.push({ titulo: item.title, url: item.url || '' });
    }
  }
  return lista;
}

async function buscarNoticiaDevBlogs() {
  const lista = [];
  for (const feedUrl of devBlogsFeeds) {
    const feed = await parser.parseURL(feedUrl);
    for (const item of feed.items) {
      if (item.title && item.link) {
        lista.push({ titulo: item.title, url: item.link });
      }
    }
  }
  return lista;
}

async function gerar() {
  try {
    const now = new Date();
    const titulosPath = "titulos.json";
    let titulosGerados = fs.existsSync(titulosPath) ? JSON.parse(fs.readFileSync(titulosPath, "utf-8")) : [];

    const noticia = await buscarNoticia();

    if (!noticia || !noticia.titulo) {
      console.log("⚠️ Nenhuma notícia válida encontrada. Abortando.");
      process.exit(0);
    }

const prompt = `
Imagine que você recebeu uma notícia técnica internacional sobre: "${noticia.titulo}".
Seu trabalho é:

1. Criar um novo título 100% original em português, inspirado no tema da notícia, mas sem traduzir literalmente.
   - Reescreva o título de forma natural e adaptada para o público brasileiro.
   - Use sinônimos, reformule as frases e traga uma abordagem diferente, mantendo o sentido geral.
   - O título deve ser único, atrativo e relacionado ao tema, mas não parecer uma tradução.

2. Em seguida, abaixo do título, escreva um artigo técnico totalmente em português que:
   - Explique a relevância para práticas modernas de arquitetura de software e desenvolvimento de sistemas.
   - Traga exemplos práticos de aplicação, preferencialmente com trechos de código (em C# ou outra linguagem relacionada, quando possível também trazer apis disponíveis que podem ajudar no desenvolvimento).
   - Ofereça dicas avançadas que normalmente não são facilmente encontradas em artigos comuns.
   - Use linguagem clara, didática e estruturada com: introdução, exemplo de código, explicação técnica e conclusão.

Importante:
- O título deve ser apresentado na primeira linha, sem prefixos como "Título:", "Novo Título:" ou "Artigo:".
- Não adicione aspas, negrito ou marcações no título.
- Comece o artigo em uma nova linha, depois do título.
`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-3.5-turbo",
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
    const titulo = (content.match(/^(.+)$/m)?.[1] || noticia.titulo).replace(/^\*\*(.+?)\*\*$/, '$1').trim();

    let corpoArtigo = content.split('\n').slice(1).join('\n').trim();

    corpoArtigo = corpoArtigo
      .replace(/```csharp\n([\s\S]*?)```/g, '<pre><code class="language-csharp">$1</code></pre>')
      .replace(/```[\s\S]*?\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    const slug = slugify(titulo);
    const filename = `artigos/${slug}.html`;

    const resumo = corpoArtigo.split("\n").slice(0, 2).join(" ").substring(0, 160).replace(/\s+/g, ' ').trim();
    const dataHoraFormatada = formatDateTime(now);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${titulo} | Anderson Damasio</title>
<meta name="description" content="${resumo}">
<link rel="icon" href="../favicon.ico" type="image/x-icon" />

<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-T15623VZYE"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-T15623VZYE');
</script>

<style>
body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; background-color: #f0f2f5; color: #333; }
h1 { font-size: 1.8rem; margin-bottom: 1rem; }
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
<main>
<h1>${titulo}</h1>
<p class="article-meta">Publicado em: ${dataHoraFormatada}</p>
<div class="article-body">${corpoArtigo.replace(/\n/g, "<br>")}</div>
<p class="back-link"><a href="../index.html">← Voltar para a página inicial</a></p>
</main>

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

    titulosGerados.push({ titulo, noticiaOriginal: noticia.titulo, data: now.toISOString() });
    fs.writeFileSync(titulosPath, JSON.stringify(titulosGerados, null, 2));

    gerarIndicesPaginados(titulosGerados);
    gerarSitemap(titulosGerados);

    console.log(`✅ Artigo gerado: ${titulo}`);
  } catch (error) {
    console.error("❌ Erro:", error.message);
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
      return `<li><a href="artigos/${slug}.html">${t.titulo}</a> <span style="color:#777;">(${data})</span></li>`;
    }).join("\n");

    const paginacao = paginas > 1 ? `
<div style="display:flex; overflow-x:auto; gap: 12px; padding: 8px; margin-top: 2rem; justify-content: center;">
  ${Array.from({ length: paginas }).map((_, idx) => {
    const pageName = idx === 0 ? "index.html" : `index${idx + 1}.html`;
    const paginaLabel = `Página ${idx + 1}`;
    const isActive = i === idx; // Destaca a página atual

    return `<a href="${pageName}" style="
      flex-shrink: 0;
      white-space: nowrap;
      font-weight: bold;
      text-decoration: none;
      color: ${isActive ? '#ffffff' : '#0a66c2'};
      background-color: ${isActive ? '#0a66c2' : 'transparent'};
      border: 1px solid #0a66c2;
      padding: 6px 12px;
      border-radius: 8px;
      transition: background-color 0.3s, color 0.3s;
      ">
      ${paginaLabel}
    </a>`;
  }).join("")}
</div>
` : '';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Anderson Damasio – Arquiteto de Software</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="favicon.ico" type="image/x-icon" />
<style>
body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; background-color: #f0f2f5; color: #333; }
header { background-color: #0a66c2; color: white; padding: 2rem 1rem; text-align: center; }
header a { color: white; font-weight: bold; text-decoration: underline; }
main { max-width: 800px; margin: 2rem auto; background-color: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
footer { text-align: center; margin-top: 3rem; font-size: 0.95rem; color: #666; }
ul { padding-left: 1.5rem; line-height: 1.8; }
a { text-decoration: none; font-weight: bold; }
a:hover { text-decoration: underline; }
</style>
</head>
<body>
<header>
<h1>Anderson Damasio</h1>
<p>Arquiteto de Software</p>
<p><a href="https://www.linkedin.com/in/andersondamasio/" target="_blank" rel="noopener">Acesse o perfil no LinkedIn</a></p>
</header>

<main>
<section>

<!-- Sobre Mim -->
<div style="background:white; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); padding:2rem; margin-bottom:2rem;">
<h2>Sobre Mim</h2>
<p>Arquiteto de Software com mais de 19 anos de experiência em desenvolvimento de sistemas, soluções escaláveis e arquitetura moderna.</p>

<h3>Contato</h3>
<p>E-mail: <a href="mailto:anderson@andersondamasio.com.br">anderson@andersondamasio.com.br</a></p>
</div>

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
<a href="politica.html">Política de Privacidade</a><br/>
&copy; 2025 Anderson Damasio – Todos os direitos reservados
</footer>
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
      return `<url><loc>${siteUrl}/artigos/${slug}.html</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    })
  ].join("\n");

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapLinks}
</urlset>`;

  fs.writeFileSync("sitemap.xml", sitemapContent);
}

gerar();
