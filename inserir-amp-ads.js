const fs = require('fs');
const { glob } = require('glob');

const HEAD_SCRIPT = `<script async custom-element="amp-auto-ads"
src="https://cdn.ampproject.org/v0/amp-auto-ads-0.1.js"></script>`;

const BODY_SCRIPT = `<amp-auto-ads type="adsense"
data-ad-client="ca-pub-1824544776589069"></amp-auto-ads>`;

let modifiedFiles = [];

glob("./artigos/**/*.html", { ignore: ["node_modules/**", ".git/**"] }, (err, files) => {
  if (err) {
    console.error("Erro ao buscar arquivos:", err);
    process.exit(1);
  }

  console.log(`Arquivos encontrados: ${files.length}`);
  if (files.length === 0) {
    console.error("Nenhum arquivo HTML encontrado dentro de /artigos.");
    process.exit(1);
  }

  files.forEach(file => {
    let content = fs.readFileSync(file, "utf8");
    let originalContent = content;
    let altered = false;

    // Verifica e insere no <head>
    if (!content.includes("amp-auto-ads-0.1.js")) {
      if (/<\/head>/i.test(content)) {
        content = content.replace(/<\/head>/i, `${HEAD_SCRIPT}\n</head>`);
        console.log(`✅ AMP script inserido no head de: ${file}`);
        altered = true;
      } else {
        console.warn(`⚠️ Arquivo ${file} não possui </head>!`);
      }
    }

    // Verifica e insere no <body>
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
});
