const siteUrl = "https://www.andersondamasio.com.br";
const siteName = "Anderson Damasio";
const authorName = "Anderson Damasio";
const authorUrl = `${siteUrl}/sobre.html`;
const authorId = `${siteUrl}/#anderson-damasio`;
const websiteId = `${siteUrl}/#website`;
const authorSameAs = [
  "https://www.linkedin.com/in/andersondamasio/"
];

function criarPessoaSchema(extra = {}) {
  return {
    "@type": "Person",
    "@id": authorId,
    "name": authorName,
    "url": authorUrl,
    "jobTitle": "Arquiteto de Software",
    "sameAs": authorSameAs,
    ...extra
  };
}

function criarPublicadorSchema(extra = {}) {
  return criarPessoaSchema(extra);
}

function criarWebSiteSchema(extra = {}) {
  return {
    "@type": "WebSite",
    "@id": websiteId,
    "name": siteName,
    "url": siteUrl,
    "inLanguage": "pt-BR",
    "publisher": criarPublicadorSchema(),
    ...extra
  };
}

module.exports = {
  authorId,
  authorName,
  authorSameAs,
  authorUrl,
  criarPublicadorSchema,
  criarPessoaSchema,
  criarWebSiteSchema,
  siteName,
  siteUrl,
  websiteId
};
