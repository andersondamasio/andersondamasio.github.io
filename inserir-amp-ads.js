const fs = require('fs');
const { glob } = require('glob');

const HEAD_SCRIPT = `
<script async custom-element="amp-auto-ads"
    src="https://cdn.ampproject.org/v0/amp-auto-ads-0.1.js">
</script>`;

const BODY_SCRIPT = `
<amp-auto-ads type="adsense"
    data-ad-client="ca-pub-1824544776589069">
</amp-auto-ads>`;

glob("artigos/**/*.html", { ignore: ["node_modules/**", ".git/**"] }, (err, files) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }

  files.forEach(file => {
    let content = fs.readFileSync(file, "utf8");
    let originalContent = content;

    if (content.includes("<head>") && !content.includes("amp-auto-ads-0.1.js")) {
      content = content.replace("<head>", `<head>${HEAD_SCRIPT}`);
    }

    if (content.includes("<body>") && !content.includes("<amp-auto-ads")) {
      content = content.replace("<body>", `<body>${BODY_SCRIPT}`);
    }

    if (content !== originalContent) {
      console.log(`Atualizando ${file}`);
      fs.writeFileSync(file, content, "utf8");
    }
  });
});
