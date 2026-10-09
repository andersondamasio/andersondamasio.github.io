const siteUrl = "https://www.andersondamasio.com.br";

const legacySeoImage = `${siteUrl}/images/capa_anderson-damasio.png`;
const defaultSeoImage = `${siteUrl}/images/capa_anderson-damasio-16x9.jpg`;
const defaultPublisherLogo = `${siteUrl}/images/capa_anderson-damasio-1x1.jpg`;
const defaultSeoImageAlt = "Anderson Damasio - arquitetura de software e tecnologia";
const defaultSeoImageWidth = 1200;
const defaultSeoImageHeight = 675;
const defaultArticleImages = [
  `${siteUrl}/images/capa_anderson-damasio-1x1.jpg`,
  `${siteUrl}/images/capa_anderson-damasio-4x3.jpg`,
  `${siteUrl}/images/capa_anderson-damasio-16x9.jpg`
];

function getArticleStructuredImages(image, toAbsoluteUrl = value => value) {
  if (!image) return undefined;
  const resolved = toAbsoluteUrl(image);
  if (isBrandImage(resolved) || !/^https?:\/\//i.test(resolved)) return undefined;
  return [resolved];
}

function isBrandImage(image) {
  return image === legacySeoImage || defaultArticleImages.includes(image);
}

module.exports = {
  defaultSeoImage,
  defaultPublisherLogo,
  defaultSeoImageAlt,
  defaultSeoImageWidth,
  defaultSeoImageHeight,
  defaultArticleImages,
  isBrandImage,
  getArticleStructuredImages
};
