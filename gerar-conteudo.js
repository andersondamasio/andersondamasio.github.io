const fs = require('fs');
const axios = require('axios');
const path = require('path');

const siteUrl = "https://www.andersondamasio.com.br";
const apiKey = process.env.OPENAI_API_KEY;
const artigosPorPagina = 10;

function slugify(str) {
  if (!str || typeof str !== "string") return "artigo";
  return str.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatDateTime(date) {
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function gerar() {
  try {
    const now = new Date();
    const dataHoraFormatada = formatDateTime(now);
    const titulosPath = "titulos.json";

    let titulosGerados = [];
    if (fs.existsSync(titulosPath)) {
      titulosGerados = JSON.parse(fs.readFileSync(titulosPath, "utf-8"));
    }

    const titulosApenas = titulosGerados.map(t => t.titulo);
    const prompt = "Escreva um artigo técnico original sobre um tema relevante de arquitetura de software. Comece com uma linha 'Título: ...'. Evite os temas: " + titulosApenas.join(", ");

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
    const titulo = content.match(/^Título:\s*(.*)$/mi)?.[1]?.trim();
    if (!titulo) {
      console.error("❌ Título não encontrado no conteúdo gerado.");
      process.exit(1);
    }

    const slug = slugify(titulo);
    const filename = `artigos/${slug}.html`;

    if (titulosApenas.includes(titulo)) {
      console.log("⚠️ Artigo já gerado anteriormente. Abortando.");
      process.exit(0);
    }

    const resumo = content.split("\n").slice(1, 3).join(" ").substring(0, 160).replace(/\s+/g, ' ').trim();

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${titulo} | Anderson Damasio</title>
  <meta name="description" content="${resumo}">
  <link rel="icon" href="../favicon.ico" type="image/x-icon" />
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
    .back-link { text-align: center; margin-top: 2rem; }
    .back-link a {
      font-weight: bold; color: #0a66c2; font-size: 1.05rem;
      border: 1px solid #0a66c2; padding: 0.4rem 1rem;
      border-radius: 6px; display: inline-block; text-decoration: none;
    }
    .back-link a:hover { background-color: #0a66c2; color: white; }
    main { max-width: 800px; margin: 2rem auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
  </style>
</head>
<body>
  <main>
<!-- Bloco Sobre Mim apenas em index.html -->
  <div style="background:white; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); padding:2rem;">
    <h2>Sobre Mim</h2>
    <p>Arquiteto de Software com mais de 19 anos de experiência em desenvolvimento de sistemas, soluções escaláveis e arquitetura moderna. Atua com foco em inovação, performance e confiabilidade de aplicações.</p>
    <h3>Contato</h3>
    <p>E-mail: <a href="mailto:anderson@andersondamasio.com.br">anderson@andersondamasio.com.br</a></p>
  </div>
</section>
    <h1>${titulo}</h1>
    <p class="article-meta">Publicado em: ${dataHoraFormatada}</p>
    <div class="article-body">${content.replace(/\n/g, "<br>")}</div>
<p class="back-link">
  <a href="../index.html">← Voltar para a página inicial</a>
</p>
    <p class="back-link">
      <a href="../index.html">← Voltar para a página inicial</a>
    </p>
  </main>
</body>
</html>`;

    if (!fs.existsSync('artigos')) fs.mkdirSync('artigos');
    fs.writeFileSync(filename, html);

    titulosGerados.push({ titulo, data: now.toISOString() });
    fs.writeFileSync(titulosPath, JSON.stringify(titulosGerados, null, 2));

    gerarIndicesPaginados(titulosGerados);

    const sitemapLinks = [
      `<url><loc>${siteUrl}/index.html</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
      ...titulosGerados.map(t => {
        const slugLink = slugify(t.titulo);
        return `<url><loc>${siteUrl}/artigos/${slugLink}.html</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
      })
    ].join("\n");

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapLinks}
</urlset>`;

    fs.writeFileSync("sitemap.xml", sitemapContent);
    console.log(`✅ Artigo salvo como ${filename}, index paginado e sitemap atualizados.`);
  } catch (error) {
    console.error("❌ Erro ao gerar conteúdo:", error.response?.data || error.message);
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
      return `<li><a href="artigos/${slug}.html" title="Leia o artigo: ${t.titulo}">${t.titulo}</a> <span style="color:#777; font-size: 0.85rem;">(${data})</span></li>`;
    }).join("\n");

    const paginacao = paginas > 1 ? '<div style="text-align:center; margin-top:2rem;">' + 
      Array.from({length: paginas}).map((_, idx) => {
        const pageName = idx === 0 ? "index.html" : `index${idx+1}.html`;
        return `<a href="${pageName}" style="margin:0 8px;">Página ${idx+1}</a>`;
      }).join("") + '</div>' : '';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Anderson Damasio – Arquiteto de Software</title>
<meta name="description" content="Perfil profissional de Anderson Damasio, Arquiteto de Software com mais de 19 anos de experiência em desenvolvimento de sistemas escaláveis e arquitetura moderna.">
<link rel="icon" href="favicon.ico" type="image/x-icon" />
<style>
body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; background-color: #f0f2f5; color: #333; }
header { background-color: #0a66c2; color: white; padding: 2rem 1rem; text-align: center; }
header a { color: white; font-weight: bold; text-decoration: underline; }
main { max-width: 800px; margin: 2rem auto; background-color: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
footer { text-align: center; margin-top: 3rem; font-size: 0.95rem; color: #666; }
ul { padding-left: 1.5rem; line-height: 1.8; }
a { color: #0a66c2; text-decoration: none; font-weight: bold; }
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
<!-- Bloco Sobre Mim apenas em index.html -->
  <div style="background:white; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); padding:2rem;">
    <h2>Sobre Mim</h2>
    <p>Arquiteto de Software com mais de 19 anos de experiência em desenvolvimento de sistemas, soluções escaláveis e arquitetura moderna. Atua com foco em inovação, performance e confiabilidade de aplicações.</p>
    <h3>Contato</h3>
    <p>E-mail: <a href="mailto:anderson@andersondamasio.com.br">anderson@andersondamasio.com.br</a></p>
  </div>
</section>
<section>
<h2>📚 Artigos Publicados</h2>
<ul>
${links}
</ul>
${paginacao}
</section>
</main>
<footer>
<a href="politica.html">Política de Privacidade</a><br/>
&copy; 2025 Anderson Damasio – Todos os direitos reservados.
</footer>
</body>
</html>`;

    const nome = i === 0 ? "index.html" : `index${i+1}.html`;
    fs.writeFileSync(nome, html);
  }
}

gerar();
