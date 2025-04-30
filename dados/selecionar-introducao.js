const fs = require('fs');

function escolherIntroducao(tematica) {
  const todas = JSON.parse(fs.readFileSync('introducoes.json', 'utf-8'));
  const usadas = Object.values(JSON.parse(fs.readFileSync('usadas.json', 'utf-8')))
    .map(x => x.intro);

  const disponiveis = todas.filter(intro => !usadas.includes(intro));

  if (disponiveis.length === 0) return todas[0].replace(/__TEMATICA__/g, tematica);

  const sorteada = disponiveis[Math.floor(Math.random() * disponiveis.length)];
  return sorteada.replace(/__TEMATICA__/g, tematica);
}

module.exports = { escolherIntroducao };
