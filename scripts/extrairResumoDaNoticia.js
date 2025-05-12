const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Extrai um trecho limpo da notícia da URL original para usar no prompt do ChatGPT.
 * @param {string} url URL da notícia original
 * @returns {Promise<string>} Um resumo limpo da página (máximo 1200 caracteres)
 */
async function extrairResumoDaNoticia(url) {
  try {
    const res = await axios.get(url);
    const $ = cheerio.load(res.data);

    // Extrai o texto do primeiro parágrafo visível
    const texto = $('p').map((i, el) => $(el).text()).get().join(' ').replace(/\s+/g, ' ').trim();
    return texto.substring(0, 1200); // limita o tamanho para evitar prompt excessivo
  } catch (e) {
    console.warn("⚠️ Falha ao extrair conteúdo da URL:", url, e.message);
    return '';
  }
}

module.exports = { extrairResumoDaNoticia };
