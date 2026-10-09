const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { validarDossie, validarAprovacao, aprovarRascunho, hashRascunho, checklistObrigatorio } = require("./editorial-review");
const { publicarRascunhoAprovado } = require("../gerar-conteudo");
const { recuperarPublicacaoInterrompida } = require("./editorial-transaction");

async function main() {
  const [comando, arquivo] = process.argv.slice(2);
  if (comando === "recuperar") {
    if (arquivo !== "--processo-anterior-encerrado") throw new Error("Confirme que nenhuma publicacao esta em execucao: recuperar --processo-anterior-encerrado");
    recuperarPublicacaoInterrompida();
    console.log("Journal recuperado. Confira o diff antes de publicar novamente.");
    return;
  }
  if (!["conferir", "aprovar", "publicar"].includes(comando) || !arquivo) {
    throw new Error("Uso: npm run article:review -- conferir|aprovar|publicar caminho.json");
  }
  const rascunho = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  const titulos = JSON.parse(fs.readFileSync("titulos.json", "utf8"));
  if (comando === "conferir") {
    const resultado = rascunho.estado === "aprovado" ? validarAprovacao(rascunho, titulos) : validarDossie(rascunho, titulos);
    console.log(JSON.stringify({ titulo: rascunho.titulo, hash: hashRascunho(rascunho), ...resultado }, null, 2));
    if (!resultado.aceita) process.exitCode = 1;
    return;
  }
  if (comando === "publicar") {
    console.log(JSON.stringify(publicarRascunhoAprovado(rascunho), null, 2));
    return;
  }
  const avaliacao = validarDossie(rascunho, titulos);
  if (!avaliacao.aceita) throw new Error(`Dossie incompleto: ${avaliacao.motivos.join(", ")}`);
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Aprovacao exige um revisor humano em terminal interativo. CI e geracao nao aprovam artigos.");
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(`Revisao humana: ${rascunho.titulo}\nHash: ${hashRascunho(rascunho)}\nO dossie e o nome do revisor serao publicos. Nao inclua dados privados.`);
    const responsavel = await terminal.question("Nome do responsavel pela revisao: ");
    const checklist = {};
    for (const item of checklistObrigatorio) checklist[item] = (await terminal.question(`${item} (digite sim para confirmar): `)).trim().toLowerCase() === "sim";
    const confirmacaoHumana = await terminal.question("Apos ler e conferir integralmente o artigo, digite REVISEI INTEGRALMENTE: ");
    const aprovado = aprovarRascunho(rascunho, { responsavel, checklist, confirmacaoHumana }, titulos);
    const destino = path.join("dados", "editorial", "aprovados", `${aprovado.revisaoHumana.hash}.json`);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, `${JSON.stringify(aprovado, null, 2)}\n`, { flag: "wx" });
    console.log(`Pacote aprovado: ${destino}. Nada foi publicado. Revise o diff antes de commitar.`);
  } finally {
    terminal.close();
  }
}

if (require.main === module) main().catch(erro => { console.error(erro.message); process.exitCode = 1; });
