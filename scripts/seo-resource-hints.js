const resourceHintOrigins = [
  "https://www.googletagmanager.com"
];

function gerarResourceHints() {
  return resourceHintOrigins
    .flatMap(origin => [
      `<link rel="preconnect" href="${origin}">`,
      `<link rel="dns-prefetch" href="${origin.replace(/^https?:/, "")}">`
    ])
    .join("\n");
}

function normalizarHostResourceHint(value) {
  try {
    return new URL(String(value || "").startsWith("//") ? `https:${value}` : value).host;
  } catch {
    return "";
  }
}

function hostPrecisaDeResourceHint(host) {
  return resourceHintOrigins.some(origin => normalizarHostResourceHint(origin) === host);
}

module.exports = {
  gerarResourceHints,
  hostPrecisaDeResourceHint,
  normalizarHostResourceHint,
  resourceHintOrigins
};
