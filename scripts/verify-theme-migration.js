const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const cheerio = require('cheerio');
const { removerRecursosTema, aplicarTemaSite } = require('./site-theme');

const pasta = path.join(process.cwd(), '.editorial', 'qa-theme');
const baseline = path.join(pasta, 'baseline.json');
const hash = texto => createHash('sha256').update(texto).digest('hex');

function snapshot(dir = '.', saida = {}) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith('.') || item.name === 'node_modules') continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) snapshot(file, saida);
    else if (/\.(html|xml)$/.test(item.name) || ['titulos.json', 'robots.txt', 'ads.txt'].includes(file)) {
      const local = file.replace(/\\/g, '/');
      const html = fs.readFileSync(file, 'utf8');
      const dado = { hash: hash(html) };
      if (file.endsWith('.html')) {
        const $ = cheerio.load(html, { sourceCodeLocationInfo: true });
        dado.semTema = hash(removerRecursosTema(html).replace(/\s/g, ''));
        const corpo = $('.article-body').first()[0]?.sourceCodeLocation;
        if (corpo) dado.corpo = hash(html.slice(corpo.startOffset, corpo.endOffset));
        dado.tema = $('#theme-select').length === 1 && $('head script[src="/scripts/theme-toggle.js"]').length === 1 && $('head link[href="/scripts/site-theme.css"]').length === 1;
        dado.elegivel = dado.tema || aplicarTemaSite(html, local) !== html;
      }
      saida[local] = dado;
    }
  }
  return saida;
}

const depois = snapshot();
fs.mkdirSync(pasta, { recursive: true });
if (process.argv.includes('--capture')) {
  fs.writeFileSync(baseline, JSON.stringify(depois), { flag: 'wx' });
  console.log(JSON.stringify({ baseline, arquivos: Object.keys(depois).length }));
} else {
  const antes = JSON.parse(fs.readFileSync(baseline));
  const arquivos = [...new Set([...Object.keys(antes), ...Object.keys(depois)])];
  const alterados = arquivos.filter(f => antes[f]?.hash !== depois[f]?.hash);
  const inesperados = alterados.filter(f => !antes[f] || !depois[f] || !antes[f].semTema || antes[f].semTema !== depois[f].semTema || antes[f].corpo !== depois[f].corpo);
  const semTema = arquivos.filter(f => depois[f]?.elegivel && !depois[f].tema);
  const relatorio = { verificadoEm: new Date().toISOString(), arquivos: arquivos.length, alterados: alterados.length,
    artigosPreservados: arquivos.filter(f => antes[f]?.corpo && antes[f].corpo === depois[f]?.corpo).length,
    paginasComTema: arquivos.filter(f => depois[f]?.tema).length, inesperados, semTema, aceita: !inesperados.length && !semTema.length };
  fs.writeFileSync(path.join(pasta, 'preservacao.json'), JSON.stringify(relatorio, null, 2));
  console.log(JSON.stringify(relatorio, null, 2));
  if (!relatorio.aceita) process.exitCode = 1;
}
