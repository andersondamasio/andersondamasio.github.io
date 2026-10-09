# Reservoir Sampling em C# com testes executaveis

Exemplo didatico que acompanha o artigo [Reservoir Sampling em C#](https://www.andersondamasio.com.br/artigos/explorando-os-segredos-do-reservoir-sampling.html). A implementacao recebe `IEnumerable<T>` e nao exige materializar toda a entrada em um array. E uma demonstracao isolada, nao um relato de uso em producao.

## Executar

Com o SDK .NET 10.0.401 ou patch compativel instalado, execute a partir deste diretorio:

```powershell
dotnet run --configuration Release
```

Nao ha pacotes NuGet externos. O console emite JSON com os testes aprovados; uma verificacao que falha encerra com erro. `Reservoir.cs` contem a implementacao e `Program.cs`, o verificador executavel. `global.json` impede escolher um SDK preview por acidente.

## Contrato

- Tamanho negativo e entrada nula lancam excecao.
- Tamanho zero devolve uma lista vazia sem enumerar a entrada.
- Entrada menor que a amostra devolve todos os elementos encontrados.
- A entrada e percorrida uma vez; valores iguais em posicoes diferentes continuam sendo elementos distintos.
- A funcao devolve a amostra ao terminar a enumeracao. Nao produz um resultado final para uma entrada infinita.

`Sample` implementa o Algorithm R descrito na secao 2 do [artigo de Vitter](https://www.cs.umd.edu/~samir/498/vitter.pdf). A cada novo item depois de encher a amostra, sorteia uma posicao entre todos os itens vistos. O limite superior de [`Random.NextInt64`](https://learn.microsoft.com/en-us/dotnet/api/system.random.nextint64?view=net-10.0) e exclusivo.

## Evidencia e limites

Em 09/10/2026, a execucao assistida pelo Codex em Windows, SDK 10.0.401 e runtime 10.0.12, passou em 13 verificacoes. Uma reproduz `IndexOutOfRangeException` no algoritmo antigo quando `k` excede o comprimento do array. As demais cobrem contrato, substituicao deterministica, limite do sorteio, enumeracao unica e preservacao de posicoes repetidas.

O teste pequeno exaustivo considera os 12 caminhos de sorteio para quatro entradas distintas e amostra de duas: cada um dos seis subconjuntos aparece duas vezes. Esse resultado valida o caso enumerado, nao substitui a demonstracao geral nem certifica a qualidade estatistica do gerador pseudoaleatorio. Nao foi feito benchmark de memoria ou velocidade.

A implementacao precisa terminar de ler a entrada para retornar. Ela nao estratifica grupos nem garante que uma amostra particular represente cada categoria. `Random` nao deve ser usado como fonte criptografica. A semente fixa e usada somente nos testes; repetibilidade nao e prometida entre versoes diferentes do runtime.
