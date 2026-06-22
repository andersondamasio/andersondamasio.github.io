const fs = require("fs");
const path = require("path");
const {
  defaultSeoImage,
  defaultSeoImageAlt,
  defaultSeoImageWidth,
  defaultSeoImageHeight
} = require("./seo-assets");

const root = process.cwd();
const siteUrl = "https://www.andersondamasio.com.br";
const siteName = "Anderson Damasio";
const rssUrl = `${siteUrl}/rss.xml`;
const anoInicioExperiencia = 2005;
const anosExperiencia = new Date().getFullYear() - anoInicioExperiencia;
const textoAnosExperiencia = `mais de ${anosExperiencia} anos`;

const pages = [
  {
    file: "artigo.html",
    title: "Modelo de Artigo | Anderson Damasio",
    description: "Modelo interno de artigo do site Anderson Damasio, mantido fora da indexação pública.",
    robots: "noindex, follow"
  },
  {
    file: "sobre.html",
    title: "Sobre Anderson Damasio | Anderson Damasio",
    description: `Conheça Anderson Damasio, arquiteto de software com ${textoAnosExperiencia} de experiência em sistemas escaláveis e tecnologia.`,
    robots: "index, follow"
  },
  {
    file: "contato.html",
    title: "Contato | Anderson Damasio",
    description: "Entre em contato com Anderson Damasio para conversas sobre arquitetura de software, desenvolvimento e tecnologia.",
    robots: "index, follow"
  },
  {
    file: "termos.html",
    title: "Termos de Uso | Anderson Damasio",
    description: "Termos de uso do site Anderson Damasio, com orientações sobre acesso, conteúdo, responsabilidades e condições de navegação.",
    robots: "index, follow"
  },
  {
    file: "politica.html",
    title: "Política de Privacidade | Anderson Damasio",
    description: "Política de privacidade do site Anderson Damasio, com informações sobre cookies, dados pessoais e proteção de privacidade.",
    robots: "index, follow"
  },
  {
    file: "obrigado.html",
    title: "Mensagem Enviada | Anderson Damasio",
    description: "Confirmação de envio de mensagem pelo formulário de contato do site Anderson Damasio.",
    robots: "noindex, follow"
  },
  {
    file: "beijaoupassa/politica-de-privacidade.html",
    title: "Política de Privacidade - Beija ou Passa",
    description: "Política de privacidade do Orkut Beija ou Passa, com informações sobre coleta, uso, armazenamento e proteção de dados pessoais.",
    robots: "index, follow"
  }
];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function absoluteUrl(file) {
  return `${siteUrl}/${file.replace(/\\/g, "/")}`;
}

function jsonLdScript(data) {
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/<\/script/gi, "<\\/script")}\n</script>`;
}

function collectHeadAssets(head) {
  const assets = [];
  const patterns = [
    /<link\s+[^>]*>/gi,
    /<style\b[\s\S]*?<\/style>/gi,
    /<script\b[\s\S]*?<\/script>/gi
  ];

  for (const pattern of patterns) {
    for (const match of head.matchAll(pattern)) {
      const value = match[0];
      if (/rel=["']canonical["']/i.test(value)) continue;
      if (/rel=["']alternate["']/i.test(value) && /application\/rss\+xml/i.test(value)) continue;
      if (/application\/ld\+json/i.test(value)) continue;
      assets.push(value.trim());
    }
  }

  return [...new Set(assets)];
}

function buildSeo(page) {
  const url = absoluteUrl(page.file);
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": page.title,
    "description": page.description,
    "url": url,
    "isPartOf": {
      "@type": "WebSite",
      "name": siteName,
      "url": siteUrl
    }
  };

  return `<title>${escapeHtml(page.title)}</title>
<meta name="description" content="${escapeAttribute(page.description)}">
<meta name="author" content="${escapeAttribute(siteName)}">
<meta name="robots" content="${escapeAttribute(page.robots)}">
<link rel="canonical" href="${escapeAttribute(url)}">
<link rel="alternate" type="application/rss+xml" title="${escapeAttribute(siteName)}" href="${escapeAttribute(rssUrl)}">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="${escapeAttribute(siteName)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeAttribute(page.title)}">
<meta property="og:description" content="${escapeAttribute(page.description)}">
<meta property="og:url" content="${escapeAttribute(url)}">
<meta property="og:image" content="${escapeAttribute(defaultSeoImage)}">
<meta property="og:image:width" content="${escapeAttribute(defaultSeoImageWidth)}">
<meta property="og:image:height" content="${escapeAttribute(defaultSeoImageHeight)}">
<meta property="og:image:alt" content="${escapeAttribute(defaultSeoImageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@andersondamasio">
<meta name="twitter:title" content="${escapeAttribute(page.title)}">
<meta name="twitter:description" content="${escapeAttribute(page.description)}">
<meta name="twitter:image" content="${escapeAttribute(defaultSeoImage)}">
<meta name="twitter:image:alt" content="${escapeAttribute(defaultSeoImageAlt)}">
${jsonLdScript(data)}`;
}

function rebuildHead(head, seo) {
  const assets = collectHeadAssets(head).join("\n");
  return `
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
${seo}
${assets}
`.replace(/[ \t]+$/gm, "");
}

let changed = 0;

for (const page of pages) {
  const file = path.join(root, page.file);
  if (!fs.existsSync(file)) continue;

  const html = fs.readFileSync(file, "utf8");
  if (!/<head[\s\S]*?>[\s\S]*?<\/head>/i.test(html)) continue;

  const seo = buildSeo(page);
  const updated = html
    .replace(/<html(?![^>]*\blang=)([^>]*)>/i, '<html lang="pt-BR"$1>')
    .replace(/<html([^>]*)lang=["']pt-br["']([^>]*)>/i, '<html$1lang="pt-BR"$2>')
    .replace(/(<head[\s\S]*?>)([\s\S]*?)(<\/head>)/i, (_, open, head, close) => {
      return `${open}${rebuildHead(head, seo)}${close}`;
    })
    .replace(/[ \t]+$/gm, "");

  if (updated !== html) {
    fs.writeFileSync(file, updated);
    changed += 1;
  }
}

console.log(`SEO aplicado em ${changed} páginas estáticas.`);
