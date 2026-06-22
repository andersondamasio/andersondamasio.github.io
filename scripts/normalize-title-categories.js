const fs = require("fs");
const path = require("path");
const { normalizarCategoria } = require("./seo-categories");

const titulosPath = path.join(process.cwd(), "titulos.json");

if (!fs.existsSync(titulosPath)) {
  console.log("titulos.json não encontrado; nada para normalizar.");
  process.exit(0);
}

const titulos = JSON.parse(fs.readFileSync(titulosPath, "utf8"));
let alterados = 0;

for (const artigo of Array.isArray(titulos) ? titulos : []) {
  const categoriaAnterior = artigo.categoria || "";
  const categoriaNormalizada = normalizarCategoria(categoriaAnterior, artigo.titulo || artigo.noticiaOriginal || "");

  if (categoriaAnterior !== categoriaNormalizada) {
    artigo.categoria = categoriaNormalizada;
    alterados += 1;
  }
}

if (alterados > 0) {
  fs.writeFileSync(titulosPath, `${JSON.stringify(titulos, null, 2)}\n`, "utf8");
}

console.log(`Categorias normalizadas em titulos.json: ${alterados}`);
