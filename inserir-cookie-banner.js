const fs = require('fs');
const path = require('path');

const diretorios = ['.', './artigos'];

const scriptHTML = `
<!-- Aviso de Cookies -->
<div id="cookie-banner" style="
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #2c2c2c;
  color: #fff;
  padding: 15px;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 9999;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.3);
">
  <span>
    Este site utiliza cookies para melhorar a experiência do usuário. Ao continuar navegando, você concorda com nossa 
    <a href="/politica-de-privacidade.html" style="color: #f1c40f; text-decoration: underline;">Política de Privacidade</a>.
  </span>
  <button onclick="aceitarCookies()" style="
    background: #f1c40f;
    border: none;
    padding: 8px 12px;
    font-weight: bold;
    cursor: pointer;
    color: #000;
    border-radius: 5px;
    margin-left: 15px;
  ">Aceitar</button>
</div>

<script src="/scripts/cookies-banner.js"></script>
`;

function processarHTML(arquivo) {
  const conteudo = fs.readFileSync(arquivo, 'utf8');
  if (!conteudo.includes('cookie-banner')) {
    const novoConteudo = conteudo.replace('</body>', scriptHTML + '\n</body>');
    fs.writeFileSync(arquivo, novoConteudo, 'utf8');
    console.log(`✅ Banner inserido: ${arquivo}`);
  } else {
    console.log(`ℹ️ Já possui banner: ${arquivo}`);
  }
}

function varrerDiretorio(dir) {
  fs.readdirSync(dir).forEach(item => {
    const caminho = path.join(dir, item);
    const stats = fs.statSync(caminho);

    if (stats.isDirectory()) {
      varrerDiretorio(caminho);
    } else if (stats.isFile() && caminho.endsWith('.html')) {
      processarHTML(caminho);
    }
  });
}

diretorios.forEach(varrerDiretorio);
