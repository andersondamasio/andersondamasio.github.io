const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');

const campos = { ga4: ['sessoes', 'sessoesEngajadas'], searchConsole: ['impressoes', 'cliques'], contatos: ['recebidos', 'qualificados'] };
const exigir = (valido, campo) => { if (!valido) throw new Error(`Observacao invalida: ${campo}`); };
function dataCivil(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return NaN;
  const instante = Date.parse(`${valor}T00:00:00Z`);
  return Number.isFinite(instante) && new Date(instante).toISOString().slice(0, 10) === valor ? instante : NaN;
}
function diaNoFuso(instante, fuso) {
  const partes = new Intl.DateTimeFormat('en', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instante);
  return ['year', 'month', 'day'].map(tipo => partes.find(p => p.type === tipo).value).join('-');
}

function validarObservacao(observacao, root = process.cwd(), agora = new Date()) {
  exigir(observacao && Object.hasOwn(campos, observacao.fonte), 'fonte');
  const inicio = dataCivil(observacao.inicio), fim = dataCivil(observacao.fim);
  exigir(Number.isFinite(inicio) && Number.isFinite(fim) && inicio <= fim && fim < agora.getTime(), 'periodo');
  exigir(typeof observacao.fuso === 'string' && observacao.fuso.length > 0, 'fuso');
  try { new Intl.DateTimeFormat('en', { timeZone: observacao.fuso }).format(agora); } catch { exigir(false, 'fuso'); }
  exigir(observacao.fim < diaNoFuso(agora, observacao.fuso), 'periodo ainda aberto no fuso informado');
  const escopo = observacao.escopo;
  exigir(escopo && typeof escopo.relatorio === 'string' && escopo.relatorio.length > 0 &&
    Array.isArray(escopo.dimensoes) && escopo.dimensoes.length > 0 && escopo.dimensoes.every(d => typeof d === 'string' && d.length > 0) &&
    escopo.filtros && typeof escopo.filtros === 'object' && !Array.isArray(escopo.filtros) &&
    typeof escopo.definicaoQualificada === 'string' && escopo.definicaoQualificada.length >= 20, 'escopo e definicao');
  const nomes = campos[observacao.fonte];
  exigir(observacao.metricas && Object.keys(observacao.metricas).sort().join(',') === [...nomes].sort().join(','), 'campos de metricas');
  for (const nome of nomes) exigir(observacao.metricas[nome] === null ||
    (Number.isSafeInteger(observacao.metricas[nome]) && observacao.metricas[nome] >= 0), nome);
  const [total, parte] = nomes.map(nome => observacao.metricas[nome]);
  exigir(observacao.fonte === 'searchConsole' || total === null || parte === null || parte <= total, 'parte maior que total');
  const evidencia = observacao.evidencia;
  exigir(evidencia && /^\.editorial\/evidencias\/[a-z0-9/_-]+\.(?:json|csv|png|pdf)$/.test(evidencia.arquivo || '') &&
    /^[a-f0-9]{64}$/.test(evidencia.sha256 || ''), 'arquivo privado de evidencia');
  const coletado = Date.parse(evidencia.coletadoEm);
  exigir(typeof evidencia.coletadoEm === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(evidencia.coletadoEm) &&
    Number.isFinite(coletado) && coletado >= fim && coletado <= agora.getTime(), 'data de coleta UTC');
  const coletaIso = evidencia.coletadoEm.length === 20 ? evidencia.coletadoEm.slice(0, -1) + '.000Z' : evidencia.coletadoEm;
  exigir(new Date(coletado).toISOString() === coletaIso, 'data de coleta invalida');
  exigir(observacao.fim < diaNoFuso(new Date(coletado), observacao.fuso), 'coleta anterior ao fechamento do periodo');
  const hash = createHash('sha256').update(fs.readFileSync(path.join(root, evidencia.arquivo))).digest('hex');
  exigir(hash === evidencia.sha256, 'hash da evidencia');
  return { ...observacao, dias: Math.round((fim - inicio) / 86400000) + 1,
    taxa: total !== null && parte !== null && total > 0 ? parte / total : null,
    avisos: observacao.fonte === 'searchConsole' && total !== null && parte !== null && parte > total
      ? ['Conferir cliques, impressoes e agregacao no relatorio original antes de interpretar a taxa. Valores preservados.'] : [],
    evidenciaPreservada: true, conferenciaFactual: 'nao-realizada-pelo-validador' };
}

function compararObservacoes(a, b, root = process.cwd(), agora = new Date()) {
  const antes = validarObservacao(a, root, agora), depois = validarObservacao(b, root, agora);
  const motivos = [];
  if (antes.fonte !== depois.fonte) motivos.push('fontes-diferentes');
  if (antes.fuso !== depois.fuso) motivos.push('fusos-diferentes');
  if (antes.dias !== depois.dias) motivos.push('duracoes-diferentes');
  if (!isDeepStrictEqual(antes.escopo, depois.escopo)) motivos.push('escopos-diferentes');
  if (antes.fim >= depois.inicio) motivos.push('periodos-sobrepostos-ou-fora-de-ordem');
  const deltas = {};
  if (!motivos.length) for (const nome of campos[antes.fonte]) {
    const inicial = antes.metricas[nome], final = depois.metricas[nome];
    deltas[nome] = { absoluto: inicial !== null && final !== null ? final - inicial : null,
      relativo: inicial !== null && final !== null && inicial > 0 ? (final - inicial) / inicial : null };
  }
  return { comparavel: motivos.length === 0, motivos, antes, depois, deltas,
    conclusao: 'Comparacao descritiva, sem inferencia causal ou estatistica. Hash preserva o arquivo, nao verifica a transcricao, autenticidade ou completude. Ausencia de valor nao representa zero.' };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 4) throw new Error('Uso: node scripts/seo-outcome-measurement.js antes.json depois.json. Leitura local, sem consultar Analytics ou Google.');
    const entradas = process.argv.slice(2).map(p => JSON.parse(fs.readFileSync(p, 'utf8')));
    const resultado = compararObservacoes(...entradas);
    console.log(JSON.stringify(resultado, null, 2));
    if (!resultado.comparavel) process.exitCode = 1;
  } catch (erro) { console.error(erro.message); process.exitCode = 1; }
}

module.exports = { validarObservacao, compararObservacoes };
