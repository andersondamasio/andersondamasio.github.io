# Snapshots versionados

Exemplo sintetico offline em Node.js, sem dependencias adicionais. A partir da raiz:

```sh
node exemplos/estado-versionado/executar.js
node --test exemplos/estado-versionado/test.js
```

Contrato: objeto JSON com somente `id`, `versao` e `estado`. A versao e um inteiro
seguro nao negativo, monotono por entidade, atribuido por uma unica autoridade.
Nao e um timestamp. O conteudo representa o estado completo desses tres campos.

Versao maior substitui; menor e ignorada; igual e identica e duplicata; igual e
divergente retorna conflito sem sobrescrever. Esse conflito precisa de tratamento
externo. O exemplo nao guarda historico: nao detecta divergencia de uma versao
antiga que ja foi superada. A ordem do primeiro conflito recebido pode afetar o
estado final; a convergencia testada pressupoe ausencia de conflitos.

Nao aplicar a deltas, incrementos ou eventos de efeitos colaterais. Nao testa
Kafka, Redis, latencia, persistencia, concorrencia real, reinicio, efeitos externos
ou entrega exatamente uma vez. Uma aplicacao concorrente precisaria garantir
atomicidade da comparacao e da escrita no armazenamento escolhido.
