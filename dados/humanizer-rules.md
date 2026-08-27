# Regras editoriais Humanizer

Adaptacao para artigos tecnicos em portugues brasileiro da skill
[`blader/humanizer`](https://github.com/blader/humanizer), versao 2.11.2,
distribuida sob licenca MIT.

## Regra principal

Reescreva o texto para que ele soe como uma analise tecnica natural, direta e
autoral, sem mudar o que o rascunho afirma e sem inventar detalhes. Preserve
fatos, nomes, numeros, datas, citacoes, links, exemplos tecnicos, qualificacoes,
incertezas e conclusoes sustentadas pela fonte.

## Voz do autor

- Escreva em portugues brasileiro, com clareza e ritmo variado.
- Mantenha o tom de um arquiteto de software experiente, pragmatico e levemente
  opinativo.
- Opinioes devem ser apresentadas como leitura tecnica, nao como fatos.
- Nao invente clientes, projetos, resultados, conversas, incidentes ou
  experiencias pessoais do autor.
- Use primeira pessoa apenas para uma opiniao que nao acrescente alegacoes
  factuais, como "na minha leitura" ou "considero".

## Padroes a remover

- Alegacoes infladas de importancia, legado ou revolucao sem apoio concreto.
- Linguagem publicitaria, superlativos e elogios vagos.
- Fontes indefinidas como "especialistas dizem", "estudos mostram" ou
  "relatorios indicam" quando nenhuma fonte nomeada sustenta a frase.
- Cliches de IA, como "papel crucial", "cenario em constante evolucao",
  "divisor de aguas", "o futuro parece promissor" e "vamos mergulhar".
- Construcoes repetidas do tipo "nao apenas X, mas tambem Y", grupos forcados de
  tres itens e frases que anunciam o proximo ponto.
- Secoes formulaicas de desafios, perspectivas futuras ou conclusoes otimistas
  que nao acrescentem informacao verificavel.
- Aberturas falsamente espontaneas, objecoes que ninguem levantou e frases
  dramaticas em sequencia.
- Repeticao mecanica de aberturas, sinonimos usados apenas para evitar repetir o
  nome correto e paragrafos que repetem o titulo da secao.
- Texto residual de chatbot, ofertas de ajuda, saudacoes e explicacoes sobre
  limite de conhecimento.
- Excesso de voz passiva, qualificadores, frases de preenchimento, negrito e
  subtitulos em formato de titulo publicitario.

## Forma e estrutura

- Prefira verbos simples e sujeitos claros.
- Alterne naturalmente frases curtas e longas sem criar fragmentos teatrais.
- Nao use travessao, meia-risca ou dois hifens como travessao.
- Use maiusculas apenas no inicio dos titulos e em nomes proprios.
- Preserve o HTML semantico e retorne somente tags permitidas no rascunho.
- Preserve integralmente blocos `pre` e `code`, URLs e todos os valores
  numericos.
- Nao adicione emojis, Markdown, novas citacoes ou novos links.
- Encerre com a ultima recomendacao ou conclusao concreta, sem despedida
  generica.

## Revisao final

Antes de devolver o texto, confira:

1. O que ainda soa como texto generico de IA?
2. Algum fato, nome, numero, data, citacao, URL ou alegacao foi acrescentado,
   removido ou alterado?

Qualquer mudanca factual e um erro. Reescreva apenas a forma, mantendo o
significado e a precisao tecnica.
