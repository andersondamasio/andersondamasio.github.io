const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const {
  defaultSeoImage,
  defaultPublisherLogo,
  defaultSeoImageAlt,
  defaultSeoImageWidth,
  defaultSeoImageHeight,
  getArticleStructuredImages
} = require("./seo-assets");
const { lerDimensoesImagemLocal } = require("./seo-image-dimensions");
const { gerarResourceHints } = require("./seo-resource-hints");
const { normalizarRobotsMeta } = require("./seo-robots");

const root = process.cwd();
const siteUrl = "https://www.andersondamasio.com.br";
const siteName = "Anderson Damasio";
const authorName = "Anderson Damasio";
const rssUrl = `${siteUrl}/rss.xml`;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      out.push(full);
    }
  }

  return out;
}

function rel(file) {
  return path.relative(root, file).replace(/\\/g, "/");
}

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

function slugToTitle(slug) {
  return String(slug || "")
    .replace(/\.html$/i, "")
    .split("-")
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<pre[\s\S]*?<\/pre>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\b(t[ií]tulo|resumo|introdu[cç][aã]o)\s*:/gi, " ")
    .replace(/^[-*#>\s]+/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimSeo(value, max = 160) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;

  const cut = text.slice(0, max - 3);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 90 ? lastSpace : cut.length).trim()}...`;
}

function trimSeoTitlePart(value, max = 70) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  if (max < 24) return trimSeo(text, max);

  const tailSize = Math.min(24, Math.max(14, Math.floor(max * 0.38)));
  const headSize = max - tailSize - 4;
  const head = text.slice(0, headSize).replace(/\s+\S*$/, "").trim();
  const tail = text.slice(-tailSize).replace(/^\S+\s+/, "").trim();
  const title = `${head}... ${tail}`.trim();

  return title.length <= max ? title : trimSeo(text, max);
}

function trimSeoTitle(value, max = 70) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;

  const parts = text.split(/\s+\|\s+/);
  if (parts.length > 1) {
    const suffix = ` | ${parts.slice(1).join(" | ")}`;
    const titleMax = max - suffix.length;
    if (titleMax >= 24) {
      return `${trimSeoTitlePart(parts[0], titleMax)}${suffix}`;
    }
  }

  return trimSeoTitlePart(text, max);
}

function isPlaceholderTitle(value) {
  return /^t[ií]tulo:?$/i.test(String(value || "").trim());
}

function buildPageTitle(title, category) {
  return trimSeoTitle(title, 100);
}

function buildDescription(text, title) {
  const clean = cleanText(text);
  const invalid =
    !clean ||
    clean.length < 70 ||
    /^[-–—]+$/.test(clean) ||
    /^introdu[cç][aã]o:?$/i.test(clean);

  if (invalid) {
    return trimSeo(`Artigo de Anderson Damasio sobre ${cleanText(title)}, com reflexões práticas para arquitetura de software, tecnologia e desenvolvimento.`);
  }

  return trimSeo(clean);
}

function normalizeLocalUrl(url) {
  if (!url) return "/";
  let value = String(url).trim().replace(/\\/g, "/");

  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return null;
    }
  }

  value = value.replace(/^\/+/, "");
  if (!value || value === "index.html") return "/";
  return value;
}

function absoluteUrl(url) {
  if (/^https?:\/\//i.test(url || "")) return url;
  const local = normalizeLocalUrl(url);
  if (!local || local === "/") return `${siteUrl}/`;
  return `${siteUrl}/${local}`;
}

function jsonLdScript(data) {
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/<\/script/gi, "<\\/script")}\n</script>`;
}

function breadcrumb(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": absoluteUrl(item.url)
    }))
  };
}

function buildSeoHead({ title, description, url, category, published }) {
  const pageTitle = buildPageTitle(title, category);
  const pageDescription = buildDescription(description, title);
  const pageUrl = absoluteUrl(url);
  const robotsMeta = normalizarRobotsMeta("index, follow");
  const publishedDate = published ? new Date(published) : null;
  const dateIso = publishedDate && !Number.isNaN(publishedDate.getTime())
    ? publishedDate.toISOString()
    : null;

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": title,
      "description": pageDescription,
      "image": getArticleStructuredImages(defaultSeoImage, absoluteUrl),
      "url": pageUrl,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": pageUrl
      },
      "datePublished": dateIso,
      "dateModified": dateIso,
      "articleSection": category,
      "inLanguage": "pt-BR",
      "author": {
        "@type": "Person",
        "name": authorName,
        "url": siteUrl
      },
      "publisher": {
        "@type": "Organization",
        "name": siteName,
        "logo": {
          "@type": "ImageObject",
          "url": defaultPublisherLogo
        }
      }
    },
    breadcrumb([
      { name: "Início", url: "/" },
      { name: "Artigos", url: "artigos/index.html" },
      { name: category, url: `artigos/${normalizeText(category).replace(/ /g, "-")}.html` },
      { name: title, url }
    ])
  ];

  return `<title>${escapeHtml(pageTitle)}</title>
<meta name="description" content="${escapeAttribute(pageDescription)}">
<meta name="author" content="${escapeAttribute(authorName)}">
<meta name="robots" content="${escapeAttribute(robotsMeta)}">
<link rel="canonical" href="${escapeAttribute(pageUrl)}">
<link rel="alternate" type="application/rss+xml" title="${escapeAttribute(siteName)}" href="${escapeAttribute(rssUrl)}">
${gerarResourceHints()}
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="${escapeAttribute(siteName)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeAttribute(pageTitle)}">
<meta property="og:description" content="${escapeAttribute(pageDescription)}">
<meta property="og:url" content="${escapeAttribute(pageUrl)}">
<meta property="og:image" content="${escapeAttribute(defaultSeoImage)}">
<meta property="og:image:width" content="${escapeAttribute(defaultSeoImageWidth)}">
<meta property="og:image:height" content="${escapeAttribute(defaultSeoImageHeight)}">
<meta property="og:image:alt" content="${escapeAttribute(defaultSeoImageAlt)}">
${dateIso ? `<meta property="article:published_time" content="${escapeAttribute(dateIso)}">\n<meta property="article:modified_time" content="${escapeAttribute(dateIso)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@andersondamasio">
<meta name="twitter:title" content="${escapeAttribute(pageTitle)}">
<meta name="twitter:description" content="${escapeAttribute(pageDescription)}">
<meta name="twitter:image" content="${escapeAttribute(defaultSeoImage)}">
<meta name="twitter:image:alt" content="${escapeAttribute(defaultSeoImageAlt)}">
${structuredData.map(jsonLdScript).join("\n")}`;
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
      if (/rel=["'](?:preconnect|dns-prefetch)["']/i.test(value)) continue;
      if (/application\/ld\+json/i.test(value)) continue;
      assets.push(value.trim());
    }
  }

  return [...new Set(assets)];
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

function otimizarImagemHtml(tag, { title, isFirstImage, fileRel }) {
  const $fragment = cheerio.load(tag, { decodeEntities: false }, false);
  const img = $fragment("img").first();
  const src = (img.attr("src") || "").trim();

  if (!src) return tag;

  const alt = (img.attr("alt") || "").trim();
  if (!alt || /^imagem relacionada$/i.test(alt)) {
    img.attr("alt", title || defaultSeoImageAlt);
  }

  img.attr("decoding", "async");

  const dimensions = lerDimensoesImagemLocal(src, { root, fileRel });
  if (dimensions) {
    img.attr("width", String(dimensions.width));
    img.attr("height", String(dimensions.height));
  }

  if (isFirstImage) {
    img.attr("fetchpriority", "high");
    img.removeAttr("loading");
  } else {
    img.attr("loading", "lazy");
    img.removeAttr("fetchpriority");
  }

  return $fragment.html("img");
}

function otimizarImagensArtigo(html, title, fileRel) {
  let encontrouPrimeiraImagem = false;

  return html.replace(/<img\b[^>]*>/gi, tag => {
    const isFirstImage = !encontrouPrimeiraImagem;
    const updated = otimizarImagemHtml(tag, { title, isFirstImage, fileRel });

    if (updated !== tag) {
      encontrouPrimeiraImagem = true;
    } else if (/<img\b/i.test(tag) && /\bsrc\s*=/i.test(tag)) {
      encontrouPrimeiraImagem = true;
    }

    return updated;
  });
}

function isCollectionPage($, fileRel) {
  const h1 = $("h1").first().text().trim();
  const title = $("title").first().text().trim();
  return fileRel === "artigos/index.html" ||
    /^Categoria:/i.test(h1) ||
    /^Categoria:/i.test(title) ||
    title === "Artigos";
}

function loadTitles() {
  const titlesPath = path.join(root, "titulos.json");
  if (!fs.existsSync(titlesPath)) return { byUrl: new Map(), byTitle: new Map() };

  const data = JSON.parse(fs.readFileSync(titlesPath, "utf8"));
  const byUrl = new Map();
  const byTitle = new Map();

  for (const item of Array.isArray(data) ? data : []) {
    if (item.url) byUrl.set(normalizeLocalUrl(item.url), item);
    if (item.titulo) byTitle.set(normalizeText(item.titulo), item);
  }

  return { byUrl, byTitle };
}

function inferCategory(fileRel, meta) {
  if (meta && meta.categoria) return meta.categoria;

  const parts = fileRel.split("/");
  if (parts.length > 2 && parts[0] === "artigos") return slugToTitle(parts[1]);
  return "Artigos";
}

const { byUrl, byTitle } = loadTitles();
let changed = 0;
let skipped = 0;

for (const file of walk(root)) {
  const fileRel = rel(file);
  if (!fileRel.startsWith("artigos/") && fileRel !== "artigo.html") continue;

  const html = fs.readFileSync(file, "utf8");
  if (!/<html[\s>]/i.test(html) || !/<head[\s>]/i.test(html) || !/<\/head>/i.test(html)) {
    skipped += 1;
    continue;
  }

  const $ = cheerio.load(html);
  const robots = ($('meta[name="robots" i]').attr("content") || "").trim();
  if (/noindex/i.test(robots) || $('meta[http-equiv="refresh" i]').length) continue;
  if (isCollectionPage($, fileRel)) continue;

  const h1 = $("h1").first().text().trim();
  const currentTitle = $("title").first().text().replace(/\s*\|\s*Anderson Damasio$/i, "").replace(/\s*[–-]\s*Artigo Técnico por Anderson Damasio$/i, "").trim();
  if (isPlaceholderTitle(h1) || isPlaceholderTitle(currentTitle)) continue;

  const inferredTitle = h1 || currentTitle || slugToTitle(path.basename(fileRel));
  const metaByUrl = byUrl.get(normalizeLocalUrl(fileRel));
  const metaByTitle = byTitle.get(normalizeText(inferredTitle));
  const title = metaByUrl?.titulo || inferredTitle;
  const category = inferCategory(fileRel, metaByUrl);
  const articleText = $(".article-body").text() || $("main").text() || $("body").text();
  const currentDescription = $('meta[name="description" i]').attr("content") || "";
  const descriptionSource = cleanText(articleText).length >= 70 ? articleText : currentDescription || title;
  const seo = buildSeoHead({
    title,
    description: descriptionSource,
    url: fileRel,
    category,
    published: metaByUrl?.data || metaByTitle?.data
  });

  const htmlComImagensOtimizadas = otimizarImagensArtigo(html, title, fileRel);
  const updatedHtml = htmlComImagensOtimizadas
    .replace(/<html(?![^>]*\blang=)([^>]*)>/i, '<html lang="pt-BR"$1>')
    .replace(/(<head[\s\S]*?>)([\s\S]*?)(<\/head>)/i, (_, open, head, close) => {
      return `${open}${rebuildHead(head, seo)}${close}`;
    })
    .replace(/[ \t]+$/gm, "");

  if (updatedHtml !== html) {
    fs.writeFileSync(file, updatedHtml);
    changed += 1;
  }
}

console.log(`SEO backfill aplicado em ${changed} artigos. ${skipped} arquivos HTML inválidos foram ignorados.`);
