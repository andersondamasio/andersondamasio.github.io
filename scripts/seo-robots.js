const previewDiretivasGoogle = [
  "max-snippet:-1",
  "max-image-preview:large",
  "max-video-preview:-1"
];

function dividirDiretivasRobots(value) {
  return String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function robotsPermiteIndexacao(value) {
  return !/\bnoindex\b/i.test(String(value || ""));
}

function normalizarRobotsMeta(value = "index, follow") {
  const diretivas = dividirDiretivasRobots(value || "index, follow");
  const vistas = new Set(diretivas.map(item => item.toLowerCase()));

  if (!vistas.has("index") && !vistas.has("noindex")) {
    diretivas.unshift("index");
    vistas.add("index");
  }

  if (!vistas.has("follow") && !vistas.has("nofollow")) {
    diretivas.push("follow");
    vistas.add("follow");
  }

  if (robotsPermiteIndexacao(diretivas.join(", "))) {
    previewDiretivasGoogle.forEach(diretiva => {
      if (!vistas.has(diretiva)) {
        diretivas.push(diretiva);
        vistas.add(diretiva);
      }
    });
  }

  return diretivas.join(", ");
}

function robotsTemPreviewAmplo(value) {
  const diretivas = new Set(dividirDiretivasRobots(value).map(item => item.toLowerCase()));
  return previewDiretivasGoogle.every(diretiva => diretivas.has(diretiva));
}

module.exports = {
  normalizarRobotsMeta,
  robotsPermiteIndexacao,
  robotsTemPreviewAmplo
};
