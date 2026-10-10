const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cheerio = require('cheerio');
const { hashCorpoEditorial } = require('./seo-helpful-content');
const { hashArquivo, hashRegistros } = require('./article-lifecycle');
const { digest } = require('./verify-deployment');
const root = path.join(__dirname, '..');
const ler = p => fs.readFileSync(path.join(root, p), 'utf8');
const relatorio = JSON.parse(ler('dados/editorial/curadoria-analogias-2026-10.json'));
const manifesto = JSON.parse(ler('dados/indexacao.json'));
const cadastro = JSON.parse(ler('titulos.json'));

test('curadoria de dispositivos preserva snapshots e corrige acesso sem simular testes pessoais', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-dispositivos-2026-10.json'));
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.metricasGoogle, null);
  assert.equal(lote.linksExternosConhecidos, null);
  assert.equal(lote.experimentosExecutados, false);
  assert.equal(lote.artigos.length, 9);
  assert.equal(lote.artigos.filter(a => a.acao === 'retirar').length, 8);
  for (const a of lote.artigos) {
    const d = manifesto.decisoes.find(d => d.url === a.url);
    assert.equal(d.acao, a.acao);
    assert.ok(a.motivo && a.evidencia && a.alternativas);
    if (a.acao === 'atualizar') {
      const r = cadastro.find(r => r.url === a.url), q = cheerio.load(ler(a.url));
      assert.equal(r.data, a.antes.data);
      assert.equal(q('meta[property="article:published_time"]').attr('content'), a.antes.data);
      assert.equal(r.correcaoEditorial.revisaoHumana, false);
      assert.equal(r.titulo, a.depois.titulo);
      assert.equal(q('h1').text(), a.depois.titulo);
      assert.equal(q('meta[name=description]').attr('content'), a.depois.descricao);
      assert.equal(q('link[rel=canonical]').attr('href'), 'https://www.andersondamasio.com.br/' + a.url);
      assert.doesNotMatch(q('meta[name=robots]').attr('content'), /noindex/);
      assert.equal(hashCorpoEditorial(q('.article-body').html()), a.depois.corpoHash);
      assert.equal(d.conteudoHash, a.depois.corpoHash);
      for (const e of a.evidencias) {
        assert.equal(q(e.seletor + ' a').attr('href'), e.fonte);
        assert.equal(hashCorpoEditorial(q(e.seletor).html()), e.textoHash);
      }
      assert.match(q('.fato-autenticacao').text(), /não exige conectar um repositório do GitHub/);
      assert.match(q('.fato-permissoes').text(), /não é uma garantia de isolamento/);
      assert.match(q('.limites-editoriais').text(), /Não houve instalação, login, execução de comandos/);
      assert.match(q('.contribuicao-editorial').text(), /comando de teste do próprio projeto/);
      assert.doesNotMatch(q('.article-body').text(), /R\$ 17|tive a oportunidade de testar|como instalei/);
    } else {
      const copia = JSON.parse(ler(a.arquivoRecuperavel));
      assert.equal(a.destinoEquivalente, null);
      assert.equal(d.destino, undefined);
      assert.equal(cadastro.some(r => r.url === a.url), false);
      assert.equal(hashRegistros(copia.registros), d.registrosHash);
      assert.equal(hashArquivo(copia.arquivos[0].html), d.arquivoHash);
      assert.equal(copia.registros[0].data, a.antes.data);
      assert.equal(copia.registros[0].titulo, a.antes.titulo);
      assert.equal(hashCorpoEditorial(cheerio.load(copia.arquivos[0].html)('.article-body').html()), a.antes.corpoHash);
      assert.deepEqual(copia.arquivos.map(f => f.url), [a.url, ...a.aliases]);
      for (const p of copia.arquivos) assert.equal(fs.existsSync(path.join(root, p.url)), false);
      for (const alias of d.aliases) assert.equal(hashArquivo(copia.arquivos.find(f => f.url === alias.url).html), alias.arquivoHash);
    }
  }
});

test('curadoria de uso preserva evidencias, datas e snapshots sem atestar testes pessoais', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-uso-2026-10.json'));
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.metricasGoogle, null);
  assert.equal(lote.experimentosExecutados, false);
  assert.equal(lote.artigos.length, 7);
  assert.equal(lote.artigos.filter(a => a.acao === 'atualizar').length, 2);
  assert.equal(lote.artigos.filter(a => a.acao === 'consolidar').length, 1);
  assert.equal(lote.artigos.filter(a => a.acao === 'retirar').length, 4);
  for (const a of lote.artigos) {
    const d = manifesto.decisoes.find(d => d.url === a.url);
    assert.equal(d.acao, a.acao);
    if (a.acao === 'atualizar') {
      const r = cadastro.find(r => r.url === a.url), q = cheerio.load(ler(a.url));
      assert.equal(r.data, a.antes.data);
      assert.equal(r.titulo, a.depois.titulo);
      assert.equal(q('h1').text(), a.depois.titulo);
      assert.equal(hashCorpoEditorial(q('.article-body').html()), a.depois.corpoHash);
      assert.equal(d.conteudoHash, a.depois.corpoHash);
      assert.equal(r.correcaoEditorial.revisaoHumana, false);
      for (const e of a.evidencias) {
        assert.equal(q(e.seletor + ' a').attr('href'), e.fonte);
        assert.equal(hashCorpoEditorial(q(e.seletor).html()), e.textoHash);
      }
    } else {
      const c = JSON.parse(ler(a.arquivoRecuperavel));
      assert.equal(cadastro.some(r => r.url === a.url), false);
      assert.equal(hashRegistros(c.registros), d.registrosHash);
      assert.equal(hashArquivo(c.arquivos[0].html), d.arquivoHash);
      assert.equal(c.registros[0].data, a.antes.data);
      assert.deepEqual(c.arquivos.map(f => f.url), [a.url, ...a.aliases]);
      for (const alias of d.aliases) assert.equal(hashArquivo(c.arquivos.find(f => f.url === alias.url).html), alias.arquivoHash);
      for (const p of c.arquivos) {
        if (a.acao === 'retirar') assert.equal(fs.existsSync(path.join(root, p.url)), false);
        else {
          const q = cheerio.load(ler(p.url));
          assert.equal(q('.article-body').length, 0);
          assert.equal(q('link[rel=canonical]').attr('href'), 'https://www.andersondamasio.com.br/' + a.destinoEquivalente);
          assert.match(q('meta[http-equiv=refresh]').attr('content'), new RegExp(a.destinoEquivalente.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        }
      }
    }
  }
});

test('orientacoes WordPress e Fitbit distinguem controle tecnico de resultados nao executados', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-uso-2026-10.json'));
  const wp = cheerio.load(ler(lote.artigos.find(a => a.url.includes('plugin-quebrado')).url));
  assert.match(wp('.fato-nonce').text(), /não substituem autenticação, autorização/);
  assert.match(wp('.fato-nonce').text(), /current_user_can/);
  assert.match(wp('.limites-editoriais').text(), /Não houve execução de WordPress/);
  const fitbit = cheerio.load(ler(lote.artigos.find(a => a.url.includes('a-nova-era-do-fitness')).url));
  assert.match(fitbit('.fato-previa').text(), /27 de outubro de 2025/);
  assert.match(fitbit('.fato-limite').text(), /não substitui a consulta/);
  assert.match(fitbit('.limites-editoriais').text(), /Não houve uso do aplicativo/);
});

test('retiradas de noticias preservam copias integrais sem substituir intencoes ou inventar metricas', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-noticias-2026-10.json'));
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.metricasGoogle, null);
  assert.equal(lote.linksExternosConhecidos, null);
  assert.equal(lote.experimentosExecutados, false);
  assert.equal(lote.artigos.length, 4);
  for (const a of lote.artigos) {
    const d = manifesto.decisoes.find(d => d.url === a.url);
    const copia = JSON.parse(ler(a.arquivoRecuperavel));
    assert.equal(a.acao, 'retirar');
    assert.equal(d.acao, 'retirar');
    assert.equal(d.destino, undefined);
    assert.equal(a.destinoEquivalente, null);
    assert.ok(a.motivo && a.evidencia && a.alternativas);
    assert.equal(a.fonteConferida.url, a.antes.fonte.url);
    assert.equal(cadastro.some(r => r.url === a.url), false);
    assert.equal(hashRegistros(copia.registros), d.registrosHash);
    assert.equal(hashArquivo(copia.arquivos[0].html), d.arquivoHash);
    assert.equal(copia.registros[0].data, a.antes.data);
    assert.equal(copia.registros[0].titulo, a.antes.titulo);
    const q = cheerio.load(copia.arquivos[0].html);
    assert.equal(hashCorpoEditorial(q('.article-body').html()), a.antes.corpoHash);
    assert.equal(d.conteudoHash, a.antes.corpoHash);
    assert.deepEqual(copia.arquivos.map(f => f.url), [a.url, ...a.aliases]);
    for (const arquivo of copia.arquivos) assert.equal(fs.existsSync(path.join(root, arquivo.url)), false);
    for (const alias of d.aliases) assert.equal(hashArquivo(copia.arquivos.find(f => f.url === alias.url).html), alias.arquivoHash);
  }
});

test('correcoes de fatos preservam URLs, datas e evidencias sem aprovar vivencia ou experimento', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-fatos-2026-10.json'));
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.experimentosExecutados, false);
  assert.equal(lote.metricasGoogle, null);
  assert.equal(lote.artigos.length, 4);
  for (const a of lote.artigos) {
    const q = cheerio.load(ler(a.url)), r = cadastro.find(r => r.url === a.url);
    assert.equal(a.acao, 'atualizar');
    assert.equal(r.data, a.antes.data);
    assert.equal(q('meta[property="article:published_time"]').attr('content'), a.antes.data);
    assert.equal(r.revisaoHumana, undefined);
    assert.equal(r.correcaoEditorial.revisaoHumana, false);
    assert.equal(r.correcaoEditorial.relatorio, 'dados/editorial/curadoria-fatos-2026-10.json');
    assert.equal(r.seo.modifiedAt, lote.em);
    assert.equal(r.qualidadeEditorial, undefined);
    assert.equal(q('.nota-atualizacao time').attr('datetime'), lote.em);
    assert.equal(q('h1').text(), a.depois.titulo);
    assert.equal(q('meta[name=description]').attr('content'), a.depois.descricao);
    assert.equal(q('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.url}`);
    assert.doesNotMatch(q('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(hashCorpoEditorial(q('.article-body').html()), a.depois.corpoHash);
    assert.equal(manifesto.decisoes.find(d => d.url === a.url).conteudoHash, a.depois.corpoHash);
    for (const e of a.evidencias) {
      assert.equal(q(e.seletor).length, 1);
      assert.equal(hashCorpoEditorial(q(e.seletor).html()), e.textoHash);
      assert.equal(q(e.seletor).find('a').attr('href'), e.fonte);
    }
    assert.equal(q('.contribuicao-editorial').length, 1);
    assert.equal(q('.limites-editoriais').length, 1);
    assert.ok(a.pergunta && a.sobreposicao);
    assert.doesNotMatch(q('.article-body').text(), /participei de um retiro|entrei na minha última empresa|participei de um grupo|aprendi ao longo de minha carreira/);
  }
});

test('casos de IA delimitam denominador, fonte historica, falso positivo e propostas nao executadas', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-fatos-2026-10.json'));
  const pagina = i => cheerio.load(ler(lote.artigos[i].url));
  assert.match(pagina(0)('.fato-tdd').text(), /viés de confirmação/);
  assert.match(pagina(0)('.limites-editoriais').text(), /propostas não executadas/);
  const airbnb = pagina(1);
  assert.match(airbnb('.fato-data').text(), /12 de fevereiro de 2026/);
  assert.match(airbnb('.fato-denominador').text(), /Estados Unidos, Canadá e México/);
  assert.match(airbnb('.fato-denominador').text(), /quando os usuários enviavam mensagens ao assistente/);
  assert.match(airbnb('.fato-denominador').text(), /não todo o atendimento/);
  assert.match(airbnb('.contribuicao-editorial').text(), /30 de 100, ou 30%/);
  assert.match(airbnb('.limites-editoriais').text(), /protocolo não foi executado/);
  assert.equal(cadastro.find(r => r.url === lote.artigos[1].url).dataFonte, '2026-02-12');
  assert.match(pagina(2)('.fato-objetivos').text(), /próximos passos/);
  assert.match(pagina(2)('.limites-editoriais').text(), /não fornece orientação previdenciária/);
  assert.doesNotMatch(pagina(2)('.article-body').text(), /Dynamics 365/);
  assert.match(lote.artigos[3].evidencia, /falso positivo/);
  assert.match(pagina(3)('.fato-carga').text(), /expectativa é do entrevistado/);
  assert.match(pagina(3)('.limites-editoriais').text(), /não é um instrumento psicológico validado/);
});

test('metricas e contexto preservam fontes, limites e historico sem aprovar experiencia pessoal', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-metricas-contexto-2026-10.json'));
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.metricasGoogle, null);
  assert.equal(lote.artigos.length, 4);
  for (const a of lote.artigos.filter(a => a.acao === 'atualizar')) {
    const q = cheerio.load(ler(a.url)), r = cadastro.find(r => r.url === a.url);
    assert.equal(r.data, a.antes.data);
    assert.equal(r.revisaoHumana, undefined);
    assert.equal(r.correcaoEditorial.revisaoHumana, false);
    assert.equal(r.correcaoEditorial.relatorio, 'dados/editorial/curadoria-metricas-contexto-2026-10.json');
    assert.equal(r.seo.modifiedAt, lote.em);
    assert.equal(r.qualidadeEditorial, undefined);
    assert.equal(q('.nota-atualizacao time').attr('datetime'), lote.em);
    assert.equal(q('h1').text(), a.depois.titulo);
    assert.equal(q('meta[name=description]').attr('content'), a.depois.descricao);
    assert.equal(q('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.url}`);
    assert.doesNotMatch(q('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(hashCorpoEditorial(q('.article-body').html()), a.depois.corpoHash);
    assert.equal(manifesto.decisoes.find(d => d.url === a.url).conteudoHash, a.depois.corpoHash);
    for (const e of a.evidencias) {
      assert.equal(q(e.seletor).length, 1);
      assert.equal(hashCorpoEditorial(q(e.seletor).html()), e.textoHash);
      assert.equal(q(e.seletor).find('a').attr('href'), e.fonte);
    }
    assert.equal(q('.contribuicao-editorial').length, 1);
    assert.equal(q('.limites-editoriais').length, 1);
  }
  const dora = cheerio.load(ler(lote.artigos[1].url));
  assert.match(dora('.limites-editoriais').text(), /não comprova.*causalidade/);
  assert.match(dora('.contribuicao-editorial').text(), /não foi aplicado a uma equipe/);
  assert.equal(dora('.contribuicao-editorial h3').length, 4);
  assert.equal(dora('.contribuicao-editorial table').length, 0);
  const instrucoes = cheerio.load(ler(lote.artigos[2].url));
  assert.match(instrucoes('.fato-instrucoes').text(), /\.github\/copilot-instructions\.md/);
  assert.match(instrucoes('.limites-editoriais').text(), /roteiro de frete é proposto e não foi executado/);
  assert.match(instrucoes('.article-body').text(), /não demonstra que a ferramenta o carregou/);
  const a = lote.artigos.find(a => a.acao === 'consolidar');
  const d = manifesto.decisoes.find(d => d.url === a.url), copia = JSON.parse(ler(a.arquivoRecuperavel));
  assert.equal(hashRegistros(copia.registros), d.registrosHash);
  assert.equal(hashArquivo(copia.arquivos[0].html), d.arquivoHash);
  assert.equal(cadastro.some(r => r.url === a.url), false);
  assert.equal(d.destino, lote.artigos[2].url);
  for (const arquivo of copia.arquivos) {
    const q = cheerio.load(ler(arquivo.url));
    assert.equal(q('.article-body').length, 0);
    assert.equal(q('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${d.destino}`);
    assert.match(q('meta[name=robots]').attr('content'), /noindex/);
  }
});

test('atribuicoes e produtos preservam publicacao e distinguem documentacao de testes pessoais', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-atribuicao-produtos-2026-10.json'));
  const corrigidos = lote.artigos.filter(a => a.acao === 'atualizar');
  assert.equal(corrigidos.length, 6);
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.experimentosExecutados, false);
  assert.equal(lote.metricasGoogle, null);
  for (const a of corrigidos) {
    const q = cheerio.load(ler(a.url)), r = cadastro.find(r => r.url === a.url);
    assert.equal(r.data, a.antes.data);
    assert.equal(r.revisaoHumana, undefined);
    assert.equal(r.correcaoEditorial.revisaoHumana, false);
    assert.equal(r.correcaoEditorial.relatorio, 'dados/editorial/curadoria-atribuicao-produtos-2026-10.json');
    assert.equal(r.qualidadeEditorial, undefined);
    assert.equal(r.seo.modifiedAt, lote.em);
    assert.equal(q('.nota-atualizacao time').attr('datetime'), lote.em);
    assert.equal(q('h1').text(), a.depois.titulo);
    assert.equal(q('meta[name=description]').attr('content'), a.depois.descricao);
    assert.equal(q('meta[property="article:published_time"]').attr('content'), a.antes.data);
    assert.equal(q('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.url}`);
    assert.doesNotMatch(q('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(hashCorpoEditorial(q('.article-body').html()), a.depois.corpoHash);
    assert.equal(manifesto.decisoes.find(d => d.url === a.url).conteudoHash, a.depois.corpoHash);
    assert.equal(q('.contribuicao-editorial').length, 1);
    assert.equal(q('.limites-editoriais').length, 1);
    assert.ok(a.pergunta && a.sobreposicao);
    for (const e of a.evidencias) {
      assert.equal(q(e.seletor).length, 1);
      assert.equal(hashCorpoEditorial(q(e.seletor).html()), e.textoHash);
      assert.equal(q(e.seletor).find('a').attr('href'), e.fonte);
    }
    assert.doesNotMatch(q('.article-body').text(), /eu testei|em minha experiência|nossa salvação|api\.smartlock\.com|api\.example\.com/i);
  }
});

test('correcoes documentais removem API de fechadura e garantias indevidas sem simular execucao', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-atribuicao-produtos-2026-10.json'));
  const pagina = trecho => cheerio.load(ler(lote.artigos.find(a => a.url.includes(trecho)).url));
  const lock = pagina('revolucao-dos-fechaduras');
  assert.equal(lock('.article-body pre').length, 0);
  assert.match(lock('.fato-reserva').text(), /AAA.*palma e a câmera ficam desativados/);
  assert.match(lock('.fato-dados').text(), /miniaturas.*nuvem/);
  assert.match(lock('.article-body').text(), /endpoint de desbloqueio sem contrato/);
  assert.match(lock('.contribuicao-editorial').text(), /não verificado/);
  const caso = pagina('protegendo-nossos-websites');
  assert.match(caso('.fato-caso').text(), /ScummVM, não um projeto de Anderson/);
  assert.match(caso('.limites-editoriais').text(), /Não houve instalação de Anubis neste site/);
  const acesso = pagina('batalha-contra');
  assert.match(acesso('.fato-desafio').text(), /não é uma prova da identidade/);
  const jobs = pagina('codigo-escondido');
  assert.match(jobs('.fato-relato').text(), /Steve Hayman/);
  assert.equal(jobs('.article-body pre').length, 0);
  const camera = pagina('eufycam-s3');
  assert.match(camera('.fato-kit').text(), /1080p.*Apple Home/);
  assert.match(camera('.limites-editoriais').text(), /Não foram testados/);
  const lorex = pagina('desvendando-o-novo-campainha');
  assert.match(lorex('.fato-modelos').text(), /B451AJD\/B451AJDB/);
  assert.match(lorex('.fato-modelos').text(), /B463AJD\/B463AJDB/);
  assert.match(lorex('.limites-editoriais').text(), /Não foi possível identificar.*modelo exato/);
});

test('repeticoes de produtos tem destino equivalente direto e noticia Caro inventada e recuperavel', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-atribuicao-produtos-2026-10.json'));
  const removidos = lote.artigos.filter(a => a.acao !== 'atualizar');
  assert.equal(removidos.filter(a => a.acao === 'consolidar').length, 3);
  assert.equal(removidos.filter(a => a.acao === 'retirar').length, 1);
  for (const a of removidos) {
    const d = manifesto.decisoes.find(d => d.url === a.url);
    const backup = JSON.parse(ler(a.arquivoRecuperavel));
    assert.equal(hashRegistros(backup.registros), d.registrosHash);
    assert.equal(hashArquivo(backup.arquivos[0].html), d.arquivoHash);
    assert.equal(hashCorpoEditorial(cheerio.load(backup.arquivos[0].html)('.article-body').html()), a.antes.corpoHash);
    assert.ok(!cadastro.some(r => r.url === a.url));
    for (const p of backup.arquivos) {
      if (a.acao === 'retirar') {
        assert.ok(!fs.existsSync(path.join(root, p.url)));
        assert.equal(d.destino, undefined);
        assert.equal(a.destinoEquivalente, null);
        assert.equal(a.fonteCorrecao.url, 'https://martinfowler.com/articles/2025-caro.html');
      } else {
        const q = cheerio.load(ler(p.url));
        const destino = cheerio.load(ler(a.destinoEquivalente));
        assert.equal(q('.article-body').length, 0);
        assert.match(q('meta[name=robots]').attr('content'), /noindex/);
        assert.equal(q('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.destinoEquivalente}`);
        assert.equal(q('meta[http-equiv=refresh]').attr('content'), `0; url=https://www.andersondamasio.com.br/${a.destinoEquivalente}`);
        assert.equal(destino('meta[http-equiv=refresh]').length, 0);
        assert.doesNotMatch(destino('meta[name=robots]').attr('content'), /noindex/);
        assert.equal(hashCorpoEditorial(destino('.article-body').html()), d.destinoConteudoHash);
      }
    }
  }
});

test('alegacoes de testes de produtos sao substituidas por fontes e propostas explicitamente nao executadas', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-testes-produtos-2026-10.json'));
  const corrigidos = lote.artigos.filter(a => a.acao === 'atualizar');
  assert.equal(corrigidos.length, 4);
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.experimentosExecutados, false);
  assert.equal(lote.metricasGoogle, null);
  for (const a of corrigidos) {
    const $ = cheerio.load(ler(a.url));
    const r = cadastro.find(r => r.url === a.url);
    assert.equal(r.data, a.antes.data);
    assert.equal(r.revisaoHumana, undefined);
    assert.equal(r.correcaoEditorial.revisaoHumana, false);
    assert.equal(r.seo.modifiedAt, lote.em);
    assert.equal($('h1').text(), a.depois.titulo);
    assert.equal($('meta[name=description]').attr('content'), a.depois.descricao);
    assert.equal($('meta[property="article:published_time"]').attr('content'), a.antes.data);
    assert.equal($('.nota-atualizacao time').attr('datetime'), lote.em);
    assert.equal($('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.url}`);
    assert.doesNotMatch($('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(hashCorpoEditorial($('.article-body').html()), a.depois.corpoHash);
    assert.equal(manifesto.decisoes.find(d => d.url === a.url).conteudoHash, a.depois.corpoHash);
    assert.equal($('.contribuicao-editorial').length, 1);
    assert.match($('.limites-editoriais').text(), /não foi executado|Nenhum teste.*foi executado/);
    assert.doesNotMatch($('.article-body').text(), /testei|aprovei|aprendi na prática|garante que seus documentos/);
    for (const e of a.evidencias) {
      assert.equal($(e.seletor).length, 1);
      assert.equal(hashCorpoEditorial($(e.seletor).html()), e.textoHash);
      assert.ok($(e.seletor).find('a').toArray().some(el => $(el).attr('href') === e.fonte));
    }
  }
  const lens = cheerio.load(ler(corrigidos.find(a => a.url.includes('microsoft-lens')).url));
  assert.match(lens('.fato-encerramento').text(), /9 de janeiro de 2026/);
  assert.match(lens('.fato-alternativa').text(), /não salva digitalizações localmente/);
  const voz = cheerio.load(ler(corrigidos.find(a => a.url.includes('revolucao-da-voz')).url));
  assert.match(voz('.fato-ditado').text(), /antes do envio/);
  assert.match(voz('.contribuicao-editorial').text(), /cenário fictício/);
});

test('consolidacoes de voz preservam copias e levam diretamente ao guia equivalente', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-testes-produtos-2026-10.json'));
  const ciclos = lote.artigos.filter(a => a.acao === 'consolidar');
  assert.equal(ciclos.length, 2);
  const sitemap = cheerio.load(ler('sitemap.xml'), { xmlMode: true });
  const urls = sitemap('loc').map((_, e) => sitemap(e).text()).get();
  for (const a of ciclos) {
    const d = manifesto.decisoes.find(d => d.url === a.url);
    assert.ok(!cadastro.some(r => r.url === a.url));
    assert.ok(!urls.includes(`https://www.andersondamasio.com.br/${a.url}`));
    const copia = JSON.parse(ler(a.arquivoRecuperavel));
    assert.equal(hashRegistros(copia.registros), d.registrosHash);
    assert.equal(hashArquivo(copia.arquivos[0].html), d.arquivoHash);
    assert.equal(hashCorpoEditorial(cheerio.load(copia.arquivos[0].html)('.article-body').html()), a.antes.corpoHash);
    for (const alias of d.aliases) assert.equal(hashArquivo(copia.arquivos.find(p => p.url === alias.url).html), alias.arquivoHash);
    for (const p of [a.url, ...d.aliases.map(b => b.url)]) {
      const $ = cheerio.load(ler(p));
      assert.equal($('.article-body').length, 0);
      assert.equal($('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.destinoEquivalente}`);
      assert.match($('meta[name=robots]').attr('content'), /noindex/);
      assert.equal($('meta[http-equiv=refresh]').attr('content'), `0; url=https://www.andersondamasio.com.br/${a.destinoEquivalente}`);
    }
    const destino = cheerio.load(ler(a.destinoEquivalente));
    assert.equal(hashCorpoEditorial(destino('.article-body').html()), d.destinoConteudoHash);
    assert.doesNotMatch(destino('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(destino('meta[http-equiv=refresh]').length, 0);
  }
});

test('correcao de atribuicoes preserva publicacao e distingue fontes de propostas nao executadas', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-atribuicoes-2026-10.json'));
  assert.equal(lote.artigos.length, 8);
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.experimentosExecutados, false);
  assert.equal(lote.metricasGoogle, null);
  assert.equal(lote.linksExternosConhecidos, null);
  const corrigidos = lote.artigos.filter(a => a.acao === 'atualizar');
  assert.equal(corrigidos.length, 4);
  for (const a of corrigidos) {
    const $ = cheerio.load(ler(a.url));
    const r = cadastro.find(r => r.url === a.url);
    assert.equal(r.data, a.antes.data);
    assert.equal(r.revisaoHumana, undefined);
    assert.equal(r.correcaoEditorial.revisaoHumana, false);
    assert.equal(r.seo.modifiedAt, lote.em);
    assert.equal($('h1').text(), a.depois.titulo);
    assert.equal($('meta[name=description]').attr('content'), a.depois.descricao);
    assert.equal($('meta[property="article:published_time"]').attr('content'), a.antes.data);
    assert.equal($('.nota-atualizacao time').attr('datetime'), lote.em);
    assert.equal($('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.url}`);
    assert.doesNotMatch($('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(hashCorpoEditorial($('.article-body').html()), a.depois.corpoHash);
    assert.equal(manifesto.decisoes.find(d => d.url === a.url).conteudoHash, a.depois.corpoHash);
    assert.equal($('.contribuicao-editorial').length, 1);
    assert.match($('.limites-editoriais').text(), /não foi executado/);
    for (const e of a.evidencias) {
      assert.equal($(e.seletor).length, 1);
      assert.equal(hashCorpoEditorial($(e.seletor).html()), e.textoHash);
      assert.ok($(e.seletor).find('a').toArray().some(el => $(el).attr('href') === e.fonte));
    }
  }
  const green = cheerio.load(ler(corrigidos.find(a => a.url.includes('revolucao-verde')).url));
  assert.match(green('.fato-caso').text(), /Ludi Akue/);
  assert.match(green('.fato-caso').text(), /não uma experiência profissional de Anderson/);
  assert.doesNotMatch(green('.article-body').text(), /minha equipe|aprendi ao longo da minha jornada|6%/);
  const wiki = cheerio.load(ler(corrigidos.find(a => a.url.includes('wiki-perfeito')).url));
  assert.match(wiki('.fato-fundador').text(), /Ilia Pirozhenko/);
  assert.match(wiki('.fato-fundador').text(), /declaração do fundador/);
  assert.doesNotMatch(wiki('h1').text(), /como eu criei|250 mil/i);
  const busca = cheerio.load(ler(corrigidos.find(a => a.url.includes('chatgpt-a-revolucao')).url));
  assert.equal(busca('.article-body pre').length, 0);
  assert.doesNotMatch(busca('.article-body').text(), /OpenAIApi|GetAnswer|baseada em GPT-3/);
});

test('consolidacoes de nuvem e retiradas de carreira preservam copias e destinos equivalentes', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-atribuicoes-2026-10.json'));
  const ciclos = lote.artigos.filter(a => a.acao !== 'atualizar');
  assert.equal(ciclos.filter(a => a.acao === 'consolidar').length, 2);
  assert.equal(ciclos.filter(a => a.acao === 'retirar').length, 2);
  const sitemap = cheerio.load(ler('sitemap.xml'), { xmlMode: true });
  const urls = sitemap('loc').map((_, e) => sitemap(e).text()).get();
  for (const a of ciclos) {
    const d = manifesto.decisoes.find(d => d.url === a.url);
    assert.equal(d.acao, a.acao);
    assert.equal(d.motivo, a.motivo);
    assert.ok(!manifesto.protegidas.includes(a.url));
    assert.ok(!cadastro.some(r => r.url === a.url));
    assert.ok(!urls.includes(`https://www.andersondamasio.com.br/${a.url}`));
    const copia = JSON.parse(ler(a.arquivoRecuperavel));
    assert.equal(hashRegistros(copia.registros), d.registrosHash);
    assert.equal(hashArquivo(copia.arquivos[0].html), d.arquivoHash);
    assert.equal(hashCorpoEditorial(cheerio.load(copia.arquivos[0].html)('.article-body').html()), a.antes.corpoHash);
    for (const alias of d.aliases) assert.equal(hashArquivo(copia.arquivos.find(p => p.url === alias.url).html), alias.arquivoHash);
    for (const p of [a.url, ...d.aliases.map(b => b.url)]) {
      if (a.acao === 'retirar') {
        assert.ok(!fs.existsSync(path.join(root, p)));
        assert.equal(a.destinoEquivalente, null);
        assert.equal(d.destino, undefined);
      } else {
        const $ = cheerio.load(ler(p));
        assert.equal($('.article-body').length, 0);
        assert.equal($('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.destinoEquivalente}`);
        assert.match($('meta[name=robots]').attr('content'), /noindex/);
        assert.equal($('meta[http-equiv=refresh]').attr('content'), `0; url=https://www.andersondamasio.com.br/${a.destinoEquivalente}`);
        const destino = cheerio.load(ler(a.destinoEquivalente));
        assert.equal(hashCorpoEditorial(destino('.article-body').html()), d.destinoConteudoHash);
        assert.doesNotMatch(destino('meta[name=robots]').attr('content'), /noindex/);
        assert.equal(destino('meta[http-equiv=refresh]').length, 0);
      }
    }
  }
});

test('guias de backup preservam publicacao e indexacao, sem prometer testes ou vivencia inexistentes', () => {
  const lote = JSON.parse(ler('dados/editorial/correcoes-backups-2026-10.json'));
  assert.equal(lote.artigos.length, 2);
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.testesDeRecuperacaoExecutados, false);
  assert.equal(lote.metricasGoogle, null);
  for (const a of lote.artigos) {
    const $ = cheerio.load(ler(a.url));
    const r = cadastro.find(r => r.url === a.url);
    assert.equal(r.data, a.antes.data);
    assert.equal(r.revisaoHumana, undefined);
    assert.equal(r.correcaoEditorial.revisaoHumana, false);
    assert.equal(r.seo.modifiedAt, lote.em);
    assert.equal($('h1').text(), a.depois.titulo);
    assert.equal($('meta[name=description]').attr('content'), a.depois.descricao);
    assert.equal($('.nota-atualizacao time').attr('datetime'), lote.em);
    assert.equal($('meta[property="article:published_time"]').attr('content'), a.antes.data);
    assert.equal($('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.url}`);
    assert.doesNotMatch($('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(hashCorpoEditorial($('.article-body').html()), a.depois.corpoHash);
    assert.equal(manifesto.decisoes.find(d => d.url === a.url).conteudoHash, a.depois.corpoHash);
    assert.equal($('.contribuicao-editorial').length, 1);
    assert.equal($('.limites-editoriais').length, 1);
    assert.match($('.limites-editoriais').text(), /não (?:foi|foram).*test|não foi executado/i);
    const outra = lote.artigos.find(b => b.url !== a.url);
    assert.ok($('.article-body a').toArray().some(el => $(el).attr('href') === `/${outra.url}`));
    for (const e of a.evidencias) {
      assert.equal($(e.seletor).length, 1);
      assert.equal(hashCorpoEditorial($(e.seletor).html()), e.textoHash);
      assert.ok($(e.seletor).find('a').toArray().some(el => $(el).attr('href') === e.fonte));
    }
    assert.doesNotMatch($('.article-body').text(), /que aprendi ao longo da minha carreira|desafios que enfrentei|plano de backup mensal ou trimestral/i);
  }
});

test('correcoes de seguranca preservam identidade e vinculam afirmacoes a fontes primarias', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-seguranca-2026-10.json'));
  assert.equal(lote.artigos.length, 7);
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.experimentosExecutados, false);
  assert.equal(lote.metricasGoogle, null);
  assert.equal(lote.linksExternosConhecidos, null);
  const permitidos = new Set(['www.sec.gov', 'learn.microsoft.com', 'support.microsoft.com',
    'owasp.org', 'www.maxfinancialservices.com', 'media.kingston.com', 'www.infoq.com']);
  for (const a of lote.artigos) {
    const q = cheerio.load(ler(a.url));
    const r = cadastro.find(r => r.url === a.url);
    const decisao = manifesto.decisoes.find(d => d.url === a.url);
    assert.equal(a.acao, 'atualizar');
    assert.equal(r.data, a.antes.data);
    assert.equal(r.revisaoHumana, undefined);
    assert.equal(r.correcaoEditorial.revisaoHumana, false);
    assert.equal(r.seo.modifiedAt, lote.em);
    assert.equal(q('h1').text(), a.depois.titulo);
    assert.equal(q('meta[name=description]').attr('content'), a.depois.descricao);
    assert.equal(q('meta[property="article:published_time"]').attr('content'), a.antes.data);
    assert.equal(q('.nota-atualizacao time').attr('datetime'), lote.em);
    assert.equal(q('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.url}`);
    assert.doesNotMatch(q('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(hashCorpoEditorial(q('.article-body').html()), a.depois.corpoHash);
    assert.equal(decisao.conteudoHash, a.depois.corpoHash);
    assert.equal(decisao.motivo, a.motivo);
    assert.equal(q('.contribuicao-editorial').length, 1);
    assert.equal(q('.limites-editoriais').length, 1);
    assert.ok(a.pergunta && a.sobreposicao);
    assert.equal(r.qualidadeEditorial, undefined);
    for (const e of a.evidencias) {
      assert.ok(permitidos.has(new URL(e.fonte).hostname));
      assert.equal(q(e.seletor).length, 1);
      assert.equal(hashCorpoEditorial(q(e.seletor).html()), e.textoHash);
      assert.equal(q(e.seletor).find('a').attr('href'), e.fonte);
    }
    assert.doesNotMatch(q('.article-body').text(), /eu testei isso|tive a oportunidade de testar|com base na minha experiência|baseado em minha experiência|lembro-me de um projeto|já passei por isso em um projeto/i);
  }
});

test('textos de seguranca nao confundem proposta, autenticacao, alegacao ou teste destrutivo com evidencia', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-seguranca-2026-10.json'));
  const pagina = trecho => cheerio.load(ler(lote.artigos.find(a => a.url.includes(trecho)).url));
  const auth = pagina('victoria-s-secret');
  assert.equal(auth('.article-body pre').length, 0);
  assert.match(auth('.article-body').text(), /autenticação.*identidade.*autorização.*acesso/s);
  assert.match(auth('.contribuicao-editorial').text(), /pedido de outro cliente/);
  assert.match(auth('.fato-incidente').text(), /não identifica uma falha de autenticação/);
  assert.match(auth('.limites-editoriais').text(), /não foi executado/);
  const axis = pagina('seguranca-em-alta');
  assert.doesNotMatch(axis('h1').text(), /vazamento/i);
  assert.match(axis('.fato-comunicado').text(), /alegando acesso/);
  assert.match(axis('.article-body').text(), /não afirma que a investigação continua aberta hoje/);
  const windows = pagina('como-proteger-seu-pc');
  assert.match(windows('.fato-offline').text(), /Salve o trabalho/);
  assert.match(windows('.fato-offline').text(), /verificação rápida no ambiente de recuperação/);
  assert.match(windows('.limites-editoriais').text(), /Nenhuma verificação.*foi executada/);
  const ironkey = pagina('ferramentas-de-seguranca');
  assert.equal(ironkey('.fato-manual li').length, 3);
  assert.match(ironkey('.fato-manual li').eq(0).text(), /bloqueio.*redefinição/);
  assert.match(ironkey('.fato-manual li').eq(1).text(), /Admin.*apagamento criptográfico/);
  assert.match(ironkey('.fato-manual li').eq(2).text(), /User-Only.*apagamento criptográfico/);
  assert.match(ironkey('.article-body').text(), /Não provoque o limite de tentativas/);
  assert.match(ironkey('.limites-editoriais').text(), /não foi testado/);
  const arquitetura = pagina('desvendando-os-lacos');
  assert.match(arquitetura('.fato-palestra').text(), /Shana Dacres-Lawrence/);
  assert.match(arquitetura('.fato-palestra').text(), /não de Anderson Damasio/);
  const aitg = pagina('a-nova-era-dos-testes');
  assert.match(aitg('.fato-aitg').text(), /26 de novembro de 2025/);
  assert.match(aitg('.contribuicao-editorial').text(), /resultado: não executado/);
  const curso = pagina('seguranca-e-privacidade');
  const cursoRegistro = lote.artigos.find(a => a.url.includes('seguranca-e-privacidade'));
  assert.equal(cursoRegistro.antes.qualidadeEditorialAnterior.palavrasArtigo, 982);
  assert.match(curso('.article-body').text(), /não recomenda matrícula/);
  assert.match(curso('.limites-editoriais').text(), /Não houve participação ou avaliação independente/);
  assert.ok(curso('.article-body a').toArray().some(el => curso(el).attr('href') === `/${lote.artigos.find(a => a.url.includes('a-nova-era-dos-testes')).url}`));
});

test('correcao de fluxos preserva historico e separa teste executado de proposta', () => {
  const lote = JSON.parse(ler('dados/editorial/curadoria-fluxos-2026-10.json'));
  assert.equal(lote.revisaoHumana, false);
  assert.equal(lote.metricasGoogle, null);
  assert.equal(lote.artigos.length, 2);
  for (const a of lote.artigos) {
    const q = cheerio.load(ler(a.url));
    const r = cadastro.find(r => r.url === a.url);
    assert.equal(r.data, a.antes.data);
    assert.equal(r.correcaoEditorial.revisaoHumana, false);
    assert.equal(r.correcaoEditorial.relatorio, 'dados/editorial/curadoria-fluxos-2026-10.json');
    assert.equal(r.seo.modifiedAt, lote.em);
    assert.equal(r.qualidadeEditorial, undefined);
    assert.equal(q('.nota-atualizacao time').attr('datetime'), lote.em);
    assert.equal(q('h1').text(), a.depois.titulo);
    assert.equal(q('meta[name=description]').attr('content'), a.depois.descricao);
    assert.equal(q('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.url}`);
    assert.doesNotMatch(q('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(hashCorpoEditorial(q('.article-body').html()), a.depois.corpoHash);
    assert.equal(manifesto.decisoes.find(d => d.url === a.url).conteudoHash, a.depois.corpoHash);
    for (const e of a.evidencias) {
      assert.equal(q(e.seletor).length, 1);
      assert.equal(hashCorpoEditorial(q(e.seletor).html()), e.textoHash);
      assert.equal(q(e.seletor).find('a').attr('href'), e.fonte);
    }
    const anterior = JSON.parse(ler(a.resolvePendenciaDe));
    assert.ok(anterior.pendentesRelacionadas.some(p => p.url === a.url));
    assert.equal(q('.contribuicao-editorial').length, 1);
    assert.equal(q('.limites-editoriais').length, 1);
  }
  const lens = lote.artigos.find(a => !a.experimento);
  const l = cheerio.load(ler(lens.url));
  assert.match(l('.fato-lens').text(), /alternativa recomendada é o OneDrive/);
  assert.match(l('.fato-lens').text(), /não apresenta o Copilot/);
  assert.match(l('.contribuicao-editorial').text(), /não um teste realizado/);
  const health = lote.artigos.find(a => a.experimento);
  assert.equal(health.experimento.resultado, 'passed');
  assert.equal(health.experimento.verificacoes, 11);
  assert.equal(health.experimento.testeProducao, false);
  assert.equal(health.experimento.operacaoNegocioValidada, false);
  for (const arquivo of health.experimento.arquivos) {
    assert.equal(digest(ler(arquivo.caminho)), arquivo.sha256);
  }
  const h = cheerio.load(ler(health.url));
  assert.match(h('.resultado-executado').text(), /11 verificações HTTP passaram/);
  assert.match(h('.limites-editoriais').text(), /Nenhuma operação de negócio foi validada/);
  assert.equal(h('.contribuicao-editorial tbody tr').length, 5);
});

test('curadoria contextual tem decisoes individuais, sem inventar metricas ou aprovacao humana', () => {
  assert.equal(relatorio.revisaoHumana, false);
  assert.equal(relatorio.metricasGoogle, null);
  assert.equal(relatorio.linksExternosConhecidos, null);
  assert.equal(new Set(relatorio.artigos.map(a => a.url)).size, 13);
  assert.deepEqual(Object.fromEntries(['atualizar', 'noindex', 'retirar'].map(acao =>
    [acao, relatorio.artigos.filter(a => a.acao === acao).length])), { atualizar: 3, noindex: 4, retirar: 6 });
  for (const a of relatorio.artigos) {
    const decisao = manifesto.decisoes.find(d => d.url === a.url);
    assert.equal(decisao.acao, a.acao);
    assert.equal(decisao.motivo, a.motivo);
    assert.equal(decisao.evidencia, a.evidencia);
    assert.ok(!manifesto.protegidas.includes(a.url));
  }
});

test('correcoes mantem URL e publicacao, datam a revisao e vinculam trechos as fontes', () => {
  for (const a of relatorio.artigos.filter(a => a.acao === 'atualizar')) {
    const $ = cheerio.load(ler(a.url));
    const r = cadastro.find(r => r.url === a.url);
    assert.equal(r.data, a.antes.data);
    assert.equal(r.revisaoHumana, undefined);
    assert.equal(r.correcaoEditorial.revisaoHumana, false);
    assert.equal(r.seo.modifiedAt, relatorio.em);
    assert.equal($('.nota-atualizacao time').attr('datetime'), relatorio.em);
    assert.equal($('h1').text(), a.depois.titulo);
    assert.equal($('link[rel=canonical]').attr('href'), `https://www.andersondamasio.com.br/${a.url}`);
    assert.equal(hashCorpoEditorial($('.article-body').html()), a.depois.corpoHash);
    assert.notEqual(a.antes.corpoHash, a.depois.corpoHash);
    assert.doesNotMatch($('meta[name=robots]').attr('content'), /noindex/);
    for (const e of a.evidencias) {
      assert.equal($(e.seletor).length, 1);
      assert.equal(hashCorpoEditorial($(e.seletor).html()), e.textoHash);
      const fontes = $(e.seletor).find('a[href]').map((_, el) => $(el).attr('href')).get();
      for (const fonte of e.fontes || [e.fonte]) assert.ok(fontes.includes(fonte));
    }
    assert.equal($('.contribuicao-editorial').length, 1);
    assert.equal($('.limites-editoriais').length, 1);
  }
});

test('noindex preserva corpo e data, mas deixa sitemap e RSS', () => {
  const sitemap = cheerio.load(ler('sitemap.xml'), { xmlMode: true });
  const rss = cheerio.load(ler('rss.xml'), { xmlMode: true });
  const urls = [...sitemap('loc').map((_, e) => sitemap(e).text()).get(), ...rss('item link').map((_, e) => rss(e).text()).get()];
  for (const a of relatorio.artigos.filter(a => a.acao === 'noindex')) {
    const $ = cheerio.load(ler(a.url));
    assert.match($('meta[name=robots]').attr('content'), /noindex/);
    assert.equal(hashCorpoEditorial($('.article-body').html()), a.antes.corpoHash);
    assert.equal(cadastro.find(r => r.url === a.url).data, a.antes.data);
    assert.ok(!urls.includes(`https://www.andersondamasio.com.br/${a.url}`));
  }
});

test('retiradas possuem copias recuperaveis conferidas e nao geram redirecionamento irrelevante', () => {
  for (const a of relatorio.artigos.filter(a => a.acao === 'retirar')) {
    const d = manifesto.decisoes.find(d => d.url === a.url);
    const backup = JSON.parse(ler(a.arquivoRecuperavel));
    assert.equal(backup.url, a.url);
    assert.equal(hashRegistros(backup.registros), d.registrosHash);
    assert.equal(hashArquivo(backup.arquivos[0].html), d.arquivoHash);
    assert.equal(hashCorpoEditorial(cheerio.load(backup.arquivos[0].html)('.article-body').html()), a.antes.corpoHash);
    assert.ok(!fs.existsSync(path.join(root, a.url)));
    assert.ok(!cadastro.some(r => r.url === a.url));
    assert.equal(a.destinoEquivalente, null);
    assert.equal(d.destino, undefined);
  }
});
