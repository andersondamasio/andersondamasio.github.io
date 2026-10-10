const fs = require("node:fs");
const path = require("node:path");
const cheerio = require("cheerio");
const { hashCorpoEditorial } = require("./seo-helpful-content");
const { siteUrl, criarWebSiteSchema } = require("./seo-identity");

const urlLeituras = "guias.html";
const arquivoSelecao = "dados/leituras-selecionadas.json";
const tipos = {
  "exemplo-executavel": "Exemplo execut\u00e1vel",
  "exercicio-proposto": "Exerc\u00edcio proposto",
  "analise-de-fontes": "An\u00e1lise de fontes"
};
const escapar = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function carregarLeituras(artigos, root = process.cwd()) {
  const arquivo = path.join(root, arquivoSelecao);
  if (!fs.existsSync(arquivo)) {
    if (fs.existsSync(path.join(root, urlLeituras))) throw new Error("Selecao ausente para pagina de guias existente.");
    return null;
  }
  const selecao = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  const exigir = (valido, detalhe) => { if (!valido) throw new Error(`Selecao de leituras invalida: ${detalhe}`); };
  const texto = value => typeof value === "string" && value.trim().length > 0;
  exigir(selecao.versao === 1, "versao");
  exigir([selecao.titulo, selecao.descricao, selecao.introducao, selecao.limites].every(texto), "textos da colecao");
  const data = Date.parse(selecao.atualizadoEm);
  exigir(typeof selecao.atualizadoEm === "string" && Number.isFinite(data) && data <= Date.now() && new Date(data).toISOString() === selecao.atualizadoEm, "data de atualizacao");
  exigir(Array.isArray(selecao.grupos) && selecao.grupos.length > 0, "grupos ausentes");
  const ids = new Set();
  const urls = new Set();
  const grupos = selecao.grupos.map(grupo => {
    exigir(/^[a-z][a-z0-9-]*$/.test(grupo.id || "") && !ids.has(grupo.id), "identificador de grupo");
    ids.add(grupo.id);
    exigir([grupo.titulo, grupo.pergunta, grupo.contexto].every(texto), grupo.id);
    exigir(Array.isArray(grupo.leituras) && grupo.leituras.length > 0, `grupo vazio: ${grupo.id}`);
    const leituras = grupo.leituras.map(item => {
      exigir(/^artigos\/[a-z0-9/-]+\.html$/.test(item.url || "") && !urls.has(item.url), "URL invalida ou repetida");
      urls.add(item.url);
      exigir(Object.hasOwn(tipos, item.tipo) && texto(item.resumo), item.url);
      exigir(/^[a-f0-9]{64}$/.test(item.conteudoHash || ""), `hash ausente: ${item.url}`);
      const candidatos = artigos.filter(a => a.url === item.url && a.localizacao?.estado !== "pendente");
      exigir(candidatos.length === 1 && texto(candidatos[0].titulo), `artigo nao publicavel ou ambiguo: ${item.url}`);
      const $ = cheerio.load(fs.readFileSync(path.join(root, item.url), "utf8"));
      exigir($(".article-body").length === 1 && !$("meta[http-equiv=refresh]").length, `conteudo ausente: ${item.url}`);
      exigir(!/noindex/i.test($("meta[name=robots]").attr("content") || ""), `noindex: ${item.url}`);
      exigir($("link[rel=canonical]").attr("href") === `${siteUrl}/${item.url}`, `canonical: ${item.url}`);
      exigir(hashCorpoEditorial($(".article-body").html()) === item.conteudoHash, `reconferir resumo apos mudanca de corpo: ${item.url}`);
      return { ...item, titulo: candidatos[0].titulo };
    });
    return { ...grupo, leituras };
  });
  return { ...selecao, grupos };
}

function gerarResumoLeituras(selecao) {
  if (!selecao) return "";
  return `<section class="selected-readings" aria-labelledby="selected-readings-title">
<h2 id="selected-readings-title"><a href="/${urlLeituras}">${escapar(selecao.titulo)}</a></h2>
<ul>${selecao.grupos.map(grupo => `<li><h3><a href="/${urlLeituras}#${grupo.id}">${escapar(grupo.titulo)}</a></h3><p>${escapar(grupo.pergunta)}</p></li>`).join("\n")}</ul>
</section>`;
}

function gerarConteudoLeituras(selecao) {
  return `<p>${escapar(selecao.introducao)}</p>
<nav class="reading-topics" aria-label="Temas dos guias">${selecao.grupos.map(g => `<a href="#${g.id}">${escapar(g.titulo)}</a>`).join("\n")}</nav>
${selecao.grupos.map(grupo => `<section class="reading-group" id="${grupo.id}" aria-labelledby="${grupo.id}-title">
<h2 id="${grupo.id}-title">${escapar(grupo.titulo)}</h2><p><strong>${escapar(grupo.pergunta)}</strong></p><p>${escapar(grupo.contexto)}</p>
<ul class="reading-list">${grupo.leituras.map(item => `<li><p class="reading-kind">${tipos[item.tipo]}</p><h3><a href="/${item.url}">${escapar(item.titulo)}</a></h3><p>${escapar(item.resumo)}</p></li>`).join("\n")}</ul>
</section>`).join("\n")}
<section aria-labelledby="reading-scope-title"><h2 id="reading-scope-title">Fontes e limites</h2><p>${escapar(selecao.limites)}</p><p><a href="/sobre.html#criterios-editoriais">Crit\u00e9rios editoriais de Anderson Damasio</a> &middot; <a href="/contato.html">Sugerir uma corre\u00e7\u00e3o</a></p></section>`;
}

function criarSchemaLeituras(selecao) {
  return {
    "@context": "https://schema.org", "@type": "CollectionPage",
    name: selecao.titulo, description: selecao.descricao, url: `${siteUrl}/${urlLeituras}`,
    dateModified: selecao.atualizadoEm, isPartOf: criarWebSiteSchema(),
    mainEntity: { "@type": "ItemList", itemListElement: selecao.grupos.flatMap(g => g.leituras).map((item, i) => ({
      "@type": "ListItem", position: i + 1, name: item.titulo, url: `${siteUrl}/${item.url}`
    })) }
  };
}

const estilosLeituras = `
.selected-readings > ul { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.5rem; list-style: none; padding: 0; margin: 0; }
.selected-readings h3, .reading-list h3 { font-size: 1.1rem; line-height: 1.4; margin: 0 0 .5rem; }
.selected-readings p { margin: 0; }
.selected-readings a, .reading-list a { overflow-wrap: anywhere; }
.reading-topics { display: flex; flex-wrap: wrap; gap: .75rem 1.5rem; padding: 1rem 0; }
.reading-group { scroll-margin-top: 8rem; }
.reading-list { list-style: none; padding: 0; margin: 1.5rem 0 0; }
.reading-list li { padding: 1rem 0; border-top: 1px solid #b9c6ce; }
.reading-list p { margin: .5rem 0 0; }
.reading-list .reading-kind { color: var(--footer, #56636b); font-size: .85rem; margin: 0 0 .35rem; }
@media (max-width: 640px) { .selected-readings > ul { grid-template-columns: 1fr; gap: 1rem; } }
`;

module.exports = { urlLeituras, carregarLeituras, gerarResumoLeituras, gerarConteudoLeituras, criarSchemaLeituras, estilosLeituras };
