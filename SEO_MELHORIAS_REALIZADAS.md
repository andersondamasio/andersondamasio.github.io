# Melhorias de SEO Realizadas

Data: 06/05/2026

Ultima atualizacao: 25/06/2026

Este documento resume o processo de melhoria, rebuild e aplicacao de SEO feito no projeto do site/blog Anderson Damasio.

## Objetivo

Padronizar o SEO das paginas existentes e garantir que as proximas paginas geradas pelo projeto ja nascam com os metadados corretos.

O foco foi:

- Corrigir metadados essenciais de SEO.
- Automatizar a geracao de SEO para novos artigos.
- Reaplicar SEO em artigos antigos.
- Atualizar o sitemap.
- Criar scripts de auditoria e manutencao.

## Arquivos Principais Alterados

### `gerar-conteudo.js`

O gerador principal foi ajustado para incluir SEO automaticamente nas paginas geradas.

Foram adicionados:

- `title` unico por pagina.
- `meta description` otimizada.
- `canonical` correto.
- Open Graph (`og:title`, `og:description`, `og:url`, `og:image`, etc.).
- Twitter Cards.
- JSON-LD para artigos (`BlogPosting`).
- JSON-LD para breadcrumbs.
- JSON-LD para paginas de categoria e colecoes.
- `lang="pt-BR"` no HTML.
- Rebuild seguro de SEO com a flag `--rebuild-seo`.

Tambem foram ajustadas:

- Paginas de categoria.
- Indice de categorias.
- Indices paginados.
- Geracao do sitemap.

O sitemap passou a:

- Ignorar arquivos vazios ou invalidos.
- Evitar URLs duplicadas.
- Adicionar `lastmod`.
- Ordenar URLs.
- Remover entradas de paginas que nao existem ou nao sao indexaveis.

### `scripts/seo-backfill-articles.js`

Script criado para aplicar SEO retroativo nos artigos ja existentes.

Ele:

- Percorre os artigos HTML existentes.
- Recria o bloco `<head>` com metadados SEO limpos.
- Preserva estilos, links e scripts relevantes.
- Adiciona dados estruturados de artigo.
- Adiciona canonical, Open Graph e Twitter Cards.
- Ignora arquivos HTML invalidos ou paginas de colecao.

Resultado da execucao:

- SEO aplicado em 7670 artigos.
- 5 arquivos HTML invalidos foram ignorados.

### `scripts/seo-backfill-static.js`

Script criado para aplicar SEO nas paginas estaticas principais.

Paginas tratadas:

- `sobre.html`
- `contato.html`
- `termos.html`
- `politica.html`
- `obrigado.html`
- `beijaoupassa/politica-de-privacidade.html`

A pagina `obrigado.html` recebeu `noindex, follow`, pois normalmente nao deve aparecer nos resultados do Google.

### `scripts/seo-audit.js`

Script criado para auditar problemas de SEO no projeto.

Ele verifica:

- Ausencia de `lang`.
- Ausencia de `title`.
- Ausencia de `description`.
- Ausencia de `canonical`.
- Ausencia de `h1`.
- Mais de um `h1`.
- Ausencia de Open Graph.
- Ausencia de Twitter Cards.
- Ausencia de JSON-LD.
- Descricoes fracas.
- Canonicals duplicados.
- Titulos duplicados.
- Descricoes duplicadas.
- Arquivos faltando no sitemap.
- URLs duplicadas no sitemap.

## Scripts Adicionados

Foram adicionados os seguintes comandos no `package.json`:

```bash
npm run seo:rebuild
npm run seo:normalize-categories
npm run seo:backfill
npm run seo:backfill:static
npm run seo:audit
npm run seo:audit:strict
```

### Uso recomendado

Para reconstruir SEO das paginas geradas:

```bash
npm run seo:rebuild
```

Para normalizar categorias do `titulos.json`:

```bash
npm run seo:normalize-categories
```

Para reaplicar SEO nos artigos antigos:

```bash
npm run seo:backfill
```

Para reaplicar SEO nas paginas estaticas:

```bash
npm run seo:backfill:static
```

Para auditar SEO:

```bash
npm run seo:audit
```

Para usar a auditoria como validacao mais rigida:

```bash
npm run seo:audit:strict
```

## Processo Executado

Durante a aplicacao, os seguintes comandos foram executados:

```bash
npm run seo:rebuild
npm run seo:backfill
npm run seo:backfill:static
npm run seo:audit
```

Tambem foram feitas validacoes de sintaxe nos scripts Node.js.

## Resultado

O projeto agora tem um fluxo mais confiavel de SEO:

- Novos artigos ja sao gerados com SEO completo.
- Artigos antigos receberam metadados retroativos.
- Paginas estaticas principais receberam metadados adequados.
- O sitemap foi corrigido para evitar entradas invalidas.
- Existe uma auditoria local para acompanhar problemas futuros.

## Pontos Pendentes

Ainda ficaram alguns pontos que exigem decisao de conteudo:

### 1. Arquivos HTML invalidos ou vazios

Foram encontrados 5 arquivos invalidos/vazios. Eles foram ignorados pelo backfill e nao devem entrar no sitemap enquanto nao forem corrigidos.

Arquivos identificados:

- `artigos/blockchain/index.html`
- `artigos/inteligencia-artificial/a-inteligencia-artificial-como-aliado-ou-inimigo-o-dilema-da-reputacao-profissional.html`
- `artigos/seguranca/a-vulnerabilidade-das-credenciais-licoes-do-ataque-a-um-engenheiro-de-software.html`
- `artigos/tecnologia/a-nova-fronteira-do-investimento-tecnologia-de-defesa-na-europa.html`
- `artigos/tecnologia/aumentos-de-preco-e-a-arquitetura-de-software-como-a-tecnologia-pode-suportar-novas-demandas.html`

Recomendacao:

- Recuperar o conteudo original, se existir.
- Regenerar as paginas.
- Ou remover/redirecionar essas URLs caso nao devam existir.

### 2. Paginas com mais de um `h1`

Alguns artigos ainda possuem mais de um `h1`, geralmente porque o corpo do artigo tambem contem um titulo principal.

Recomendacao:

- Manter apenas o titulo da pagina como `h1`.
- Converter titulos internos do conteudo para `h2` ou `h3`.

### 3. Titulos duplicados ou fracos

Algumas paginas possuem titulos duplicados ou pouco descritivos, como paginas com titulo `Titulo:`.

Recomendacao:

- Revisar o conteudo desses artigos.
- Ajustar titulos ruins na fonte de dados.
- Considerar `noindex` para paginas de baixa qualidade ou duplicadas.

## Estrategia Para as Proximas Paginas

A partir de agora, o melhor fluxo e:

1. Gerar ou atualizar conteudo pelo processo normal.
2. Rodar `npm run seo:rebuild`.
3. Rodar `npm run seo:audit`.
4. Corrigir apenas os pontos apontados pela auditoria.

Para mudancas maiores ou publicacao em lote, o ideal e rodar:

```bash
npm run seo:rebuild
npm run seo:backfill
npm run seo:backfill:static
npm run seo:audit
```

Assim o projeto mantem um padrao unico de SEO, reduz trabalho manual e evita que novas paginas sejam publicadas sem os metadados essenciais.

---

## Atualizacao de 22/06/2026

Depois da analise no Google Search Console, foram feitos ajustes adicionais para resolver problemas de indexacao em escala, considerando que os artigos sao gerados automaticamente.

### Dados considerados do Search Console

- 1 clique e 258 impressoes nos ultimos 3 meses.
- CTR de 0,4% e posicao media de 17,2.
- 1.971 paginas indexadas.
- 8.688 paginas nao indexadas.
- 1.306 URLs com 404, principalmente caminhos antigos sem `/artigos/`.
- 4.528 URLs rastreadas, mas nao indexadas.
- 2.846 URLs descobertas, mas ainda nao rastreadas.
- Sitemap processado em 22/06/2026.
- Erro de dado estruturado `ProfilePage` sem `mainEntity` na home.

### Ajustes novos no gerador

O arquivo `gerar-conteudo.js` passou a centralizar uma etapa de publicacao SEO:

- Gera apenas listagens indexaveis para as primeiras paginas de home/categorias.
- Marca paginacoes profundas como `noindex, follow`.
- Remove paginacoes profundas do `sitemap.xml`.
- Cria paginas de compatibilidade para URLs antigas, com `noindex, follow`, canonical para a URL correta e meta refresh.
- Cria pagina de compatibilidade para `politica-de-privacidade.html`, apontando para `politica.html`.
- Corrige links internos antigos para politica de privacidade.
- Impede que arquivos invalidos, vazios, noindex ou com titulo placeholder entrem no sitemap.
- Remove a insercao intencional de erros ortograficos nos artigos novos.
- Converte `h1` dentro do corpo do artigo em `h2`, mantendo apenas um `h1` por pagina.
- Ajusta `ProfilePage` da home para incluir `mainEntity`.
- Diferencia titulos SEO longos usando mais contexto e categoria, evitando duplicidade.
- Centraliza a escrita dos arquivos gerados para remover espacos finais de linha e evitar sujeira recorrente apos rebuilds.
- Usa uma taxonomia canonica compartilhada para categorias, evitando categorias vazias, genericas ou com HTML.
- Normaliza categorias vindas dos artigos automaticos antes de gerar listagens, breadcrumbs e sitemap.
- Mantem categorias com menos de 3 artigos como navegaveis, mas com `noindex, follow` e fora do sitemap.

### Ajustes nos scripts

O `scripts/seo-backfill-articles.js` agora:

- Ignora paginas `noindex` e aliases com meta refresh.
- Ignora artigos com titulo placeholder como `Titulo:`.
- Usa a categoria do caminho do arquivo quando o `titulos.json` tem artigos com o mesmo titulo.
- Reconstroi os titulos SEO antigos com mais contexto para evitar duplicidade.

O `scripts/seo-audit.js` agora tambem verifica:

- Links internos quebrados.
- Links legados para `politica-de-privacidade.html`.
- URLs `noindex` dentro do sitemap.
- Limite maximo de tamanho/quantidade de URLs do sitemap.
- Existencia de `robots.txt` apontando para o sitemap.
- Existencia de `rss.xml`, itens do feed e links validos/indexaveis.
- Link `<link rel="alternate" type="application/rss+xml">` em paginas indexaveis.
- Paginas indexaveis que ficaram fora do sitemap.
- Artigos indexaveis sem bloco de artigos relacionados.
- `ProfilePage` sem `mainEntity`.
- Paginacoes profundas que continuam indexaveis.
- Duplicidades apenas em paginas indexaveis, ignorando aliases e noindex.
- Paginas de categoria indexaveis com nome invalido, como `Categoria`, `rdf:type` ou conteudo com HTML.
- Categorias pequenas indexaveis com menos de 3 artigos.
- Instrucoes no gerador que pecam erros ortograficos propositais ou reativem o modulo antigo de erros.

Tambem foi criado o `scripts/normalize-title-categories.js`, que corrige o campo `categoria` em `titulos.json` usando a mesma taxonomia do gerador.

### RSS e descoberta de conteudo

Foi adicionada a geracao automatica de `rss.xml` com os 100 artigos publicaveis mais recentes.

O feed inclui:

- Titulo do artigo.
- Link canonico.
- GUID canonico.
- Data de publicacao.
- Categoria.
- Descricao baseada na meta description do artigo.

As paginas geradas e os backfills de artigos/estaticas tambem passaram a incluir:

```html
<link rel="alternate" type="application/rss+xml" title="Anderson Damasio" href="https://www.andersondamasio.com.br/rss.xml">
```

### Links internos de relevancia

Foi adicionada uma etapa automatica de artigos relacionados em paginas de artigo indexaveis.

O gerador agora:

- Seleciona relacionados por categoria, palavras do titulo e proximidade temporal.
- Usa fallback para artigos recentes quando ha poucos candidatos do mesmo tema.
- Insere ate 4 links contextuais por artigo.
- Mantem os relacionados fora de aliases e paginas `noindex`.
- Faz a auditoria falhar caso um artigo indexavel fique sem relacionados.

Isso reduz paginas isoladas, melhora distribuicao de links internos e ajuda o Google a entender clusters tematicos.

### Cobertura de sitemap

A auditoria tambem passou a falhar quando uma pagina HTML indexavel tem canonical valido, mas nao aparece no `sitemap.xml`.

Com isso:

- `index2.html` e `index3.html` entram no sitemap, pois ainda sao indexaveis.
- `beijaoupassa/politica-de-privacidade.html` entra no sitemap.
- Artigos antigos top-level em `artigos/*.html` podem ser resolvidos por slug mesmo quando entradas antigas do `titulos.json` nao tinham URL.
- Artigos obsoletos, templates e duplicatas fora do conjunto publicavel sao marcados como `noindex, follow`.

### Comando de manutencao

Foi adicionado o comando unico:

```bash
npm run seo:maintain
```

Ele executa:

```bash
npm run seo:normalize-categories
npm run seo:backfill
npm run seo:backfill:static
npm run seo:rebuild
npm run seo:audit:strict
```

Este passa a ser o fluxo recomendado antes de publicar alteracoes de SEO ou novos lotes de artigos.

O workflow `.github/workflows/gerar-html.yml` tambem foi atualizado para executar `npm run seo:maintain` antes de commitar artigos novos. Assim, se alguma regra de SEO quebrar, a automacao falha antes de publicar.

O workflow legado `.github/workflows/inserir-cookies.yml` foi limitado para execucao manual, porque ele fazia commits automaticos apos cada push em HTML e podia deixar a publicacao final diferente do resultado auditado pelo pipeline de SEO. O script manual `inserir-cookie-banner.js` tambem foi atualizado para usar `/politica.html` e remover espacos finais.

### Imagens, dados estruturados e integridade continua

Foi adicionada uma configuracao central de assets SEO em `scripts/seo-assets.js`.

Com isso:

- A imagem padrao de SEO passou a usar uma versao 16:9 otimizada.
- Foram geradas variacoes 16:9, 4:3 e 1:1 para dados estruturados de artigos.
- `BlogPosting` passou a expor as tres proporcoes recomendadas para artigos.
- Open Graph passou a incluir largura, altura e texto alternativo da imagem.
- Twitter Card passou a incluir texto alternativo da imagem.
- A auditoria estrita passou a falhar caso um artigo indexavel nao tenha as variacoes de imagem do `BlogPosting`.
- A auditoria estrita passou a falhar caso a imagem padrao do Open Graph nao tenha dimensoes e texto alternativo.

Tambem foi removido o uso de horario dinamico em metadados de listagens durante o rebuild. Agora a data de atualizacao das listagens vem da data mais recente dos artigos daquela pagina, tornando `npm run seo:maintain` reproduzivel.

Os workflows manuais que podem alterar HTML tambem passaram a rodar `npm run seo:maintain` antes de commitar:

- `.github/workflows/atualizar-analytics.yml`
- `.github/workflows/inserir-amp-ads.yml`
- `.github/workflows/inserir-cookies.yml`

Foi criado o workflow `.github/workflows/seo-integrity.yml`, que executa em push, pull request e manualmente:

```bash
npm ci
npm run seo:maintain
git diff --exit-code -- . ':(exclude)node_modules/**'
```

Assim, alem de auditar, o CI tambem detecta quando o SEO gerado nao foi commitado.

A comparacao e os commits automaticos ignoram `node_modules`, porque a instalacao de dependencias no runner pode alterar arquivos versionados de pacotes sem relacao com o SEO publicado.

Tambem foi adicionada uma regra de `.gitignore` para `node_modules/` e um bloqueio em `robots.txt` para `/node_modules/`, com a pasta removida do controle de versao. Nenhuma pagina HTML referencia `/node_modules`, entao a remocao reduz superficie publicada sem afetar navegacao do site.

### Taxonomia e categorias

Foi criado o arquivo `scripts/seo-categories.js` como fonte unica para categorias permitidas, aliases e regras de inferencia.

Com isso:

- 278 entradas antigas de `titulos.json` tiveram a categoria normalizada.
- Categorias vazias passaram a ser inferidas pelo titulo do artigo.
- Categorias equivalentes foram consolidadas, como `Seguranca Online` e `Seguranca Cibernetica` em `Seguranca`.
- Categorias invalidas como `Categoria`, `rdf:type` e uma categoria com HTML foram removidas da fonte de dados.
- Paginas antigas dessas categorias invalidas viraram paginas de compatibilidade `noindex, follow`, com canonical para `artigos/index.html`.
- Categorias legitimas, mas com baixo volume, como `Educacao`, `Saude`, `Back-end`, `Negocios` e `Produtividade`, continuam acessiveis, mas nao entram no indice nem no sitemap ate terem pelo menos 3 artigos.

Essa regra evita que os artigos gerados automaticamente criem novas categorias soltas ou paginas finas sem relevancia suficiente para busca.

### Qualidade editorial do gerador

O prompt do gerador foi revisado para pedir texto natural, autoral e tecnicamente confiavel, sem erros ortograficos propositais.

Tambem foram removidos os arquivos antigos usados para inserir erros artificiais:

- `dados/selecionar-errorsMaps.js`
- `dados/erros_usados.json`

A auditoria estrita agora falha se o gerador voltar a pedir erros ortograficos ou importar o modulo antigo de erros. Isso protege os proximos artigos automaticos contra um padrao que poderia reduzir confianca, legibilidade e qualidade percebida.

### Qualidade de titulos indexaveis

Foi adicionada uma verificacao para bloquear titulos fracos na fonte `titulos.json` e nos `h1` de artigos indexaveis.

A regra cobre casos como:

- Titulo vazio.
- `Titulo:` ou `Novo Titulo:` como prefixo publicado.
- `Conteudo Editorial:` sem titulo real.
- `Voltar ao topo` como titulo de artigo.
- Padroes gerados de baixa qualidade como `E fascinante como ... evoluiu nos ultimos anos...`.

Tambem foram corrigidos 19 registros antigos em `titulos.json`, incluindo 9 paginas indexaveis que ainda tinham `h1` fraco. As URLs publicadas foram preservadas para nao quebrar links ja conhecidos pelo Google; o ajuste foi feito em titulo, `h1`, metadados e listagens geradas.

A auditoria estrita agora possui duas protecoes novas:

- `weakSourceTitles`, para impedir que a base dos artigos automaticos volte a receber titulos fracos.
- `weakArticleTitles`, para impedir que uma pagina indexavel seja publicada com `h1` fraco.

### Caminhos canonicos de categorias

Foi feita uma varredura do sitemap publicado para encontrar artigos indexaveis dentro de pastas fora da taxonomia canonica.

Foram migrados 37 artigos que estavam em caminhos como:

- `artigos/categoria/...`
- `artigos/rdf-type/...`
- `artigos/seguranca-online/...`
- `artigos/seguranca-cibernetica/...`
- `artigos/tecnologia-domestica/...`
- `artigos/tecnologia-e-desenvolvimento/...`
- `artigos/inteligencia-artificial` com slug acentuado no caminho.

As paginas canonicas foram recriadas nas categorias corretas, como `artigos/seguranca/...`, `artigos/tecnologia/...`, `artigos/observabilidade/...` e `artigos/desenvolvimento-de-software/...`.

As URLs antigas foram preservadas como paginas de compatibilidade ou obsoletas com `noindex, follow` e canonical para o destino correto, evitando quebra de acesso enquanto remove esses caminhos ruins do sitemap.

A auditoria estrita agora tambem falha se:

- Um artigo indexavel estiver em uma pasta de categoria fora do slug canonico.
- Um registro de `titulos.json` apontar para uma URL de artigo com pasta de categoria nao canonica.

### Titulos SEO e diretivas de preview

Foi ajustada a estrategia de `<title>` dos artigos para priorizar o assunto real do conteudo.

Antes, muitos artigos automaticos usavam o padrao `Titulo | Categoria | Anderson Damasio` e podiam chegar a 140 caracteres. Isso fazia o Google receber titulos muito longos, com risco de corte agressivo e perda de relevancia no trecho mais importante.

Agora:

- Artigos usam o proprio titulo do conteudo como `<title>`, limitado a 100 caracteres.
- Categoria e autoria continuam presentes em breadcrumb, JSON-LD, author, canonical, Open Graph e listagens.
- Paginas estaticas e listagens continuam com titulos contextuais do site.
- O auditor estrito falha se uma pagina indexavel passar de 100 caracteres no `<title>`.
- O auditor estrito tambem falha se uma pagina indexavel nao tiver as diretivas de preview amplas para Google.

Tambem foi criado o helper `scripts/seo-robots.js` para centralizar as diretivas de robots.

As paginas indexaveis agora usam:

```html
index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1
```

Isso permite snippets mais completos, imagens maiores nos resultados e melhor aproveitamento de previews quando o Google considerar apropriado.

### Core Web Vitals, terceiros e imagens

Foi adicionada uma camada de otimizacao de carregamento sem alterar a ordem dos scripts de consentimento/anuncios, para reduzir risco de quebra.

Foi criado o helper `scripts/seo-resource-hints.js`, usado pelo gerador e pelos backfills para incluir:

- `preconnect` para dominios criticos de terceiros.
- `dns-prefetch` para os mesmos dominios.
- Auditoria para impedir que paginas com scripts desses terceiros sejam publicadas sem os resource hints correspondentes.

Dominios cobertos:

- `www.googletagmanager.com`

Tambem foi padronizada a otimizacao de imagens em artigos:

- Novas imagens de capa geradas pelo `gerar-conteudo.js` recebem `decoding="async"` e `fetchpriority="high"`.
- Imagens locais de artigos recebem `width` e `height` reais para reduzir risco de deslocamento visual durante o carregamento.
- O `alt` da imagem de capa passa a usar o titulo do artigo quando disponivel.
- O backfill retroativo corrige imagens antigas, incluindo `decoding="async"`, dimensoes reais e prioridade alta na primeira imagem do artigo.
- Imagens adicionais do artigo passam a receber `loading="lazy"`.

Foi criado o helper `scripts/seo-image-dimensions.js` para ler dimensoes de imagens locais sem depender do `sharp` no ambiente Windows. Ele suporta JPEG, PNG e GIF e e usado pelo gerador, pelo backfill e pela auditoria.

A auditoria estrita agora falha se encontrar:

- Imagem sem `alt`.
- Imagem sem `decoding="async"`.
- Imagem local sem `width` e `height`.
- Primeira imagem de artigo sem `fetchpriority="high"`.
- Imagens seguintes de artigo sem `loading="lazy"`.
- Scripts de terceiros conhecidos sem `preconnect`/`dns-prefetch`.

### Entidade do autor e E-E-A-T tecnico

Foi criada a centralizacao de identidade em `scripts/seo-identity.js`.

Esse helper define, em um unico lugar:

- `Person` canonico do Anderson Damasio com `@id`.
- URL do perfil interno em `/sobre.html`.
- `sameAs` apontando para o LinkedIn ja publicado no site.
- `Organization` do site com `@id`, URL e logo.
- `WebSite` com `@id`, idioma e publisher.

Os artigos (`BlogPosting`) agora usam essa entidade canônica no campo `author`, e o publisher tambem passou a ser gerado pelo helper. A home, listagens, paginas estaticas e paginas de compatibilidade tambem passaram a reutilizar o mesmo `WebSite`/`Organization`.

A auditoria estrita agora falha se um `BlogPosting` indexavel nao tiver o autor conectado ao `@id` canonico e ao `sameAs` esperado.

### Relevancia estruturada dos artigos

Foi criado o helper `scripts/seo-article-metadata.js` para enriquecer automaticamente os artigos sem depender de preenchimento manual.

Esse helper gera, a partir do titulo, categoria e corpo do artigo:

- `keywords` limitadas e derivadas do conteudo.
- `wordCount` real do texto do artigo.
- `about` com a categoria canonica.
- `mentions` com entidades/termos relevantes.
- `isAccessibleForFree`.
- `copyrightYear`.

O `BlogPosting` tambem passou a receber `copyrightHolder` com a mesma entidade canonica do autor, e o `head` dos artigos passou a receber `meta name="keywords"` gerado pelo mesmo helper.

A auditoria estrita agora falha se um artigo indexavel perder esses metadados de relevancia no JSON-LD. O gerador tambem foi reforcado para limpar titulos que venham com Markdown (`##`) ou prefixo `Introdução:`, evitando que novos artigos saiam com titulo fraco ou artificial.

### Fontes editoriais dos artigos

Foi criado o helper `scripts/seo-source-citation.js` para centralizar o tratamento das fontes originais usadas pelos artigos gerados automaticamente.

Quando um item em `titulos.json` possui `urlFonte`, o pipeline agora:

- Normaliza a URL da fonte.
- Inclui uma secao visivel `Fonte consultada` no fim do artigo.
- Usa o titulo original (`noticiaOriginal`) como texto do link quando disponivel.
- Adiciona `rel="noopener noreferrer"` nos links externos de fonte.
- Enriquece o `BlogPosting` com `isBasedOn` e `citation`.
- Faz o backfill das fontes nos artigos antigos.

A auditoria estrita passou a falhar quando um artigo indexavel tem `urlFonte` em `titulos.json`, mas nao possui a fonte visivel no HTML, a referencia estruturada no JSON-LD ou quando o link de fonte contem HTML interno indevido.

### Trilha de conteudo util e verificavel

Foi criada uma nova trilha para que os artigos gerados automaticamente fiquem mais validaveis, mais uteis para leitores e menos dependentes de texto generico.

O helper `scripts/seo-helpful-content.js` passou a centralizar essa regra. Ele gera e valida duas secoes visiveis em cada artigo:

- `O que foi verificado`, com fonte principal, data considerada, recorte editorial e limites da analise.
- `Como aplicar essa leitura`, com acoes praticas adaptadas a categoria do artigo.

O gerador `gerar-conteudo.js` tambem teve o prompt reforcado para exigir:

- Resumo executivo curto.
- Separacao entre fato reportado, interpretacao tecnica e limites do que ainda nao pode ser afirmado.
- Aplicacao pratica para arquitetos, desenvolvedores ou lideres tecnicos.
- Riscos e cuidados sem sensacionalismo.
- Proibicao explicita de inventar dados, numeros, datas, nomes ou conclusoes nao sustentadas pela fonte.
- Valor adicional alem da noticia, com impacto, trade-offs, riscos, decisoes praticas e sinais observaveis por um time.

O backfill `scripts/seo-backfill-articles.js` aplica as mesmas secoes nos artigos antigos. Quando ha `urlFonte`, a secao aponta para a fonte original normalizada; quando nao ha fonte externa cadastrada, o artigo declara essa limitacao de forma transparente.

A auditoria estrita agora falha se um artigo indexavel nao possuir as secoes `article-validation` e `article-usefulness`. Assim, os proximos artigos e os artigos antigos precisam manter a camada de verificacao e utilidade antes de serem publicados.

### Saneamento do HTML dos artigos

Durante a validacao das fontes, foram encontrados artigos com HTML tolerado pelo navegador, mas ruim para parsers de SEO:

- Fechamentos invalidos como `<p></div>` e `</div></p>`.
- Exemplos de codigo contendo `<script>` cru dentro de `.article-body`.

O gerador e o backfill agora normalizam esses casos automaticamente:

- Corrigem fechamentos invalidos no corpo do artigo.
- Neutralizam `<script>` e `</script>` dentro de `.article-body`, mantendo o texto visivel como exemplo de codigo e evitando que o restante da pagina seja interpretado como JavaScript.

A auditoria estrita tambem ganhou as verificacoes `malformedArticleHtml` e `articleBodyUnsafeHtml`, para impedir que esse tipo de HTML volte a ser publicado sem ser detectado.

### Recursos externos no Google Search Console

Apos a limpeza de monetizacao, o HTML publicado deve manter apenas recursos Google conhecidos:

- Google tag/Analytics (`G-T15623VZYE`).

O `ads.txt` tambem fica restrito ao publisher autorizado do Google AdSense, evitando linhas de parceiros antigos ou redes intermediarias.

### Workflow automatico dos proximos artigos

O workflow horario `.github/workflows/gerar-html.yml`, responsavel por gerar e commitar novos artigos, foi ajustado para reduzir risco de travamento e garantir que os proximos conteudos passem pelo mesmo pipeline de SEO.

Mudancas aplicadas:

- Troca do `git clone` manual com `GH_PAT` por `actions/checkout@v4`.
- Uso de `GITHUB_TOKEN` com `permissions: contents: write` para permitir commit/push pelo workflow.
- Atualizacao para `actions/setup-node@v4` com Node.js 20 e cache npm nativo.
- Inclusao de `concurrency` para cancelar execucoes horarias antigas ainda em andamento.
- Inclusao de `timeout-minutes: 45` para evitar execucoes presas indefinidamente.
- Manutencao do passo `npm run seo:maintain` antes do commit.

Isso evita que uma falha de segredo ou autenticacao no clone interrompa a geracao automatica, e mantem a regra de que todo artigo novo precisa passar por rebuild e auditoria SEO antes de ser publicado.

### Curadoria de fontes recentes com X

O gerador passou a usar o X como radar de descoberta de noticias recentes, sem transformar o post social na fonte final do artigo.

Mudancas aplicadas:

- Criacao de buscas recentes no X para contas tecnicas e temas como arquitetura de software, IA, seguranca, cloud, DevOps, bancos de dados, observabilidade e ferramentas de desenvolvimento.
- Uso de `TWITTER_BEARER_TOKEN` para consultar a API recente do X quando o segredo estiver configurado.
- Fallback automatico entre `api.x.com` e `api.twitter.com`.
- Extracao da URL original compartilhada no post, ignorando links sociais ou intermediarios como `x.com`, `twitter.com`, `t.co`, `linkedin.com`, `youtube.com` e similares.
- Deduplicacao por URL normalizada, removendo parametros de campanha.
- Score de selecao combinando recencia, relevancia tecnica, confiabilidade do dominio, autor/verificacao/engajamento no X e penalidade para conteudo promocional ou comparativos de compra.
- Manutencao dos feeds RSS tecnicos como segunda camada de fonte, com a mesma avaliacao de score.

Com isso, os proximos artigos tendem a nascer de assuntos mais recentes, mas ainda apontando para uma fonte editorial verificavel. Se o token do X nao estiver disponivel ou a API falhar, o gerador continua funcionando pelos RSS ja existentes.

### Resultado da validacao final

Em 25/06/2026, o comando abaixo foi executado com sucesso:

```bash
npm run seo:maintain
```

Tambem foram executados com sucesso apos os ajustes de fonte, saneamento do HTML e trilha de conteudo util:

```bash
npm run seo:rebuild
npm run seo:audit:strict
```

Resultado:

- 17.527 arquivos HTML auditados.
- 8.057 artigos considerados publicaveis/indexaveis.
- 8.115 URLs no sitemap.
- 100 artigos recentes no `rss.xml`.
- 0 categorias invalidas restantes em `titulos.json`.
- Nenhum `title`, `description`, `canonical`, `h1`, Open Graph, Twitter Card ou JSON-LD ausente.
- Nenhum `<title>` indexavel acima de 100 caracteres.
- Nenhuma pagina indexavel sem `max-snippet:-1`, `max-image-preview:large` e `max-video-preview:-1`.
- Nenhuma pagina com script terceiro conhecido sem resource hints.
- Nenhuma imagem sem `alt`.
- Nenhuma imagem sem `decoding="async"`.
- Nenhuma imagem local sem `width` e `height`.
- Nenhuma primeira imagem de artigo sem `fetchpriority="high"`.
- Nenhuma imagem adicional de artigo sem `loading="lazy"`.
- Nenhum `BlogPosting` sem identidade canônica do autor (`@id` + `sameAs`).
- Nenhum `BlogPosting` sem `keywords`, `wordCount`, `about`, `mentions`, `isAccessibleForFree`, `copyrightYear` e `copyrightHolder`.
- Nenhum artigo indexavel com `urlFonte` sem fonte visivel ou sem `isBasedOn`/`citation` no JSON-LD.
- Nenhum artigo indexavel sem a secao `O que foi verificado`.
- Nenhum artigo indexavel sem a secao `Como aplicar essa leitura`.
- Nenhum artigo indexavel com HTML malformado no fechamento do corpo.
- Nenhum artigo indexavel com `<script>` cru dentro de `.article-body`.
- Nenhum artigo indexavel com titulo iniciando por `##` ou `Introdução:`.
- Nenhum link interno quebrado.
- Nenhuma URL `noindex` no sitemap.
- Nenhum problema em `robots.txt`.
- Nenhum problema no `rss.xml`.
- Nenhuma pagina indexavel fora do sitemap.
- Nenhum artigo indexavel sem artigos relacionados.
- Nenhuma duplicidade de `title`, `description` ou `canonical` em paginas indexaveis.
- Nenhuma paginacao profunda indexavel.
- Nenhuma categoria invalida indexavel.
- Nenhuma categoria fina indexavel.
- Nenhum titulo fraco em `titulos.json`.
- Nenhum `h1` fraco em artigo indexavel.
- Nenhum artigo indexavel em caminho de categoria nao canonico.
- Nenhuma URL fonte em `titulos.json` com pasta de categoria nao canonica.
- Nenhuma instrucao ativa no gerador pedindo erros ortograficos propositais.
- Nenhum erro restante de `ProfilePage` sem `mainEntity`.
- `git diff --check` sem problemas de whitespace apos o rebuild completo.

### Observacao importante

Como o site e estatico, as URLs antigas foram tratadas com paginas de compatibilidade `noindex` em vez de redirects 301 reais. Se a hospedagem permitir regras de redirect, o proximo passo tecnico ideal e trocar esses aliases por redirects 301 no servidor/CDN.
