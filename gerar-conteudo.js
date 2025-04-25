const fs = require('fs');
const axios = require('axios');

const apiKey = process.env.OPENAI_API_KEY;
const prompt = "Escreva um artigo sobre os benefícios de arquiteturas desacopladas em aplicações modernas.";

async function gerar() {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4",
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
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Artigo gerado por ChatGPT</title>
</head>
<body>
  <h1>Artigo Gerado</h1>
  <pre style="white-space: pre-wrap">${content}</pre>
</body>
</html>`;

    fs.writeFileSync('artigo.html', html);
    console.log("✅ Arquivo artigo.html gerado com sucesso.");
  } catch (error) {
    console.error("❌ Erro ao gerar conteúdo:", error.response?.data || error.message);
    process.exit(1);
  }
}

gerar();