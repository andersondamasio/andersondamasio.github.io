# Melhorias de SEO Realizadas

Data: 06/05/2026

Ultima atualizacao: 22/06/2026

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
- `ProfilePage` sem `mainEntity`.
- Paginacoes profundas que continuam indexaveis.
- Duplicidades apenas em paginas indexaveis, ignorando aliases e noindex.

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

### Comando de manutencao

Foi adicionado o comando unico:

```bash
npm run seo:maintain
```

Ele executa:

```bash
npm run seo:backfill
npm run seo:backfill:static
npm run seo:rebuild
npm run seo:audit:strict
```

Este passa a ser o fluxo recomendado antes de publicar alteracoes de SEO ou novos lotes de artigos.

O workflow `.github/workflows/gerar-html.yml` tambem foi atualizado para executar `npm run seo:maintain` antes de commitar artigos novos. Assim, se alguma regra de SEO quebrar, a automacao falha antes de publicar.

### Resultado da validacao final

Em 22/06/2026, o comando abaixo foi executado com sucesso:

```bash
npm run seo:maintain
```

Resultado:

- 17.421 arquivos HTML auditados.
- 7.794 artigos considerados publicaveis/indexaveis.
- 7.856 URLs no sitemap.
- 100 artigos recentes no `rss.xml`.
- Nenhum `title`, `description`, `canonical`, `h1`, Open Graph, Twitter Card ou JSON-LD ausente.
- Nenhum link interno quebrado.
- Nenhuma URL `noindex` no sitemap.
- Nenhum problema em `robots.txt`.
- Nenhum problema no `rss.xml`.
- Nenhuma duplicidade de `title`, `description` ou `canonical` em paginas indexaveis.
- Nenhuma paginacao profunda indexavel.
- Nenhum erro restante de `ProfilePage` sem `mainEntity`.

### Observacao importante

Como o site e estatico, as URLs antigas foram tratadas com paginas de compatibilidade `noindex` em vez de redirects 301 reais. Se a hospedagem permitir regras de redirect, o proximo passo tecnico ideal e trocar esses aliases por redirects 301 no servidor/CDN.
