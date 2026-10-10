# JSON local para variaveis CSS

Exemplo didatico do guia [Design tokens: converter um JSON local em variaveis CSS](https://www.andersondamasio.com.br/artigos/design-tokens-a-arquitetura-secreta-por-tras-de-interfaces-de-usuario-incriveis.html). O artigo pertence ao site de [Anderson Damasio](https://www.andersondamasio.com.br/). O exemplo nao representa experiencia profissional do autor.

## Executar

Requer Node.js 20 ou mais recente. Nao utiliza pacotes externos. A partir da raiz do repositorio:

```powershell
node exemplos/design-tokens/converter.js exemplos/design-tokens/tokens.json
node --test exemplos/design-tokens/test.js
```

O primeiro comando imprime o CSS na saida padrao, sem gravar arquivos. A entrada e validada integralmente antes da impressao. Erros resultam em mensagem na saida de erro e codigo de encerramento 1.

## Contrato

- A entrada e um objeto JSON nao vazio, com os grupos opcionais `colors` e `spacing`. Pelo menos um grupo deve existir; cada grupo presente precisa conter tokens.
- O nome do token comeca por letra minuscula. Pode conter letras minusculas e digitos, com hifens entre segmentos nao vazios.
- Cores aceitam `#` seguido de seis digitos hexadecimais. Espacamentos aceitam numeros nao negativos em `px` ou `rem`, com ponto decimal opcional.
- Grupos e nomes sao ordenados para produzir a mesma saida independentemente da ordem das chaves. Valores nao sao convertidos entre unidades.
- O formato e local: nao implementa DTCG, aliases, temas, integracao com Figma ou avaliacao de contraste.

## Exercicio reproduzivel

Em uma copia de `tokens.json`, altere `spacing.medium` de `16px` para `1.5rem` e execute o conversor com o caminho dessa copia. A declaracao `--spacing-medium` deve mudar e as demais devem permanecer iguais. Uma cor `#fff` deve ser recusada, porque o contrato exige seis digitos. Os testes automatizados cobrem esses tipos de caso.

## Evidencia e limites

Os quatro testes deste diretorio passaram localmente e no [CI da revisao 150b1841cb66](https://github.com/andersondamasio/andersondamasio.github.io/actions/runs/38022154302). Sao testes do contrato de transformacao, nao uma validacao visual de uma interface. O comando `npm run test:examples`, na raiz, tambem compara o codigo e a saida CSS do artigo com os arquivos executaveis.

Uma alteracao no exemplo exige conferir novamente o trecho publicado e os registros editoriais correspondentes. Os testes nao devem ser alterados apenas para aceitar um artigo divergente. Este README fica no repositorio; o Pages publica o guia e os arquivos de exemplo, nao uma copia HTML deste documento.
