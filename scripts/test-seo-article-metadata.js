const test = require("node:test");
const assert = require("node:assert/strict");
const { criarMetadadosArtigo, contarPalavrasProsa, artigoTemMetadadosCoerentes,
  limparTextoArtigo, contarPalavras, keywordsMetaContent } = require("./seo-article-metadata");
const { criarPessoaSchema } = require("./seo-identity");

const contexto = { category: "Arquitetura", articleHtml: "<p>Fila com entrega persistente.</p>",
  publishedDate: "2025-12-31T23:00:00Z" };
const artigo = () => ({ ...criarMetadadosArtigo(contexto), copyrightHolder: criarPessoaSchema() });

test("metadados descrevem o texto curto sem inventar palavras-chave ou entidades", () => {
  assert.deepEqual(criarMetadadosArtigo(contexto), {
    wordCount: 4, about: { "@type": "Thing", name: "Arquitetura" },
    isAccessibleForFree: true, copyrightYear: 2025
  });
  assert.equal(artigoTemMetadadosCoerentes(artigo(), contexto), true);
});

test("contagem separa blocos e preserva palavras interrompidas por marcacao inline", () => {
  assert.equal(contarPalavrasProsa("<p>micro<strong>servicos</strong></p><p>fila<br>duravel</p><ul><li>um</li><li>dois</li></ul>"), 5);
  assert.equal(contarPalavrasProsa("<table><tr><td>um</td><td>dois</td></tr></table>"), 2);
});

test("parser decodifica entidades uma vez e conta codigo inline como texto", () => {
  assert.equal(contarPalavrasProsa("<p>a&ccedil;&atilde;o&nbsp;d&#39;agua guarda-chuva <code>List&lt;T&gt;</code></p>"), 5);
  assert.equal(contarPalavrasProsa("<p>&lt;div&gt;texto&lt;/div&gt;</p>"), 3);
  assert.equal(contarPalavrasProsa("<p>&amp;lt;tag&amp;gt;</p>"), 3);
});

test("contagem exclui blocos de codigo e elementos gerados ou ocultos", () => {
  const descartado = '<pre><code>muitas palavras de codigo</code></pre><script>ignorar()</script>' +
    '<style>.regra { display: none; }</style><template>Outro texto</template>' +
    '<p hidden>Texto oculto</p><button class="copy-button">Copiar codigo</button>' +
    '<section class="article-validation">Nota editorial</section><section class="article-usefulness">Nota antiga</section>';
  assert.equal(contarPalavrasProsa(`<p>Texto.</p>${descartado}`), 1);
  assert.equal(contarPalavrasProsa(descartado), 0);
});

test("data desconhecida nao vira ano atual; usa o ano UTC da publicacao conhecida", () => {
  for (const publishedDate of [undefined, null, "", "invalida"]) {
    assert.equal(Object.hasOwn(criarMetadadosArtigo({ ...contexto, publishedDate }), "copyrightYear"), false);
  }
  assert.equal(criarMetadadosArtigo({ ...contexto, publishedDate: "2025-12-31T23:00:00-03:00" }).copyrightYear, 2026);
  assert.deepEqual(criarMetadadosArtigo({}), { isAccessibleForFree: true });
});

test("auditoria rejeita contagem, categoria, ano e acessibilidade divergentes", () => {
  for (const alteracao of [
    { wordCount: 100 }, { wordCount: "4" }, { wordCount: undefined },
    { about: { "@type": "Thing", name: "Outra categoria" } },
    { about: { "@type": "Person", name: contexto.category } },
    { copyrightYear: 2026 }, { copyrightHolder: null }, { isAccessibleForFree: false },
    { keywords: ["quem", "fila", "persistente"] }, { mentions: [{ "@type": "Thing", name: "quem" }] }
  ]) assert.equal(artigoTemMetadadosCoerentes({ ...artigo(), ...alteracao }, contexto), false, JSON.stringify(alteracao));
  assert.equal(artigoTemMetadadosCoerentes(artigo()), false);
  assert.equal(artigoTemMetadadosCoerentes(null, contexto), false);
});

test("helpers dos filtros editoriais e de palavras-chave manuais mantem contrato", () => {
  const texto = '<p>Resumo: Uma fila &amp; duas rotas.</p><pre>nao contar</pre>';
  assert.equal(limparTextoArtigo(texto), "Uma fila & duas rotas.");
  assert.equal(contarPalavras(texto), 4);
  assert.equal(keywordsMetaContent([" termo   curado ", "", "outro"]), "termo curado, outro");
});
