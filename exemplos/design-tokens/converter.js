const fs = require('node:fs');

function converter(tokens) {
  const objeto = valor => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
  if (!objeto(tokens) || Object.keys(tokens).length === 0) throw new Error('Objeto de tokens vazio ou invalido.');
  const regras = { colors: /^#[0-9a-fA-F]{6}$/, spacing: /^(?:0|[1-9]\d*)(?:\.\d+)?(?:px|rem)$/ };
  const linhas = [];
  for (const grupo of Object.keys(tokens).sort()) {
    if (!Object.hasOwn(regras, grupo) || !objeto(tokens[grupo]) || !Object.keys(tokens[grupo]).length) {
      throw new Error(`Grupo invalido: ${grupo}`);
    }
    for (const nome of Object.keys(tokens[grupo]).sort()) {
      const valor = tokens[grupo][nome];
      if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(nome) ||
          typeof valor !== 'string' || !regras[grupo].test(valor)) {
        throw new Error(`Token invalido: ${grupo}.${nome}`);
      }
      linhas.push(`  --${grupo}-${nome}: ${valor};`);
    }
  }
  return `:root {\n${linhas.join('\n')}\n}\n`;
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Uso: node converter.js tokens.json');
    process.stdout.write(converter(JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''))));
  } catch (erro) {
    console.error(erro.message);
    process.exitCode = 1;
  }
}

module.exports = { converter };
