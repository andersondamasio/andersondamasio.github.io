const axios = require("axios");

const twitterBearer = process.env.TWITTER_BEARER_TOKEN;

const xRecentSearchQueries = [
  {
    nome: "contas-tecnicas",
    query: "(from:OpenAI OR from:AnthropicAI OR from:github OR from:GoogleCloudTech OR from:awscloud OR from:CloudflareDev OR from:Microsoft) has:links -is:retweet -is:reply"
  },
  {
    nome: "topicos-tecnicos-en",
    query: '("software architecture" OR "developer tools" OR "cloud native" OR cybersecurity OR vulnerability OR PostgreSQL OR Kubernetes OR "AI agents" OR LLM OR DevOps OR observability) has:links -is:retweet -is:reply lang:en'
  },
  {
    nome: "topicos-tecnicos-pt",
    query: '("arquitetura de software" OR "segurança" OR "inteligência artificial" OR devops OR cloud OR PostgreSQL OR Kubernetes) has:links -is:retweet -is:reply lang:pt'
  }
];

const dominiosSociaisOuIntermediarios = [
  "x.com",
  "twitter.com",
  "t.co",
  "facebook.com",
  "linkedin.com",
  "instagram.com",
  "threads.net",
  "youtube.com",
  "youtu.be"
];

function normalizarFonteUrl(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return "";
  }
}

function dominioFonte(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function dominioCombina(dominio, esperado) {
  return dominio === esperado || dominio.endsWith(`.${esperado}`);
}

function dominioSocialOuIntermediario(url) {
  const dominio = dominioFonte(url);
  return !dominio || dominiosSociaisOuIntermediarios.some(item => dominioCombina(dominio, item));
}

function escolherUrlFonteDoTweet(tweet) {
  const urls = tweet.entities?.urls || [];

  return urls
    .map(item => ({
      url: normalizarFonteUrl(item.unwound_url || item.expanded_url || item.url),
      titulo: item.title || "",
      descricao: item.description || ""
    }))
    .find(item => item.url && !dominioSocialOuIntermediario(item.url));
}

async function buscarXApi(pathname, { params = {} } = {}) {
  const bases = ["https://api.x.com/2", "https://api.twitter.com/2"];
  let ultimoErro = null;

  for (const base of bases) {
    try {
      return await axios.get(`${base}${pathname}`, {
        params,
        headers: { Authorization: `Bearer ${twitterBearer}` },
        timeout: 15000
      });
    } catch (erro) {
      ultimoErro = erro;
      const status = erro.response?.status;
      if (status && ![401, 403, 404, 410].includes(status)) break;
    }
  }

  throw ultimoErro || new Error("Falha ao consultar X API");
}

function formatarTitulo(valor) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function testarRadarX() {
  if (!twitterBearer) {
    throw new Error("TWITTER_BEARER_TOKEN nao configurado.");
  }

  const candidatos = [];
  const urlsVistas = new Set();

  for (const config of xRecentSearchQueries) {
    const res = await buscarXApi("/tweets/search/recent", {
      params: {
        query: config.query,
        max_results: 10,
        "tweet.fields": "created_at,author_id,entities,public_metrics,referenced_tweets,lang",
        expansions: "author_id",
        "user.fields": "username,name,verified,public_metrics"
      }
    });

    const tweets = res.data.data || [];
    const users = res.data.includes?.users || [];
    const usersById = new Map(users.map(user => [user.id, user]));
    const remaining = res.headers["x-rate-limit-remaining"] ?? "n/a";

    console.log(`[x-radar] query=${config.nome} tweets=${tweets.length} rate_remaining=${remaining}`);

    for (const tweet of tweets) {
      if (tweet.referenced_tweets?.some(ref => ref.type === "retweeted" || ref.type === "replied_to")) {
        continue;
      }

      const fonte = escolherUrlFonteDoTweet(tweet);
      if (!fonte?.url) continue;

      const normalizada = fonte.url.replace(/\/$/, "");
      if (urlsVistas.has(normalizada)) continue;
      urlsVistas.add(normalizada);

      const user = usersById.get(tweet.author_id);

      candidatos.push({
        query: config.nome,
        dominio: dominioFonte(fonte.url),
        titulo: formatarTitulo(fonte.titulo || tweet.text),
        url: fonte.url,
        post: user?.username ? `https://x.com/${user.username}/status/${tweet.id}` : `https://x.com/i/web/status/${tweet.id}`
      });
    }
  }

  console.log(`[x-radar] candidatos_editoriais=${candidatos.length}`);
  candidatos.slice(0, 5).forEach((item, index) => {
    console.log(`[x-radar] ${index + 1}. query=${item.query} dominio=${item.dominio} titulo="${item.titulo}"`);
    console.log(`[x-radar]    fonte=${item.url}`);
    console.log(`[x-radar]    post=${item.post}`);
  });

  if (candidatos.length === 0) {
    throw new Error("Nenhuma URL editorial foi extraida do X.");
  }
}

testarRadarX().catch(erro => {
  const status = erro.response?.status ? ` status=${erro.response.status}` : "";
  const body = erro.response?.data ? ` body=${JSON.stringify(erro.response.data).slice(0, 500)}` : "";
  console.error(`[x-radar] falhou:${status} ${erro.message}${body}`);
  process.exit(1);
});
