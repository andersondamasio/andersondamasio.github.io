const fs = require('fs');
const path = require('path');

function listarHtmls(dir) {
  let arquivosHtml = [];

  const itens = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of itens) {
    const caminhoCompleto = path.join(dir, item.name);

    if (item.isDirectory()) {
      arquivosHtml = arquivosHtml.concat(listarHtmls(caminhoCompleto));
    } else if (item.isFile() && caminhoCompleto.endsWith('.html')) {
      arquivosHtml.push(caminhoCompleto);
    }
  }

  return arquivosHtml;
}

const HEAD_SCRIPT = `<script async custom-element="amp-auto-ads"
src="https://cdn.ampproject.org/v0/amp-auto-ads-0.1.js"></script>`;

const BODY_SCRIPT = `<amp-auto-ads type="adsense"
data-ad-client="ca-pub-1824544776589069"></amp-auto-ads>`;

let modifiedFiles = [];
let headInsertions = 0;
let bodyInsertions = 0;

const arquivos = listarHtmls('./artigos');

console.log(`🔍 Arquivos encontrados: ${arquivos.length}`);

if (arquivos.length === 0) {
  console.error("🚫 Nenhum arquivo HTML encontrado dentro de /artigos.");
  process.exit(1);
}

arquivos.forEach(file => {
  let content = fs.readFileSync(file, "utf8");
  let altered = false;

  if (!content.includes("amp-auto-ads-0.1.js")) {
    if (/<\/head>/i.test(content)) {
      content = content.replace(/<\/head>/i, `${HEAD_SCRIPT}\n</head>`);
      headInsertions++;
      altered = true;
    } else {
      console.warn(`⚠️ Arquivo ${file} não possui </head>!`);
    }
  }

  if (!content.includes("<amp-auto-ads")) {
    if (/<body[^>]*>/i.test(content)) {
      content = content.replace(/<body([^>]*)>/i, `<body$1>\n${BODY_SCRIPT}`);
      bodyInsertions++;
      altered = true;
    } else {
      console.warn(`⚠️ Arquivo ${file} não possui <body>!`);
    }
  }

  if (altered) {
    fs.writeFileSync(file, content, "utf8");
    modifiedFiles.push(file);
  }
});

console.log("\n===== RESUMO =====");
console.log(`✅ Total de arquivos analisados: ${arquivos.length}`);
console.log(`✅ Scripts AMP inseridos no <head>: ${headInsertions}`);
console.log(`✅ Tags AMP Ads inseridas no <body>: ${bodyInsertions}`);
console.log(`✅ Total de arquivos modificados: ${modifiedFiles.length}`);

if (modifiedFiles.length === 0) {
  console.log("🎯 Nenhum arquivo precisava de alteração. Tudo atualizado!");
  process.exit(0);
}
