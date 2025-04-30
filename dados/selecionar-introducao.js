const fs = require('fs');
const path = require('path');

function escolherIntroducao(tematica) {
  const todas = JSON.parse(fs.readFileSync(path.join(__dirname, 'introducoes.json'), 'utf-8'));

  const usadasPath = path.join(__dirname, 'usadas.json');
  const usadasRaw = fs.existsSync(usadasPath)
    ? JSON.parse(fs.readFileSync(usadasPath, 'utf-8'))
    : {};

  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  const usadasRecentes = Object.values(usadasRaw)
    .filter(x => {
      const data = x.data ? new Date(x.data) : new Date();
      return data >= trintaDiasAtras;
    })
    .map(x => x.intro);

  const disponiveis = todas.filter(intro => !usadasRecentes.includes(intro));
  const base = disponiveis.length > 0 ? disponiveis : todas;

  const sorteada = base[Math.floor(Math.random() * base.length)];
  return sorteada.replace(/__TEMATICA__/g, tematica);
}

module.exports = { escolherIntroducao };
