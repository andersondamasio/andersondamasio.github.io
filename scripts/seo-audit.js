const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const {
  defaultSeoImage,
  defaultArticleImages
} = require("./seo-assets");
const { artigoTemMetadadosDeRelevancia } = require("./seo-article-metadata");
const {
  categoriasCanonicas,
  minArtigosCategoriaIndexavel,
  categoriaInvalida,
  normalizarCategoria
} = require("./seo-categories");
const {
  hostPrecisaDeResourceHint,
  normalizarHostResourceHint
} = require("./seo-resource-hints");
const { arquivoLocalImagem } = require("./seo-image-dimensions");
const { authorId, authorSameAs } = require("./seo-identity");
const { robotsTemPreviewAmplo } = require("./seo-robots");
const {
  artigoTemFonteEditorial,
  normalizarFonteUrl
} = require("./seo-source-citation");
const { avaliarSecoesConteudoUtil } = require("./seo-helpful-content");

const root = process.cwd();
const siteUrl = "https://www.andersondamasio.com.br";
const strict = process.argv.includes("--strict");
const maxExamples = 8;

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

function normalizeLocalUrl(url) {
  if (!url) return "/";

  let value = String(url).trim().replace(/\\/g, "/");
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.origin !== siteUrl) return null;
      value = parsed.pathname;
    } catch {
      return null;
    }
  }

  value = value.replace(/^\/+/, "");
  if (!value || value === "index.html") return "/";
  return decodeURIComponent(value);
}

function localFileFromUrl(url) {
  const local = normalizeLocalUrl(url);
  if (!local) return null;
  return local === "/" ? "index.html" : local;
}

function localFileFromHref(href, fileRel) {
  if (!href) return null;

  let value = String(href).trim();
  if (!value || value.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(value)) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.origin !== siteUrl) return null;
      value = `${parsed.pathname}${parsed.search || ""}${parsed.hash || ""}`;
    } catch {
      return null;
    }
  }

  value = value.split("#")[0].split("?")[0];
  if (!value) return null;

  let local;
  if (value.startsWith("/")) {
    local = value.replace(/^\/+/, "");
  } else {
    const base = path.posix.dirname(fileRel);
    local = path.posix.normalize(path.posix.join(base === "." ? "" : base, value));
  }

  try {
    local = decodeURIComponent(local);
  } catch {
    // Mantém o valor original quando a URL não puder ser decodificada.
  }

  local = local.replace(/^\/+/, "").replace(/^\.\//, "");
  if (!local || local === "index.html") return "index.html";
  if (local.endsWith("/")) return `${local}index.html`;
  return local;
}

function getJsonLdObjects(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function jsonLdTypeIncludes(value, type) {
  const current = value && value["@type"];
  return Array.isArray(current) ? current.includes(type) : current === type;
}

function collectJsonLdImageUrls(value, out = []) {
  if (!value) return out;

  if (typeof value === "string") {
    out.push(value);
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach(item => collectJsonLdImageUrls(item, out));
    return out;
  }

  if (typeof value === "object") {
    collectJsonLdImageUrls(value.url, out);
    collectJsonLdImageUrls(value.contentUrl, out);
  }

  return out;
}

function getCategoryNameFromPage($, title) {
  const h1 = $("h1").first().text().trim();
  const source = /^Categoria:/i.test(h1)
    ? h1
    : /^Categoria:/i.test(title)
      ? title
      : "";

  if (!source) return null;

  return source
    .replace(/^Categoria:\s*/i, "")
    .replace(/\s+-\s+P[aá]gina\s+\d+.*$/i, "")
    .replace(/\s*\|\s*.*$/i, "")
    .trim();
}

function isInvalidCategoryName(name) {
  const clean = String(name || "").trim();
  return categoriaInvalida(clean, clean);
}

function slugifyCategory(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function decodeUrlPath(value) {
  return String(value || "").split("/").map(part => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  }).join("/");
}

function nonCanonicalArticleCategoryPath(fileRel, title = "") {
  const local = decodeUrlPath(normalizeLocalUrl(fileRel) || "");
  const match = local.match(/^artigos\/([^/]+)\/[^/]+\.html$/i);
  if (!match) return null;

  const categorySlug = match[1];
  const expectedSlug = slugifyCategory(normalizarCategoria(categorySlug, title));
  const knownSlug = categoriasCanonicas.some(categoria => slugifyCategory(categoria) === expectedSlug);

  if (!knownSlug || categorySlug !== expectedSlug) {
    return { categorySlug, expectedSlug };
  }

  return null;
}

function cleanPageTitleForAudit(title) {
  return String(title || "")
    .replace(/\s*\|\s*.*$/i, "")
    .replace(/\s*[–-]\s*Artigo Técnico por Anderson Damasio$/i, "")
    .trim();
}

function isWeakArticleTitle(title) {
  const clean = String(title || "").replace(/\s+/g, " ").trim();
  const normalized = clean
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return !clean ||
    /^#{1,6}\s+/.test(clean) ||
    /^(novo\s+)?titulo(\s+provocativo)?\s*[:：*-]/i.test(clean) ||
    /^introducao\s*[:：-]/i.test(normalized) ||
    /^conteudo editorial\s*[:：-]?$/i.test(normalized) ||
    /^voltar ao topo$/i.test(normalized) ||
    /^e fascinante como/i.test(normalized) ||
    /evoluiu nos ultimos anos, mas os erros continuam parecidos/i.test(normalized);
}

function findProfilePageWithoutMainEntity(value, out = []) {
  if (!value || typeof value !== "object") return out;

  if (jsonLdTypeIncludes(value, "ProfilePage") && !value.mainEntity) {
    out.push(value);
  }

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      child.forEach(item => findProfilePageWithoutMainEntity(item, out));
    } else if (child && typeof child === "object") {
      findProfilePageWithoutMainEntity(child, out);
    }
  }

  return out;
}

function authorHasLinkedIdentity(author) {
  const authors = Array.isArray(author) ? author : [author];
  return authors.some(item => {
    if (!item || typeof item !== "object") return false;
    const sameAs = Array.isArray(item.sameAs) ? item.sameAs : [];
    return item["@id"] === authorId && authorSameAs.every(url => sameAs.includes(url));
  });
}

function pushExample(bucket, value) {
  if (bucket.length < maxExamples) bucket.push(value);
}

function summarizeDuplicates(map) {
  return [...map.entries()]
    .filter(([, files]) => files.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxExamples)
    .map(([value, files]) => ({
      count: files.length,
      value: value.slice(0, 120),
      examples: files.slice(0, 4)
    }));
}

const stats = {
  htmlFiles: 0,
  missingLang: [],
  missingTitle: [],
  overlongTitle: [],
  missingDescription: [],
  weakDescription: [],
  missingCanonical: [],
  invalidCanonical: [],
  missingH1: [],
  multipleH1: [],
  missingOg: [],
  missingOgImageDetails: [],
  missingTwitter: [],
  robotsMissingPreviewDirectives: [],
  missingResourceHints: [],
  missingJsonLd: [],
  articleJsonLdMissingImageVariants: [],
  articleAuthorMissingLinkedIdentity: [],
  articleJsonLdMissingRelevanceMetadata: [],
  articleMissingSourceCitation: [],
  articleMalformedSourceCitation: [],
  articleMissingValidationSection: [],
  articleMissingUsefulnessSection: [],
  malformedArticleHtml: [],
  articleBodyUnsafeHtml: [],
  imagesWithoutAlt: [],
  imagesWithoutAsyncDecoding: [],
  imagesWithoutDimensions: [],
  articleFirstImageWithoutHighPriority: [],
  articleImagesWithoutLazyLoading: [],
  sitemapMissingFiles: [],
  sitemapDuplicateLocs: [],
  sitemapNoindexUrls: [],
  indexableMissingFromSitemap: [],
  sitemapTooLarge: [],
  missingRobotsTxt: [],
  robotsMissingSitemap: [],
  missingRssFeed: [],
  rssMissingItems: [],
  rssBrokenLinks: [],
  missingRssAlternate: [],
  missingRelatedArticles: [],
  brokenInternalLinks: [],
  legacyPrivacyLinks: [],
  profilePageMissingMainEntity: [],
  deepPaginationIndexable: [],
  invalidCategoryPages: [],
  thinCategoryPagesIndexable: [],
  weakArticleTitles: [],
  weakSourceTitles: [],
  nonCanonicalArticleCategoryPaths: [],
  nonCanonicalSourceArticleUrls: [],
  generatorQualityPromptIssues: []
};

const titles = new Map();
const descriptions = new Map();
const canonicals = new Map();
const robotsByFile = new Map();
const indexableCanonicalByFile = new Map();
const sourceByFile = new Map();

const generatorPath = path.join(root, "gerar-conteudo.js");
if (fs.existsSync(generatorPath)) {
  const generatorSource = fs.readFileSync(generatorPath, "utf8");
  const qualityPromptPatterns = [
    { label: "prompt pede erros ortográficos", pattern: /(?:inserir|possua|cometer|escreva\s+com)[\s\S]{0,80}erros?\s+(?:ortogr[aá]ficos?|de\s+ortografia)/i },
    { label: "prompt exige erros como condição", pattern: /se\s+n[aã]o\s+conseguir[\s\S]{0,80}erros?\s+(?:ortogr[aá]ficos?|de\s+ortografia)/i },
    { label: "módulo antigo de erros ortográficos importado", pattern: /selecionar-errorsMaps|inserirErrosOrtograficos|errosUsadosPath/i }
  ];

  for (const item of qualityPromptPatterns) {
    if (item.pattern.test(generatorSource)) {
      pushExample(stats.generatorQualityPromptIssues, item.label);
    }
  }
}

const sourceTitlesPath = path.join(root, "titulos.json");
if (fs.existsSync(sourceTitlesPath)) {
  const sourceTitles = JSON.parse(fs.readFileSync(sourceTitlesPath, "utf8"));
  if (Array.isArray(sourceTitles)) {
    sourceTitles.forEach((item, index) => {
      if (isWeakArticleTitle(item?.titulo)) {
        pushExample(stats.weakSourceTitles, `${index}: ${item?.url || item?.noticiaOriginal || "(sem referencia)"} -> ${item?.titulo || "(sem titulo)"}`);
      }
      const nonCanonicalPath = nonCanonicalArticleCategoryPath(item?.url, item?.titulo);
      if (nonCanonicalPath) {
        pushExample(stats.nonCanonicalSourceArticleUrls, `${index}: ${item?.url} -> ${nonCanonicalPath.expectedSlug}`);
      }
      const sourceUrl = normalizarFonteUrl(item?.urlFonte);
      const local = normalizeLocalUrl(item?.url);
      if (sourceUrl && local) {
        sourceByFile.set(local, {
          sourceUrl,
          sourceTitle: item?.noticiaOriginal || item?.titulo || "Fonte original"
        });
      }
    });
  }
}

for (const file of walk(root)) {
  const html = fs.readFileSync(file, "utf8");
  const $ = cheerio.load(html);
  const fileRel = rel(file);
  stats.htmlFiles += 1;

  const title = ($("title").first().text() || "").trim();
  const description = ($('meta[name="description" i]').attr("content") || "").trim();
  const canonical = ($('link[rel="canonical" i]').attr("href") || "").trim();
  const robots = ($('meta[name="robots" i]').attr("content") || "").trim();
  const noindex = /noindex/i.test(robots);
  const h1Count = $("h1").length;
  const lang = ($("html").attr("lang") || "").trim();
  const ogImage = ($('meta[property="og:image" i]').attr("content") || "").trim();
  const ogImageWidth = ($('meta[property="og:image:width" i]').attr("content") || "").trim();
  const ogImageHeight = ($('meta[property="og:image:height" i]').attr("content") || "").trim();
  const ogImageAlt = ($('meta[property="og:image:alt" i]').attr("content") || "").trim();
  const twitterImage = ($('meta[name="twitter:image" i]').attr("content") || "").trim();
  const twitterImageAlt = ($('meta[name="twitter:image:alt" i]').attr("content") || "").trim();
  const hasRssAlternate = $('link[rel="alternate" i][type="application/rss+xml" i]').length > 0;
  const hintedHosts = new Set();
  $('link[rel="preconnect" i], link[rel="dns-prefetch" i]').each((_, link) => {
    const host = normalizarHostResourceHint(($(link).attr("href") || "").trim());
    if (host) hintedHosts.add(host);
  });
  const relatedLinks = (html.match(/<section\s+class=["'][^"']*\brelated-articles\b[\s\S]*?<\/section>/i)?.[0].match(/<a\s+[^>]*href=/gi) || []).length;
  const categoryName = getCategoryNameFromPage($, title);
  const isCategoryPage = Boolean(categoryName);
  const isArticleContentPage = fileRel.startsWith("artigos/") &&
    fileRel !== "artigos/index.html" &&
    !isCategoryPage &&
    !/^Artigos por categoria/i.test(title);
  robotsByFile.set(fileRel, robots);

  if (!lang) pushExample(stats.missingLang, fileRel);
  if (!title) pushExample(stats.missingTitle, fileRel);
  if (!noindex && title.length > 100) pushExample(stats.overlongTitle, `${fileRel}: ${title.length} caracteres`);
  if (!description) pushExample(stats.missingDescription, fileRel);
  if (description && (description.length < 70 || /^[-–—]+$/.test(description) || /^introdu[cç][aã]o:?$/i.test(description))) {
    pushExample(stats.weakDescription, `${fileRel}: ${description}`);
  }
  if (!canonical) {
    pushExample(stats.missingCanonical, fileRel);
  } else {
    const localCanonical = normalizeLocalUrl(canonical);
    if (!localCanonical) {
      pushExample(stats.invalidCanonical, `${fileRel}: ${canonical}`);
    } else {
      const canonicalFile = path.join(root, localFileFromUrl(localCanonical));
      if (!fs.existsSync(canonicalFile)) {
        pushExample(stats.invalidCanonical, `${fileRel}: ${canonical}`);
      }
    }
  }
  if (h1Count === 0) pushExample(stats.missingH1, fileRel);
  if (h1Count > 1) pushExample(stats.multipleH1, `${fileRel}: ${h1Count}`);
  if (!$('meta[property="og:title" i]').attr("content") || !$('meta[property="og:description" i]').attr("content") || !ogImage) {
    pushExample(stats.missingOg, fileRel);
  }
  if (!noindex && ogImage === defaultSeoImage && (!ogImageWidth || !ogImageHeight || !ogImageAlt || !twitterImageAlt)) {
    pushExample(stats.missingOgImageDetails, fileRel);
  }
  if (!$('meta[name="twitter:card" i]').attr("content") || !twitterImage) {
    pushExample(stats.missingTwitter, fileRel);
  }
  if (!noindex && !robotsTemPreviewAmplo(robots)) {
    pushExample(stats.robotsMissingPreviewDirectives, `${fileRel}: ${robots || "(sem robots)"}`);
  }
  $("script[src]").each((_, script) => {
    const host = normalizarHostResourceHint(($(script).attr("src") || "").trim());
    if (hostPrecisaDeResourceHint(host) && !hintedHosts.has(host)) {
      pushExample(stats.missingResourceHints, `${fileRel}: ${host}`);
    }
  });
  if (fileRel.startsWith("artigos/") && !$('script[type="application/ld+json" i]').length) {
    pushExample(stats.missingJsonLd, fileRel);
  }
  if (!noindex && !hasRssAlternate) {
    pushExample(stats.missingRssAlternate, fileRel);
  }
  if (!noindex && isArticleContentPage && relatedLinks < 2) {
    pushExample(stats.missingRelatedArticles, fileRel);
  }
  const expectedSource = sourceByFile.get(fileRel);
  if (!noindex && expectedSource) {
    const sourceAnchors = $(".article-source a[href]").toArray();
    if (sourceAnchors.some(link => $(link).children().length > 0)) {
      pushExample(stats.articleMalformedSourceCitation, `${fileRel}: link de fonte contem HTML interno`);
    }
    const hasVisibleSource = $("a[href]").toArray().some(link => {
      return normalizarFonteUrl($(link).attr("href")) === expectedSource.sourceUrl;
    });
    if (!hasVisibleSource) {
      pushExample(stats.articleMissingSourceCitation, `${fileRel}: link visivel ausente`);
    }
  }
  if (!noindex && isArticleContentPage) {
    if (/<p>\s*<\/div>|<\/div>\s*<\/p>/i.test(html)) {
      pushExample(stats.malformedArticleHtml, fileRel);
    }
    const articleBodyHtml = html.match(/<div\s+class=["'][^"']*\barticle-body\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
    if (/<\/?script\b/i.test(articleBodyHtml)) {
      pushExample(stats.articleBodyUnsafeHtml, fileRel);
    }
    const articleTitle = $("h1").first().text().trim() || cleanPageTitleForAudit(title);
    if (isWeakArticleTitle(articleTitle)) {
      pushExample(stats.weakArticleTitles, `${fileRel}: ${articleTitle || "(sem titulo)"}`);
    }
    const helpfulContent = avaliarSecoesConteudoUtil($);
    if (!helpfulContent.validationOk) {
      pushExample(stats.articleMissingValidationSection, fileRel);
    }
    if (!helpfulContent.usefulnessOk) {
      pushExample(stats.articleMissingUsefulnessSection, fileRel);
    }
    const nonCanonicalPath = nonCanonicalArticleCategoryPath(fileRel, articleTitle);
    if (nonCanonicalPath) {
      pushExample(stats.nonCanonicalArticleCategoryPaths, `${fileRel}: ${nonCanonicalPath.categorySlug} -> ${nonCanonicalPath.expectedSlug}`);
    }
  }
  if (!noindex && isCategoryPage && isInvalidCategoryName(categoryName)) {
    pushExample(stats.invalidCategoryPages, `${fileRel}: ${categoryName || "(sem categoria)"}`);
  }
  if (!noindex && isCategoryPage && /^artigos\/[^/]+\.html$/i.test(fileRel)) {
    const articleLinks = $("main li a[href]").length;
    if (articleLinks < minArtigosCategoriaIndexavel) {
      pushExample(stats.thinCategoryPagesIndexable, `${fileRel}: ${articleLinks} links`);
    }
  }

  const pageImages = $("img[src]").toArray();
  pageImages.forEach((img, index) => {
    const src = ($(img).attr("src") || "").trim();
    const alt = ($(img).attr("alt") || "").trim();
    const width = ($(img).attr("width") || "").trim();
    const height = ($(img).attr("height") || "").trim();
    if (src && !alt) pushExample(stats.imagesWithoutAlt, `${fileRel}: ${src}`);
    if (src && ($(img).attr("decoding") || "").trim().toLowerCase() !== "async") {
      pushExample(stats.imagesWithoutAsyncDecoding, `${fileRel}: ${src}`);
    }
    if (src && arquivoLocalImagem(src, { root, fileRel }) && (!width || !height)) {
      pushExample(stats.imagesWithoutDimensions, `${fileRel}: ${src}`);
    }

    if (!noindex && isArticleContentPage) {
      const fetchPriority = ($(img).attr("fetchpriority") || "").trim().toLowerCase();
      const loading = ($(img).attr("loading") || "").trim().toLowerCase();

      if (index === 0 && fetchPriority !== "high") {
        pushExample(stats.articleFirstImageWithoutHighPriority, `${fileRel}: ${src}`);
      }

      if (index > 0 && loading !== "lazy") {
        pushExample(stats.articleImagesWithoutLazyLoading, `${fileRel}: ${src}`);
      }
    }
  });

  $('script[type="application/ld+json" i]').each((_, script) => {
    const json = $(script).contents().text();
    for (const item of getJsonLdObjects(json)) {
      if (findProfilePageWithoutMainEntity(item).length) {
        pushExample(stats.profilePageMissingMainEntity, fileRel);
      }

      if (!noindex && jsonLdTypeIncludes(item, "BlogPosting")) {
        const imageUrls = collectJsonLdImageUrls(item.image);
        const hasAllDefaultVariants = defaultArticleImages.every(image => imageUrls.includes(image));
        if (!hasAllDefaultVariants) {
          pushExample(stats.articleJsonLdMissingImageVariants, fileRel);
        }
        if (!authorHasLinkedIdentity(item.author)) {
          pushExample(stats.articleAuthorMissingLinkedIdentity, fileRel);
        }
        if (!artigoTemMetadadosDeRelevancia(item)) {
          pushExample(stats.articleJsonLdMissingRelevanceMetadata, fileRel);
        }
        const expectedSource = sourceByFile.get(fileRel);
        if (expectedSource && !artigoTemFonteEditorial(item, expectedSource.sourceUrl)) {
          pushExample(stats.articleMissingSourceCitation, `${fileRel}: JSON-LD sem fonte`);
        }
      }
    }
  });

  $("a[href]").each((_, anchor) => {
    const href = ($(anchor).attr("href") || "").trim();
    if (/politica-de-privacidade\.html/i.test(href)) {
      pushExample(stats.legacyPrivacyLinks, `${fileRel}: ${href}`);
    }

    const target = localFileFromHref(href, fileRel);
    if (!target) return;

    if (!fs.existsSync(path.join(root, target))) {
      pushExample(stats.brokenInternalLinks, `${fileRel}: ${href} -> ${target}`);
    }
  });

  const rootPagination = fileRel.match(/^index(\d+)\.html$/i);
  const categoryPagination = isCategoryPage
    ? fileRel.match(/^artigos\/[^/]+(\d+)\.html$/i)
    : null;
  const pageNumber = rootPagination
    ? Number(rootPagination[1])
    : categoryPagination
      ? Number(categoryPagination[1])
      : null;

  if (pageNumber && pageNumber > 3 && !noindex) {
    pushExample(stats.deepPaginationIndexable, fileRel);
  }

  if (title && !noindex) {
    if (!titles.has(title)) titles.set(title, []);
    titles.get(title).push(fileRel);
  }
  if (description && !noindex) {
    if (!descriptions.has(description)) descriptions.set(description, []);
    descriptions.get(description).push(fileRel);
  }
  if (canonical && !noindex) {
    if (!canonicals.has(canonical)) canonicals.set(canonical, []);
    canonicals.get(canonical).push(fileRel);
    indexableCanonicalByFile.set(fileRel, canonical);
  }
}

const sitemapPath = path.join(root, "sitemap.xml");
let sitemapLocs = new Set();
if (fs.existsSync(sitemapPath)) {
  const xml = fs.readFileSync(sitemapPath, "utf8");
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  sitemapLocs = new Set(locs);
  const seen = new Map();

  if (locs.length > 50000 || Buffer.byteLength(xml, "utf8") > 50 * 1024 * 1024) {
    pushExample(stats.sitemapTooLarge, `urls=${locs.length}; bytes=${Buffer.byteLength(xml, "utf8")}`);
  }

  for (const loc of locs) {
    seen.set(loc, (seen.get(loc) || 0) + 1);
    const localFile = localFileFromUrl(loc);
    if (!localFile || !fs.existsSync(path.join(root, localFile))) {
      pushExample(stats.sitemapMissingFiles, loc);
    } else {
      const localRel = localFile.replace(/\\/g, "/");
      const robots = robotsByFile.get(localRel) || "";
      if (/noindex/i.test(robots)) {
        pushExample(stats.sitemapNoindexUrls, loc);
      }
    }
  }

  for (const [loc, count] of seen.entries()) {
    if (count > 1) pushExample(stats.sitemapDuplicateLocs, `${loc}: ${count}`);
  }
} else {
  pushExample(stats.sitemapMissingFiles, "sitemap.xml");
}

if (sitemapLocs.size) {
  for (const [fileRel, canonical] of indexableCanonicalByFile.entries()) {
    if (!sitemapLocs.has(canonical)) {
      pushExample(stats.indexableMissingFromSitemap, `${fileRel}: ${canonical}`);
    }
  }
}

const robotsPath = path.join(root, "robots.txt");
if (!fs.existsSync(robotsPath)) {
  pushExample(stats.missingRobotsTxt, "robots.txt");
} else {
  const robots = fs.readFileSync(robotsPath, "utf8");
  const expectedSitemap = `${siteUrl}/sitemap.xml`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`^\\s*Sitemap:\\s*${expectedSitemap}\\s*$`, "im").test(robots)) {
    pushExample(stats.robotsMissingSitemap, "robots.txt");
  }
}

const rssPath = path.join(root, "rss.xml");
if (!fs.existsSync(rssPath)) {
  pushExample(stats.missingRssFeed, "rss.xml");
} else {
  const rss = fs.readFileSync(rssPath, "utf8");
  const items = [...rss.matchAll(/<item>[\s\S]*?<\/item>/gi)].map(match => match[0]);

  if (!/<rss\b/i.test(rss) || !/<channel\b/i.test(rss) || items.length === 0) {
    pushExample(stats.rssMissingItems, "rss.xml");
  }

  for (const item of items.slice(0, 100)) {
    const link = item.match(/<link>(.*?)<\/link>/i)?.[1];
    const localFile = link && localFileFromUrl(link);

    if (!localFile || !fs.existsSync(path.join(root, localFile))) {
      pushExample(stats.rssBrokenLinks, link || "(sem link)");
      continue;
    }

    const localRel = localFile.replace(/\\/g, "/");
    const robots = robotsByFile.get(localRel) || "";
    if (/noindex/i.test(robots)) {
      pushExample(stats.rssBrokenLinks, `${link} -> noindex`);
    }
  }
}

const report = {
  htmlFiles: stats.htmlFiles,
  issues: {
    missingLang: stats.missingLang,
    missingTitle: stats.missingTitle,
    overlongTitle: stats.overlongTitle,
    missingDescription: stats.missingDescription,
    weakDescription: stats.weakDescription,
    missingCanonical: stats.missingCanonical,
    invalidCanonical: stats.invalidCanonical,
    missingH1: stats.missingH1,
    multipleH1: stats.multipleH1,
    missingOg: stats.missingOg,
    missingOgImageDetails: stats.missingOgImageDetails,
    missingTwitter: stats.missingTwitter,
    robotsMissingPreviewDirectives: stats.robotsMissingPreviewDirectives,
    missingResourceHints: stats.missingResourceHints,
    missingJsonLd: stats.missingJsonLd,
    articleJsonLdMissingImageVariants: stats.articleJsonLdMissingImageVariants,
    articleAuthorMissingLinkedIdentity: stats.articleAuthorMissingLinkedIdentity,
    articleJsonLdMissingRelevanceMetadata: stats.articleJsonLdMissingRelevanceMetadata,
    articleMissingSourceCitation: stats.articleMissingSourceCitation,
    articleMalformedSourceCitation: stats.articleMalformedSourceCitation,
    articleMissingValidationSection: stats.articleMissingValidationSection,
    articleMissingUsefulnessSection: stats.articleMissingUsefulnessSection,
    malformedArticleHtml: stats.malformedArticleHtml,
    articleBodyUnsafeHtml: stats.articleBodyUnsafeHtml,
    imagesWithoutAlt: stats.imagesWithoutAlt,
    imagesWithoutAsyncDecoding: stats.imagesWithoutAsyncDecoding,
    imagesWithoutDimensions: stats.imagesWithoutDimensions,
    articleFirstImageWithoutHighPriority: stats.articleFirstImageWithoutHighPriority,
    articleImagesWithoutLazyLoading: stats.articleImagesWithoutLazyLoading,
    sitemapMissingFiles: stats.sitemapMissingFiles,
    sitemapDuplicateLocs: stats.sitemapDuplicateLocs,
    sitemapNoindexUrls: stats.sitemapNoindexUrls,
    indexableMissingFromSitemap: stats.indexableMissingFromSitemap,
    sitemapTooLarge: stats.sitemapTooLarge,
    missingRobotsTxt: stats.missingRobotsTxt,
    robotsMissingSitemap: stats.robotsMissingSitemap,
    missingRssFeed: stats.missingRssFeed,
    rssMissingItems: stats.rssMissingItems,
    rssBrokenLinks: stats.rssBrokenLinks,
    missingRssAlternate: stats.missingRssAlternate,
    missingRelatedArticles: stats.missingRelatedArticles,
    brokenInternalLinks: stats.brokenInternalLinks,
    legacyPrivacyLinks: stats.legacyPrivacyLinks,
    profilePageMissingMainEntity: stats.profilePageMissingMainEntity,
    deepPaginationIndexable: stats.deepPaginationIndexable,
    invalidCategoryPages: stats.invalidCategoryPages,
    thinCategoryPagesIndexable: stats.thinCategoryPagesIndexable,
    weakArticleTitles: stats.weakArticleTitles,
    weakSourceTitles: stats.weakSourceTitles,
    nonCanonicalArticleCategoryPaths: stats.nonCanonicalArticleCategoryPaths,
    nonCanonicalSourceArticleUrls: stats.nonCanonicalSourceArticleUrls,
    generatorQualityPromptIssues: stats.generatorQualityPromptIssues
  },
  duplicates: {
    titles: summarizeDuplicates(titles),
    descriptions: summarizeDuplicates(descriptions),
    canonicals: summarizeDuplicates(canonicals)
  }
};

console.log(JSON.stringify(report, null, 2));

const issueCount = Object.values(report.issues).reduce((sum, list) => sum + list.length, 0);
const duplicateCount = Object.values(report.duplicates).reduce((sum, list) => sum + list.length, 0);

if (strict && (issueCount > 0 || duplicateCount > 0)) {
  process.exitCode = 1;
}
