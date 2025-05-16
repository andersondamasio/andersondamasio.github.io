const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Extrai um resumo limpo e mais completo da página HTML da notícia.
 * Funciona com blogs, portais, e outras estruturas variadas.
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

    // 🔹 1. Captura #speakable-summary, se existir
    texto = $('#speakable-summary').text().trim();

    // 🔹 2. Captura <meta name="description"> como fallback extra
    const resumoMeta = $('meta[name="description"]').attr('content')?.trim() || '';

    // 🔹 3. Busca <p> logo após o título, se o título foi passado
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

    // 🔹 4. Fallback: captura vários <p> do corpo da notícia
    if (!texto) {
      let paragrafos = $('article p, main p, .content p, .article-body p, p')
        .map((i, el) => $(el).text().trim())
        .get()
        .filter(p => {
          const limpado = p.replace(/\s+/g, ' ');
          return (
            limpado.length > 60 &&
            !/cookies|subscribe|terms|privacy|login|comments|sign up|newsletter|advert/i.test(limpado) &&
            !/\s{2,}/.test(p)
          );
        });

      texto = paragrafos.slice(0, 5).join(' ').replace(/\s+/g, ' ').trim();
    }

    // 🔹 5. Se ainda estiver curto, adiciona resumoMeta ao início
    if (texto.length < 300 && resumoMeta && !texto.includes(resumoMeta)) {
      texto = resumoMeta + ' ' + texto;
    }

    return texto.substring(0, 1200);
  } catch (e) {
    console.warn("⚠️ Falha ao extrair conteúdo da URL:", url, e.message);
    return '';
  }
}

module.exports = { extrairResumoDaNoticia };
