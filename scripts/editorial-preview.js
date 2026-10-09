const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { avaliarHtmlEditorial, hashRascunho, validarDossie } = require("./editorial-review");

const escapar = valor => String(valor ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

function gerarPrevia(rascunho, titulos = []) {
  const html = avaliarHtmlEditorial(rascunho.corpoArtigo);
  if (!html.aceita) throw new Error(`HTML inseguro para previa: ${html.motivos.join(", ")}`);
  const dossie = validarDossie(rascunho, titulos);
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Previa editorial: ${escapar(rascunho.titulo)}</title>
<style>
* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.7 'Segoe UI', sans-serif; background: #fff; color: #252a2e; }
main { max-width: 800px; padding: 24px; margin: auto; }
header { border-bottom: 1px solid #c5cdd1; margin-bottom: 24px; padding-bottom: 16px; }
h1 { font-size: 30px; line-height: 1.2; margin: 16px 0; }
h2 { font-size: 22px; line-height: 1.35; margin-top: 28px; }
p, li, h1, h2, dd, code { overflow-wrap: anywhere; }
a { color: #075db4; }
.status { font-size: 14px; color: #735000; }
.resumo { color: #46525c; }
aside { border-top: 1px solid #c5cdd1; margin-top: 32px; padding-top: 16px; }
dt { font-weight: 600; } dd { margin: 0 0 12px; }
pre { overflow-x: auto; } img { max-width: 100%; height: auto; }
@media (max-width: 540px) { main { padding: 16px; } h1 { font-size: 25px; } }
</style></head><body><main>
<header><p class="status">Rascunho local. Esta previa nao aprova nem publica o artigo.</p>
<h1>${escapar(rascunho.titulo)}</h1><p class="resumo">${escapar(rascunho.resumo)}</p></header>
<article>${rascunho.corpoArtigo}</article>
<aside aria-label="Dossie de revisao"><h2>Conferencia editorial</h2>
<p>Estado do pacote: ${escapar(rascunho.estado)}. Revisao humana registrada: ${rascunho.revisaoHumana ? "sim; conferir validade no CLI" : "nao"}.</p>
<p>Checagem estrutural do dossie: ${dossie.aceita ? "aprovada; nao verifica automaticamente a verdade dos fatos" : escapar(dossie.motivos.join(", "))}.</p>
<p>Versao para conferencia: <code>${hashRascunho(rascunho)}</code>.</p>
<dl>${(rascunho.dossie?.afirmacoes || []).map(a => `<dt>${escapar(a.tipo)}</dt><dd>${escapar(a.trecho)}</dd><dd>${escapar(a.verificacao)}</dd>`).join("\n")}</dl>
<p>Limites: ${escapar(rascunho.dossie?.limites)}</p>
<p>Sobreposicao: ${escapar(rascunho.dossie?.duplicidade?.justificativa)}</p>
</aside></main></body></html>`;
}

function salvarPrevia(arquivo, { root = process.cwd() } = {}) {
  const rascunho = JSON.parse(fs.readFileSync(path.resolve(root, arquivo), "utf8"));
  const titulos = JSON.parse(fs.readFileSync(path.join(root, "titulos.json"), "utf8"));
  const html = gerarPrevia(rascunho, titulos);
  // Keep drafts outside public output and account for catalogue-dependent checks.
  const nome = createHash("sha256").update(html).digest("hex");
  const diretorio = path.join(root, ".editorial", "previas");
  const destino = path.join(diretorio, `${nome}.html`);
  fs.mkdirSync(diretorio, { recursive: true });
  if (fs.existsSync(destino)) {
    if (fs.readFileSync(destino, "utf8") !== html) throw new Error("Previa existente diverge do hash.");
  } else fs.writeFileSync(destino, html, { flag: "wx" });
  return destino;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error("Uso: npm run article:preview -- caminho-do-rascunho.json");
    console.log(salvarPrevia(process.argv[2]));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { gerarPrevia, salvarPrevia };
