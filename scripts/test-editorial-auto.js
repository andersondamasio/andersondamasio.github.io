const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { rascunhoFixture, aprovacaoFixture } = require('./fixtures/editorial-review');
const { prepararAprovacao, revisar, coletarFontes, urlConsulta, redePrivada } = require('./editorial-auto');
const { validarAprovacao } = require('./editorial-review');
const { controles } = require('./editorial-auto-policy');
const { gerarSecoesConteudoUtil, hashCorpoEditorial } = require('./seo-helpful-content');
const { selecionarPacote } = require('./editorial-queue');

function fixture() {
  const r = rascunhoFixture();
  r.revisaoEditorial = { aceita: true };
  r.dossie.afirmacoes[0].ancora = 'entrega mensagens em ordem';
  for (const trecho of ['Como hipotese, uma equipe pode versionar o contrato para comparar consumidores.',
    'Este exemplo nao demonstra ganhos de desempenho em producao.']) r.dossie.afirmacoes.push({ tipo: 'inferencia', trecho,
    verificacao: 'Limite ou proposta declarada, sem afirmar um resultado medido.' });
  const agora = new Date();
  const fontes = [{ url: r.fonte.url, titulo: r.fonte.titulo, tipo: 'primaria', consultadaEm: agora.toISOString(),
    texto: 'Documentacao sintetica: A fila de exemplo entrega mensagens em ordem.' }];
  const parecer = { decisao: 'publicar', pendencias: [], controles: Object.fromEntries(controles.map(c => [c, true])), dossie: r.dossie };
  const aprovar = () => prepararAprovacao(r, parecer, fontes, [], 'modelo-sintetico-offline', agora);
  return { r, fontes, parecer, agora, aprovar };
}

test('revisao automatica aprova sem inventar declaracao humana e invalida alteracoes', () => {
  const { aprovar, agora } = fixture();
  const aprovado = aprovar();
  assert.equal(aprovado.revisaoHumana, null);
  assert.equal(aprovado.revisaoAutomatica.tipo, 'ia');
  assert.equal(validarAprovacao(aprovado, [], agora).aceita, true);
  assert.equal(aprovado.auditoriaAutomatica.fontes[0].texto, undefined);
  for (const alterar of [r => { r.corpoArtigo += '<p>Outra afirmacao.</p>'; },
    r => { r.auditoriaAutomatica.parecer.controles.fatosFontes = false; },
    r => { r.revisaoAutomatica.modelo = 'modelo-diferente'; }, r => { r.revisaoAutomatica.aprovadaEm = '2099-01-01'; },
    r => { r.resumo += ' Nova afirmacao.'; }]) {
    const r = structuredClone(aprovado); alterar(r); assert.equal(validarAprovacao(r, [], agora).aceita, false);
  }
  assert.equal(validarAprovacao(aprovado, [], new Date(agora.getTime() + 8 * 86400000)).aceita, false);
  assert.equal(validarAprovacao(aprovado, [{ editorial: { hash: aprovado.revisaoAutomatica.hash } }], agora).aceita, false);
  assert.equal(validarAprovacao(aprovacaoFixture()).aceita, true);
});

test('recusa pendencias, fatos sem ancora, cobertura incompleta, fonte inventada e conteudo retido', () => {
  for (const alterar of [f => { f.parecer.decisao = 'reter'; }, f => { f.parecer.pendencias.push('fato incerto'); },
    f => { f.parecer.controles.utilidade = false; }, f => { f.parecer.dossie.afirmacoes.pop(); },
    f => { f.parecer.dossie.afirmacoes[0].ancora = 'Frase que nao consta na fonte consultada.'; },
    f => { f.parecer.dossie.fontes[0].url = 'https://example.org/inventada'; },
    f => { f.r.revisaoEditorial.aceita = false; }, f => { f.r.corpoArtigo += '<img src="/a.png">'; },
    f => { f.fontes[0].consultadaEm = '2000-01-01'; }]) {
    const f = fixture(); alterar(f); assert.throws(f.aprovar);
  }
});

test('revisor separado recebe dados como nao confiaveis e nao libera resposta truncada ou invalida', async () => {
  const f = fixture();
  const avaliar = async payload => {
    assert.match(payload.messages[0].content, /DADOS NAO CONFIAVEIS/);
    assert.equal(payload.model, 'modelo-teste');
    return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(f.parecer) } }] };
  };
  const r = await revisar(f.r, { fontes: f.fontes, avaliar, modelo: 'modelo-teste' });
  assert.equal(validarAprovacao(r).aceita, true);
  for (const response of [{ choices: [{ finish_reason: 'length', message: { content: '{}' } }] },
    { choices: [{ finish_reason: 'stop', message: { content: 'nao JSON' } }] }]) {
    await assert.rejects(revisar(f.r, { fontes: f.fontes, avaliar: async () => response }));
  }
});

test('busca usa primaria predefinida, retem ausencia e nao executa instrucoes no HTML', async () => {
  const f = fixture();
  const html = '<main><a href="https://kubernetes.io/docs/concepts/">Fonte</a><a href="http://127.0.0.1/">local</a></main>';
  const calls = [];
  const fontes = await coletarFontes(f.r, async url => { calls.push(url); return { url, html, texto: 'Documento para fixture', titulo: 'Fonte sintetica' }; });
  assert.equal(fontes[0].tipo, 'secundaria');
  assert.equal(fontes[1].tipo, 'primaria');
  assert.equal(calls.length, 2);
  await assert.rejects(coletarFontes(f.r, async url => ({ url, html: '<main>Sem links</main>', texto: 'Fonte', titulo: 'Fonte' })), /Nenhuma fonte primaria/);
  for (const url of ['http://example.org/', 'https://127.0.0.1/', 'https://[::1]/', 'https://user:pass@example.org/', 'https://example.org:8443/', 'https://servidor.local/']) assert.throws(() => urlConsulta(url));
  for (const ip of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.0.1', '100.64.1.1', '224.0.0.1']) assert.equal(redePrivada.check(ip), true);
});

test('pacote automatico entra na fila e exibe rotulo honesto sem revisar o acervo', () => {
  const { aprovar, agora } = fixture();
  const r = aprovar();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perfil-auto-test-'));
  try {
    const pacote = `dados/editorial/aprovados/${r.revisaoAutomatica.hash}.json`;
    fs.mkdirSync(path.join(root, 'dados/editorial/aprovados'), { recursive: true });
    fs.writeFileSync(path.join(root, pacote), JSON.stringify(r));
    fs.writeFileSync(path.join(root, 'dados/editorial/fila.json'), JSON.stringify({ versao: 1, pacotes: [pacote] }));
    fs.writeFileSync(path.join(root, 'titulos.json'), '[]');
    assert.equal(selecionarPacote({ root, agora }).elegivel, true);
    fs.writeFileSync(path.join(root, 'titulos.json'), JSON.stringify([{ data: agora.toISOString() }]));
    assert.equal(selecionarPacote({ root, agora }).motivo, 'intervalo-de-sete-dias');
    const html = gerarSecoesConteudoUtil({ sourceUrl: r.fonte.url, corpoArtigo: r.corpoArtigo,
      editorial: { hash: r.revisaoAutomatica.hash, conteudoHash: hashCorpoEditorial(r.corpoArtigo), revisaoAutomatica: r.revisaoAutomatica, dossie: r.dossie } });
    assert.match(html, /data-editorial-status="revisao-automatizada"/);
    assert.match(html, /Sem aprova&ccedil;&atilde;o humana individual/);
    assert.doesNotMatch(html, /Revis&atilde;o editorial:<\/strong> Anderson/);
  } finally {
    if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('perfil-auto-test-')) throw new Error('Temporario fora do escopo.');
    fs.rmSync(root, { recursive: true });
  }
});

test('publicador real aceita revisao automatica, conserva rotulo apos rebuild e bloqueia replay', () => {
  const f = fixture();
  f.r.fonte.data = '2026-10-01';
  const r = f.aprovar();
  const { publicarRascunhoAprovado, reconstruirPaginasSeo } = require('../gerar-conteudo');
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, 'perfil-auto-publish-test-'));
  const cwd = process.cwd();
  try {
    fs.writeFileSync(path.join(root, 'titulos.json'), '[]');
    process.chdir(root);
    const resultado = publicarRascunhoAprovado(r);
    assert.equal(resultado.publicado, true);
    assert.equal(resultado.onlineVerificado, false);
    const antes = fs.readFileSync(resultado.url, 'utf8');
    assert.match(antes, /data-editorial-status="revisao-automatizada"/);
    reconstruirPaginasSeo();
    assert.equal(fs.readFileSync(resultado.url, 'utf8'), antes);
    assert.throws(() => publicarRascunhoAprovado(r), /ja-publicado/);
    const registro = JSON.parse(fs.readFileSync('titulos.json'))[0];
    assert.equal(registro.editorial.revisaoHumana, null);
    assert.equal(registro.editorial.revisaoAutomatica.tipo, 'ia');
    assert.equal(registro.dataFonte, '2026-10-01');
    assert.match(antes, /01\/10\/2026/);
  } finally {
    process.chdir(cwd);
    if (path.dirname(root) !== base || !path.basename(root).startsWith('perfil-auto-publish-test-')) throw new Error('Temporario fora do escopo.');
    fs.rmSync(root, { recursive: true });
  }
});

test('CLI sem comando nao consome API; workflow nao aprova como humano', () => {
  assert.throws(() => execFileSync(process.execPath, [require.resolve('./editorial-auto')], { stdio: 'pipe' }), /Uso:/);
  const yaml = fs.readFileSync('.github/workflows/publicar-artigo.yml', 'utf8');
  assert.match(yaml, /npm run article:auto -- gerar/);
  assert.doesNotMatch(yaml, /article:review -- aprovar/);
  assert.match(yaml, /publicacao-editorial-main/);
  assert.match(yaml, /node scripts\/verify-deployment.js/);
  assert.match(yaml, /if: always\(\)/);
});
