# Fila de inteiros com fechamento em C++17

Exemplo didatico do guia [Fila em C++: sincronizacao e encerramento com condition_variable](https://www.andersondamasio.com.br/artigos/desenvolvendo-sistemas-de-baixa-latencia-com-c-desafios-e-oportunidades.html), no site de [Anderson Damasio](https://www.andersondamasio.com.br/). Nao e relato de uso em producao nem demonstracao de baixa latencia.

## Executar

Em Linux com GCC e suporte a C++17, a partir deste diretorio:

```bash
g++ -std=c++17 -Wall -Wextra -Werror -pedantic -pthread main.cpp -o /tmp/fila-exemplo
/tmp/fila-exemplo
g++ -std=c++17 -Wall -Wextra -Werror -pedantic -pthread test.cpp -o /tmp/fila-testes
timeout 10s /tmp/fila-testes
```

O programa imprime `1`, `2` e `3`, uma linha por valor. Os testes imprimem uma linha iniciada por `OK` e terminam com codigo zero. Falha de assercao, erro de compilacao ou timeout nao contam como aprovacao. Os caminhos em `/tmp` evitam gravar executaveis na pasta publicada do site; use nomes livres no seu ambiente.

## Contrato

- `enviar` insere um inteiro enquanto a fila esta aberta e retorna `false` apos o fechamento.
- `receber` aguarda se a fila esta vazia e aberta. O predicado e conferido sob o mutex.
- `fechar` impede novos envios e notifica todos os consumidores. Pode ser chamado novamente.
- Itens ja enfileirados sao drenados antes de `receber` retornar `std::nullopt`.
- A fila deve continuar existindo ate que todas as threads que a utilizam terminem. O programa aguarda o consumidor com `join`.
- A ordem FIFO se refere a retirada dos itens. Com consumidores distintos, ela nao garante ordem de conclusao do trabalho externo.

## Evidencia e limites

O job `cpp-example` no [CI da revisao 150b1841cb66](https://github.com/andersondamasio/andersondamasio.github.io/actions/runs/38022154302) compilou o programa e os testes com warnings como erros, conferiu a saida e executou 20 rodadas. Cada rodada verifica ordem, drenagem, fechamento e entrega de 10.000 inteiros com dois consumidores, sem perda ou duplicacao no cenario executado.

Nao foi executado benchmark, teste de tempo real ou prova de todas as intercalacoes possiveis. A fila nao limita memoria, nao cancela operacoes e nao garante justica entre consumidores. Para comparar latencia, seria necessario definir carga, percentis, ambiente e alternativas antes de medir.

Na raiz do repositorio, `npm run test:examples` compara os blocos C++ publicados com `fila.hpp` e `main.cpp`; esse comando Node nao compila C++. O README fica no repositorio, enquanto o guia e os arquivos de codigo permanecem acessiveis no site.
