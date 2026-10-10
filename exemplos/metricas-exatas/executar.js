const { medir } = require('./medir');
const dados = require('./dados.json');

const resultados = dados.cenarios.map(cenario => ({
  cenario: cenario.nome, ...medir(dados.alvos, cenario.respostas)
}));
console.log(JSON.stringify({ origem: dados.origem, resultados }, null, 2));
