const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Extrai um resumo limpo da página HTML da notícia.
 * Funciona em múltiplos formatos de HTML (blogs, portais, X, etc).
 * 
 * @param {string} url 
 * @param {string} [tituloOriginal] 
 * @returns {Promise<string>}
 */
async function extrairResumoDaNoticia(url, tituloOriginal = '') {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (ResumoBot)'
      }
    });

    const $ = cheerio.load(res.data);
    let texto = '';

    // ✅ 1. Tenta pegar parágrafo especial (#speakable-summary)
    texto = $('#speakable-summary').text().trim();

    // ✅ 2. Tenta pegar resumo do <meta name="description">
    if (!texto) {
      texto = $('meta[name="description"]').attr('content')?.trim() || '';
    }

    // ✅ 3. Se título foi passado, tenta encontrar <p> próximo ao título
    if (!texto && tituloOriginal) {
      const normalizado = tituloOriginal.trim().toLowerCase();
      const tokens = normalizado.split(/\s+/).filter(t => t.length > 3);

      let posTitulo = null;

      $('h1, h2, h3, strong, b').each((i, el) => {
        const textoEl = $(el).text().trim().toLowerCase();
        if (tokens.every(tok => textoEl.includes(tok))) {
          posTitulo = el;
          return false;
        }
      });

      if (posTitulo) {
        const paragrafo = $(posTitulo).nextAll('p').first().text().trim();
        if (paragrafo.length > 40) {
          texto = paragrafo;
        }
      }
    }

    // ✅ 4. Fallback com heurística anti-lixo
    if (!texto) {
      texto = $('article p, main p, .content p, .article-body p, p')
        .map((i, el) => $(el).text().trim())
        .get()
        .filter(p => {
          const limpado = p.replace(/\s+/g, ' ');
          return (
            limpado.length > 40 &&
            !/cookies|subscribe|terms|privacy|login|comments|sign up|newsletter|advert/i.test(limpado) &&
            !/\s{2,}/.test(p) // ❌ Rejeita parágrafos com muitos espaços seguidos
          );
        })
        .slice(0, 3)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return texto.substring(0, 1200);
  } catch (e) {
    console.warn("⚠️ Falha ao extrair conteúdo da URL:", url, e.message);
    return '';
  }
}

module.exports = { extrairResumoDaNoticia };
