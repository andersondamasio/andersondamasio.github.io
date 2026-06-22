const {
  defaultPublisherLogo,
  defaultSeoImageAlt
} = require("./seo-assets");

const siteUrl = "https://www.andersondamasio.com.br";
const siteName = "Anderson Damasio";
const authorName = "Anderson Damasio";
const authorUrl = `${siteUrl}/sobre.html`;
const authorId = `${siteUrl}/#anderson-damasio`;
const organizationId = `${siteUrl}/#organization`;
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

function criarOrganizacaoSchema(extra = {}) {
  return {
    "@type": "Organization",
    "@id": organizationId,
    "name": siteName,
    "url": siteUrl,
    "logo": {
      "@type": "ImageObject",
      "url": defaultPublisherLogo,
      "caption": defaultSeoImageAlt
    },
    ...extra
  };
}

function criarWebSiteSchema(extra = {}) {
  return {
    "@type": "WebSite",
    "@id": websiteId,
    "name": siteName,
    "url": siteUrl,
    "inLanguage": "pt-BR",
    "publisher": criarOrganizacaoSchema(),
    ...extra
  };
}

module.exports = {
  authorId,
  authorName,
  authorSameAs,
  authorUrl,
  criarOrganizacaoSchema,
  criarPessoaSchema,
  criarWebSiteSchema,
  organizationId,
  siteName,
  siteUrl,
  websiteId
};
