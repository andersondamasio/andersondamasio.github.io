const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { avaliarGeneroEditorial, revisarComPoliticaEditorial } = require("./editorial-policy");
const { avaliarSinaisHumanizer, validarPreservacaoHumanizer } = require("./humanizer-editorial");
const { salvarRascunhoEditorial } = require("./editorial-draft");
const { inventariarAcervo } = require("./editorial-inventory");
const { gerar, publicarRascunhoAprovado, reconstruirPaginasSeo } = require("../gerar-conteudo");
const { aprovacaoFixture } = require("./fixtures/editorial-review");

const fonteUrl = "https://example.org/documentacao";
const citacao = "Eu testei o sistema em um ambiente isolado e documentei os limites.";
const fontes = [{ url: fonteUrl, texto: `Relato da pesquisadora: ${citacao}` }];
const quoteHtml = `<blockquote cite="${fonteUrl}"><p>${citacao}</p><cite>Pesquisadora, fonte original</cite></blockquote>`;

async function comWorkspace(executar) {
  const base = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(base, "perfil-editorial-test-"));
  const cwd = process.cwd();
  try {
    return await executar(root);
  } finally {
    process.chdir(cwd);
    if (path.dirname(path.resolve(root)) !== base || !path.basename(root).startsWith("perfil-editorial-test-")) {
      throw new Error("Diretorio temporario fora do escopo do teste.");
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function snapshot(root, saida = {}, prefixo = "") {
  for (const entrada of fs.readdirSync(path.join(root, prefixo), { withFileTypes: true })) {
    if (entrada.name === ".editorial") continue;
    const local = path.join(prefixo, entrada.name);
    if (entrada.isDirectory()) snapshot(root, saida, local);
    else saida[local] = fs.readFileSync(path.join(root, local)).toString("base64");
  }
  return saida;
}

test("retencao por sinais de vivencia em primeira ou terceira pessoa", () => {
  for (const corpoArtigo of [
    "<p>Na minha experiencia, isso funcionou.</p>",
    "<p>Minha experiencia com a API comprovou a melhoria.</p>",
    "<p>Eu participei da implantacao.</p>",
    "<p>Testei em producao antes de publicar.</p>",
    "<p>Nos meus projetos, implementei essa integracao.</p>",
    "<p>Anderson Damasio comprovou a melhoria.</p>",
    "<p>O autor testou o aplicativo.</p>",
    "<p>Ja vivi esse problema antes.</p>"
  ]) {
    const resultado = avaliarGeneroEditorial({ corpoArtigo });
    assert.equal(resultado.aceita, false, corpoArtigo);
    assert.equal(resultado.verificacaoFactual, false);
  }
  assert.equal(avaliarGeneroEditorial({ titulo: "Testei o sistema", corpoArtigo: "<p>Texto neutro.</p>" }).aceita, false);
});

test("preserva codigo, exemplo hipotetico e texto tecnico sem vivencia", () => {
  const corpoArtigo = '<p>Em um exemplo hipotetico, uma equipe poderia adotar filas.</p><pre><code>const frase = "Eu testei em meus projetos";</code></pre><p>O identificador <code>testei</code> e uma string.</p>';
  assert.equal(avaliarGeneroEditorial({ corpoArtigo }).aceita, true);
  assert.equal(avaliarSinaisHumanizer({ corpoArtigo }).sinais.some(s => s.id === "experiencia-pessoal-nao-verificavel"), false);
});

test("retencao cobre relatos de uso, preferencia e resultados pessoais no titulo ou corpo", () => {
  const frases = [
    "Instalei essas aplicacoes em todos os meus sistemas Linux",
    "Ja utilizei varias distribuicoes em projetos diferentes.",
    "Recentemente, passei por uma situacao assim.",
    "Decidi usar a IA e consegui fazer uma analise do plugin.",
    "Tive a oportunidade de experimentar o Fitbit Premium.",
    "Quando comecei a usar o Fitbit, percebi a diferenca.",
    "Como a IA mudou meu jeito de desenvolver",
    "A IA transformou o meu treino",
    "Meu top 11 de distribuicoes Linux",
    "Minhas distribuicoes favoritas",
    "O Kindle segue sendo meu preferido"
  ];
  for (const frase of frases) {
    for (const entrada of [{ titulo: frase, corpoArtigo: '<p>Texto neutro.</p>' }, { corpoArtigo: `<p>${frase}</p>` }]) {
      const r = avaliarGeneroEditorial(entrada);
      assert.equal(r.aceita, false, frase);
      assert.equal(r.verificacaoFactual, false);
    }
  }
});

test("novos sinais nao atingem orientacao ao leitor, hipotese impessoal ou identificadores", () => {
  for (const corpoArtigo of [
    '<p>Instale apenas os aplicativos necessarios. O desenvolvedor instalou o plugin.</p>',
    '<p>Em um exemplo hipotetico, uma equipe poderia trocar a distribuicao.</p>',
    '<p>Qual distribuicao seria a escolha da equipe? Um usuario pode salvar favoritos.</p>',
    '<pre><code>const exemplo = "Instalei o app e mudou minha rotina";</code></pre><p>O campo <code>minha escolha</code> e demonstrativo.</p>'
  ]) assert.equal(avaliarGeneroEditorial({ corpoArtigo }).aceita, true, corpoArtigo);
});

test("relato de uso citado exige texto e URL correspondentes, nao basta envolver em aspas", () => {
  const texto = 'Instalei o aplicativo e ele mudou minha rotina de trabalho.';
  const corpoArtigo = `<blockquote cite="${fonteUrl}"><p>${texto}</p><cite>Autora da fonte</cite></blockquote>`;
  const r = avaliarGeneroEditorial({ corpoArtigo, fontes: [{ url: fonteUrl, texto }] });
  assert.equal(r.aceita, true);
  assert.equal(r.citacoesRastreaveis, 1);
  assert.equal(avaliarGeneroEditorial({ corpoArtigo }).aceita, false);
  assert.equal(avaliarGeneroEditorial({ corpoArtigo, fontes: [{ url: fonteUrl, texto: 'Outro texto sem esse relato.' }] }).aceita, false);
});

test("citacao so e reconhecida quando texto e URL correspondem a fonte fornecida", () => {
  const resultado = avaliarGeneroEditorial({ corpoArtigo: quoteHtml, fontes });
  assert.equal(resultado.aceita, true);
  assert.equal(resultado.citacoesRastreaveis, 1);
  assert.equal(avaliarGeneroEditorial({ corpoArtigo: quoteHtml }).aceita, false);
  assert.equal(avaliarGeneroEditorial({ corpoArtigo: quoteHtml, fontes: [{ url: fonteUrl, texto: "Outro relato" }] }).aceita, false);
  assert.equal(avaliarGeneroEditorial({ corpoArtigo: quoteHtml.replace(fonteUrl, "https://example.org/outro"), fontes }).aceita, false);
  assert.equal(avaliarGeneroEditorial({ corpoArtigo: `${quoteHtml}<p>Eu testei tambem.</p>`, fontes }).aceita, false);
});

test("Humanizer preserva citacao e nao introduz vivencia mesmo com nota alta", () => {
  const original = { titulo: "Relato de uma pesquisadora", corpoArtigo: quoteHtml };
  assert.equal(validarPreservacaoHumanizer(original, original, fontes).aceita, true);
  assert.equal(avaliarSinaisHumanizer({ ...original, fontes }).sinais.some(s => s.id === "experiencia-pessoal-nao-verificavel"), false);
  const alterada = validarPreservacaoHumanizer(original, { ...original, corpoArtigo: quoteHtml.replace("isolado", "produtivo") }, fontes);
  assert.ok(alterada.motivos.includes("citacoes-alteradas"));
  const atribuicaoAlterada = validarPreservacaoHumanizer(original, { ...original, corpoArtigo: quoteHtml.replace("Pesquisadora, fonte original", "Anderson Damasio") }, fontes);
  assert.ok(atribuicaoAlterada.motivos.includes("citacoes-alteradas"));
  const inserida = validarPreservacaoHumanizer(original, { ...original, corpoArtigo: `${quoteHtml}<p>Nos nossos clientes, comprovamos melhorias.</p>` }, fontes);
  assert.equal(inserida.aceita, false);
});

test("revisao executa a politica antes e depois da transformacao de linguagem", async () => {
  let chamadas = 0;
  const parametros = {
    titulo: "Uma analise tecnica", corpoArtigo: "<p>Eu testei este sistema.</p>",
    noticia: { url: fonteUrl }, textoFonte: fontes[0].texto,
    humanizar: async () => { chamadas++; return { aceita: true, titulo: "Analise", corpoArtigo: "<p>Anderson testou tudo.</p>" }; }
  };
  const antes = await revisarComPoliticaEditorial(parametros);
  assert.equal(antes.aceita, false);
  assert.equal(chamadas, 0);
  const depois = await revisarComPoliticaEditorial({ ...parametros, corpoArtigo: "<p>A noticia descreve o sistema.</p>" });
  assert.equal(chamadas, 1);
  assert.equal(depois.aceita, false);
  assert.ok(depois.motivos.includes("vivencia-atribuida-ao-autor"));
});

test("rascunho nunca assume aprovacao, nao sobrescreve arquivos e permanece isolado", async () => comWorkspace(root => {
  const a = salvarRascunhoEditorial({ titulo: "../../escape", estado: "aprovado", publicado: true, revisaoHumana: "inventada" }, root);
  const b = salvarRascunhoEditorial({ titulo: "Mesmo titulo" }, root);
  assert.notEqual(a, b);
  assert.equal(path.dirname(a), path.join(root, ".editorial", "rascunhos"));
  const pacote = JSON.parse(fs.readFileSync(a, "utf8"));
  assert.equal(pacote.estado, "revisao_pendente");
  assert.equal(pacote.publicado, false);
  assert.equal(pacote.revisaoHumana, null);
  assert.deepEqual(fs.readdirSync(root), [".editorial"]);
}));

const tituloFixture = "Analise de filas para integracao de sistemas";
const textoFonteFixture = "Documented source material about a software release and its compatibility guarantees. ".repeat(40);
const corpoFixture = Array.from({ length: 5 }, (_, indice) =>
  `<h2>Decisao tecnica ${indice + 1}</h2><p>${"A noticia reporta um fato da fonte e esta interpretacao possui limites para a aplicacao pratica pela equipe de arquitetura. ".repeat(10)}</p>`
).join("") + "<ul><li>Confira os contratos entre servicos.</li></ul>";

async function testarGerador(root, { corpo = corpoFixture, corpoRevisado = corpo, somenteRascunho = true } = {}) {
  fs.writeFileSync(path.join(root, "titulos.json"), "[]\n");
  fs.writeFileSync(path.join(root, "index.html"), "home protegida");
  fs.writeFileSync(path.join(root, "sitemap.xml"), "sitemap protegido");
  fs.writeFileSync(path.join(root, "rss.xml"), "feed protegido");
  const antes = snapshot(root);
  process.chdir(root);
  let geracoes = 0;
  let humanizacoes = 0;
  const resultado = await gerar({
    somenteRascunho,
    selecionarNoticia: async () => ({ titulo: "Fonte tecnica", url: fonteUrl, data: "2026-10-01T12:00:00Z" }),
    extrairFonte: async () => ({ textoPrincipal: textoFonteFixture, resumoFonte: "Resumo de teste" }),
    gerarTexto: async payload => {
      geracoes++;
      assert.ok(payload.messages[1].content.includes("nao deve assumir sua identidade"));
      assert.equal(payload.messages[1].content.includes("Voc\u00ea \u00e9 Anderson Damasio"), false);
      return { data: { choices: [{ message: { content: `${tituloFixture}\n${corpo}\n|Arquitetura|` } }] } };
    },
    humanizar: async () => {
      humanizacoes++;
      return {
        aceita: true, titulo: tituloFixture, corpoArtigo: corpoRevisado,
        avaliacaoAntes: { score: 100, sinais: [] }, avaliacaoDepois: { score: 100, sinais: [] }, tentativas: 1
      };
    }
  });
  assert.equal(geracoes, 1);
  assert.equal(resultado.publicado, false);
  assert.equal(resultado.estado, "revisao_pendente");
  assert.deepEqual(snapshot(root), antes);
  assert.equal(fs.existsSync(path.join(root, "artigos")), false);
  const pacote = JSON.parse(fs.readFileSync(resultado.arquivo, "utf8"));
  assert.equal(pacote.revisaoHumana, null);
  return { pacote, humanizacoes };
}

test("gerador integrado: draft-only nao altera site, cadastro, sitemap ou feed", async () => comWorkspace(async root => {
  const { pacote, humanizacoes } = await testarGerador(root);
  assert.equal(humanizacoes, 1);
  assert.equal(pacote.qualidadeArtigo.aceita, true);
  assert.equal(pacote.revisaoEditorial.depois.aceita, true);
  assert.ok(pacote.pendencias.includes("revisao-humana"));
}));

test("gerador integrado: bloqueia vivencia antes do Humanizer inclusive no modo normal", async () => comWorkspace(async root => {
  const { pacote, humanizacoes } = await testarGerador(root, { corpo: "<p>Eu testei esta API.</p>", somenteRascunho: false });
  assert.equal(humanizacoes, 0);
  assert.ok(pacote.pendencias.includes("vivencia-primeira-pessoa"));
}));

test("gerador integrado: nao publica vivencia reintroduzida pelo Humanizer", async () => comWorkspace(async root => {
  const { pacote } = await testarGerador(root, { corpoRevisado: `${corpoFixture}<p>Anderson Damasio testou em producao.</p>`, somenteRascunho: false });
  assert.ok(pacote.pendencias.includes("vivencia-atribuida-ao-autor"));
}));

test("gerador integrado retem experiencia implicita antes e depois do Humanizer", async () => {
  await comWorkspace(async root => {
    const { pacote, humanizacoes } = await testarGerador(root, { corpo: '<p>Tive a oportunidade de experimentar este aplicativo.</p>', somenteRascunho: false });
    assert.equal(humanizacoes, 0);
    assert.ok(pacote.pendencias.includes('vivencia-pessoal-implicita'));
  });
  await comWorkspace(async root => {
    const { pacote, humanizacoes } = await testarGerador(root, { corpoRevisado: `${corpoFixture}<p>O aplicativo mudou minha rotina.</p>`, somenteRascunho: false });
    assert.equal(humanizacoes, 1);
    assert.ok(pacote.pendencias.includes('vivencia-pessoal-implicita'));
  });
});

test("gerador integrado: noticia curta nao exige extensao artificial e ainda requer revisao", async () => comWorkspace(async root => {
  const { pacote } = await testarGerador(root, { corpo: "<p>Uma explicacao curta baseada na fonte.</p>" });
  assert.equal(pacote.qualidadeArtigo.aceita, true);
  assert.ok(pacote.pendencias.includes("revisao-humana"));
  assert.equal(pacote.revisaoHumana, null);
}));

test("publicacao em fixture isolada preserva artigo e politica apos dois rebuilds", async () => comWorkspace(async root => {
  fs.writeFileSync(path.join(root, "titulos.json"), "[]");
  process.chdir(root);
  const resultado = publicarRascunhoAprovado(aprovacaoFixture());
  assert.equal(resultado.publicado, true);
  assert.equal(resultado.onlineVerificado, false);
  const registros = JSON.parse(fs.readFileSync(path.join(root, "titulos.json"), "utf8"));
  assert.equal(registros.length, 1);
  assert.equal(registros[0].url, resultado.url);
  assert.ok(registros[0].editorial.hash);
  assert.equal(registros[0].editorial.revisaoHumana.responsavel, "Revisor sintetico de teste offline");
  const artigo = fs.readFileSync(path.join(root, resultado.url), "utf8");
  reconstruirPaginasSeo();
  const primeiro = snapshot(root);
  reconstruirPaginasSeo();
  assert.deepEqual(snapshot(root), primeiro);
  assert.equal(fs.readFileSync(path.join(root, resultado.url), "utf8"), artigo);
  assert.ok(fs.readFileSync(path.join(root, "sitemap.xml"), "utf8").includes(resultado.url));
  assert.ok(fs.readFileSync(path.join(root, "rss.xml"), "utf8").includes(resultado.url));
}));

test("gerador integrado: parametro legado false nao permite publicacao automatica", async () => comWorkspace(async root => {
  const { pacote } = await testarGerador(root, { somenteRascunho: false });
  assert.equal(pacote.estado, "revisao_pendente");
}));

test("publicador integrado bloqueia pendencia, repeticao e colisao sem alterar arquivos", async () => comWorkspace(root => {
  fs.writeFileSync(path.join(root, "titulos.json"), "[]");
  process.chdir(root);
  const aprovado = aprovacaoFixture();
  const antes = snapshot(root);
  assert.throws(() => publicarRascunhoAprovado({ ...aprovado, revisaoHumana: null }), /aprovacao/);
  assert.deepEqual(snapshot(root), antes);
  const resultado = publicarRascunhoAprovado(aprovado);
  const depois = snapshot(root);
  assert.throws(() => publicarRascunhoAprovado(aprovado), /ja-publicado/);
  assert.deepEqual(snapshot(root), depois);
  fs.writeFileSync(path.join(root, "titulos.json"), "[]");
  assert.throws(() => publicarRascunhoAprovado(aprovado), /existente/);
  assert.equal(fs.readFileSync(path.join(root, resultado.url), "utf8"), Buffer.from(depois[resultado.url.replaceAll("/", path.sep)], "base64").toString());
}));

test("publicador integrado reverte artigo e catalogo se rebuild detectar perda de cobertura", async () => comWorkspace(root => {
  fs.writeFileSync(path.join(root, "titulos.json"), "[]");
  fs.mkdirSync(path.join(root, "artigos", "arquitetura"), { recursive: true });
  fs.writeFileSync(path.join(root, "artigos", "arquitetura", "fora-do-cadastro.html"), '<html><head><title>Artigo real sem registro no catalogo</title></head><body><h1>Artigo real sem registro no catalogo</h1><div class="article-body"><p>Conteudo que nao pode desaparecer da navegacao.</p></div></body></html>');
  const antes = snapshot(root);
  process.chdir(root);
  assert.throws(() => publicarRascunhoAprovado(aprovacaoFixture()), /cobertura|cadastro|registro/i);
  assert.deepEqual(snapshot(root), antes);
}));

test("inventario e somente leitura e nunca resolve silenciosamente URLs ambiguas", async () => comWorkspace(root => {
  fs.mkdirSync(path.join(root, "artigos", "ia"), { recursive: true });
  fs.mkdirSync(path.join(root, "artigos", "dados"), { recursive: true });
  const html = '<h1>Teste</h1><meta name="robots" content="noindex,follow"><div class="article-body"><p>Eu testei o produto.</p></div>';
  fs.writeFileSync(path.join(root, "artigos", "ia", "teste.html"), html);
  fs.writeFileSync(path.join(root, "artigos", "dados", "teste.html"), html);
  fs.writeFileSync(path.join(root, "artigos", "index.html"), "<h1>Listagem</h1>");
  fs.writeFileSync(path.join(root, "titulos.json"), JSON.stringify([
    { titulo: "Teste", urlFonte: fonteUrl },
    { titulo: "Outro", url: "artigos/ia/teste.html", urlFonte: fonteUrl }
  ]));
  const antes = snapshot(root);
  const inventario = inventariarAcervo(root);
  assert.equal(inventario.resumo.artigos, 2);
  assert.equal(inventario.resumo.candidatosVivencia, 2);
  assert.equal(inventario.resumo.gruposFonteRepetida, 1);
  assert.equal(inventario.urlsImplicitas[0].candidatos.length, 2);
  assert.equal(inventario.urlsImplicitas[0].resolucao, "revisao_pendente");
  assert.equal(inventario.artigos[0].indexacaoGoogle, null);
  assert.equal(inventario.artigos[0].cliquesGoogle, null);
  assert.equal(inventario.artigos[0].robots, "noindex,follow");
  assert.deepEqual(snapshot(root), antes);
}));

test('inventario agrupa variantes de rastreamento mas preserva conteudo e cadastro', async () => comWorkspace(root => {
  fs.mkdirSync(path.join(root, 'artigos'), { recursive: true });
  const registros = [
    { titulo: 'Um assunto', url: 'artigos/a.html', urlFonte: 'https://example.org/doc?id=1&utm_source=feed#secao' },
    { titulo: 'Outro recorte', url: 'artigos/b.html', urlFonte: 'https://example.org/doc?id=1' },
    { titulo: 'Outra versao', url: 'artigos/c.html', urlFonte: 'https://example.org/doc?id=2' }
  ];
  for (const r of registros) fs.writeFileSync(path.join(root, r.url), `<h1>${r.titulo}</h1><div class="article-body"><p>Texto de fixture sem relato pessoal.</p></div>`);
  fs.writeFileSync(path.join(root, 'titulos.json'), JSON.stringify(registros));
  const antes = snapshot(root), resultado = inventariarAcervo(root);
  assert.deepEqual(resultado.fontesRepetidas, [{ url: 'https://example.org/doc?id=1', registros: registros.slice(0, 2).map(({ titulo, url }) => ({ titulo, url })) }]);
  for (const artigo of resultado.artigos) {
    assert.equal(artigo.motivos.includes('fonte-compartilhada-requer-comparacao'), artigo.url !== 'artigos/c.html');
    assert.equal(artigo.decisao, 'triagem_pendente');
  }
  assert.deepEqual(snapshot(root), antes);
}));

test('publicador integrado rejeita fonte reapresentada com UTM sem escrever site', async () => comWorkspace(root => {
  const aprovado = aprovacaoFixture();
  fs.writeFileSync(path.join(root, 'titulos.json'), JSON.stringify([{
    titulo: 'Recorte com palavras diferentes', url: 'artigos/anterior.html',
    urlFonte: aprovado.fonte.url + '?utm_medium=rss#resumo', data: '2026-09-01T00:00:00Z'
  }]));
  fs.writeFileSync(path.join(root, 'index.html'), 'Home protegida');
  fs.writeFileSync(path.join(root, 'sitemap.xml'), 'Sitemap protegido');
  fs.writeFileSync(path.join(root, 'rss.xml'), 'Feed protegido');
  const antes = snapshot(root);
  process.chdir(root);
  assert.throws(() => publicarRascunhoAprovado(aprovado, { agora: new Date('2026-10-09T12:00:00Z') }), /sobreposicao-a-revisar/);
  assert.deepEqual(snapshot(root), antes);
}));
