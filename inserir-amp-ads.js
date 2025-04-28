const fs = require('fs');
const { glob } = require('glob');

const HEAD_SCRIPT = `<script async custom-element="amp-auto-ads"
src="https://cdn.ampproject.org/v0/amp-auto-ads-0.1.js"></script>`;

const BODY_SCRIPT = `<amp-auto-ads type="adsense"
data-ad-client="ca-pub-1824544776589069"></amp-auto-ads>`;

let modifiedFiles = [];

glob("artigos/**/*.html", { ignore: ["node_modules/**", ".git/**"] }, (err, files) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error("Nenhum arquivo HTML encontrado dentro de /artigos.");
    process.exit(1);
  }

  files.forEach(file => {
    let content = fs.readFileSync(file, "utf8");
    let originalContent = content;

    // Inserir o HEAD_SCRIPT antes de </head> usando regex tolerante
    if (!content.includes("amp-auto-ads-0.1.js")) {
      content = content.replace(/<\/head>/i, `${HEAD_SCRIPT}\n</head>`);
    }

    // Inserir o BODY_SCRIPT logo depois da primeira ocorrência de <body>
    if (!content.includes("<amp-auto-ads")) {
      content = content.replace(/<body[^>]*>/i, match => `${match}\n${BODY_SCRIPT}`);
    }

    if (content !== originalContent) {
      console.log(`Arquivo modificado: ${file}`);
      fs.writeFileSync(file, content, "utf8");
      modifiedFiles.push(file);
    }
  });

  if (modifiedFiles.length === 0) {
    console.error("Nenhum arquivo foi modificado. Verifique se os códigos já não existem ou ajuste o script.");
    process.exit(1);
  } else {
    console.log(`Total de arquivos modificados: ${modifiedFiles.length}`);
  }
});
