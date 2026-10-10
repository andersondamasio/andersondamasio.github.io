const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { siteUrl, authorSameAs } = require('./seo-identity');
const { hashCorpoEditorial } = require('./seo-helpful-content');
const { avaliarGeneroEditorial } = require('./editorial-policy');
const { validarUrlMedicao } = require('./seo-measurement');
const { digest } = require('./verify-deployment');

const exigir = (valido, campo) => { if (!valido) throw new Error(`Pacote de distribuicao invalido: ${campo}`); };
const identificador = valor => typeof valor === 'string' && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(valor) && valor.length <= 80;
const texto = valor => typeof valor === 'string' && valor.trim().length >= 20 && valor.length <= 2500 && !/[<>]/.test(valor);
const hashArquivo = arquivo => createHash('sha256').update(fs.readFileSync(arquivo)).digest('hex');

function criarLinkCampanha(url, campanha, conteudo) {
  exigir(identificador(campanha) && identificador(conteudo), 'identificadores UTM');
  const destino = new URL(validarUrlMedicao(url));
  destino.search = new URLSearchParams({ utm_source: 'linkedin', utm_medium: 'social',
    utm_campaign: campanha, utm_content: conteudo }).toString();
  return destino.href;
}

function prepararDistribuicao(config, root = process.cwd(), { lerPublicado } = {}) {
  exigir(config?.versao === 1 && identificador(config.id), 'versao ou id');
  exigir(config.estado === 'rascunho', 'nao autoriza aprovacao ou publicacao');
  exigir(authorSameAs.includes(config.perfil) && config.perfil.startsWith('https://www.linkedin.com/'), 'perfil oficial');
  exigir(/^[a-f0-9]{40}$/.test(config.revisaoPublicada || ''), 'revisao Git');
  exigir(/^\.editorial\/medicoes\/[a-zA-Z0-9-]+\.json$/.test(config.medicao || ''), 'medicao privada');
  const medicaoPath = path.join(root, config.medicao);
  const medicao = JSON.parse(fs.readFileSync(medicaoPath, 'utf8'));
  exigir(medicao.deployConfirmado === true && medicao.revisaoEsperada === config.revisaoPublicada, 'publicacao nao comprovada');
  exigir(Array.isArray(config.itens) && config.itens.length > 0 && config.itens.length <= 10, 'itens');
  const cadastro = JSON.parse(fs.readFileSync(path.join(root, 'titulos.json'), 'utf8'));
  const lerGit = lerPublicado || (arquivo => execFileSync('git', ['show', `${config.revisaoPublicada}:${arquivo}`],
    { cwd: root, encoding: 'utf8', maxBuffer: 20e6 }));
  const ids = new Set(), urls = new Set();
  const itens = config.itens.map(item => {
    exigir(identificador(item.id) && !ids.has(item.id), 'id do material');
    ids.add(item.id);
    exigir(/^artigos\/[a-z0-9/-]+\.html$/.test(item.url || '') && !urls.has(item.url), 'URL do artigo');
    urls.add(item.url);
    const registros = cadastro.filter(r => r.url === item.url && r.localizacao?.estado !== 'pendente');
    exigir(registros.length === 1, 'cadastro ausente ou ambiguo');
    const html = fs.readFileSync(path.join(root, item.url), 'utf8');
    exigir(digest(html) === digest(lerGit(item.url)), 'HTML local diverge da revisao publicada');
    const $ = cheerio.load(html);
    const canonical = `${siteUrl}/${item.url}`;
    exigir($('.article-body').length === 1 && !$('meta[http-equiv=refresh]').length, 'pagina sem corpo ou alias');
    exigir($('link[rel=canonical]').attr('href') === canonical && !/noindex/i.test($('meta[name=robots]').attr('content') || ''), 'canonical ou robots');
    exigir(hashCorpoEditorial($('.article-body').html()) === item.conteudoHash, 'corpo alterado; reconferir promessa e texto');
    const observadas = medicao.observacoes.filter(o => o.url === canonical);
    exigir(observadas.length === 1 && observadas[0].http?.status === 200 && observadas[0].pagina?.correspondeAoGit === true &&
      observadas[0].pagina?.canonical === canonical && observadas[0].pagina?.permiteIndexacaoDeclarada === true, 'URL nao conferida publicamente');
    for (const campo of ['publico', 'pergunta', 'resposta', 'objetivoProfissional', 'limites', 'postLinkedin']) exigir(texto(item[campo]), campo);
    exigir(!/https?:\/\//i.test(item.postLinkedin), 'links do post sao gerados a partir da URL conferida');
    exigir(avaliarGeneroEditorial({ titulo: registros[0].titulo, corpoArtigo: `<p>${item.postLinkedin}</p>` }).aceita, 'vivencia no rascunho');
    exigir(Array.isArray(item.recursos) && item.recursos.length > 0, 'recursos');
    const recursos = item.recursos.map(arquivo => {
      exigir(/^exemplos\/[a-z0-9-]+\/[A-Za-z][A-Za-z0-9.-]*\.(?:js|json|cpp|hpp|cs|csproj|md)$/.test(arquivo), 'caminho do recurso');
      return { arquivo, hash: hashArquivo(path.join(root, arquivo)) };
    });
    return { id: item.id, url: item.url, conteudoHash: item.conteudoHash,
      ...Object.fromEntries(['publico', 'pergunta', 'resposta', 'objetivoProfissional', 'limites', 'postLinkedin'].map(c => [c, item[c]])),
      titulo: registros[0].titulo, canonical, linkCampanha: criarLinkCampanha(canonical, config.id, item.id), recursos };
  });
  return { versao: 1, id: config.id, estado: 'rascunho', aprovacao: null, publicadoEm: null, perfil: config.perfil,
    revisaoPublicada: config.revisaoPublicada, medicao: { arquivo: config.medicao, hash: hashArquivo(medicaoPath), verificadaEm: medicao.geradoEm },
    limites: 'Preparacao local. Nao publica em redes, nao configura Analytics e nao comprova demanda ou resultados no Google. Conferencia automatica nao e aprovacao humana.', itens };
}

function renderizarPacote(pacote) {
  const partes = [`# Materiais para revisao: ${pacote.id}`, 'Estado: rascunho. Nenhum post aprovado, agendado ou publicado.',
    `Perfil oficial: ${pacote.perfil}`, pacote.limites];
  for (const item of pacote.itens) {
    partes.push(`## ${item.titulo}`, `Publico: ${item.publico}`, `Pergunta: ${item.pergunta}`, `Entrega: ${item.resposta}`,
      `Objetivo profissional: ${item.objetivoProfissional}`, `Limites: ${item.limites}`,
      `Pagina canonica: ${item.canonical}`, '### Rascunho para LinkedIn', item.postLinkedin, item.linkCampanha,
      '### Recursos conferidos', ...item.recursos.map(r => `- ${r.arquivo}: SHA-256 ${r.hash}`));
  }
  partes.push('## Uso e acompanhamento',
    'Revisar texto, fatos e contexto antes de autorizar qualquer publicacao externa. Nao repetir o mesmo texto em comunidades ou enviar mensagens em massa.',
    'Os links UTM identificam esta divulgacao externa; nao devem substituir canonicals ou links internos do site. Nao incluir dados de pessoas nos parametros.',
    'A ficha de medicao inicia sem numeros. Registrar data real e URL do post somente depois da publicacao autorizada. A preparacao nao inicia a janela de acompanhamento.',
    'Usar periodos, filtros e dimensoes equivalentes ao comparar GA4 ou Search Console. Sessoes engajadas nao comprovam contatos qualificados; contar contatos recebidos separadamente, sem gravar nomes ou mensagens nesta ficha.');
  return partes.join('\n\n') + '\n';
}

function criarFicha(pacote) {
  return { versao: 1, campanha: pacote.id, publicacaoExterna: { estado: 'nao-publicada', em: null, url: null },
    observacoes: [], limites: 'Preencher apenas com dados agregados e procedencia. Campo desconhecido e null, nao zero. Nenhum dado foi coletado.',
    modeloObservacao: { fonte: 'ga4', inicio: null, fim: null, fuso: null,
      escopo: { relatorio: 'aquisicao-de-trafego', dimensoes: ['sessionSourceMedium', 'sessionCampaignName'],
        filtros: { sessionSourceMedium: 'linkedin / social', sessionCampaignName: pacote.id },
        definicaoQualificada: 'Sessao engajada e um indicador de leitura, nao de contato qualificado.' },
      evidencia: { arquivo: null, sha256: null, coletadoEm: null },
      metricas: { sessoes: null, sessoesEngajadas: null } } };
}

function salvarPacote(pacote, root = process.cwd()) {
  exigir(identificador(pacote.id), 'id de saida');
  exigir(pacote.estado === 'rascunho' && pacote.aprovacao === null && pacote.publicadoEm === null, 'saida somente como rascunho');
  const dir = path.join(root, '.editorial', 'distribuicao', pacote.id);
  exigir(!fs.existsSync(dir), 'pasta existente; preservar revisoes e medicoes');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'pacote.json'), JSON.stringify(pacote, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(dir, 'materiais.md'), renderizarPacote(pacote), { flag: 'wx' });
  fs.writeFileSync(path.join(dir, 'medicao.json'), JSON.stringify(criarFicha(pacote), null, 2) + '\n', { flag: 'wx' });
  return dir;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Uso: node scripts/editorial-outreach.js arquivo-configuracao.json. Prepara somente rascunhos privados.');
    const pacote = prepararDistribuicao(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
    const diretorio = salvarPacote(pacote);
    console.log(JSON.stringify({ diretorio, materiais: pacote.itens.length, estado: pacote.estado, publicado: false }, null, 2));
  } catch (erro) { console.error(erro.message); process.exitCode = 1; }
}

module.exports = { criarLinkCampanha, prepararDistribuicao, renderizarPacote, criarFicha, salvarPacote };
