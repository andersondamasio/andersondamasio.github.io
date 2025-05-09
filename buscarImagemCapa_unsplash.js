
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const sharp = require('sharp'); // Opcional, se quiser redimensionar ou otimizar

async function buscarImagemCapa(query, slug) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.warn("⚠️ Chave da API do Unsplash não definida em UNSPLASH_ACCESS_KEY");
    return null;
  }

  try {
    const res = await axios.get("https://api.unsplash.com/search/photos", {
      params: { query, per_page: 1 },
      headers: {
        Authorization: `Client-ID ${accessKey}`
      }
    });

    if (!res.data.results.length) {
      console.log(`⚠️ Nenhuma imagem encontrada para: ${query}`);
      return null;
    }

    const imageUrl = res.data.results[0].urls.regular;
    const imagePath = path.join("images", "artigos", `${slug}.jpg`);

    const imageRes = await axios.get(imageUrl, { responseType: "arraybuffer" });
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    fs.writeFileSync(imagePath, imageRes.data);
    console.log(`✅ Imagem salva: ${imagePath}`);
    return `/images/artigos/${slug}.jpg`;

  } catch (err) {
    console.error(`❌ Erro ao buscar imagem no Unsplash: ${err.message}`);
    return null;
  }
}
