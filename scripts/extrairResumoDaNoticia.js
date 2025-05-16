const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Extrai um trecho limpo da notícia da URL original para usar no prompt do ChatGPT.
 * Prioriza o parágrafo que vem após o título, se fornecido.
 * 
 * @param {string} url URL da notícia original
 * @param {string} [tituloOriginal] Título da notícia (opcional, melhora precisão)
 * @returns {Promise<string>} Um resumo limpo da página (máximo 1200 caracteres)
 */
async function extrairResumoDaNoticia(url, tituloOriginal = '') {
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);

    let texto = '';

    if (tituloOriginal) {
      const normalizado = tituloOriginal.trim().toLowerCase();

      // Procura o título dentro do HTML (em tags comuns de título)
      let posTitulo = null;
      $('h1, h2, h3, strong, b').each((i, el) => {
        const t = $(el).text().trim().toLowerCase();
        if (t.includes(normalizado)) {
          posTitulo = el;
          return false;
        }
      });

      if (posTitulo) {
        // Pega o primeiro <p> visível após o título
        const paragrafo = $(posTitulo).nextAll('p').first().text().trim();
        if (paragrafo && paragrafo.length > 40) {
          texto = paragrafo;
        }
      }
    }

    // Fallback: junta os <p> principais se nada for encontrado
    if (!texto) {
      texto = $('article p, main p, .content p, .article-body p, p')
        .map((i, el) => $(el).text())
        .get()
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
