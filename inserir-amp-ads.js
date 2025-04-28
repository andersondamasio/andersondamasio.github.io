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

const arquivos = listarHtmls('./artigos');

console.log(`Arquivos encontrados: ${arquivos.length}`);
arquivos.forEach(file => console.log(file));

if (arquivos.length === 0) {
  console.error("Nenhum arquivo HTML encontrado dentro de /artigos.");
  process.exit(1);
}

arquivos.forEach(file => {
  let content = fs.readFileSync(file, "utf8");
  let originalContent = content;
  let altered = false;

  if (!content.includes("amp-auto-ads-0.1.js")) {
    if (/<\/head>/i.test(content)) {
      content = content.replace(/<\/head>/i, `${HEAD_SCRIPT}\n</head>`);
      console.log(`✅ AMP script inserido no head de: ${file}`);
      altered = true;
    } else {
      console.warn(`⚠️ Arquivo ${file} não possui </head>!`);
    }
  }

  if (!content.includes("<amp-auto-ads")) {
    if (/<body[^>]*>/i.test(content)) {
      content = content.replace(/<body([^>]*)>/i, `<body$1>\n${BODY_SCRIPT}`);
      console.log(`✅ AMP ads inserido no body de: ${file}`);
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

if (modifiedFiles.length === 0) {
  console.error("Nenhum arquivo foi modificado. Talvez já esteja tudo atualizado?");
  process.exit(1);
} else {
  console.log(`Total de arquivos modificados: ${modifiedFiles.length}`);
}
