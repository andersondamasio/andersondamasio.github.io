const fs = require('fs');
const axios = require('axios');

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

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-T15623VZYE"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-T15623VZYE');
  </script>
</head>
<body>
  <h1>${titulo}</h1>
  <pre style="white-space: pre-wrap">${content}</pre>
</body>
</html>`;

    if (!fs.existsSync('artigos')) fs.mkdirSync('artigos');
    fs.writeFileSync(filename, html);

    // Atualiza titulos.json
    titulosGerados.push(titulo);
    fs.writeFileSync(titulosPath, JSON.stringify(titulosGerados, null, 2));

    // Atualiza index.html
    const link = `<li><a href="${filename}">📝 ${titulo}</a></li>`;
    const existing = fs.existsSync('index.html') ? fs.readFileSync('index.html', 'utf-8') : '';
    const artigosExistentes = existing.match(/<li>.*?<\/li>/g) || [];

    const novosLinks = [link, ...artigosExistentes.filter(l => !l.includes(slug))].slice(0, 50).join("\n");
    const indexContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Index de Artigos</title></head><body><h1>📚 Artigos Gerados</h1><ul>${novosLinks}</ul></body></html>`;

    fs.writeFileSync('index.html', indexContent);
    console.log(`✅ Artigo salvo como ${filename}`);
  } catch (error) {
    console.error("❌ Erro ao gerar conteúdo:", error.response?.data || error.message);
    process.exit(1);
  }
}

gerar();
