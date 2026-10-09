const { authorName, authorSameAs } = require("./seo-identity");

const descricaoPerfil = "Anderson Damasio, arquiteto de software com atua\u00e7\u00e3o em desenvolvimento de sistemas desde 2005. Perfil, contato e artigos sobre arquitetura e tecnologia.";

function gerarApresentacaoPerfil() {
  return `<section class="profile-intro" aria-labelledby="profile-title">
<img src="/favicon.ico" alt="Marca de Anderson Damasio" width="48" height="48" decoding="async" class="profile-mark">
<h1 id="profile-title">${authorName}</h1>
<p class="profile-role">Arquiteto de Software</p>
<p>Atuo com desenvolvimento de sistemas desde 2005. Este &eacute; meu site pessoal, com perfil profissional e artigos sobre arquitetura de software e tecnologia.</p>
<nav class="profile-links" aria-label="Perfil e contato"><a href="/sobre.html">Sobre Anderson Damasio</a><a href="${authorSameAs[0]}" rel="me noopener noreferrer">LinkedIn</a><a href="/contato.html">Contato</a></nav>
</section>`;
}

function gerarSobrePerfil() {
  return `<section class="profile-intro" aria-labelledby="profile-title">
<img src="/favicon.ico" alt="Marca de Anderson Damasio" width="48" height="48" decoding="async" class="profile-mark">
<h1 id="profile-title">Anderson Damasio</h1>
<p class="profile-role">Arquiteto de Software</p>
<p>Atuo com desenvolvimento de sistemas desde 2005, com foco em arquitetura de software. Mantenho este site para reunir meu perfil profissional e publicar conte&uacute;do t&eacute;cnico em portugu&ecirc;s.</p>
<p>Meu perfil profissional est&aacute; no <a href="${authorSameAs[0]}" rel="me noopener noreferrer">LinkedIn de Anderson Damasio</a>.</p>
</section>
<section aria-labelledby="temas-title"><h2 id="temas-title">Temas do site</h2>
<p>Os artigos acompanham decis&otilde;es de arquitetura, desenvolvimento de sistemas e aplica&ccedil;&otilde;es de intelig&ecirc;ncia artificial. O foco editorial &eacute; explicar fatos, escolhas t&eacute;cnicas e seus limites para desenvolvedores e arquitetos.</p>
<p><a href="/artigos/index.html">Explorar os artigos por assunto</a></p></section>
<section id="criterios-editoriais" aria-labelledby="editorial-title"><h2 id="editorial-title">Como o conte&uacute;do &eacute; produzido</h2>
<p>Os artigos s&atilde;o produzidos com apoio de intelig&ecirc;ncia artificial, a partir de fontes externas. S&atilde;o not&iacute;cias e an&aacute;lises baseadas em fontes, n&atilde;o relatos de experi&ecirc;ncia pessoal, projetos de clientes ou testes realizados por mim.</p>
<p>A nova rotina separa rascunho, revis&atilde;o e publica&ccedil;&atilde;o. Uma revis&atilde;o humana s&oacute; &eacute; indicada no artigo quando existe um registro correspondente &agrave;quela vers&atilde;o. Os textos anteriores sem esse registro s&atilde;o identificados como parte do acervo ainda n&atilde;o revisado individualmente.</p>
<ul><li>Afirma&ccedil;&otilde;es factuais devem ter suporte nas fontes citadas.</li><li>Infer&ecirc;ncias e exemplos hipot&eacute;ticos devem ser reconhec&iacute;veis como tais.</li><li>Uma an&aacute;lise deve responder a uma pergunta concreta, sem apenas reescrever a not&iacute;cia original.</li><li>Imagens de terceiros exigem permiss&atilde;o ou licen&ccedil;a compat&iacute;vel; citar a origem n&atilde;o substitui essa autoriza&ccedil;&atilde;o.</li></ul>
<p>Encontrou um erro ou uma informa&ccedil;&atilde;o desatualizada? Envie a URL do artigo e, quando poss&iacute;vel, a fonte que permite conferir a corre&ccedil;&atilde;o.</p></section>
<section aria-labelledby="contact-title"><h2 id="contact-title">Contato</h2>
<p><a href="mailto:anderson@andersondamasio.com.br">anderson@andersondamasio.com.br</a></p>
<p><a href="/contato.html">Formul&aacute;rio de contato</a> &middot; <a href="/">P&aacute;gina inicial</a></p></section>`;
}

const estilosPerfil = `
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', sans-serif; margin: 0; background: var(--bg, #f4f6f7); color: var(--text, #252a2e); }
main { width: min(100%, 960px); margin: 0 auto; padding: 2rem 1.5rem; background: none; border-radius: 0; box-shadow: none; }
main section { margin: 0; padding: 1.5rem 0; border-bottom: 1px solid #b9c6ce; }
main section:last-child { border-bottom: 0; }
.profile-intro { max-width: 760px; }
.profile-mark { display: block; margin-bottom: 1rem; }
.profile-intro h1 { font-size: 2.25rem; line-height: 1.15; margin: 0 0 .65rem; color: var(--text, #252a2e); }
.profile-role { color: #087d73; font-size: 1.2rem; font-weight: 600; margin: 0 0 1rem; }
main h2 { font-size: 1.35rem; margin: 0 0 1rem; }
main p, main li { line-height: 1.65; overflow-wrap: anywhere; }
.profile-links { display: flex; flex-wrap: wrap; gap: .75rem 1.5rem; margin-top: 1.5rem; }
.article-index { list-style: none; padding: 0; margin: 0; }
.article-index li { padding: .8rem 0; border-bottom: 1px solid #d4dde2; }
.article-index time { display: block; color: var(--footer, #56636b); font-size: .85rem; }
body.dark-theme .profile-role { color: #79d7c5; }
@media (max-width: 540px) { main { padding: 1rem; } .profile-intro h1 { font-size: 1.9rem; } }
`;

module.exports = { descricaoPerfil, gerarApresentacaoPerfil, gerarSobrePerfil, estilosPerfil };
