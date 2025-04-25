const fs = require('fs');
const axios = require('axios');

const siteUrl = "https://www.andersondamasio.com.br";
const apiKey = process.env.OPENAI_API_KEY;

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
    <h1>${titulo}</h1>
    <p class="article-meta">Publicado em: ${dataHoraFormatada}</p>
    <div class="article-body">${content.replace(/\n/g, "<br>")}</div>
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

    const indexPath = "index.html";
    if (fs.existsSync(indexPath)) {
      let indexContent = fs.readFileSync(indexPath, "utf-8");

      const links = titulosGerados.map((t) => {
        const slugLink = slugify(t.titulo);
        const dataLink = formatDateTime(new Date(t.data));
        return `<li><a href="artigos/${slugLink}.html" title="Leia o artigo: ${t.titulo}">${t.titulo}</a> <span style="color:#777; font-size: 0.85rem;">(${dataLink})</span></li>`;
      }).join("\n");

      indexContent = indexContent.replace(
        /<!-- LINKS-DOS-ARTIGOS-INICIO -->(.|\n|\r)*?<!-- LINKS-DOS-ARTIGOS-FIM -->/,
        `<!-- LINKS-DOS-ARTIGOS-INICIO -->\n<section id="artigos-gerados">\n<h2>📚 Artigos Publicados</h2>\n<ul style="list-style: disc; padding-left: 1.5rem; line-height: 1.8;">\n${links}\n</ul>\n</section>\n<!-- LINKS-DOS-ARTIGOS-FIM -->`
      );

      fs.writeFileSync(indexPath, indexContent);
    }

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
    console.log(`✅ Artigo salvo como ${filename}, com dados protegidos e sitemap atualizado.`);
  } catch (error) {
    console.error("❌ Erro ao gerar conteúdo:", error.response?.data || error.message);
    process.exit(1);
  }
}

gerar();
