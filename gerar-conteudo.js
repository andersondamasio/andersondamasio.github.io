const fs = require('fs');
const axios = require('axios');

const siteUrl = "https://www.andersondamasio.com.br";

const apiKey = process.env.OPENAI_API_KEY;
const promptBase = "Escreva um artigo técnico original sobre um tema relevante de arquitetura de software. Comece com uma linha 'Título: ...'";

// Função para gerar slug SEO-friendly
function slugify(str) {
  return str.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function gerar() {
  try {
    const titulosPath = "titulos.json";
    const titulosGerados = fs.existsSync(titulosPath)
      ? JSON.parse(fs.readFileSync(titulosPath, "utf-8"))
      : [];

    const prompt = `${promptBase}\nEvite os seguintes temas: ${titulosGerados.join(", ")}`;

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
    const titulo = content.match(/^Título:\s*(.*)$/mi)?.[1] || 'artigo';
    const slug = slugify(titulo);
    const filename = `artigos/${slug}.html`;

    if (titulosGerados.includes(titulo)) {
      console.log("⚠️ Artigo já gerado anteriormente. Abortando.");
      process.exit(0);
    }

    const resumo = content.split("\n").slice(1, 3).join(" ").substring(0, 160).replace(/\s+/g, ' ').trim();

    const html = `
<!DOCTYPE html>
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
    main { max-width: 800px; margin: 2rem auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    a { color: #0a66c2; text-decoration: none; font-weight: bold; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <main>
    <h1>${titulo}</h1>
    <pre style="white-space: pre-wrap;">${content}</pre>
    <p style="text-align:center; margin-top:2rem;">
      <a href="../index.html">← Voltar para a página inicial</a>
    </p>
  </main>
</body>
</html>`;

    if (!fs.existsSync('artigos')) fs.mkdirSync('artigos');
    fs.writeFileSync(filename, html);

    titulosGerados.push(titulo);
    fs.writeFileSync(titulosPath, JSON.stringify(titulosGerados, null, 2));

    // Atualizar links no index.html
    const indexPath = "index.html";
    if (fs.existsSync(indexPath)) {
      let indexContent = fs.readFileSync(indexPath, "utf-8");

      const links = titulosGerados.map(t => {
        const slugLink = slugify(t);
        return `<li><a href="artigos/${slugLink}.html">${t}</a></li>`;
      }).join("\n");

      indexContent = indexContent.replace(
        /<!-- LINKS-DOS-ARTIGOS-INICIO -->(.|\n|\r)*?<!-- LINKS-DOS-ARTIGOS-FIM -->/,
        `<!-- LINKS-DOS-ARTIGOS-INICIO -->\n${links}\n<!-- LINKS-DOS-ARTIGOS-FIM -->`
      );

      fs.writeFileSync(indexPath, indexContent);
    }

    // Gerar sitemap.xml com domínio personalizado
    const sitemapLinks = [
      `<url><loc>${siteUrl}/index.html</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
      ...titulosGerados.map(t => {
        const slugLink = slugify(t);
        return `<url><loc>${siteUrl}/artigos/${slugLink}.html</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
      })
    ].join("\n");

    const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapLinks}
</urlset>`;

    fs.writeFileSync("sitemap.xml", sitemapContent);

    console.log(`✅ Artigo salvo como ${filename} e sitemap.xml atualizado`);
  } catch (error) {
    console.error("❌ Erro ao gerar conteúdo:", error.response?.data || error.message);
    process.exit(1);
  }
}

gerar();
