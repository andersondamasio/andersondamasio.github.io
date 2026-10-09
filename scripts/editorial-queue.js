const fs = require("node:fs");
const path = require("node:path");
const { hashRascunho, validarAprovacao, avaliarCadenciaSemanal } = require("./editorial-review");

const formatoPacote = /^dados\/editorial\/aprovados\/([a-f0-9]{64})\.json$/;

function selecionarPacote({ root = process.cwd(), pacote = "", agora = new Date() } = {}) {
  const ler = arquivo => JSON.parse(fs.readFileSync(path.join(root, arquivo), "utf8"));
  const titulos = ler("titulos.json");
  if (!Array.isArray(titulos)) throw new Error("Catalogo invalido.");
  const fila = pacote ? { versao: 1, pacotes: [pacote] } : ler("dados/editorial/fila.json");
  if (fila.versao !== 1 || !Array.isArray(fila.pacotes) || fila.pacotes.length > 100 ||
      fila.pacotes.some(p => typeof p !== "string" || !formatoPacote.test(p)) ||
      new Set(fila.pacotes).size !== fila.pacotes.length) throw new Error("Fila invalida: use caminhos unicos de pacotes aprovados.");
  const publicados = new Set(titulos.map(t => t.editorial?.hash).filter(Boolean));
  for (const arquivo of fila.pacotes) {
    const base = path.resolve(root, "dados/editorial/aprovados");
    const real = fs.realpathSync(path.join(root, arquivo));
    if (path.dirname(real) !== base) throw new Error("Pacote fora do diretorio aprovado.");
    const rascunho = ler(arquivo);
    const hash = formatoPacote.exec(arquivo)[1];
    if (hashRascunho(rascunho) !== hash || rascunho.revisaoHumana?.hash !== hash) throw new Error(`Hash divergente: ${arquivo}`);
    if (publicados.has(hash)) {
      if (pacote) throw new Error("Pacote ja publicado.");
      continue;
    }
    const validacao = validarAprovacao(rascunho, titulos, agora);
    if (!validacao.aceita) throw new Error(`Pacote nao aprovado: ${validacao.motivos.join(", ")}`);
    const cadencia = avaliarCadenciaSemanal(titulos, agora);
    if (!cadencia.aceita) return { elegivel: false, pacote: null, motivo: "intervalo-de-sete-dias", proximaPublicacao: cadencia.proximaPublicacao };
    return { elegivel: true, pacote: arquivo, motivo: "pacote-aprovado-disponivel" };
  }
  return { elegivel: false, pacote: null, motivo: fila.pacotes.length ? "fila-ja-publicada" : "fila-vazia" };
}

if (require.main === module) {
  try {
    const resultado = selecionarPacote({ pacote: process.env.PACOTE || "" });
    console.log(JSON.stringify(resultado, null, 2));
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `elegivel=${resultado.elegivel}\npacote=${resultado.pacote || ""}\n`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { selecionarPacote };
