const { versaoPoliticaEditorial } = require("../editorial-policy");
const { criarDossie, aprovarRascunho, checklistObrigatorio } = require("../editorial-review");

// Synthetic local fixture. Never use this attestation for real editorial approval.
function rascunhoFixture(alteracoes = {}) {
  const rascunho = {
    versao: 2, politica: versaoPoliticaEditorial, estado: "revisao_pendente", publicado: false,
    revisaoHumana: null, criadoEm: "2026-10-01T12:00:00Z", pendencias: ["revisao-humana"],
    titulo: "Contratos de mensagens em uma fila de eventos", categoria: "Arquitetura",
    resumo: "Uma fixture de testes para exercitar a revisao de contratos de eventos.",
    corpoArtigo: '<h2>Contrato da fila de exemplo</h2><p>A fila de exemplo entrega mensagens em ordem.</p><p>Como hipotese, uma equipe pode versionar o contrato para comparar consumidores.</p><p>Este exemplo nao demonstra ganhos de desempenho em producao.</p>',
    fonte: { url: "https://example.org/contrato", titulo: "Contrato de teste", consultadaEm: "2026-10-01T12:00:00Z" },
    ...alteracoes
  };
  rascunho.dossie = criarDossie(rascunho);
  rascunho.dossie.pauta.pergunta = "Como comparar o contrato de consumidores da fila?";
  rascunho.dossie.fontes[0].tipo = "primaria";
  rascunho.dossie.fontes[0].resumoEvidencia = "Fonte sintetica usada somente no teste offline.";
  rascunho.dossie.afirmacoes = [{
    tipo: "fato", trecho: "A fila de exemplo entrega mensagens em ordem.",
    fonteUrl: rascunho.fonte.url, localizacaoNaFonte: "Paragrafo inicial da fixture de contrato.",
    verificacao: "Afirmacao sintetica conferida apenas no contexto deste teste."
  }];
  rascunho.dossie.contribuicao = {
    descricao: "Comparar contratos sem atribuir resultados reais ao exemplo.",
    trecho: "Como hipotese, uma equipe pode versionar o contrato para comparar consumidores."
  };
  rascunho.dossie.limites = "Este exemplo nao demonstra ganhos de desempenho em producao.";
  rascunho.dossie.duplicidade = { candidatos: [], decisao: "novo-artigo", justificativa: "Acervo vazio utilizado somente nesta fixture de teste." };
  return rascunho;
}

function aprovacaoFixture(rascunho = rascunhoFixture(), titulos = []) {
  return aprovarRascunho(rascunho, {
    responsavel: "Revisor sintetico de teste offline",
    checklist: Object.fromEntries(checklistObrigatorio.map(c => [c, true])), confirmacaoHumana: "REVISEI INTEGRALMENTE"
  }, titulos, new Date("2026-10-02T12:00:00Z"));
}

module.exports = { rascunhoFixture, aprovacaoFixture };
