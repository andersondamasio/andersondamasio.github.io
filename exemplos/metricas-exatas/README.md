# Correspondencia exata e acerto por posicao

Exemplo didatico offline em Node.js, sem dependencias, modelos ou chaves de API.

[Artigo com contexto, resultados e limites](https://www.andersondamasio.com.br/artigos/desvendando-os-misterios-por-tras-das-propriedades-emergentes-dos-llms.html).

```sh
node exemplos/metricas-exatas/executar.js
node --test exemplos/metricas-exatas/test.js
```

`dados.json` contem quatro alvos e tres conjuntos artificiais de respostas.
Os cenarios A/B/C nao representam modelos, tamanhos, treinos ou amostras reais.
`?` indica uma posicao errada. O contrato e ASCII em maiusculas: caracteres nao
sao tokens de um LLM nem uma avaliacao semantica. Nao ha normalizacao de texto.

Resultados: A tem 8/16 posicoes corretas e 0/4 respostas exatas; B tem 12/16 e
0/4; C tem 16/16 e 4/4. Sao as mesmas respostas de cada cenario avaliadas por
duas regras. A media por posicao usa o total de caracteres (micro media).

Os testes verificam as contas, associacao por id, imutabilidade, denominadores
de comprimentos distintos e rejeicao de dados invalidos/incompletos. Nao
comprovam nem refutam capacidades emergentes em modelos de linguagem.

Inspiracao conceitual, sem copiar dados ou reproduzir experimentos:
- Wei et al., https://arxiv.org/abs/2206.07682
- Schaeffer et al., https://arxiv.org/abs/2304.15004

O artigo distingue a pesquisa dos autores deste exemplo sintetico criado e
executado por Codex. Nenhuma experiencia pessoal de Anderson e alegada.
