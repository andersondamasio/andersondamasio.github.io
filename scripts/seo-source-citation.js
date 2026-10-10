function normalizarFonteUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(String(url).trim());
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    parsed.hash = "";
    return parsed.href;
  } catch {
    return null;
  }
}

function limparTituloFonte(title) {
  return String(title || "")
    .replace(/\s+/g, " ")
    .trim();
}

// Chave de triagem; nunca substitui a URL citada ou uma canonical publicada.
function normalizarUrlComparacaoFonte(url) {
  const normalizada = normalizarFonteUrl(url);
  if (!normalizada) return null;
  const parsed = new URL(normalizada);
  if (parsed.username || parsed.password) return null;
  for (const key of [...parsed.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|at_medium$|at_campaign$|cmpid$|guccounter$)/i.test(key)) {
      parsed.searchParams.delete(key);
    }
  }
  // Uniformiza a codificacao mesmo quando nao havia rastreamento para remover.
  parsed.search = parsed.searchParams.toString();
  // Uma barra no fim de um valor de query faz parte desse valor, nao do caminho.
  return parsed.search ? parsed.href : parsed.href.replace(/\/$/, "");
}

function criarFonteSchema({ sourceUrl, sourceTitle }) {
  const url = normalizarFonteUrl(sourceUrl);
  if (!url) return null;

  return {
    "@type": "CreativeWork",
    "name": limparTituloFonte(sourceTitle) || "Fonte original",
    "url": url
  };
}

function coletarUrls(value, out = []) {
  if (!value) return out;

  if (typeof value === "string") {
    const url = normalizarFonteUrl(value);
    if (url) out.push(url);
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach(item => coletarUrls(item, out));
    return out;
  }

  if (typeof value === "object") {
    if (value.url) coletarUrls(value.url, out);
    if (value["@id"]) coletarUrls(value["@id"], out);
    Object.entries(value).forEach(([key, item]) => {
      if (key !== "url" && key !== "@id") coletarUrls(item, out);
    });
  }

  return out;
}

function valorTemFonte(value, expectedSourceUrl) {
  const expected = normalizarFonteUrl(expectedSourceUrl);
  if (!expected) return true;
  return coletarUrls(value).includes(expected);
}

function artigoTemFonteEditorial(item, expectedSourceUrl) {
  const expected = normalizarFonteUrl(expectedSourceUrl);
  if (!expected) return true;

  return valorTemFonte(item?.citation, expected) &&
    valorTemFonte(item?.isBasedOn, expected);
}

module.exports = {
  artigoTemFonteEditorial,
  criarFonteSchema,
  normalizarFonteUrl,
  normalizarUrlComparacaoFonte
};
