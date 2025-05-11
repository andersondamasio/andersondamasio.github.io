const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const pastaArtigos = path.join(__dirname, "artigos");

const menuHTML = `
<header style="background: #0a66c2; padding: 1rem 2rem; position: sticky; top: 0; z-index: 1000; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
  <nav style="display: flex; justify-content: center; gap: 2rem; flex-wrap: wrap;">
    <a href="../index.html" style="color: white; font-weight: 600; text-decoration: none;">Início</a>
    <a href="../artigos/index.html" style="color: white; font-weight: 600; text-decoration: none;">Artigos</a>
    <a href="../sobre.html" style="color: white; font-weight: 600; text-decoration: none;">Sobre</a>
    <a href="../contato.html" style="color: white; font-weight: 600; text-decoration: none;">Contato</a>
  </nav>
</header>`;

let arquivosAlterados = [];

function atualizarOuInserirMenu(filePath) {
  let html = fs.readFileSync(filePath, "utf8");

  const bodyIndex = html.indexOf("<body");
  if (bodyIndex === -1) return;

  const fimBodyTag = html.indexOf(">", bodyIndex);
  if (fimBodyTag === -1) return;

  const depoisBody = html.slice(fimBodyTag + 1);
  const temHeader = depoisBody.includes("<header");

  let novoHtml = "";

  if (temHeader) {
    // Substitui <header> existente por novo
    const regexHeader = /<header[\s\S]*?<\/header>/i;
    novoHtml = html.replace(regexHeader, menuHTML);
    if (novoHtml !== html) {
      arquivosAlterados.push(filePath);
      fs.writeFileSync(filePath, novoHtml, "utf8");
      console.log("♻️ Menu atualizado:", path.basename(filePath));
    }
  } else {
    // Insere novo menu
    novoHtml = html.slice(0, fimBodyTag + 1) + "\n\n" + menuHTML + "\n" + html.slice(fimBodyTag + 1);
    arquivosAlterados.push(filePath);
    fs.writeFileSync(filePath, novoHtml, "utf8");
    console.log("✅ Menu adicionado:", path.basename(filePath));
  }
}

function processarArtigosRaiz() {
  const arquivos = fs.readdirSync(pastaArtigos);
  for (const nome of arquivos) {
    const caminho = path.join(pastaArtigos, nome);
    if (nome.endsWith(".html") && fs.statSync(caminho).isFile()) {
      atualizarOuInserirMenu(caminho);
    }
  }
}

function fazerCommitSeNecessario() {
  if (arquivosAlterados.length === 0) {
    console.log("📭 Nenhum arquivo alterado. Nenhum commit necessário.");
    return;
  }

  try {
    execSync("git add artigos/*.html");
    execSync(`git commit -m "Inserção ou atualização automática do menu nos artigos"`);
    execSync("git push");
    console.log("🚀 Alterações commitadas e enviadas para o GitHub.");
  } catch (err) {
    console.error("❌ Erro ao fazer commit ou push:", err.message);
  }
}

processarArtigosRaiz();
fazerCommitSeNecessario();
