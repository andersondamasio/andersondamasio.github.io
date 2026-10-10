const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { siteUrl, authorSameAs } = require('./seo-identity');
const { hashCorpoEditorial } = require('./seo-helpful-content');
const { criarLinkCampanha, prepararDistribuicao, renderizarPacote, criarFicha, salvarPacote } = require('./editorial-outreach');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'outreach-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const escrever = (arquivo, valor) => {
    const destino = path.join(root, arquivo);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, typeof valor === 'string' ? valor : JSON.stringify(valor));
  };
  const url = 'artigos/exemplo.html', canonical = `${siteUrl}/${url}`, corpo = '<p>Exemplo didatico com limites explicitos.</p>';
  const html = `<html><head><link rel="canonical" href="${canonical}"><meta name="robots" content="index,follow"></head><body><h1>Exemplo</h1><div class="article-body">${corpo}</div></body></html>`;
  const medicao = { deployConfirmado: true, revisaoEsperada: 'a'.repeat(40), geradoEm: '2026-10-08T12:00:00Z',
    observacoes: [{ url: canonical, http: { status: 200 }, pagina: { correspondeAoGit: true, canonical, permiteIndexacaoDeclarada: true } }] };
  const config = { versao: 1, id: 'guias-tecnicos', estado: 'rascunho', perfil: authorSameAs[0], revisaoPublicada: 'a'.repeat(40),
    medicao: '.editorial/medicoes/2026-10-08T12-00-00-000Z-aaaaaaaaaaaa.json', itens: [{ id: 'exemplo', url, conteudoHash: hashCorpoEditorial(corpo),
      publico: 'Pessoas estudando algoritmos e seus limites.', pergunta: 'Como executar o exemplo e conferir o resultado?',
      resposta: 'O guia apresenta codigo e verificacoes reproduziveis.', objetivoProfissional: 'Apresentar um material didatico sobre desenvolvimento.',
      limites: 'Um teste funcional nao comprova desempenho em producao.', postLinkedin: 'Este guia apresenta um exemplo didatico com testes e limites explicitos.',
      recursos: ['exemplos/exemplo/test.js'] }] };
  escrever(url, html);
  escrever('titulos.json', [{ url, titulo: 'Exemplo' }]);
  escrever(config.medicao, medicao);
  escrever('exemplos/exemplo/test.js', 'console.log("exemplo");');
  return { root, escrever, config, medicao, html, preparar: () => prepararDistribuicao(config, root, { lerPublicado: () => html }) };
}

test('prepara materiais privados sem aprovar, publicar ou inventar medicoes', t => {
  const f = fixture(t), pacote = f.preparar();
  assert.equal(pacote.estado, 'rascunho');
  assert.equal(pacote.aprovacao, null);
  assert.equal(pacote.publicadoEm, null);
  assert.equal(pacote.itens[0].recursos[0].hash.length, 64);
  assert.match(renderizarPacote(pacote), /Nenhum post aprovado/);
  assert.match(renderizarPacote(pacote), /nao comprovam contatos qualificados/);
  const ficha = criarFicha(pacote);
  assert.equal(ficha.publicacaoExterna.estado, 'nao-publicada');
  assert.deepEqual(ficha.observacoes, []);
  assert.deepEqual(ficha.modeloObservacao.metricas, { sessoes: null, sessoesEngajadas: null });
  const dir = salvarPacote(pacote, f.root);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['materiais.md', 'medicao.json', 'pacote.json']);
  assert.throws(() => salvarPacote(pacote, f.root), /pasta existente/);
  assert.equal(fs.readFileSync(path.join(f.root, f.config.itens[0].url), 'utf8'), f.html);
  assert.throws(() => salvarPacote({ ...pacote, id: 'outro', estado: 'aprovado' }, f.root), /somente como rascunho/);
});

test('gera UTM apenas para pagina interna canonica e identificadores estaticos', () => {
  const link = new URL(criarLinkCampanha(`${siteUrl}/artigos/exemplo.html`, 'guias-2026', 'exemplo'));
  assert.equal(link.searchParams.get('utm_source'), 'linkedin');
  assert.equal(link.searchParams.get('utm_medium'), 'social');
  assert.equal(link.searchParams.get('utm_campaign'), 'guias-2026');
  for (const url of ['https://exemplo.com/artigos/a.html', '/artigos/a.html?email=x', '/artigos/a.html#parte']) {
    assert.throws(() => criarLinkCampanha(url, 'guias', 'exemplo'));
  }
  for (const id of ['../../dados', 'nome@email.com', 'a'.repeat(81)]) assert.throws(() => criarLinkCampanha('/guias.html', id, 'exemplo'));
});

test('recusa perfil nao confirmado e estado de aprovacao/publicacao', t => {
  const f = fixture(t);
  f.config.perfil = 'https://github.com/andersondamasio';
  assert.throws(f.preparar, /perfil oficial/);
  f.config.perfil = authorSameAs[0];
  for (const estado of ['aprovado', 'publicado']) { f.config.estado = estado; assert.throws(f.preparar, /nao autoriza/); }
});

test('exige revisao publicada e observacao HTTP correspondente', t => {
  const f = fixture(t);
  for (const mudar of [m => { m.deployConfirmado = false; }, m => { m.revisaoEsperada = 'b'.repeat(40); },
    m => { m.observacoes = []; }, m => { m.observacoes[0].http.status = 404; },
    m => { m.observacoes[0].pagina.correspondeAoGit = false; }, m => { m.observacoes[0].pagina.permiteIndexacaoDeclarada = false; }]) {
    const m = structuredClone(f.medicao); mudar(m); f.escrever(f.config.medicao, m); assert.throws(f.preparar);
  }
});

test('alterar HTML ou hash invalida a preparacao mesmo com relatorio antigo', t => {
  const f = fixture(t);
  f.escrever(f.config.itens[0].url, f.html.replace('index,follow', 'noindex,follow'));
  assert.throws(f.preparar, /HTML local diverge/);
  f.escrever(f.config.itens[0].url, f.html);
  f.config.itens[0].conteudoHash = 'f'.repeat(64);
  assert.throws(f.preparar, /corpo alterado/);
});

test('recusa cadastro duplicado, item repetido, caminhos externos e link livre no post', t => {
  const f = fixture(t), item = f.config.itens[0];
  f.config.itens.push(structuredClone(item)); assert.throws(f.preparar, /id do material/); f.config.itens.pop();
  f.escrever('titulos.json', [{ url: item.url }, { url: item.url }]); assert.throws(f.preparar, /ambiguo/);
  f.escrever('titulos.json', [{ url: item.url, titulo: 'Exemplo' }]);
  item.recursos = ['exemplos/../../.env']; assert.throws(f.preparar, /caminho do recurso/);
  item.recursos = ['exemplos/exemplo/test.js']; item.postLinkedin += ' https://exemplo.com'; assert.throws(f.preparar, /links do post/);
});

test('nao transporta campos extras de aprovacao para o material', t => {
  const f = fixture(t); f.config.itens[0].aprovado = true;
  assert.equal(Object.hasOwn(f.preparar().itens[0], 'aprovado'), false);
});

test('retencao automatica detecta sinais de vivencia no post sem alegar revisao factual', t => {
  const f = fixture(t);
  f.config.itens[0].postLinkedin = 'Na minha experiencia com meus clientes, implementei esta solucao em producao.';
  assert.throws(f.preparar, /vivencia no rascunho/);
});
