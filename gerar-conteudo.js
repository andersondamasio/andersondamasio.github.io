
const fs = require('fs');
const axios = require('axios');
const Parser = require('rss-parser');
const { escolherIntroducao } = require('./dados/selecionar-introducao');
const parser = new Parser();

const siteUrl = "https://www.andersondamasio.com.br";
const apiKey = process.env.OPENAI_API_KEY;
const artigosPorPagina = 10;

const hackerNewsUrl = "https://hacker-news.firebaseio.com/v0/topstories.json";
const devBlogsFeeds = [
  "https://rss.app/feeds/pgPpIEPhhshd64LJ.xml",
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
    const tematica = noticia.titulo;
    const introducaoVaria = escolherIntroducao(tematica);

    if (!noticia || !noticia.titulo) {
      console.log("⚠️ Nenhuma notícia válida encontrada. Abortando.");
      process.exit(0);
    }

const prompt = `
Você é Anderson Damasio, um Arquiteto de Software com mais de 19 anos de experiência prática em sistemas escaláveis.
Você acaba de ler uma notícia técnica internacional sobre: "${noticia.titulo}".

Seu objetivo é criar um conteúdo editorial **com aparência 100% humana e autoral**, publicado em seu blog pessoal no Brasil.

**O que você deve produzir:**

1. Um **título original e criativo**, em português, inspirado na notícia, mas:
   - Sem tradução literal.
   - Com estilo natural para o público brasileiro de tecnologia.
   - Que traga um olhar técnico, provocativo ou prático, como se fosse você mesmo escrevendo.

2. Em seguida, **um artigo completo**, com:
   - Uma introdução como esta: ${introducaoVaria}
   - Uma explicação técnica clara e aprofundada sobre o tema.
   - Trechos de código reais (preferencialmente em C# ou outra linguagem prática, com APIs úteis quando possível).
   - Dicas avançadas que mostrem domínio prático, indo além do básico.
   - Uma conclusão com reflexões ou recomendações suas.

**Importante:**
- Não inicie com “Título:” ou similares. Apenas escreva o título direto na primeira linha.
- Pule uma linha e inicie o artigo.
- O conteúdo deve parecer escrito por um humano experiente, com estilo natural, fluente e levemente opinativo.
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
    const dataISO = new Date(now).toISOString();

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
<meta property="og:url" content="https://www.andersondamasio.com.br/artigos/${slug}.html">
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

<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-T15623VZYE"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-T15623VZYE');
</script>

<!-- Script principal da Ezoic (Standalone) no <head> -->
<script async src="//www.ezojs.com/ezoic/sa.min.js"></script>
<script>
  window.ezstandalone = window.ezstandalone || {};
  ezstandalone.cmd = ezstandalone.cmd || [];
</script>

<!-- Google AdSense -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1824544776589069"
     crossorigin="anonymous"></script>

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

<!-- Ezoic Placeholder: incontent_5 (ID 115) -->
<div id="ezoic-pub-ad-placeholder-115" style="margin: 2rem 0;"></div>
<script>
  ezstandalone.cmd.push(function() {
    ezstandalone.showAds(115);
  });
</script>

<div class="article-body">${corpoArtigo.replace(/\n/g, "<br>")}</div>
<p class="back-link"><a href="../index.html">← Voltar para a página inicial</a></p>

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

    titulosGerados.push({ titulo, noticiaOriginal: noticia.titulo, data: now.toISOString() });
    fs.writeFileSync(titulosPath, JSON.stringify(titulosGerados, null, 2));

    gerarIndicesPaginados(titulosGerados);
    gerarSitemap(titulosGerados);

   // Registrar introdução usada
    const usadasPath = './dados/usadas.json';
    const usadas = fs.existsSync(usadasPath) ? JSON.parse(fs.readFileSync(usadasPath, 'utf-8')) : {};
    usadas[`${now.toISOString().split('T')[0]}-${slug}`] = {
  intro: introducaoVaria,
  data: now.toISOString().split('T')[0]
};
    fs.writeFileSync(usadasPath, JSON.stringify(usadas, null, 2));
    
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
<div class="scroll-container">
  ${Array.from({ length: paginas }).map((_, idx) => {
    const pageName = idx === 0 ? "index.html" : `index${idx + 1}.html`;
    const paginaLabel = `Página ${idx + 1}`;
    const isActive = i === idx;
    return `<a href="${pageName}" class="${isActive ? 'active' : ''}">${paginaLabel}</a>`;
  }).join("")}
</div>
` : '';

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Anderson Damasio – Arquiteto de Software | Artigos sobre Desenvolvimento e Arquitetura</title>
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

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@andersondamasio">
<meta name="twitter:title" content="Anderson Damasio – Arquiteto de Software">
<meta name="twitter:description" content="Mais de 19 anos de experiência em desenvolvimento de sistemas, arquitetura moderna e artigos técnicos.">
<meta name="twitter:image" content="https://www.andersondamasio.com.br/images/capa_anderson-damasio.png">

<!-- Verificação Google AdSense -->
<meta name="google-adsense-account" content="ca-pub-1824544776589069">

<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-T15623VZYE"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-T15623VZYE');
</script>

<!-- Ezoic Standalone -->
<script async src="//www.ezojs.com/ezoic/sa.min.js"></script>
<script>
  window.ezstandalone = window.ezstandalone || {};
  ezstandalone.cmd = ezstandalone.cmd || [];
</script>

<!-- Google AdSense -->
<script async src="https://pagead2.googlesyndication.com/pagead/js?client=ca-pub-1824544776589069"
     crossorigin="anonymous"></script>

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
