# Liveness e readiness em ASP.NET Core

Exemplo didatico com o middleware nativo do ASP.NET Core 10, sem pacotes NuGet externos. A dependencia e simulada; nao acessa um banco, pagamento, loja ou servico externo. Nao e uma configuracao pronta para producao.

## Executar

Neste diretorio, com SDK .NET 10.0.401 ou patch compativel:

```powershell
dotnet run --configuration Release --verbosity minimal
```

O verificador abre um servidor somente em `127.0.0.1`, em porta escolhida pelo sistema, e o encerra em `finally`. Nao deixa servidor permanente. Uma assercao que falha termina o processo com erro.

`HealthExample.cs` e o codigo exibido no artigo; `Program.cs` executa 11 requisicoes HTTP e verifica status, corpo, ausencia de cache e isolamento da dependencia. Os cinco estados sao inicial indisponivel, saudavel, degradado, falha e recuperacao. A rota inexistente retorna 404.

## O que observar

- `/health/live` nao executa a dependencia: responde 200/Healthy mesmo durante a falha simulada.
- `/health/ready` executa a dependencia: Unhealthy resulta em 503; Healthy e Degraded resultam em 200 na configuracao padrao.
- `Degraded` demonstra por que apenas testar `IsSuccessStatusCode` perde informacao.
- Nenhuma requisicao cria pedido ou valida pagamento. A aprovacao desses testes nao demonstra que um fluxo de negocio funciona.

A [documentacao oficial](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks?view=aspnetcore-10.0) explica filtros, codigos padrao e separacao entre readiness e liveness. Para um servico real, os checks, timeouts, custo, acesso aos endpoints e resposta operacional precisam ser definidos conforme suas dependencias. Nao exponha detalhes sensiveis no corpo da resposta.

Em 10/10/2026, a execucao assistida pelo Codex em Windows, SDK 10.0.401 e runtime 10.0.12, passou nas 11 verificacoes HTTP, com cinco execucoes do check. O registro e os hashes dos quatro arquivos estao em `dados/editorial/curadoria-fluxos-2026-10.json`, na raiz do repositorio. Isso nao e uma revisao humana nem um teste da infraestrutura citada no artigo.
