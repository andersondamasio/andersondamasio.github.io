const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const { criarIcone, tamanhos } = require('./seo-icons');

test('icone usa quatro PNGs validos da mesma marca, e estavel e fica abaixo de 32 KiB', async () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../_assets/brand-ad.png'));
  const icone = await criarIcone(fonte);
  assert.deepEqual(await criarIcone(fonte), icone);
  assert.deepEqual(fs.readFileSync(path.join(__dirname, '../favicon.ico')), icone);
  assert.ok(icone.length < 32768);
  assert.equal(icone.readUInt16LE(0), 0); assert.equal(icone.readUInt16LE(2), 1);
  assert.equal(icone.readUInt16LE(4), tamanhos.length);
  let proximo = 6 + 16 * tamanhos.length;
  for (let i = 0; i < tamanhos.length; i++) {
    const entrada = 6 + 16 * i, tamanho = tamanhos[i];
    const offset = icone.readUInt32LE(entrada + 12), bytes = icone.readUInt32LE(entrada + 8);
    assert.equal(offset, proximo); proximo += bytes;
    const png = icone.subarray(offset, offset + bytes);
    const meta = await sharp(png).metadata();
    assert.equal(meta.format, 'png'); assert.equal(meta.width, tamanho); assert.equal(meta.height, tamanho);
    assert.equal(meta.hasAlpha, true); assert.equal(icone[entrada], tamanho);
    const esperado = await sharp(fonte).resize(tamanho, tamanho).ensureAlpha().raw().toBuffer();
    assert.deepEqual(await sharp(png).raw().toBuffer(), esperado);
  }
  assert.equal(proximo, icone.length);
  const naoQuadrada = await sharp({ create: { width: 96, height: 48, channels: 3, background: 'white' } }).png().toBuffer();
  await assert.rejects(criarIcone(naoQuadrada), /quadrada/);
});
