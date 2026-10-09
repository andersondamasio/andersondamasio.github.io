const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { versaoPoliticaEditorial } = require("./editorial-policy");

function salvarRascunhoEditorial(dados, root = process.cwd()) {
  const diretorio = path.join(root, ".editorial", "rascunhos");
  const pacote = {
    ...dados,
    versao: 1,
    politica: versaoPoliticaEditorial,
    estado: "revisao_pendente",
    revisaoHumana: null,
    publicado: false,
    criadoEm: new Date().toISOString()
  };
  fs.mkdirSync(diretorio, { recursive: true });
  const arquivo = path.join(diretorio, `${randomUUID()}.json`);
  fs.writeFileSync(arquivo, `${JSON.stringify(pacote, null, 2)}\n`, { flag: "wx" });
  return arquivo;
}

module.exports = { salvarRascunhoEditorial };
