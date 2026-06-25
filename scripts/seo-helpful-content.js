const { normalizarFonteUrl } = require("./seo-source-citation");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function limparTextoCurto(value, fallback = "") {
  const text = String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

function normalizarTexto(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function formatarDataFonte(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function acoesPorCategoria(category) {
  const normalized = normalizarTexto(category);

  if (/seguranca/.test(normalized)) {
    return [
      "Revise o modelo de ameaças antes de transformar a novidade em decisão de arquitetura.",
      "Valide autenticação, autorização, auditoria e exposição de dados nos pontos afetados.",
      "Defina sinais observáveis para perceber abuso, falha de integração ou regressão de segurança."
    ];
  }

  if (/inteligencia artificial|ia|machine learning/.test(normalized)) {
    return [
      "Avalie qualidade dos dados, critérios de teste e limites do modelo antes de levar a ideia para produção.",
      "Separe claramente automação, apoio à decisão e decisão autônoma para reduzir risco operacional.",
      "Inclua métricas de custo, latência, acurácia e revisão humana no desenho da solução."
    ];
  }

  if (/banco de dados|dados/.test(normalized)) {
    return [
      "Confira impacto em consistência, latência, custo de armazenamento e estratégia de recuperação.",
      "Teste o comportamento com volume realista antes de assumir ganhos de desempenho.",
      "Documente trade-offs de índice, particionamento, replicação e governança de dados."
    ];
  }

  if (/devops|cloud|observabilidade|infraestrutura/.test(normalized)) {
    return [
      "Transforme a ideia em hipótese mensurável com SLO, métricas e plano de rollback.",
      "Valide custo, automação, segurança e operação antes de ampliar o uso em ambientes críticos.",
      "Inclua logs, traces e alertas que comprovem se a mudança melhorou a experiência real."
    ];
  }

  if (/carreira|lideranca|negocios|produtividade/.test(normalized)) {
    return [
      "Converta o aprendizado em uma decisão pequena que possa ser testada pelo time nesta semana.",
      "Observe efeitos em comunicação, autonomia, fluxo de trabalho e qualidade da entrega.",
      "Registre critérios objetivos para saber se a mudança trouxe resultado ou apenas mais processo."
    ];
  }

  return [
    "Use o caso como gatilho para revisar decisões técnicas, dependências e premissas do seu contexto.",
    "Compare o impacto prometido com custo, risco, manutenção e experiência de quem usa o sistema.",
    "Crie um experimento pequeno antes de transformar a tendência em padrão de arquitetura."
  ];
}

function fontePrincipalHtml({ sourceUrl, sourceTitle }) {
  const url = normalizarFonteUrl(sourceUrl);
  const title = limparTextoCurto(sourceTitle, "fonte original");

  if (!url) {
    return "<strong>Fonte principal:</strong> este conteúdo não possui URL externa cadastrada no histórico; a validação fica limitada ao texto publicado e aos metadados do próprio site.";
  }

  return `<strong>Fonte principal:</strong> o ponto de partida foi <a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>.`;
}

function gerarSecoesConteudoUtil({ title, category, sourceUrl, sourceTitle, sourceDate }) {
  const safeTitle = limparTextoCurto(title, "este tema");
  const safeCategory = limparTextoCurto(category, "Tecnologia");
  const dataFonte = formatarDataFonte(sourceDate);
  const temFonteExterna = Boolean(normalizarFonteUrl(sourceUrl));
  const practicalItems = acoesPorCategoria(safeCategory)
    .map(item => `<li>${escapeHtml(item)}</li>`)
    .join("\n");
  const validationItems = [
    `<li>${fontePrincipalHtml({ sourceUrl, sourceTitle })}</li>`,
    dataFonte
      ? `<li><strong>Data considerada:</strong> ${temFonteExterna ? "a fonte externa ou data original registrada" : "a data editorial registrada para este artigo"} é ${escapeHtml(dataFonte)}.</li>`
      : null,
    `<li><strong>Recorte editorial:</strong> a análise conecta o tema "${escapeHtml(safeTitle)}" à categoria <strong>${escapeHtml(safeCategory)}</strong> e ao impacto para arquitetura, times e decisões técnicas.</li>`,
    '<li><strong>Limites da análise:</strong> projeções e recomendações são tratadas como interpretação técnica, não como fato confirmado pela fonte.</li>'
  ].filter(Boolean);

  return [
    '<section class="article-validation" aria-labelledby="article-validation-title">',
    '<h2 id="article-validation-title">O que foi verificado</h2>',
    '<ul>',
    ...validationItems,
    '</ul>',
    '</section>',
    '<section class="article-usefulness" aria-labelledby="article-usefulness-title">',
    '<h2 id="article-usefulness-title">Como aplicar essa leitura</h2>',
    '<ul>',
    practicalItems,
    '</ul>',
    '</section>'
  ].join("\n");
}

function removerSecoesConteudoUtil(html) {
  return String(html || "")
    .replace(/\n?<section\s+class=["'][^"']*\barticle-validation\b[^"']*["'][\s\S]*?<\/section>\s*/gi, "\n")
    .replace(/\n?<section\s+class=["'][^"']*\barticle-usefulness\b[^"']*["'][\s\S]*?<\/section>\s*/gi, "\n");
}

function ensureHelpfulContentStyles(html) {
  if (/\.article-validation\b/i.test(html) && /\.article-usefulness\b/i.test(html)) return html;

  const css = [
    ".article-validation, .article-usefulness { margin-top: 2rem; padding: 1rem 1.1rem; border-left: 4px solid var(--link, #0a66c2); background: rgba(10,102,194,0.06); border-radius: 8px; }",
    ".article-validation h2, .article-usefulness h2 { margin-top: 0; font-size: 1.15rem; color: var(--text, #333); }",
    ".article-validation ul, .article-usefulness ul { margin: 0; padding-left: 1.2rem; }",
    ".article-validation li, .article-usefulness li { margin: 0.5rem 0; }",
    ""
  ].join("\n");

  return String(html || "").replace(/<\/style>/i, `${css}</style>`);
}

function inserirSecoesConteudoUtil(html, options) {
  const secoes = gerarSecoesConteudoUtil(options);
  const semSecoesAntigas = removerSecoesConteudoUtil(html);
  const comEstilos = ensureHelpfulContentStyles(semSecoesAntigas);

  const depoisDoCorpo = comEstilos.replace(
    /(<div\s+class=["'][^"']*\barticle-body\b[^"']*["'][^>]*>[\s\S]*?<\/div>)/i,
    (_, articleBody) => `${articleBody}\n${secoes}`
  );
  if (depoisDoCorpo !== comEstilos) return depoisDoCorpo;

  const antesDaFonte = comEstilos.replace(
    /(<section\s+class=["'][^"']*\barticle-source\b[^"']*["'][\s\S]*?<\/section>)/i,
    (_, sourceSection) => `${secoes}\n${sourceSection}`
  );
  if (antesDaFonte !== comEstilos) return antesDaFonte;

  const antesDoVoltar = comEstilos.replace(
    /(<p\s+class=["'][^"']*\bback-link\b[^"']*["'][^>]*>)/i,
    (_, backLink) => `${secoes}\n${backLink}`
  );
  if (antesDoVoltar !== comEstilos) return antesDoVoltar;

  return comEstilos.replace(/(<\/main>)/i, (_, mainClose) => `${secoes}\n${mainClose}`);
}

function avaliarSecoesConteudoUtil($) {
  const validation = $(".article-validation").first();
  const usefulness = $(".article-usefulness").first();
  const validationText = validation.text();
  const usefulnessText = usefulness.text();

  return {
    validationOk: validation.length > 0 &&
      validation.find("li").length >= 3 &&
      /fonte principal/i.test(validationText) &&
      /recorte editorial/i.test(validationText) &&
      /limites da an[aá]lise/i.test(validationText),
    usefulnessOk: usefulness.length > 0 &&
      usefulness.find("li").length >= 3 &&
      /como aplicar/i.test(usefulnessText)
  };
}

module.exports = {
  avaliarSecoesConteudoUtil,
  gerarSecoesConteudoUtil,
  inserirSecoesConteudoUtil,
  removerSecoesConteudoUtil
};
