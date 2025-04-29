const fs = require('fs');
const path = require('path');

const diretorios = ['.', './artigos'];

function substituirLink(arquivo) {
  const conteudo = fs.readFileSync(arquivo, 'utf8');
  const novoConteudo = conteudo.replace(
    /<a href=["']\/politica-de-privacidade\.html["'](.*?)>Política de Privacidade<\/a>/g,
    '<a href="/politica.html"$1>Política de Privacidade</a>'
  );

  if (conteudo !== novoConteudo) {
    fs.writeFileSync(arquivo, novoConteudo, 'utf8');
    console.log(`✅ Link atualizado: ${arquivo}`);
  }
}

function varrerDiretorio(dir) {
  fs.readdirSync(dir).forEach(item => {
    const caminho = path.join(dir, item);
    const stats = fs.statSync(caminho);

    if (stats.isDirectory()) {
      varrerDiretorio(caminho);
    } else if (stats.isFile() && caminho.endsWith('.html')) {
      substituirLink(caminho);
    }
  });
}

diretorios.forEach(varrerDiretorio);
