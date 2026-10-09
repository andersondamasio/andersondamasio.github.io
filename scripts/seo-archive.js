const { normalizarCategoria } = require("./seo-categories");

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const meses = ["janeiro", "fevereiro", "mar\u00e7o", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function chaveMes(data) {
  const valor = new Date(data);
  if (!data || !Number.isFinite(valor.getTime())) throw new Error("Arquivo cronologico exige data de publicacao valida.");
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(valor);
  return `${partes.find(p => p.type === "year").value}-${partes.find(p => p.type === "month").value}`;
}

function nomeMes(chave) {
  const [ano, mes] = chave.split("-");
  return `${meses[Number(mes) - 1]} de ${ano}`;
}

function agruparArquivo(artigos) {
  const grupos = new Map();
  const vistos = new Set();
  for (const artigo of artigos) {
    if (!/^artigos\/[a-z0-9/-]+\.html$/.test(artigo.url || "")) throw new Error("URL de artigo invalida no arquivo.");
    if (vistos.has(artigo.url)) throw new Error(`URL repetida no arquivo: ${artigo.url}`);
    vistos.add(artigo.url);
    const chave = chaveMes(artigo.data);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(artigo);
  }
  return [...grupos].sort(([a], [b]) => b.localeCompare(a)).map(([chave, itens]) => ({
    chave, nome: nomeMes(chave), url: `arquivo/${chave}.html`,
    artigos: itens.sort((a, b) => new Date(b.data) - new Date(a.data) || a.url.localeCompare(b.url))
  }));
}

function indiceMeses(grupos, { categoria } = {}) {
  const mesesDaCategoria = categoria ? grupos.filter(g => g.artigos.some(a => normalizarCategoria(a.categoria, a.titulo) === categoria)) : grupos;
  return `<section class="archive-months" aria-labelledby="archive-months-title"><h2 id="archive-months-title">Arquivo por m&ecirc;s</h2><ul>${mesesDaCategoria.map(g => `<li><a href="/${g.url}">${escapeHtml(g.nome)}</a> <span>(${g.artigos.length})</span></li>`).join("\n")}</ul></section>`;
}

function conteudoMes(grupo) {
  const porDia = new Map();
  for (const artigo of grupo.artigos) {
    const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit" }).format(new Date(artigo.data));
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(artigo);
  }
  const dias = [...porDia];
  const atalhos = dias.length > 1 ? `<details class="archive-date-selector"><summary>Datas de publica&ccedil;&atilde;o</summary><nav class="archive-days" aria-label="Dias de publicacao">${dias.map(([dia]) => `<a href="#dia-${dia}">${dia}</a>`).join("\n")}</nav></details>` : "";
  return `${atalhos}${dias.map(([dia, artigos]) => `<section aria-labelledby="dia-${dia}"><h2 id="dia-${dia}">${Number(dia)} de ${escapeHtml(grupo.nome)}</h2><ul class="article-index">${artigos.map(a => `<li><a href="/${a.url}">${escapeHtml(a.titulo)}</a><span>${escapeHtml(normalizarCategoria(a.categoria, a.titulo))}</span></li>`).join("\n")}</ul></section>`).join("\n")}`;
}

// Chronological continuation pages are alternative access paths, not search landing pages.
function politicaListagem({ papel, indice = 0, categoriaElegivel = true }) {
  if (!["perfil", "categoria", "arquivo"].includes(papel) || !Number.isInteger(indice) || indice < 0) throw new Error("Papel de listagem invalido.");
  const indexavel = indice === 0 && (papel !== "categoria" || categoriaElegivel);
  return { robots: indexavel ? "index, follow" : "noindex, follow", sitemap: indexavel };
}

const estilosArquivo = `
.archive-months ul { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.7rem 1.5rem; padding-left: 1.2rem; }
.archive-months { border-top: 1px solid #d3dbe2; margin-top: 2rem; padding-top: 1rem; }
.archive-months h2, .archive-content h2 { font-size: 1.25rem; }
.archive-months span, .article-index span { color: var(--footer, #58616b); font-size: 0.875rem; }
.archive-content { max-width: 960px; margin: auto; padding: 2rem 1.5rem; box-sizing: border-box; }
.archive-content h1 { font-size: 1.8rem; overflow-wrap: anywhere; }
.archive-content a { overflow-wrap: anywhere; }
.archive-content h2[id] { scroll-margin-top: 8rem; }
.archive-date-selector summary { cursor: pointer; padding: 0.75rem 0; color: var(--link); }
.archive-content .article-index { list-style: none; padding: 0; }
.archive-content .article-index li { padding: 0.8rem 0; border-bottom: 1px solid #d3dbe2; }
.archive-content .article-index span { display: block; margin-top: 0.3rem; }
.archive-days { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1.5rem 0; }
.archive-days a { display: grid; place-items: center; min-width: 2.75rem; min-height: 2.75rem; border-bottom: 2px solid #13766d; }
.archive-navigation { display: flex; flex-wrap: wrap; gap: 1rem; margin: 2rem 0; }
`;

module.exports = { agruparArquivo, chaveMes, nomeMes, indiceMeses, conteudoMes, politicaListagem, estilosArquivo };
