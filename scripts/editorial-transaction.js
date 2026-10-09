const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

let transacao = null;

function destinoSeguro(root, arquivo) {
  const destino = path.resolve(root, arquivo);
  const relativo = path.relative(root, destino);
  if (!relativo || relativo.startsWith("..") || path.isAbsolute(relativo) || relativo.split(path.sep).some(p => p.startsWith("."))) {
    throw new Error(`Destino fora do site: ${arquivo}`);
  }
  let atual = destino;
  while (atual !== root) {
    if (fs.existsSync(atual) && fs.lstatSync(atual).isSymbolicLink()) throw new Error("Publicacao nao segue links simbolicos.");
    atual = path.dirname(atual);
  }
  return destino;
}

function gravarAtomico(destino, conteudo) {
  const temporario = `${destino}.editorial-tmp`;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(temporario, conteudo, { flag: "wx" });
  fs.renameSync(temporario, destino);
}

function escreverPublicacao(arquivo, conteudo) {
  if (!transacao) return fs.writeFileSync(arquivo, conteudo);
  const destino = destinoSeguro(transacao.root, arquivo);
  if (!transacao.registros.some(r => r.destino === destino)) {
    const backup = `${transacao.registros.length}.bak`;
    const existia = fs.existsSync(destino);
    if (existia) fs.copyFileSync(destino, path.join(transacao.pasta, backup), fs.constants.COPYFILE_EXCL);
    transacao.registros.push({ destino, backup, existia });
    gravarAtomico(path.join(transacao.pasta, "journal.json"), JSON.stringify(transacao.registros));
  }
  gravarAtomico(destino, conteudo);
}

function reverter(root, pasta, registros) {
  for (const registro of [...registros].reverse()) {
    const destino = destinoSeguro(root, registro.destino);
    if (!/^\d+\.bak$/.test(registro.backup)) throw new Error("Backup de publicacao invalido.");
    const temporario = `${destino}.editorial-tmp`;
    if (fs.existsSync(temporario)) fs.unlinkSync(temporario);
    if (registro.existia) gravarAtomico(destino, fs.readFileSync(path.join(pasta, registro.backup)));
    else if (fs.existsSync(destino)) fs.unlinkSync(destino);
  }
}

function limparJournal(root, pasta) {
  if (path.resolve(pasta) !== path.join(root, ".editorial", "publicacao-em-andamento")) throw new Error("Journal fora do escopo.");
  const concluida = path.join(root, ".editorial", `publicacao-concluida-${randomUUID()}`);
  fs.renameSync(pasta, concluida);
  if (path.dirname(concluida) !== path.join(root, ".editorial")) throw new Error("Limpeza fora do escopo.");
  fs.rmSync(concluida, { recursive: true, force: false });
}

function executarPublicacao(executar, root = process.cwd()) {
  root = fs.realpathSync(root);
  if (transacao) throw new Error("Publicacao ja em andamento neste processo.");
  const pasta = path.join(root, ".editorial", "publicacao-em-andamento");
  fs.mkdirSync(path.dirname(pasta), { recursive: true });
  // mkdir is the exclusive lock; a crash leaves the journal for explicit recovery.
  fs.mkdirSync(pasta);
  transacao = { root, pasta, registros: [] };
  let concluida = false;
  try {
    const resultado = executar();
    if (resultado?.then) throw new Error("A transacao de publicacao deve ser sincrona.");
    fs.writeFileSync(path.join(pasta, "concluida"), "ok", { flag: "wx" });
    concluida = true;
    limparJournal(root, pasta);
    return resultado;
  } catch (erro) {
    if (concluida) throw erro;
    reverter(root, pasta, transacao.registros);
    limparJournal(root, pasta);
    throw erro;
  } finally {
    transacao = null;
  }
}

function recuperarPublicacaoInterrompida(root = process.cwd()) {
  root = fs.realpathSync(root);
  const pasta = path.join(root, ".editorial", "publicacao-em-andamento");
  if (!fs.existsSync(pasta)) throw new Error("Nenhuma publicacao interrompida.");
  if (!fs.existsSync(path.join(pasta, "concluida"))) {
    const journal = path.join(pasta, "journal.json");
    reverter(root, pasta, fs.existsSync(journal) ? JSON.parse(fs.readFileSync(journal, "utf8")) : []);
  }
  limparJournal(root, pasta);
}

module.exports = { executarPublicacao, escreverPublicacao, recuperarPublicacaoInterrompida };
