const fs = require("fs");
const path = require("path");

function arquivoLocalImagem(src, { root = process.cwd(), fileRel = "" } = {}) {
  let value = String(src || "").trim();
  if (!value || /^(data|mailto|tel|javascript):/i.test(value)) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (!/^(www\.)?andersondamasio\.com\.br$/i.test(url.hostname)) return null;
      value = url.pathname;
    } catch {
      return null;
    }
  }

  value = value.split("#")[0].split("?")[0];
  if (!value) return null;

  let local;
  if (value.startsWith("/")) {
    local = value.replace(/^\/+/, "");
  } else {
    const base = fileRel ? path.posix.dirname(fileRel.replace(/\\/g, "/")) : "";
    local = path.posix.normalize(path.posix.join(base === "." ? "" : base, value));
  }

  const absolute = path.resolve(root, local);
  const resolvedRoot = path.resolve(root);
  if (absolute !== resolvedRoot && !absolute.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }

  return fs.existsSync(absolute) ? absolute : null;
}

function dimensoesJpeg(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    offset += 2;

    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > buffer.length) break;

    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame && offset + 7 < buffer.length) {
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3)
      };
    }

    offset += length;
  }

  return null;
}

function dimensoesPng(buffer) {
  const isPng =
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;

  if (!isPng) return null;

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function dimensoesGif(buffer) {
  const signature = buffer.slice(0, 6).toString("ascii");
  if (signature !== "GIF87a" && signature !== "GIF89a") return null;

  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8)
  };
}

function lerDimensoesImagemArquivo(file) {
  if (!file || !fs.existsSync(file)) return null;

  const buffer = fs.readFileSync(file);
  return dimensoesPng(buffer) || dimensoesJpeg(buffer) || dimensoesGif(buffer);
}

function lerDimensoesImagemLocal(src, options = {}) {
  const file = arquivoLocalImagem(src, options);
  return file ? lerDimensoesImagemArquivo(file) : null;
}

module.exports = {
  arquivoLocalImagem,
  lerDimensoesImagemArquivo,
  lerDimensoesImagemLocal
};
