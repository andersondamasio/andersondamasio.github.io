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

    // Fallback: pega apenas os <p> dentro de <article> ou <main>, ignorando menus
if (!texto) {
  const paragrafos = $('article p, main p')
    .filter((i, el) => {
      const parentClasses = $(el).parents().map((_, p) => $(p).attr('class') || '').get().join(' ');
      return !/mega-menu|menu|nav|header|footer|sidebar/i.test(parentClasses);
    })
    .map((i, el) => $(el).text().trim())
    .get()
    .filter(p => p.length > 60 && !/\s{2,}/.test(p))
    .slice(0, 5);

  texto = paragrafos.join(' ').replace(/\s+/g, ' ').trim();
}


    return texto.substring(0, 1200);
  } catch (e) {
    console.warn("⚠️ Falha ao extrair conteúdo da URL:", url, e.message);
    return '';
  }
}

module.exports = { extrairResumoDaNoticia };
