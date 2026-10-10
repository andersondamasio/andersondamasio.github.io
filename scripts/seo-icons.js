const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const tamanhos = [16, 32, 48, 96];

async function criarIcone(fonte) {
  const metadata = await sharp(fonte).metadata();
  if (metadata.width !== metadata.height || metadata.width < 96) throw new Error('Fonte do icone deve ser quadrada e ter pelo menos 96px.');
  const imagens = [];
  for (const tamanho of tamanhos) imagens.push(await sharp(fonte).resize(tamanho, tamanho).ensureAlpha().png({ compressionLevel: 9 }).toBuffer());
  // ICO directory entries point to complete PNG payloads, with no pixel changes after encoding.
  const cabecalho = Buffer.alloc(6 + 16 * imagens.length);
  cabecalho.writeUInt16LE(1, 2); cabecalho.writeUInt16LE(imagens.length, 4);
  let offset = cabecalho.length;
  imagens.forEach((png, i) => {
    const entrada = 6 + 16 * i;
    cabecalho[entrada] = tamanhos[i]; cabecalho[entrada + 1] = tamanhos[i];
    cabecalho.writeUInt16LE(1, entrada + 4); cabecalho.writeUInt16LE(32, entrada + 6);
    cabecalho.writeUInt32LE(png.length, entrada + 8); cabecalho.writeUInt32LE(offset, entrada + 12);
    offset += png.length;
  });
  return Buffer.concat([cabecalho, ...imagens]);
}

async function gerarIcone(root = process.cwd()) {
  const fonte = fs.readFileSync(path.join(root, '_assets/brand-ad.png'));
  const icone = await criarIcone(fonte);
  if (icone.length > 32768) throw new Error('Icone acima do limite local de 32 KiB; conferir fonte e geracao.');
  const arquivo = path.join(root, 'favicon.ico');
  const mudou = !fs.existsSync(arquivo) || !fs.readFileSync(arquivo).equals(icone);
  if (mudou) fs.writeFileSync(arquivo, icone);
  return { atualizado: mudou, bytesFonte: fonte.length, bytesIcone: icone.length, tamanhos };
}

if (require.main === module) gerarIcone().then(r => console.log(JSON.stringify(r))).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { criarIcone, gerarIcone, tamanhos };
