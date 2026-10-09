const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const cheerio = require("cheerio");

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function snapshot(dir = ".", resultado = { arquivos: {}, corpos: {} }) {
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name.startsWith(".") || entrada.name === "node_modules") continue;
    const file = path.join(dir, entrada.name);
    if (entrada.isDirectory()) snapshot(file, resultado);
    else if (/\.(html|xml)$/.test(entrada.name)) {
      const texto = fs.readFileSync(file, "utf8");
      const local = file.replace(/\\/g, "/");
      resultado.arquivos[local] = hash(texto);
      if (texto.includes("article-body")) {
        const $ = cheerio.load(texto);
        if ($(".article-body").length) resultado.corpos[local] = hash($(".article-body").first().html());
      }
    }
  }
  return resultado;
}

function diferencas(a, b) {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(key => a[key] !== b[key]);
}

function validarRebuild() {
  const antes = snapshot();
  const rebuild = () => console.log(execFileSync(process.execPath, ["gerar-conteudo.js", "--rebuild-seo"], { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 }));
  rebuild();
  const primeiro = snapshot();
  rebuild();
  const segundo = snapshot();
  const corposAlterados = diferencas(antes.corpos, segundo.corpos);
  const saidasInstaveis = diferencas(primeiro.arquivos, segundo.arquivos);
  const resultado = { verificadoEm: new Date().toISOString(), arquivosAntes: Object.keys(antes.arquivos).length, arquivosDepois: Object.keys(segundo.arquivos).length, artigos: Object.keys(antes.corpos).length, corposAlterados, saidasInstaveis, arquivosAtualizados: diferencas(antes.arquivos, primeiro.arquivos), aceita: !corposAlterados.length && !saidasInstaveis.length };
  fs.mkdirSync(".editorial", { recursive: true });
  fs.writeFileSync(".editorial/validacao-rebuild.json", `${JSON.stringify(resultado, null, 2)}\n`);
  console.log(JSON.stringify({ ...resultado, arquivosAtualizados: resultado.arquivosAtualizados.length, relatorio: ".editorial/validacao-rebuild.json" }, null, 2));
  if (!resultado.aceita) throw new Error("Rebuild alterou corpos de artigos ou nao e idempotente. Consulte .editorial/validacao-rebuild.json.");
  return resultado;
}

if (require.main === module) {
  try { validarRebuild(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { validarRebuild };
