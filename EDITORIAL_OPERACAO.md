# Geracao, revisao e publicacao de artigos

O gerador entrega rascunhos. Um artigo so entra no site depois de uma revisao humana registrada para a versao exata do texto. A rotina semanal gera uma pauta na segunda-feira, as 09h de Sao Paulo; publicar e uma operacao separada, limitada a um novo artigo a cada sete dias, inclusive nas execucoes manuais.

Os artigos sao noticias, guias e analises baseados em fontes. Nao sao relatos de vivencia pessoal de Anderson Damasio. A IA e o Humanizer nao podem inventar projetos, testes, clientes, resultados nem revisao humana. O modelo permanece configuravel; trocar o modelo nao substitui a conferencia das afirmacoes.

## Gerar um rascunho

```powershell
npm run article:draft
```

Esse comando usa as credenciais configuradas no ambiente e pode consumir creditos da API. O teto da avaliacao comparativa de modelos e um controle separado, nao um limite de faturamento deste comando ou da conta.

O resultado fica em `.editorial/rascunhos/`, ignorado pelo Git. O comando padrao `npm start` tambem gera apenas rascunho; o antigo parametro `somenteRascunho: false` nao autoriza publicacao. Se a fonte for rejeitada ou nao houver pauta elegivel, a rotina pode encerrar sem rascunho.

No GitHub, `gerar-e-commitar` conserva o nome historico, mas agora tem somente leitura do repositorio. Guarda os JSON como artefatos por 14 dias. Artefatos seguem a visibilidade e as permissoes do repositorio: nao devem conter segredos, dados privados ou copias integrais de fontes. A rotina nao faz commit de artigos automaticamente.

## Conferir texto e evidencias

Preencha o `dossie` no JSON gerado. O Codex pode pesquisar, comparar fontes, propor correcoes e preparar esse dossie; a declaracao de revisao humana pertence ao revisor.

| Campo | O que conferir |
| --- | --- |
| `pauta` | Publico, pergunta concreta e genero editorial. A resposta precisa estar no artigo. |
| `fontes` | URL, titulo, classificacao primaria/secundaria, data de consulta e nota curta da evidencia. Ao menos uma fonte primaria precisa ser conferida. |
| `afirmacoes` | Trecho presente no artigo, tipo (`fato`, `inferencia` ou `exemplo-hipotetico`) e verificacao. Para fatos, indique a fonte e onde localizar o suporte. Cubra todas as afirmacoes materiais, nao apenas a mais facil. |
| `contribuicao` | O que a leitura acrescenta a fonte e o trecho que entrega esse valor ao leitor. |
| `limites` | Trecho do artigo que explicita o que nao foi demonstrado ou nao pode ser generalizado. |
| `duplicidade` | Compare as pautas sugeridas pelo sistema. Registre a justificativa individual quando houver sobreposicao. Se for atualizacao do mesmo assunto, nao publique outra URL por este fluxo. |
| `midias` | Origem e permissao/licenca de cada imagem. No HTML, use alt e dimensoes. Ter uma imagem na fonte nao concede direito de republica-la. |

As notas de fonte sao curtas, com limite de 500 caracteres por resumo de evidencia. Prefira localizacao e explicacao propria; nao copie documentos inteiros. Links do X podem ajudar a descobrir uma pauta, mas nao substituem a documentacao que sustenta os fatos.

```powershell
npm run article:review -- conferir ".editorial/rascunhos/ARQUIVO.json"
```

Esse teste confere preenchimento, correspondencia dos trechos, URLs, HTML e sobreposicao heuristica. Nao consulta nem comprova a veracidade das fontes. Detectores de linguagem pessoal, contagem de palavras, notas de estilo e similaridade lexical tambem nao sao verificacao factual nem prova de utilidade.

Nao ha exigencia de esticar o artigo para um numero fixo de palavras ou secoes. A documentacao do [Google sobre conteudo util](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) orienta a avaliar originalidade, clareza de autoria, confiabilidade e valor para o leitor, sem uma contagem preferida de palavras. A [orientacao sobre IA generativa](https://developers.google.com/search/docs/fundamentals/using-gen-ai-content) nao transforma conteudo automatizado em problema por definicao; qualidade e finalidade continuam relevantes. Nenhum desses ajustes garante indexacao ou posicao.

## Aprovar a versao revisada

Para ler o artigo em uma pagina local, sem publica-lo nem consumir API:

```powershell
npm run article:preview -- ".editorial/rascunhos/ARQUIVO.json"
```

A previa fica em `.editorial/previas/`, com o hash da versao e as evidencias. Nao inclui analytics nem carrega recursos externos. Nao substitui a conferencia na fonte. Depois de qualquer reescrita, inclusive pelo Humanizer, reconcilie os trechos do dossie com o corpo final; nao copie uma aprovacao anterior.

Depois de conferir o artigo integralmente, o revisor deve executar em um terminal interativo:

```powershell
npm run article:review -- aprovar ".editorial/rascunhos/ARQUIVO.json"
```

O comando solicita nome, checklist e declaracao expressa. CI e geracao nao executam essa aprovacao. O pacote aprovado fica em `dados/editorial/aprovados/HASH.json`, sem publicar o artigo. Nome, dossie e pacote sao destinados ao repositorio publico: revise o diff e nao inclua informacoes privadas.

O hash vincula a aprovacao ao texto, titulo, resumo, fontes, pauta, evidencias e demais dados do rascunho. Alterar o conteudo depois exige outra revisao. O registro e uma declaracao operacional do revisor, nao assinatura digital ou prova criptografica de identidade; as permissoes do GitHub continuam sendo o controle de acesso ao repositorio.

## Publicar e verificar

Commitado o pacote aprovado em `main`, inclua seu caminho em `pacotes` no arquivo `dados/editorial/fila.json`. A fila respeita essa ordem e nunca busca rascunhos privados. O workflow **Publicar artigo revisado** consulta a fila nas segundas-feiras, as 09h20 de Sao Paulo (12h20 UTC). O GitHub pode atrasar o horario agendado. Fila vazia, inteiramente publicada ou intervalo semanal ainda nao cumprido encerram sem publicacao; nao ha aprovacao automatica nem promessa de um artigo semanal sem revisao humana.

Para antecipar a consulta, execute o mesmo workflow manualmente, deixando `pacote` vazio para usar a fila ou informando o caminho de um pacote aprovado. Ele confere a aprovacao novamente contra o acervo atual, impede colisao de URL e repeticao de pacote, respeita o intervalo de sete dias, reconstrui o site e executa a auditoria antes de commitar e solicitar o build do Pages. Pacote alterado, invalido ou sem arquivo interrompe a execucao para correcao, em vez de ser pulado silenciosamente. Nenhuma chamada de IA ocorre nessa etapa.

`npm run article:queue` permite testar a selecao local sem escrever no artigo, aprovar, consumir API ou publicar. O JSON inicial da fila esta vazio. Aprovacoes anteriores continuam exigindo uma versao identica e podem precisar de nova revisao de sobreposicao se o acervo mudou.

Alternativamente, prepare os arquivos locais com `npm run article:review -- publicar "dados/editorial/aprovados/HASH.json"`, execute `npm run seo:maintain` e confira o diff antes do commit e push. O retorno local nao confirma deploy online. O workflow de verificacao publica deve comparar as paginas servidas com a revisao esperada depois do Pages.

O verificador e disparado no push em `main`, espera o build Pages com o mesmo SHA e compara o HTML publico. O publicador executa a mesma conferencia diretamente depois de solicitar o Pages: commits feitos com `GITHUB_TOKEN` nao devem depender de disparar outro workflow por push. Timeout, build falho ou conteudo antigo sao falhas, nao publicacao confirmada.

Se a preparacao local falhar, o journal restaura os arquivos modificados e remove os arquivos criados nessa tentativa. Se o processo for interrompido abruptamente, novas publicacoes ficam bloqueadas. Confirme que o processo anterior terminou antes de executar `npm run article:review -- recuperar --processo-anterior-encerrado`, depois confira o diff. Essa recuperacao nao desfaz commits nem deployments.

## Verificacao sem consumo de API

```powershell
npm run test:editorial
npm run test:humanizer
npm run test:seo:recovery
npm run test:model:budget
npm run test:seo:templates
```

Esses testes usam fontes e modelos simulados. A publicacao de teste ocorre em diretorio temporario e nao cria artigo real. `npm run test:rebuild:site` faz dois rebuilds locais completos, compara as saidas e confere preservacao dos corpos existentes; seu relatorio fica em `.editorial/validacao-rebuild.json`.

## Perfil, templates e metadados

`scripts/seo-profile.js` e a fonte do texto da home e da pagina Sobre. A home e reconstruida pelo gerador; Sobre e atualizada por `seo:backfill:static`. Nao editar apenas os HTML resultantes. O perfil usa os dados confirmados e o LinkedIn oficial; projetos, resultados e outros perfis so devem ser incluidos depois de confirmados.

Nos artigos novos, `titulos.json` guarda `seo.description`, `seo.modifiedAt` e o registro editorial. Uma atualizacao substancial deve preservar `data` e `url`, registrar a nova descricao quando necessario e alterar `seo.modifiedAt` para a data real da revisao. O backfill conserva esses campos; sitemap e dados estruturados usam as mesmas datas. Executar um rebuild nao deve tornar o artigo artificialmente recente.

O bloco de responsabilidade editorial nao equivale a verificacao factual automatica. Artigos antigos sem registro individual aparecem com esse limite explicito. Nos novos artigos, a revisao visivel exige registro de aprovacao e correspondencia do corpo publicado. Alteracoes do texto invalidam essa correspondencia; ajustes de carregamento de imagens nao mudam o conteudo aprovado. A imagem generica da marca pode aparecer no compartilhamento social, mas nao e declarada como imagem especifica de cada artigo.

Antes de uma migracao ampla de templates, `node scripts/verify-editorial-migration.js --capture` registra uma linha de base local e recusa sobrescreve-la. Depois, o mesmo comando sem `--capture` compara corpos editoriais, H1, URL canonica, robots e datas. Nao substituir essa linha de base para ocultar diferencas: investigar e documentar alteracoes intencionais separadamente.

`node scripts/qa-seo-templates.js` valida as paginas principais em tres larguras, com servidor temporario e navegador isolado. Defina `CHROME_PATH` para um Chrome local quando o Chromium do Puppeteer nao estiver disponivel. Os relatorios e capturas ficam em `.editorial/`, fora do repositorio publico. Esse QA nao acessa a sessao pessoal do navegador e nao demonstra indexacao nem Core Web Vitals de usuarios reais.

## Arquivo e descoberta

O rebuild cria `arquivo/index.html` e uma pagina por mes, agrupando publicacoes no fuso de Sao Paulo. Todos os artigos do mes recebem links HTML diretos; o seletor de dias e apenas um atalho dentro da pagina e nao esconde os artigos. As URLs anteriores e a navegacao sequencial continuam disponiveis.

A politica local distingue as paginas de entrada (perfil, categorias elegiveis e arquivo cronologico) das continuacoes de listas. As continuacoes mantem canonical proprio e `noindex, follow`, ficando fora do sitemap; os artigos nao recebem noindex por causa da paginacao. Nao se trata de uma exigencia do Google: e a escolha do site para separar suas portas de entrada das listagens alternativas. A regra anterior de indexar somente as tres primeiras paginas foi removida. O criterio legado de pelo menos tres artigos para uma categoria permanece; ele nao e requisito de qualidade do Google e nao deve ser atendido gerando conteudo artificial.

`npm run seo:navigation` mede caminhos no HTML local e falha se artigos indexaveis ficarem sem pagina, orfaos, dependentes apenas de paginas noindex ou a mais de cinco links da home. O relatorio nao e uma medicao do Googlebot. Para registrar uma comparacao inicial, use `node scripts/seo-navigation.js --baseline`; a linha de base nao e sobrescrita. `npm run test:seo:navigation` cobre datas, URLs, caminhos, sitemap, paginas obsoletas e dois rebuilds em fixtures.

O verificador de deploy inclui os novos arquivos quando a revisao esperada os anuncia na home. Uma home atualizada com paginas mensais ausentes ou antigas nao passa como publicacao concluida.

## Avaliacao de modelos com orcamento fechado

`npm run model:evaluation:plan` apenas mostra a matriz, sem acessar a API. Sao cinco pautas versionadas e tres variantes com o mesmo prompt: Terra medium, Terra high e Sol medium. A avaliacao estrutural e os sinais Humanizer nao verificam fatos nem escolhem um vencedor. Ler os textos contra as fontes e registrar fidelidade, utilidade especifica, limites e naturalidade separadamente.

O workflow manual `avaliar-modelos.yml` usa o segredo OpenAI existente e uma unica autorizacao acumulada de US$ 2. Antes de qualquer chamada paga, cria atomicamente a tag `editorial-eval-usd2-2026-10`; outra execucao ou reexecucao e bloqueada, inclusive se a primeira falhar. Nao apagar essa tag para tentar novamente. Em caso de falha, conferir o ledger e o uso real antes de solicitar uma nova autorizacao. O ledger reserva o custo maximo antes do envio e conserva a reserva em timeout ou consumo desconhecido. Nao ha retry automatico.

Resultados, uso, prompts e rascunho ficam em artefatos por 30 dias, sem modificar o catalogo nem publicar. O candidato RabbitMQ/Terra medium recebe uma segunda passagem Humanizer, quando a geracao estiver completa. O dossie preenchido por IA continua exigindo conferencia de fatos, trechos e duplicidade; nunca recebe aprovacao humana automatica. A falta de um candidato completo e um resultado da avaliacao, nao motivo para uma chamada paga extra silenciosa.

A disponibilidade dos dois modelos e conferida por consultas de leitura antes da reserva remota. Falta de acesso interrompe o teste sem enviar uma geracao. A confirmacao de acesso nao garante que uma chamada posterior tera sucesso; o ledger continua protegendo o teto em caso de falha.

## Medicao depois do deploy

`npm run seo:measurement` captura home, Sobre e tres artigos recentes, comparando o HTML publico com a revisao Git em `EXPECTED_REVISION` (padrao HEAD). `node scripts/seo-measurement.js --capture caminho/urls.json` recebe uma lista de ate 60 URLs do site para um piloto. Cada captura tem arquivo proprio em `.editorial/medicoes/` e nao sobrescreve a anterior.

HTTP, canonical, robots e correspondencia com o Git sao observados separadamente dos dados do Google. Ultimo rastreamento, indexacao, impressoes, cliques, CTR, posicao e consultas ficam `null` ate haver observacao real do Search Console, com fonte e periodo. Captura HTTP nao mede penalizacao nem visibilidade. Uma versao publica antiga impede confirmar o deploy. Depois da confirmacao, o relatorio propoe comparacoes em duas, quatro e oito semanas; isso nao cria um lembrete automatico nem garante que o Google ja tenha rastreado a revisao.

O rebuild preserva o corpo existente de artigos noindex, em vez de os transformar em avisos de indisponibilidade. Eles ficam fora das superficies de promocao geradas e do sitemap/RSS; links contextuais deliberados no corpo nao sao removidos automaticamente. A decisao de noindex ainda exige curadoria individual e nao decorre apenas de um sinal de linguagem.

## Decisoes por URL

`dados/indexacao.json` registra decisoes por URL com motivo, evidencia, responsavel e data. `manter`, `atualizar` e `noindex` exigem URL resolvida e hash do corpo revisado. `consolidar` e `retirar` usam tambem hashes do arquivo inteiro e dos registros do catalogo. As URLs do perfil sao protegidas; adicionar URLs com valor comprovado a `protegidas` antes de preparar um lote. Ausencia de dado do Search Console nao significa ausencia de valor.

1. Conferir o conteudo e registrar a decisao. O hash vem de `hashCorpoEditorial` aplicado ao HTML interno de `.article-body`; nao e uma nota automatica de qualidade.
2. Executar `npm run seo:indexation:plan`. O dry-run mostra exatamente as URLs e mudancas, sem escrever.
3. Aplicar com `node scripts/indexation-policy.js --apply HASH_CONFERIDO`. HTML alterado desde o dry-run invalida o hash. A aplicacao e o rebuild sao transacionais; falhas restauram os arquivos.
4. Executar auditoria, testes e comparacao de dois rebuilds antes do commit/deploy. `seo:maintain`, backfill e rebuild recusam divergencia entre manifesto e HTML.

`atualizar` registra uma decisao editorial, nao reescreve o corpo sozinho. A remocao de uma decisao do manifesto tambem nao recoloca uma pagina no indice: reindexacao exige decisao explicita e conteudo conferido. Nessas tres acoes, canonical e URL sao preservados.

Para `retirar`, conferir o arquivo atual e todos os registros que apontam para a URL, inclusive duplicados historicos. `arquivoHash` usa `hashArquivo` e `registrosHash` usa `hashRegistros` de `scripts/article-lifecycle.js`; HTML com corpo tambem exige `conteudoHash`. O dry-run lista arquivos a excluir, registros a arquivar e snapshots recuperaveis. A aplicacao preserva os HTML e registros originais em `dados/editorial/arquivados/`, remove-os do catalogo ativo e exclui os arquivos HTML. O rebuild nao pode recria-los. GitHub Pages deve responder 404, confirmado pelo verificador remoto, e nao um aviso 200 ou redirecionamento generico.

`consolidar` exige ainda `destino` e `destinoConteudoHash`: um unico artigo ativo, com corpo conferido, canonical proprio, sem noindex nem redirecionamento. A equivalencia de intencao precisa de revisao editorial documentada; hashes nao provam equivalencia. Categorias, ciclos e destinos retirados sao recusados. A hospedagem estatica usa meta refresh imediato e canonical para o destino; isso nao e um HTTP 301. A URL de origem sai do catalogo, sitemap, feed e listagens; o artigo equivalente permanece. Nao aplicar essa acao apenas por semelhanca de titulos.

Aliases afetados devem ser relacionados explicitamente como `{url, arquivoHash}`. O fluxo verifica que sao redirecionamentos sem corpo, com canonical para a origem. Links editoriais para uma URL retirada precisam de correcao revisada antes do lote: o processo nao apaga trechos dos artigos automaticamente. Depois do rebuild, uma referencia restante a uma retirada aborta a transacao e restaura arquivos, catalogo e snapshots. Testes cobrem os cinco tipos de decisao, copias recuperaveis, aliases, destinos invalidos, reversao e dois rebuilds. Conferir auditoria completa antes de publicar.

Os nove registros historicos resolvidos em outubro de 2026 estao em `dados/editorial/arquivados/historicos-2026-10.json`, com as revisoes Git consultadas. Sete URLs continham apenas avisos; oito registros apontavam a elas, incluindo um par duplicado, e um registro nao tinha URL. Os textos antigos existentes em duas URLs genericas nao foram republicados nem confundidos com conteudo revisado. A retirada nao se baseou em idade ou falta de trafego.

O primeiro piloto esta registrado em `dados/editorial/curadoria-piloto-2026-10.json`: leitura assistida de 20 corpos, oito correcoes de texto e cinco decisoes reversiveis de noindex. O registro distingue correcao pontual, reescrita, fontes consultadas e pendencias; nao declara revisao humana nem certificacao factual do acervo inteiro. As datas originais e URLs foram preservadas. O noindex foi escolhido por promessa comercial nao atendida e baixa contribuicao concreta dos textos, nao apenas por idade, trafego ou numero de palavras.

A auditoria ignora `.editorial/`, que contem previas e fragmentos privados nao publicados. Isso nao dispensa a auditoria dos HTML publicos. Para ampliar o QA visual, acrescente caminhos `artigos/...html` ao comando `node scripts/qa-seo-templates.js`.

## Conferencia factual de artigos do acervo

O lote `dados/editorial/consolidacao-generalistas-2026-10.json` documenta a leitura e consolidacao de seis textos sobre o mesmo conceito. A URL mais antiga permanece como guia, com atribuicao a fonte, exercicio explicitamente hipotetico e data visivel da atualizacao. As cinco outras URLs e seus cinco aliases apontam diretamente para esse guia. Os originais completos e seus registros estao arquivados; nenhuma aprovacao humana foi criada. A escolha nao supoe que a URL mais antiga tenha melhor ranking, nem decorre apenas de fonte ou titulo semelhantes.

`npm run test:seo:indexation` confere os hashes desse lote, as copias recuperaveis, os dez redirecionamentos, as datas e a ausencia de links publicos para as origens consolidadas. Uma futura alteracao do corpo do guia exige nova conferencia editorial e atualizacao explicita de `destinoConteudoHash` nas cinco decisoes dependentes; nao remover o bloqueio para aceitar qualquer destino. Preservar o relatorio historico e registrar a nova revisao e seus testes quando atualizar essas expectativas.

Os lotes posteriores ao piloto ficam em `dados/editorial/correcoes-fontes-primarias-2026-10.json` (cinco artigos) e `dados/editorial/correcoes-piloto-agentes-2026-10.json` (sete artigos). Cada registro guarda o corpo anterior por hash, motivo, nova versao, fontes e seletores dos trechos conferidos. O historico anterior nao e sobrescrito. Scores de geracao e Humanizer referentes ao corpo antigo ficam no historico, nao como avaliacao da versao reescrita.

A conferencia assistida das fontes nao representa revisao humana, reproducao dos experimentos citados ou execucao dos roteiros propostos. Os textos distinguem esses limites. A suite de templates verifica correspondencia entre registro, corpo, fonte, descricao, datas e manifesto; esse teste estrutural nao comprova a veracidade das fontes.

Quando a fonte fornece apenas uma data civil, guardar `AAAA-MM-DD`, sem inventar horario. O bloco editorial preserva esse dia; timestamps completos continuam sendo apresentados no fuso de Sao Paulo. Mudar a fonte principal requer preservar sua referencia anterior no relatorio de correcao, e nao aproveitar a data da noticia secundaria como se fosse a data do documento primario.

`scripts/seo-code-styles.js` compartilha a regra de quebra de identificadores entre o template de novos artigos e o backfill. No acervo, a regra e inserida apenas em paginas com codigo inline; blocos `pre` conservam sua propria rolagem e o texto copiavel nao e modificado. Conferir telas de 320 px com identificadores longos e uma pagina com bloco de codigo ao alterar essa regra.

O mesmo modulo compartilha o espacamento superior dos blocos copiaveis. O backfill corrige a regra legada `pre` com padding de 1rem apenas quando ha bloco de codigo no corpo e estilo do botao Copiar; o template novo ja reserva 3rem acima do texto. A mudanca fica no CSS, preservando codigo e corpo editorial. O QA deve comparar tambem a base do botao com o inicio do codigo, pois ausencia de overflow nao detecta sobreposicao.

## Exemplos tecnicos reproduziveis

`exemplos/reservoir-sampling/` acompanha a correcao do guia existente, mantendo sua URL. O projeto .NET 10 inclui implementacao, contrato e 13 verificacoes executaveis, sem pacotes externos. O CI compila e executa os testes; a suite de templates compara o codigo do HTML com o arquivo C#, evitando que um trecho divergente seja publicado. Rodar a partir do diretorio do exemplo para respeitar `global.json`.

O resultado representa testes automatizados em ambiente isolado, nao vivencia profissional do autor, revisao humana ou benchmark de desempenho. A atualizacao posterior ao piloto esta em `dados/editorial/correcao-reservoir-2026-10.json`; o primeiro registro de curadoria permanece como historico, sem sobrescrever os hashes do que foi revisado naquela etapa.

## Documentacao fora do site

O build legado do Pages convertia documentos Markdown do repositorio em paginas HTML que nao passavam pela auditoria do gerador. `_config.yml` exclui esses documentos da publicacao, preservando os arquivos no Git e os HTML do site. Os arquivos C#, projeto e selecao do SDK continuam acessiveis pelo guia; README, relatorios de manutencao e regras internas nao sao paginas para o leitor do site.

O verificador pos-deploy confere oito enderecos de documentos, em Markdown e HTML, exigindo HTTP 404 ou 410. Uma pagina 200, redirecionamento, falha de acesso ou erro de servidor nao conta como exclusao confirmada. Essa verificacao complementa a auditoria dos HTML locais.

A pasta `dados/editorial/arquivados/` tambem e excluida do site, para nao republicar snapshots de conteudo retirado. Esses arquivos continuam no repositorio publico: nao devem conter segredos. O verificador confere retiradas e snapshots definidos no manifesto alem dos oito documentos. Consolidacoes sao conferidas por correspondencia de bytes da origem e destino com a revisao Git esperada.
