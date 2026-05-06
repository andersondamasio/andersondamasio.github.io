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
  sitemapDuplicateLocs: []
};

const titles = new Map();
const descriptions = new Map();
const canonicals = new Map();

for (const file of walk(root)) {
  if (isVerificationFile(file)) continue;

  const html = fs.readFileSync(file, "utf8");
  const $ = cheerio.load(html);
  const fileRel = rel(file);
  stats.htmlFiles += 1;

  const title = ($("title").first().text() || "").trim();
  const description = ($('meta[name="description" i]').attr("content") || "").trim();
  const canonical = ($('link[rel="canonical" i]').attr("href") || "").trim();
  const h1Count = $("h1").length;
  const lang = ($("html").attr("lang") || "").trim();

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

  $("img").each((_, img) => {
    const src = ($(img).attr("src") || "").trim();
    const alt = ($(img).attr("alt") || "").trim();
    if (src && !alt) pushExample(stats.imagesWithoutAlt, `${fileRel}: ${src}`);
  });

  if (title) {
    if (!titles.has(title)) titles.set(title, []);
    titles.get(title).push(fileRel);
  }
  if (description) {
    if (!descriptions.has(description)) descriptions.set(description, []);
    descriptions.get(description).push(fileRel);
  }
  if (canonical) {
    if (!canonicals.has(canonical)) canonicals.set(canonical, []);
    canonicals.get(canonical).push(fileRel);
  }
}

const sitemapPath = path.join(root, "sitemap.xml");
if (fs.existsSync(sitemapPath)) {
  const xml = fs.readFileSync(sitemapPath, "utf8");
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
  const seen = new Map();

  for (const loc of locs) {
    seen.set(loc, (seen.get(loc) || 0) + 1);
    const localFile = localFileFromUrl(loc);
    if (!localFile || !fs.existsSync(path.join(root, localFile))) {
      pushExample(stats.sitemapMissingFiles, loc);
    }
  }

  for (const [loc, count] of seen.entries()) {
    if (count > 1) pushExample(stats.sitemapDuplicateLocs, `${loc}: ${count}`);
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
    sitemapDuplicateLocs: stats.sitemapDuplicateLocs
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
