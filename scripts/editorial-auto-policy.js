const { createHash } = require('node:crypto');
const cheerio = require('cheerio');
const { validarDossie, hashRascunho, textoHtml, candidatosDuplicidade } = require('./editorial-review');

const politicaAutomatica = '2026-11-17.1';
const controles = ['fatosFontes', 'tituloResumo', 'inferencias', 'coberturaIntegral', 'utilidade', 'direitos', 'semVivenciaInventada'];
const digest = texto => createHash('sha256').update(texto).digest('hex');

function avaliarRevisaoAutomatica(r, titulos = [], agora = new Date()) {
  const resultado = validarDossie(r, titulos);
  const motivos = resultado.motivos;
  if (r.revisaoEditorial?.aceita === false || r.qualidadeArtigo?.aceita === false || r.qualidadeFonte?.aceita === false) motivos.push('controle-editorial-retido');
  const auditoria = r.auditoriaAutomatica;
  const fontes = auditoria?.fontes || [];
  const parecer = auditoria?.parecer;
  if (!auditoria || auditoria.politica !== politicaAutomatica || !auditoria.modelo ||
      !Number.isFinite(Date.parse(auditoria.verificadoEm)) || Date.parse(auditoria.verificadoEm) > agora.getTime() ||
      !parecer || parecer.decisao !== 'publicar' || !Array.isArray(parecer.pendencias) || parecer.pendencias.length ||
      controles.some(c => parecer.controles?.[c] !== true)) motivos.push('revisao-automatica-incompleta');
  if (Date.parse(auditoria?.verificadoEm) < agora.getTime() - 7 * 86400000) motivos.push('revisao-automatica-expirada');
  if (!fontes.length || fontes.some(f => !/^[a-f0-9]{64}$/.test(f.hashTexto || '') || !f.url ||
      !Number.isFinite(Date.parse(f.consultadaEm)) || Date.parse(f.consultadaEm) > agora.getTime() ||
      Date.parse(f.consultadaEm) < agora.getTime() - 7 * 86400000)) motivos.push('fontes-nao-consultadas');
  if ((r.dossie?.fontes || []).some(f => !fontes.some(s => s.url === f.url && s.tipo === f.tipo))) motivos.push('fonte-fora-da-consulta');
  if (r.revisaoHumana) motivos.push('revisoes-ambiguas');
  if (candidatosDuplicidade(r, titulos).length) motivos.push('sobreposicao-requer-revisao');
  const $ = cheerio.load(r.corpoArtigo || '', null, false);
  if ($('img, pre, table').length) motivos.push('midia-ou-exemplo-exige-revisao-especifica');
  const afirmacoes = r.dossie?.afirmacoes || [];
  // Every prose block must be accounted for; structural checks are not a truth detector.
  const blocos = $('p, li, blockquote').toArray().filter(el => !$(el).children('p, li, blockquote, ul, ol').length)
    .map(el => textoHtml($(el).html())).filter(Boolean);
  if (!blocos.length || blocos.some(b => !afirmacoes.some(a => textoHtml(a.trecho) === b))) motivos.push('cobertura-de-afirmacoes-incompleta');
  const textoForaDosBlocos = $.root().find('*').addBack().contents().toArray().some(n =>
    n.type === 'text' && n.data.trim() && !$(n).parent().closest('p, li, blockquote, h2, h3, h4').length);
  if (textoForaDosBlocos) motivos.push('texto-fora-do-mapa-de-afirmacoes');
  for (const a of afirmacoes.filter(a => a.tipo === 'fato')) {
    if (!fontes.some(f => f.url === a.fonteUrl) || !a.ancora || a.ancora.length < 10 || a.ancora.length > 140) motivos.push('fato-sem-ancora');
  }
  if (!afirmacoes.some(a => a.tipo === 'fato' && r.dossie?.fontes.some(f => f.url === a.fonteUrl && f.tipo === 'primaria'))) motivos.push('fato-sem-fonte-primaria');
  return { aceita: motivos.length === 0, motivos: [...new Set(motivos)], verificacaoFactualAutomatica: false };
}

function aprovarAutomaticamente(rascunho, { modelo, fontes, parecer }, titulos = [], agora = new Date()) {
  if (rascunho.revisaoHumana || rascunho.revisaoAutomatica || rascunho.publicado) throw new Error('Revisao exige rascunho ainda nao aprovado/publicado.');
  for (const a of rascunho.dossie?.afirmacoes || []) {
    if (a.tipo === 'fato' && !fontes.some(f => f.url === a.fonteUrl && textoHtml(f.texto).includes(textoHtml(a.ancora)))) {
      throw new Error('Ancora factual ausente da fonte consultada.');
    }
  }
  const conteudo = { ...rascunho, pendencias: [], auditoriaAutomatica: {
    politica: politicaAutomatica, modelo, verificadoEm: agora.toISOString(), parecer,
    fontes: fontes.map(({ texto, ...fonte }) => ({ ...fonte, hashTexto: digest(texto) }))
  } };
  const resultado = avaliarRevisaoAutomatica(conteudo, titulos, agora);
  if (!resultado.aceita) throw new Error(`Publicacao automatica retida: ${resultado.motivos.join(', ')}`);
  return { ...conteudo, estado: 'aprovado', revisaoHumana: null, revisaoAutomatica: {
    tipo: 'ia', modelo, politica: politicaAutomatica, aprovadaEm: agora.toISOString(), hash: hashRascunho(conteudo),
    declaracao: 'REVISAO AUTOMATIZADA; SEM APROVACAO HUMANA INDIVIDUAL'
  } };
}

function validarAprovacaoAutomatica(r, titulos = [], agora = new Date()) {
  const resultado = avaliarRevisaoAutomatica(r, titulos, agora);
  const revisao = r.revisaoAutomatica;
  if (r.estado !== 'aprovado' || revisao?.tipo !== 'ia' || revisao.hash !== hashRascunho(r) ||
      revisao.politica !== politicaAutomatica || revisao.modelo !== r.auditoriaAutomatica?.modelo ||
      revisao.aprovadaEm !== r.auditoriaAutomatica?.verificadoEm ||
      revisao.declaracao !== 'REVISAO AUTOMATIZADA; SEM APROVACAO HUMANA INDIVIDUAL') resultado.motivos.push('aprovacao-automatica-ausente-ou-desatualizada');
  if (r.publicado || titulos.some(t => t.editorial?.hash === revisao?.hash)) resultado.motivos.push('rascunho-ja-publicado');
  resultado.aceita = resultado.motivos.length === 0;
  return resultado;
}

module.exports = { politicaAutomatica, controles, aprovarAutomaticamente, validarAprovacaoAutomatica };
