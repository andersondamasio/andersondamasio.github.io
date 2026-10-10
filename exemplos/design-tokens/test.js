const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { converter } = require('./converter');
const tokens = require('./tokens.json');

test('gera CSS deterministico sem alterar a entrada', () => {
  const antes = JSON.stringify(tokens);
  assert.equal(converter(tokens), ':root {\n  --colors-primary: #007bff;\n  --colors-secondary: #6c757d;\n  --spacing-medium: 16px;\n  --spacing-small: 8px;\n}\n');
  assert.equal(JSON.stringify(tokens), antes);
  assert.equal(converter({ spacing: tokens.spacing, colors: tokens.colors }), converter(tokens));
});

test('alterar um token altera sua declaracao e mantem as demais', () => {
  const alterado = structuredClone(tokens);
  alterado.spacing.medium = '1.5rem';
  assert.equal(converter(alterado), converter(tokens).replace('16px', '1.5rem'));
  assert.match(converter({ spacing: { zero: '0px' } }), /--spacing-zero: 0px;/);
});

test('rejeita formato fora do contrato, referencias e CSS injetado', () => {
  for (const entrada of [null, [], {}, { colors: {} }, { colors: [] }, { size: { x: '8px' } },
    { colors: { x: { $value: '#ffffff' } } }, { colors: { x: 'var(--other)' } },
    { colors: { x: '#fff' } }, { colors: { x: '#ffffff; } body { display:none' } },
    { colors: { 'x;': '#ffffff' } }, { spacing: { x: '-8px' } },
    { spacing: { x: 8 } }, { spacing: { x: '8em' } }, { spacing: { x: '8px\n' } },
    JSON.parse('{"__proto__":{"x":"8px"}}')]) assert.throws(() => converter(entrada));
});

test('CLI imprime CSS, nao grava arquivos, e falha sem entrada', () => {
  const executar = args => spawnSync(process.execPath, [path.join(__dirname, 'converter.js'), ...args], { encoding: 'utf8' });
  const ok = executar([path.join(__dirname, 'tokens.json')]);
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout, converter(tokens));
  assert.equal(ok.stderr, '');
  const faltando = executar([]);
  assert.equal(faltando.status, 1);
  assert.equal(faltando.stdout, '');
  assert.match(faltando.stderr, /Uso:/);
});
