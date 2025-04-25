const fs = require('fs');
const axios = require('axios');
const Parser = require('rss-parser');
const parser = new Parser();

const siteUrl = "https://www.andersondamasio.com.br";
const apiKey = process.env.OPENAI_API_KEY;
const artigosPorPagina = 10;

if (!apiKey) {
  console.error("❌ OPENAI_API_KEY não definida.");
  process.exit(1);
}

const hackerNewsUrl = "https://hacker-news.firebaseio.com/v0/topstories.json";
const devBlogsFeeds = [
  "https://devblogs.microsoft.com/dotnet/feed/",
  "https://devblogs.microsoft.com/azure/feed/",
  "https://devblogs.microsoft.com/visualstudio/feed/",
  "https://devblogs.microsoft.com/devops/feed/",
  "https://devblogs.microsoft.com/opensource/feed/"
];

function slugify(str) {
  if (!str || typeof str !== "string") return "artigo";
  return str.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizarTitulo(titulo) {
  return titulo.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, '');
}

function formatDateTime(date) {
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function buscarNoticiaHackerNews() {
  const ids = await axios.get(hackerNewsUrl).then(res => res.data.slice(0, 30));
  for (const id of ids) {
    const item = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(res => res.data);
    if (item && item.title && !item.deleted && !item.dead) {
      return { titulo: item.title, url: item.url || '' };
    }
  }
  return null;
}

async function buscarNoticiaDevBlogs() {
  for (const feedUrl of devBlogsFeeds) {
    const feed = await parser.parseURL(feedUrl);
    for (const item of feed.items) {
      if (item.title && item.link) {
        return { titulo: item.title, url: item.link };
      }
    }
  }
  return null;
}

async function gerar() {
  try {
    const now = new Date();
    const titulosPath = "titulos.json";

    let titulosGerados = [];
    if (fs.existsSync(titulosPath)) {
      titulosGerados = JSON.parse(fs.readFileSync(titulosPath, "utf-8"));
    }

    const noticiasUtilizadas = titulosGerados
      .map(t => t.noticiaOriginal)
      .filter(Boolean)
      .map(normalizarTitulo);

    let noticia = await buscarNoticiaHackerNews();
    if (!noticia || noticiasUtilizadas.includes(normalizarTitulo(noticia.titulo))) {
      noticia = await buscarNoticiaDevBlogs();
    }

    if (noticia && noticiasUtilizadas.includes(normalizarTitulo(noticia.titulo))) {
      console.log("⚠️ Notícia já utilizada anteriormente. Abortando.");
      process.exit(0);
    }

    let prompt;
    if (noticia) {
      prompt = `Resumo da notícia: ${noticia.titulo}. Com base nesta novidade real, escreva um artigo técnico e original com conteúdo e título em português, explicando como essa tendência se conecta a práticas modernas de arquitetura de software. Você pode opcionalmente abranger os assuntos mais relevantes que tenha haver com o assunto, sendo eles como exemplo Microservices, Serverless, Kubernetes, Domain-Driven Design, Event-Driven Architecture, Clean Architecture, CQRS, Hexagonal Architecture (Ports and Adapters), Cloud-Native Patterns, Resilience Engineering, API Gateway Patterns, Edge Computing, Observability (Logs, Metrics, Tracing), DevOps, Continuous Delivery, Monolith to Microservices Migration, AI System Architecture, Data Mesh e Event Sourcing ou algum outro que seja mais relevante para o assunto.`;
    } else {
      prompt = "Escreva um artigo técnico moderno e original em português sobre arquitetura de software, utilizando opcionalmente conceitos como Microservices, Serverless, Kubernetes, Domain-Driven Design, Event-Driven Architecture, Clean Architecture, CQRS, Hexagonal Architecture (Ports and Adapters), Cloud-Native Patterns, Resilience Engineering, API Gateway Patterns, Edge Computing, Observability (Logs, Metrics, Tracing), DevOps, Continuous Delivery, Monolith to Microservices Migration, AI System Architecture, Data Mesh e Event Sourcing. O artigo deve ser original.";
    }

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
    const titulo = content.match(/^Título:\s*(.*)$/mi)?.[1]?.trim() || noticia?.titulo || "Artigo de Arquitetura";
    const slug = slugify(titulo);
    const filename = `artigos/${slug}.html`;

    const resumo = content.split("\n").slice(1, 3).join(" ").substring(0, 160).replace(/\s+/g, ' ').trim();
    const dataHoraFormatada = formatDateTime(now);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${titulo} | Anderson Damasio</title>
<meta name="description" content="${resumo}">
<link rel="icon" href="../favicon.ico" type="image/x-icon" />
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

    titulosGerados.push({
      titulo,
      data: now.toISOString(),
      noticiaOriginal: noticia?.titulo || null
    });
    fs.writeFileSync(titulosPath, JSON.stringify(titulosGerados, null, 2));

    console.log(`✅ Artigo gerado: ${titulo}`);
  } catch (error) {
    console.error("❌ Erro:", error.response?.data || error.message);
    process.exit(1);
  }
}

gerar();
