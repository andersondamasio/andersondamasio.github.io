const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { rascunhoFixture, aprovacaoFixture } = require("./fixtures/editorial-review");
const { validarDossie, validarAprovacao, aprovarRascunho, avaliarHtmlEditorial, avaliarCadenciaSemanal,
  hashRascunho, candidatosDuplicidade } = require("./editorial-review");

test("dossie completo continua sem aprovacao enquanto nao houver declaracao humana", () => {
  const rascunho = rascunhoFixture();
  assert.equal(validarDossie(rascunho).aceita, true);
  assert.equal(validarAprovacao(rascunho).aceita, false);
  assert.throws(() => aprovarRascunho(rascunho, { responsavel: "IA automatica" }), /revisor humano/);
  assert.equal(validarAprovacao(aprovacaoFixture()).aceita, true);
});

test("hash cobre texto, pauta, resumo, fontes, modelos e imagem, independentemente da ordem de chaves", () => {
  const aprovado = aprovacaoFixture();
  const alteracoes = [
    r => { r.corpoArtigo += "<p>Um novo fato nao aprovado.</p>"; },
    r => { r.titulo += " atualizado"; }, r => { r.resumo += " Novo resumo."; },
    r => { r.dossie.pauta.pergunta += " Outra pergunta."; },
    r => { r.dossie.fontes[0].url += "?v=2"; },
    r => { r.geracao = { modelo: "outro-modelo" }; },
    r => { r.dossie.midias = [{ src: "/outro.png" }]; }
  ];
  for (const alterar of alteracoes) {
    const copia = structuredClone(aprovado);
    alterar(copia);
    assert.equal(validarAprovacao(copia).aceita, false);
  }
  const reordenado = Object.fromEntries(Object.entries(aprovado).reverse());
  assert.equal(hashRascunho(reordenado), hashRascunho(aprovado));
  assert.equal(hashRascunho(JSON.parse(JSON.stringify(aprovado))), hashRascunho(aprovado));
});

test("aprovacao antiga sintetica nao dispensa a triagem atual de uso pessoal", () => {
  const r = aprovacaoFixture();
  r.corpoArtigo += '<p>O aplicativo mudou minha rotina.</p>';
  // Simula um pacote antigo com hash consistente, somente nesta fixture isolada.
  r.revisaoHumana.hash = hashRascunho(r);
  const resultado = validarAprovacao(r);
  assert.equal(resultado.aceita, false);
  assert.ok(resultado.motivos.includes('vivencia-pessoal-implicita'));
  assert.equal(resultado.motivos.includes('aprovacao-humana-ausente-ou-desatualizada'), false);
});

test("afirmacoes, fontes, contribuicao e limites precisam corresponder ao artigo", () => {
  const alteracoes = [
    r => { r.dossie.afirmacoes = []; }, r => { r.dossie.afirmacoes[0].trecho = "Um fato ausente do artigo de exemplo."; },
    r => { r.dossie.afirmacoes[0].fonteUrl = "https://example.org/outra"; },
    r => { r.dossie.afirmacoes[0].localizacaoNaFonte = ""; },
    r => { r.dossie.afirmacoes[0].trecho = "<script>falso trecho presente</script>"; },
    r => { r.fonte.data = "invalida"; },
    r => { r.dossie.fontes[0].resumoEvidencia = ""; }, r => { r.dossie.fontes[0].tipo = "secundaria"; },
    r => { r.dossie.fontes[0].consultadaEm = "invalida"; },
    r => { r.dossie.contribuicao.trecho = "Outra contribuicao ausente do texto."; },
    r => { r.dossie.limites = "Limites que nao foram escritos no artigo."; }
  ];
  for (const alterar of alteracoes) {
    const r = rascunhoFixture(); alterar(r);
    assert.equal(validarDossie(r).aceita, false);
  }
});

test("novo artigo exige justificativa para pautas que reutilizam fonte ou tem sobreposicao", () => {
  const r = rascunhoFixture();
  const titulos = [{ titulo: "Contratos de mensagens e eventos", urlFonte: r.fonte.url, url: "artigos/arquitetura/anterior.html" }];
  assert.equal(candidatosDuplicidade(r, titulos).length, 1);
  assert.ok(validarDossie(r, titulos).motivos.includes("sobreposicao-a-revisar"));
  r.dossie.duplicidade.candidatos = [{ ...titulos[0], justificativa: "Pauta distinta conferida na fixture, sem reutilizar sua resposta." }];
  assert.equal(validarDossie(r, titulos).aceita, true);
  const aprovado = aprovacaoFixture(r, titulos);
  const atualizado = [...titulos, { ...titulos[0], url: "artigos/arquitetura/outro.html" }];
  assert.equal(validarAprovacao(aprovado, atualizado).aceita, false);
});

test("HTML ativo e URLs inseguras sao recusados, codigo escapado permanece valido", () => {
  for (const html of [
    '<script>alert(1)</script><p>Texto</p>', '<img src="https://example.org/a.png" onerror="alert(1)">',
    '<a href="javascript:alert(1)">Link</a>', '<a href="java&#x73;cript:alert(1)">Link</a>',
    '<iframe src="https://example.org"></iframe>', '<svg onload="alert(1)"></svg>',
    '<p style="position:fixed">Texto</p>', '<img src="//example.org/a.png">',
    '</div><p>Texto que escaparia do artigo</p>', '<p>Texto</p></main><p>Conteudo externo</p>',
    '<div><p>Container sem fechamento explicito</p>'
  ]) assert.equal(avaliarHtmlEditorial(html).aceita, false, html);
  assert.equal(avaliarHtmlEditorial('<p>Exemplo:</p><pre><code>&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>').aceita, true);
});

test("imagem requer origem, direitos, texto alternativo e dimensoes", () => {
  const r = rascunhoFixture();
  r.corpoArtigo += '<figure><img src="/assets/teste.png" alt="Contrato de teste" width="800" height="500"><figcaption>Diagrama de teste.</figcaption></figure>';
  assert.ok(validarDossie(r).motivos.includes("imagem-sem-direitos-ou-metadados"));
  r.dossie.midias = [{ src: "/assets/teste.png", origem: "https://example.org/diagrama", direitos: "Fixture de teste propria sem utilizacao externa." }];
  assert.equal(validarDossie(r).aceita, true);
});

test("replay, checklist incompleto, politica antiga e aprovacao futura bloqueiam publicacao", () => {
  const aprovado = aprovacaoFixture();
  assert.equal(validarAprovacao(aprovado, [{ editorial: { hash: aprovado.revisaoHumana.hash } }]).aceita, false);
  for (const alterar of [
    r => { r.revisaoHumana.checklist.conferiFatosNasFontes = false; },
    r => { r.revisaoHumana.politica = "antiga"; }, r => { r.revisaoHumana.aprovadaEm = "2099-10-01"; },
    r => { r.revisaoHumana.responsavel = ""; }, r => { r.publicado = true; }
  ]) { const r = structuredClone(aprovado); alterar(r); assert.equal(validarAprovacao(r).aceita, false); }
});

test("cadencia protege intervalo de sete dias inclusive execucao manual e datas futuras", () => {
  const titulos = [{ data: "2026-10-01T12:00:00Z" }];
  assert.equal(avaliarCadenciaSemanal(titulos, new Date("2026-10-08T11:59:59Z")).aceita, false);
  assert.equal(avaliarCadenciaSemanal(titulos, new Date("2026-10-08T12:00:00Z")).aceita, true);
  assert.equal(avaliarCadenciaSemanal(titulos, new Date("2026-09-30T12:00:00Z")).aceita, false);
  assert.equal(avaliarCadenciaSemanal([], new Date()).aceita, true);
});

test("CLI sem parametros falha sem iniciar geracao ou consumo de API", () => {
  assert.throws(() => execFileSync(process.execPath, [require.resolve("./editorial-cli")], { stdio: "pipe" }), /Uso:/);
});

test("CLI nao aprova um dossie valido de forma nao interativa", () => {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, "perfil-review-cli-test-"));
  try {
    fs.writeFileSync(path.join(root, "titulos.json"), "[]");
    fs.writeFileSync(path.join(root, "rascunho.json"), JSON.stringify(rascunhoFixture()));
    assert.throws(() => execFileSync(process.execPath, [require.resolve("./editorial-cli"), "aprovar", "rascunho.json"], {
      cwd: root, stdio: "pipe"
    }), /revisor humano em terminal interativo/);
    assert.equal(fs.existsSync(path.join(root, "dados")), false);
  } finally {
    if (path.dirname(path.resolve(root)) !== base || !path.basename(root).startsWith("perfil-review-cli-test-")) throw new Error("Temporario fora do escopo");
    fs.rmSync(root, { recursive: true, force: true });
  }
});
