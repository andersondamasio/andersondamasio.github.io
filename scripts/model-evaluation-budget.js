const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

// Precos Standard consultados em 2026-10-09 nas paginas oficiais de cada modelo.
// Reservar sem desconto de cache e com margem para cache-write/regiao.
const precos = Object.freeze({
  "gpt-5.6-terra": { entrada: 2, saida: 12 },
  "gpt-5.6-sol": { entrada: 4, saida: 20 }
});
const limiteUsd = 2;
const arredondarAcima = valor => Math.ceil(valor * 1e6) / 1e6;

function custoConservador(modelo, entrada, saida) {
  const preco = precos[modelo];
  if (!preco || !Number.isFinite(entrada) || entrada < 0 || !Number.isFinite(saida) || saida < 0) throw new Error("Modelo ou uso sem preco validado.");
  return arredondarAcima((entrada * preco.entrada * 1.25 + saida * preco.saida) * 1.1 / 1e6);
}

function estimarReserva(payload) {
  const permitidos = new Set(["model", "messages", "max_completion_tokens", "reasoning_effort", "service_tier", "n", "response_format", "store"]);
  if (Object.keys(payload).some(key => !permitidos.has(key))) throw new Error("Parametro fora do escopo de custo textual validado.");
  if (!Array.isArray(payload.messages) || !payload.messages.length || payload.messages.some(m => typeof m.content !== "string")) throw new Error("Avaliacao limitada a mensagens de texto.");
  if (payload.tools?.length || payload.functions?.length || (payload.service_tier && payload.service_tier !== "default") || (payload.n && payload.n !== 1)) throw new Error("Ferramentas, multiplas respostas e tiers extras nao estao no orcamento.");
  if (!Number.isInteger(payload.max_completion_tokens) || payload.max_completion_tokens < 1 || payload.max_completion_tokens > 12000) throw new Error("Defina max_completion_tokens entre 1 e 12000, incluindo raciocinio.");
  const entradaMaxima = Buffer.byteLength(JSON.stringify(payload), "utf8") + 512;
  if (entradaMaxima > 100000) throw new Error("Entrada fora do escopo de contexto curto da avaliacao.");
  return custoConservador(payload.model, entradaMaxima, payload.max_completion_tokens);
}

function atualizarLedger(diretorio, atualizar) {
  fs.mkdirSync(diretorio, { recursive: true });
  const arquivo = path.join(diretorio, "orcamento.json");
  const lock = path.join(diretorio, "orcamento.lock");
  const fd = fs.openSync(lock, "wx");
  const temporario = path.join(diretorio, `orcamento-${randomUUID()}.tmp`);
  try {
    const ledger = fs.existsSync(arquivo) ? JSON.parse(fs.readFileSync(arquivo, "utf8")) : { limiteUsd, precosConferidosEm: "2026-10-09", fontePrecos: "https://developers.openai.com/api/docs/pricing", chamadas: [] };
    if (ledger.limiteUsd !== limiteUsd || !Array.isArray(ledger.chamadas) || ledger.chamadas.some(x => !Number.isFinite(x.comprometidoUsd) || x.comprometidoUsd < 0)) throw new Error("Ledger invalido; nao executar chamadas ate conferir o consumo.");
    const retorno = atualizar(ledger);
    fs.writeFileSync(temporario, `${JSON.stringify(ledger, null, 2)}\n`, { flag: "wx" });
    fs.renameSync(temporario, arquivo);
    return retorno;
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lock);
    if (fs.existsSync(temporario)) fs.unlinkSync(temporario);
  }
}

async function executarComOrcamento({ payload, enviar, diretorio = path.join(process.cwd(), ".editorial", "avaliacao-modelos") }) {
  const reservaUsd = estimarReserva(payload);
  const id = randomUUID();
  atualizarLedger(diretorio, ledger => {
    const comprometido = ledger.chamadas.reduce((soma, x) => soma + x.comprometidoUsd, 0);
    if (comprometido + reservaUsd > limiteUsd) throw new Error(`Orcamento insuficiente: US$ ${comprometido.toFixed(6)} comprometidos e US$ ${reservaUsd.toFixed(6)} necessarios; teto US$ 2.`);
    ledger.chamadas.push({ id, modelo: payload.model, reasoningEffort: payload.reasoning_effort || null, criadaEm: new Date().toISOString(), reservaUsd, comprometidoUsd: reservaUsd, estado: "reservada" });
  });
  try {
    const resposta = await enviar({ ...payload, service_tier: "default" });
    const uso = resposta.usage || resposta.data?.usage;
    const usoValido = Number.isInteger(uso?.prompt_tokens) && uso.prompt_tokens >= 0 && Number.isInteger(uso?.completion_tokens) && uso.completion_tokens >= 0;
    atualizarLedger(diretorio, ledger => {
      const chamada = ledger.chamadas.find(x => x.id === id);
      chamada.estado = usoValido ? "concluida" : "consumo-nao-informado";
      if (usoValido) {
        chamada.uso = uso;
        chamada.comprometidoUsd = custoConservador(payload.model, uso.prompt_tokens, uso.completion_tokens);
      }
      chamada.concluidaEm = new Date().toISOString();
    });
    return resposta;
  } catch (error) {
    atualizarLedger(diretorio, ledger => {
      const chamada = ledger.chamadas.find(x => x.id === id);
      chamada.estado = "resultado-incerto-reserva-mantida";
      chamada.comprometidoUsd = Math.max(chamada.comprometidoUsd, reservaUsd);
    });
    throw error;
  }
}

module.exports = { custoConservador, estimarReserva, executarComOrcamento };
