async function esperarPages({ repositorio, revisao, token, fetchImpl = fetch, tentativas = 24,
  intervaloMs = 15000, esperar = ms => new Promise(resolve => setTimeout(resolve, ms)) }) {
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repositorio || "") || !/^[a-f0-9]{40}$/.test(revisao || "")) {
    throw new Error("Repositorio e revisao completa obrigatorios para conferir o Pages.");
  }
  if (!Number.isInteger(tentativas) || tentativas < 1 || tentativas > 24) throw new Error("Tentativas invalidas.");
  let ultimo = null;
  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const resposta = await fetchImpl(`https://api.github.com/repos/${repositorio}/pages/builds/latest`, {
      signal: AbortSignal.timeout(15000), redirect: "error",
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10",
        ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
    if (resposta.status !== 200 && resposta.status !== 404) throw new Error(`Consulta Pages falhou: HTTP ${resposta.status}`);
    ultimo = resposta.status === 200 ? await resposta.json() : null;
    if (ultimo?.commit === revisao) {
      if (ultimo.status === "built") return { revisao, status: "built", tentativa };
      if (!["queued", "building"].includes(ultimo.status)) throw new Error(`Build da revisao esperada nao concluiu: ${ultimo.status}`);
    }
    if (tentativa < tentativas) await esperar(intervaloMs);
  }
  throw new Error(`Pages nao confirmou ${revisao} dentro do limite; ultimo commit: ${ultimo?.commit || "indisponivel"}.`);
}

if (require.main === module) esperarPages({ repositorio: process.env.GITHUB_REPOSITORY,
  revisao: process.env.EXPECTED_REVISION, token: process.env.GH_TOKEN }).then(resultado => {
  console.log(JSON.stringify(resultado));
}).catch(error => { console.error(error.message); process.exitCode = 1; });

module.exports = { esperarPages };
