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

const SCRIPT_CORRETO = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1824544776589069"
     crossorigin="anonymous"></script>`;

const arquivos = listarHtmls('./artigos');

let removidos = 0;
let adicionados = 0;
let modificados = [];

console.log(`🔍 Arquivos encontrados: ${arquivos.length}`);

arquivos.forEach(file => {
  let content = fs.readFileSync(file, "utf8");
  let original = content;
  let altered = false;

  // Remove script AMP do <head>
  content = content.replace(/<script async custom-element="amp-auto-ads"[\s\S]*?<\/script>/gi, () => {
    removidos++;
    altered = true;
    return '';
  });

  // Remove tag <amp-auto-ads ...> do <body>
  content = content.replace(/<amp-auto-ads[\s\S]*?<\/amp-auto-ads>|<amp-auto-ads[^>]*\/?>/gi, () => {
    removidos++;
    altered = true;
    return '';
  });

  // Adiciona script correto se ainda não estiver presente
  if (!content.includes("pagead2.googlesyndication.com/pagead/js/adsbygoogle.js")) {
    if (/<\/head>/i.test(content)) {
      content = content.replace(/<\/head>/i, `${SCRIPT_CORRETO}\n</head>`);
      adicionados++;
      altered = true;
    } else {
      console.warn(`⚠️ Arquivo ${file} não possui </head>!`);
    }
  }

  // Gravar alterações se necessário
  if (altered && content !== original) {
    fs.writeFileSync(file, content, "utf8");
    modificados.push(file);
  }
});

console.log("\n===== RESUMO =====");
console.log(`✅ Total de arquivos analisados: ${arquivos.length}`);
console.log(`🗑️ Scripts AMP removidos: ${removidos}`);
console.log(`➕ Scripts corretos adicionados ao <head>: ${adicionados}`);
console.log(`📝 Total de arquivos modificados: ${modificados.length}`);

if (modificados.length > 0) {
  console.log("📄 Arquivos alterados:");
  modificados.forEach(f => console.log(" - " + f));
} else {
  console.log("🎯 Nenhum arquivo precisou de alteração. Tudo certo!");
}
