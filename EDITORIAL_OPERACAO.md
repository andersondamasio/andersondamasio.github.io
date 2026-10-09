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

Depois de conferir o artigo integralmente, o revisor deve executar em um terminal interativo:

```powershell
npm run article:review -- aprovar ".editorial/rascunhos/ARQUIVO.json"
```

O comando solicita nome, checklist e declaracao expressa. CI e geracao nao executam essa aprovacao. O pacote aprovado fica em `dados/editorial/aprovados/HASH.json`, sem publicar o artigo. Nome, dossie e pacote sao destinados ao repositorio publico: revise o diff e nao inclua informacoes privadas.

O hash vincula a aprovacao ao texto, titulo, resumo, fontes, pauta, evidencias e demais dados do rascunho. Alterar o conteudo depois exige outra revisao. O registro e uma declaracao operacional do revisor, nao assinatura digital ou prova criptografica de identidade; as permissoes do GitHub continuam sendo o controle de acesso ao repositorio.

## Publicar e verificar

Commitado o pacote aprovado em `main`, execute o workflow **Publicar artigo revisado** e informe seu caminho completo no repositorio. Ele confere a aprovacao novamente, impede colisao de URL e repeticao de pacote, respeita o intervalo semanal, reconstrui o site e executa a auditoria antes de commitar e solicitar o build do Pages. Nenhuma chamada de IA ocorre nessa etapa.

Alternativamente, prepare os arquivos locais com `npm run article:review -- publicar "dados/editorial/aprovados/HASH.json"`, execute `npm run seo:maintain` e confira o diff antes do commit e push. O retorno local nao confirma deploy online. O workflow de verificacao publica deve comparar as paginas servidas com a revisao esperada depois do Pages.

Se a preparacao local falhar, o journal restaura os arquivos modificados e remove os arquivos criados nessa tentativa. Se o processo for interrompido abruptamente, novas publicacoes ficam bloqueadas. Confirme que o processo anterior terminou antes de executar `npm run article:review -- recuperar --processo-anterior-encerrado`, depois confira o diff. Essa recuperacao nao desfaz commits nem deployments.

## Verificacao sem consumo de API

```powershell
npm run test:editorial
npm run test:humanizer
npm run test:seo:recovery
npm run test:model:budget
```

Esses testes usam fontes e modelos simulados. A publicacao de teste ocorre em diretorio temporario e nao cria artigo real. `npm run test:rebuild:site` faz dois rebuilds locais completos, compara as saidas e confere preservacao dos corpos existentes; seu relatorio fica em `.editorial/validacao-rebuild.json`.
