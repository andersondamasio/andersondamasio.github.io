const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { validarObservacao, compararObservacoes } = require('./seo-outcome-measurement');
const agora = new Date('2026-10-10T12:00:00Z');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metrics-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const arquivo = '.editorial/evidencias/sintetico.json', conteudo = '{"somenteFixture":true}';
  fs.mkdirSync(path.join(root, '.editorial/evidencias'), { recursive: true });
  fs.writeFileSync(path.join(root, arquivo), conteudo);
  const antes = { fonte: 'ga4', inicio: '2026-09-01', fim: '2026-09-07', fuso: 'America/Sao_Paulo',
    escopo: { relatorio: 'aquisicao-de-trafego', dimensoes: ['sessionSourceMedium'], filtros: { campanha: 'exemplo' },
      definicaoQualificada: 'Sessao engajada nao representa contato comercial qualificado.' },
    evidencia: { arquivo, sha256: createHash('sha256').update(conteudo).digest('hex'), coletadoEm: '2026-10-09T12:00:00Z' },
    metricas: { sessoes: 10, sessoesEngajadas: 4 } };
  const depois = { ...structuredClone(antes), inicio: '2026-09-08', fim: '2026-09-14', metricas: { sessoes: 15, sessoesEngajadas: 6 } };
  return { root, antes, depois, validar: o => validarObservacao(o, root, agora), comparar: () => compararObservacoes(antes, depois, root, agora) };
}

test('compara agregados sinteticos com mesmo escopo sem inferir causalidade', t => {
  const f = fixture(t), r = f.comparar();
  assert.equal(r.comparavel, true);
  assert.equal(r.antes.dias, 7);
  assert.equal(r.antes.taxa, 0.4);
  assert.deepEqual(r.deltas.sessoes, { absoluto: 5, relativo: 0.5 });
  assert.equal(r.antes.conferenciaFactual, 'nao-realizada-pelo-validador');
  assert.match(r.conclusao, /sem inferencia causal/);
});

test('preserva desconhecido e nao divide por zero', t => {
  const f = fixture(t);
  f.antes.metricas = { sessoes: 0, sessoesEngajadas: 0 };
  assert.equal(f.comparar().deltas.sessoes.relativo, null);
  f.depois.metricas = { sessoes: null, sessoesEngajadas: null };
  const r = f.comparar();
  assert.equal(r.depois.metricas.sessoes, null);
  assert.equal(r.depois.taxa, null);
  assert.deepEqual(r.deltas.sessoes, { absoluto: null, relativo: null });
});

test('recusa comparacao entre duracoes, fontes, fusos, filtros e periodos incompativeis', t => {
  const f = fixture(t), original = structuredClone(f.depois);
  for (const mudar of [o => { o.fim = '2026-09-15'; }, o => { o.fuso = 'UTC'; },
    o => { o.escopo.filtros.campanha = 'outra'; }, o => { o.inicio = '2026-09-07'; o.fim = '2026-09-13'; },
    o => { o.fonte = 'contatos'; o.metricas = { recebidos: 2, qualificados: 1 }; }]) {
    Object.assign(f.depois, structuredClone(original)); mudar(f.depois);
    const r = f.comparar(); assert.equal(r.comparavel, false); assert.deepEqual(r.deltas, {});
  }
});

test('aceita ordem de chaves diferente sem mudar o escopo', t => {
  const f = fixture(t), e = f.depois.escopo;
  f.depois.escopo = { filtros: e.filtros, dimensoes: e.dimensoes, definicaoQualificada: e.definicaoQualificada, relatorio: e.relatorio };
  assert.equal(f.comparar().comparavel, true);
});

test('confere arquivo de evidencia e rejeita caminhos fora da pasta privada', t => {
  const f = fixture(t), original = structuredClone(f.antes.evidencia);
  f.antes.evidencia.sha256 = 'a'.repeat(64); assert.throws(() => f.validar(f.antes), /hash/);
  f.antes.evidencia = { ...original, arquivo: '.editorial/evidencias/../../.env' }; assert.throws(() => f.validar(f.antes), /arquivo privado/);
  f.antes.evidencia = original;
  fs.writeFileSync(path.join(f.root, original.arquivo), '{}'); assert.throws(() => f.validar(f.antes), /hash/);
});

test('recusa metricas negativas, fracionadas, incoerentes, omitidas e desconhecidas', t => {
  const f = fixture(t);
  for (const metricas of [{ sessoes: -1, sessoesEngajadas: 0 }, { sessoes: 1.5, sessoesEngajadas: 1 },
    { sessoes: 1, sessoesEngajadas: 2 }, { sessoes: 1 }, { visitantes: 2 }]) {
    assert.throws(() => f.validar({ ...f.antes, metricas }));
  }
});

test('exige dias civis validos, fuso real e coleta depois do fechamento', t => {
  const f = fixture(t);
  for (const patch of [{ inicio: '2026-02-30' }, { inicio: '2026-09-08' }, { fuso: 'Outro/Fuso' },
    { fim: '2026-10-10' }, { fim: '2026-10-09' },
    { evidencia: { ...f.antes.evidencia, coletadoEm: '2026-10-09T12:00:00' } },
    { evidencia: { ...f.antes.evidencia, coletadoEm: '2026-10-11T00:00:00Z' } }]) {
    assert.throws(() => f.validar({ ...f.antes, ...patch }));
  }
  const o = { ...f.antes, fim: '2026-09-07', evidencia: { ...f.antes.evidencia, coletadoEm: '2026-09-08T02:59:59Z' } };
  assert.throws(() => f.validar(o), /fechamento/);
  o.evidencia.coletadoEm = '2026-09-08T03:00:00Z';
  assert.equal(f.validar(o).dias, 7);
});

test('considera o dia local e nao apenas a meia-noite UTC', t => {
  const f = fixture(t), o = { ...f.antes, fim: '2026-10-09', evidencia: { ...f.antes.evidencia, coletadoEm: '2026-10-10T01:00:00Z' } };
  assert.throws(() => validarObservacao(o, f.root, new Date('2026-10-10T02:00:00Z')), /periodo ainda aberto/);
});

test('suporta Search Console e contatos como fontes separadas', t => {
  const f = fixture(t);
  const gsc = f.validar({ ...f.antes, fonte: 'searchConsole', metricas: { impressoes: 100, cliques: 2 } });
  const contatos = f.validar({ ...f.antes, fonte: 'contatos', metricas: { recebidos: 4, qualificados: 1 } });
  assert.equal(gsc.taxa, 0.02);
  assert.equal(contatos.taxa, 0.25);
  const conferir = f.validar({ ...f.antes, fonte: 'searchConsole', metricas: { impressoes: 1, cliques: 2 } });
  assert.equal(conferir.metricas.cliques, 2);
  assert.equal(conferir.avisos.length, 1);
});
