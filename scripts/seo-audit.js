const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

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

function isVerificationFile(file) {
  return /^ezoic-[^.]+\.html$/i.test(path.basename(file));
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
  missingDescription: [],
  weakDescription: [],
  missingCanonical: [],
  invalidCanonical: [],
  missingH1: [],
  multipleH1: [],
  missingOg: [],
  missingTwitter: [],
  missingJsonLd: [],
  imagesWithoutAlt: [],
  sitemapMissingFiles: [],
  sitemapDuplicateLocs: [],
  sitemapNoindexUrls: [],
  sitemapTooLarge: [],
  missingRobotsTxt: [],
  robotsMissingSitemap: [],
  missingRssFeed: [],
  rssMissingItems: [],
  rssBrokenLinks: [],
  missingRssAlternate: [],
  brokenInternalLinks: [],
  legacyPrivacyLinks: [],
  profilePageMissingMainEntity: [],
  deepPaginationIndexable: []
};

const titles = new Map();
const descriptions = new Map();
const canonicals = new Map();
const robotsByFile = new Map();

for (const file of walk(root)) {
  if (isVerificationFile(file)) continue;

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
  const hasRssAlternate = $('link[rel="alternate" i][type="application/rss+xml" i]').length > 0;
  robotsByFile.set(fileRel, robots);

  if (!lang) pushExample(stats.missingLang, fileRel);
  if (!title) pushExample(stats.missingTitle, fileRel);
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
  if (!$('meta[property="og:title" i]').attr("content") || !$('meta[property="og:description" i]').attr("content")) {
    pushExample(stats.missingOg, fileRel);
  }
  if (!$('meta[name="twitter:card" i]').attr("content")) {
    pushExample(stats.missingTwitter, fileRel);
  }
  if (fileRel.startsWith("artigos/") && !$('script[type="application/ld+json" i]').length) {
    pushExample(stats.missingJsonLd, fileRel);
  }
  if (!noindex && !hasRssAlternate) {
    pushExample(stats.missingRssAlternate, fileRel);
  }

  $("img").each((_, img) => {
    const src = ($(img).attr("src") || "").trim();
    const alt = ($(img).attr("alt") || "").trim();
    if (src && !alt) pushExample(stats.imagesWithoutAlt, `${fileRel}: ${src}`);
  });

  $('script[type="application/ld+json" i]').each((_, script) => {
    const json = $(script).contents().text();
    for (const item of getJsonLdObjects(json)) {
      if (findProfilePageWithoutMainEntity(item).length) {
        pushExample(stats.profilePageMissingMainEntity, fileRel);
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
  const categoryPagination = /^Categoria:/i.test($("h1").first().text().trim()) || /^Categoria:/i.test(title)
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
  }
}

const sitemapPath = path.join(root, "sitemap.xml");
if (fs.existsSync(sitemapPath)) {
  const xml = fs.readFileSync(sitemapPath, "utf8");
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
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
    missingDescription: stats.missingDescription,
    weakDescription: stats.weakDescription,
    missingCanonical: stats.missingCanonical,
    invalidCanonical: stats.invalidCanonical,
    missingH1: stats.missingH1,
    multipleH1: stats.multipleH1,
    missingOg: stats.missingOg,
    missingTwitter: stats.missingTwitter,
    missingJsonLd: stats.missingJsonLd,
    imagesWithoutAlt: stats.imagesWithoutAlt,
    sitemapMissingFiles: stats.sitemapMissingFiles,
    sitemapDuplicateLocs: stats.sitemapDuplicateLocs,
    sitemapNoindexUrls: stats.sitemapNoindexUrls,
    sitemapTooLarge: stats.sitemapTooLarge,
    missingRobotsTxt: stats.missingRobotsTxt,
    robotsMissingSitemap: stats.robotsMissingSitemap,
    missingRssFeed: stats.missingRssFeed,
    rssMissingItems: stats.rssMissingItems,
    rssBrokenLinks: stats.rssBrokenLinks,
    missingRssAlternate: stats.missingRssAlternate,
    brokenInternalLinks: stats.brokenInternalLinks,
    legacyPrivacyLinks: stats.legacyPrivacyLinks,
    profilePageMissingMainEntity: stats.profilePageMissingMainEntity,
    deepPaginationIndexable: stats.deepPaginationIndexable
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
