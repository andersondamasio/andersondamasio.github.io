const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const cheerio = require("cheerio");
const { siteUrl } = require("./seo-identity");
const { hashCorpoEditorial } = require("./seo-helpful-content");
const { caminhoLocal } = require("./seo-navigation");
const { escreverPublicacao, removerPublicacao } = require("./editorial-transaction");

const hashArquivo = text => createHash("sha256").update(String(text).replace(/\r\n/g, "\n")).digest("hex");
const hashRegistros = registros => hashArquivo(JSON.stringify(registros));
const hashValido = valor => /^[a-f0-9]{64}$/.test(valor || "");
const urlValida = url => /^(?:[a-z0-9-]+\/)+[a-z0-9-]+\.html$/.test(url || "");
const textoJson = valor => `${JSON.stringify(valor, null, 2)}\n`;

function lerSeguro(root, url) {
  const arquivo = path.join(root, url);
  for (let atual = arquivo; atual !== root; atual = path.dirname(atual)) {
    if (fs.existsSync(atual) && fs.lstatSync(atual).isSymbolicLink()) throw new Error(`Link simbolico nao permitido: ${url}`);
  }
  return fs.existsSync(arquivo) ? fs.readFileSync(arquivo, "utf8") : null;
}

function planejarCiclo({ root, decisao, cadastro, manifesto }) {
  const { url, acao, arquivoHash, registrosHash, destino, destinoConteudoHash } = decisao;
  if (!hashValido(arquivoHash) || !hashValido(registrosHash)) throw new Error(`Retirada/consolidacao exige hashes do arquivo e cadastro: ${url}`);
  const aliases = decisao.aliases || [];
  if (!Array.isArray(aliases) || aliases.some(a => !urlValida(a.url) || !hashValido(a.arquivoHash))) throw new Error(`Aliases invalidos: ${url}`);
  const caminhos = [url, ...aliases.map(a => a.url)];
  if (new Set(caminhos).size !== caminhos.length || caminhos.some(p => manifesto.protegidas.includes(p))) throw new Error(`URL protegida ou repetida: ${url}`);
  if (aliases.some(a => manifesto.decisoes.some(d => d.url === a.url))) throw new Error(`Alias tambem possui decisao propria: ${url}`);
  if (cadastro.some(a => caminhos.slice(1).includes(a.url))) throw new Error(`Alias pertence a outro registro: ${url}`);
  if (acao === "consolidar") {
    if (!/^artigos\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.html$/.test(destino || "") || caminhos.includes(destino) || !hashValido(destinoConteudoHash) ||
        cadastro.filter(a => a.url === destino && !a.localizacao?.estado).length !== 1 ||
        manifesto.decisoes.some(d => d.url === destino && !["manter", "atualizar"].includes(d.acao))) throw new Error(`Destino nao e artigo ativo unico: ${url}`);
    const $ = cheerio.load(lerSeguro(root, destino) || "");
    if ($(".article-body").length !== 1 || hashCorpoEditorial($(".article-body").html()) !== destinoConteudoHash ||
        $("link[rel=canonical]").attr("href") !== `${siteUrl}/${destino}` || $("link[rel=canonical]").length !== 1 ||
        /noindex/i.test($("meta[name='robots' i]").attr("content") || "") || $("meta[http-equiv='refresh' i]").length) throw new Error(`Destino mudou, nao indexavel ou redireciona: ${url}`);
  } else if (destino) throw new Error(`Retirada sem substituto nao aceita destino: ${url}`);

  const arquivoBackup = `dados/editorial/arquivados/${hashArquivo(`${url}\n${arquivoHash}`)}.json`;
  const backupExistente = lerSeguro(root, arquivoBackup);
  const registros = cadastro.filter(a => a.url === url);
  let backup;
  if (backupExistente !== null) {
    backup = JSON.parse(backupExistente);
    if (backup.versao !== 1 || backup.url !== url || hashRegistros(backup.registros) !== registrosHash ||
        !Array.isArray(backup.arquivos) || backup.arquivos.length !== caminhos.length) throw new Error(`Backup divergente: ${url}`);
  } else {
    if (!registros.length || hashRegistros(registros) !== registrosHash) throw new Error(`Cadastro divergiu da revisao: ${url}`);
    backup = { versao: 1, url, registros, arquivos: caminhos.map(p => ({ url: p, html: lerSeguro(root, p) })) };
  }
  for (const [i, p] of caminhos.entries()) {
    const original = backup.arquivos[i];
    const hashEsperado = i === 0 ? arquivoHash : aliases[i - 1].arquivoHash;
    if (original?.url !== p || typeof original.html !== "string" || hashArquivo(original.html) !== hashEsperado) throw new Error(`Arquivo original divergiu: ${p}`);
    const $ = cheerio.load(original.html);
    if (i > 0 && ($(".article-body").length || $("link[rel=canonical]").attr("href") !== `${siteUrl}/${url}` || !$("meta[http-equiv='refresh' i]").length)) throw new Error(`Alias nao comprovado: ${p}`);
    if (i === 0 && $(".article-body").length && (!hashValido(decisao.conteudoHash) || $(".article-body").length !== 1 || hashCorpoEditorial($(".article-body").html()) !== decisao.conteudoHash)) throw new Error(`Corpo sem revisao correspondente: ${p}`);
  }
  if (registros.length && hashRegistros(registros) !== registrosHash) throw new Error(`Cadastro alterado apos arquivamento: ${url}`);
  const arquivos = caminhos.map(p => {
    const antes = lerSeguro(root, p);
    const depois = acao === "retirar" ? null : require("../gerar-conteudo").gerarHtmlAliasLegado({ origem: p, destino, titulo: backup.registros[0]?.titulo || "Artigo consolidado" }).replace(/\r\n/g, "\n");
    const original = backup.arquivos.find(a => a.url === p).html;
    if (antes !== null && hashArquivo(antes) !== hashArquivo(original) && hashArquivo(antes) !== hashArquivo(depois)) throw new Error(`Arquivo alterado apos revisao: ${p}`);
    return { url: p, antes, depois, alterado: antes !== depois };
  });
  return { url, acao, motivo: decisao.motivo, destino, arquivos, arquivoBackup, backup: textoJson(backup),
    backupNovo: backupExistente === null, registrosRemovidos: registros.length,
    alterado: backupExistente === null || registros.length > 0 || arquivos.some(a => a.alterado) };
}

function aplicarCiclos(operacoes, root) {
  const ciclos = operacoes.filter(o => o.arquivos);
  if (!ciclos.length) return;
  for (const ciclo of ciclos) {
    if (ciclo.backupNovo) escreverPublicacao(path.join(root, ciclo.arquivoBackup), ciclo.backup);
    for (const arquivo of ciclo.arquivos.filter(a => a.alterado)) {
      if (arquivo.depois === null) removerPublicacao(path.join(root, arquivo.url));
      else escreverPublicacao(path.join(root, arquivo.url), arquivo.depois);
    }
  }
  const arquivo = path.join(root, "titulos.json");
  const registros = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  const urls = new Set(ciclos.map(c => c.url));
  const depois = registros.filter(r => !urls.has(r.url));
  if (depois.length !== registros.length) escreverPublicacao(arquivo, textoJson(depois));
}

function verificarReferenciasRetiradas(root, operacoes) {
  const retiradas = new Set(operacoes.filter(o => o.acao === "retirar").flatMap(o => o.arquivos.map(a => a.url)));
  if (!retiradas.size) return;
  const problemas = [];
  function visitar(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (item.name.startsWith(".") || item.name === "node_modules" || item.isSymbolicLink()) continue;
      const arquivo = path.join(dir, item.name);
      if (item.isDirectory()) visitar(arquivo);
      else if (item.name.endsWith(".html")) {
        const local = path.relative(root, arquivo).replace(/\\/g, "/");
        const $ = cheerio.load(fs.readFileSync(arquivo, "utf8"));
        $("a[href], link[rel='canonical']").each((_, a) => {
          if (retiradas.has(caminhoLocal($(a).attr("href"), local))) problemas.push(local);
        });
        $("meta[http-equiv='refresh' i]").each((_, meta) => {
          const destino = ($(meta).attr("content") || "").match(/url\s*=\s*['\"]?([^'\"]+)/i)?.[1];
          if (destino && retiradas.has(caminhoLocal(destino.trim(), local))) problemas.push(local);
        });
      }
    }
  }
  visitar(root);
  if (problemas.length) throw new Error(`Referencias a URLs retiradas: ${[...new Set(problemas)].slice(0, 10).join(", ")}. Corrija as referencias ou inclua aliases comprovados no plano.`);
}

module.exports = { hashArquivo, hashRegistros, planejarCiclo, aplicarCiclos, verificarReferenciasRetiradas };
