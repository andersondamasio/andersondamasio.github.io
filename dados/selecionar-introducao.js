const fs = require('fs');
const path = require('path');

function escolherIntroducao(tematica) {
  const todas = JSON.parse(fs.readFileSync(path.join(__dirname, 'introducoes.json'), 'utf-8'));
  const usadasPath = path.join(__dirname, 'usadas.json');
  const usadas = fs.existsSync(usadasPath)
    ? Object.values(JSON.parse(fs.readFileSync(usadasPath, 'utf-8')))
        .map(x => x.intro)
    : [];

  const disponiveis = todas.filter(intro => !usadas.includes(intro));
  const base = disponiveis.length > 0 ? disponiveis : todas;
  const sorteada = base[Math.floor(Math.random() * base.length)];
  return sorteada.replace(/__TEMATICA__/g, tematica);
}

module.exports = { escolherIntroducao };
