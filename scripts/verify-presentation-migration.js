const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const pasta = '.editorial/qa-presentation';
const hash = texto => createHash('sha256').update(texto).digest('hex');
function snapshot(dir = '.', saida = {}) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith('.') || item.name === 'node_modules') continue;
    const file = path.join(dir, item.name), local = file.replace(/\\/g, '/');
    if (item.isDirectory()) snapshot(file, saida);
    else if (/\.(html|xml)$/.test(local) || ['titulos.json', 'robots.txt', 'ads.txt'].includes(local) || /^dados\/.*\.json$/.test(local)) {
      const html = fs.readFileSync(file, 'utf8');
      const dado = { hash: hash(html) };
      if (local.endsWith('.html')) {
        const $ = cheerio.load(html, { sourceCodeLocationInfo: true });
        const corpo = $('.article-body').first()[0]?.sourceCodeLocation;
        if (corpo) dado.corpo = hash(html.slice(corpo.startOffset, corpo.endOffset));
        dado.seo = hash(JSON.stringify($('head title, head meta:not([name="color-scheme"]), head link[rel="canonical"], head script[type="application/ld+json"]').toArray().map(el => ({
          tag: el.tagName, attributes: el.attribs, text: $(el).text()
        }))));
        dado.elegivel = Boolean($('body > header > nav').length && $('body > main').length && !$('meta[http-equiv="refresh"]').length && !local.startsWith('beijaoupassa/'));
        dado.apresentacao = $('head link[href="/scripts/site-presentation.css"]').length === 1 && $('head script[src="/scripts/site-interactions.js"]').length === 1 && $('header.site-header').length === 1;
      }
      saida[local] = dado;
    }
  }
  return saida;
}
const depois = snapshot();
fs.mkdirSync(pasta, { recursive: true });
const baseline = path.join(pasta, 'baseline.json');
if (process.argv.includes('--capture')) {
  fs.writeFileSync(baseline, JSON.stringify(depois), { flag: 'wx' });
  console.log(JSON.stringify({ baseline, arquivos: Object.keys(depois).length }));
} else {
  const antes = JSON.parse(fs.readFileSync(baseline));
  const arquivos = [...new Set([...Object.keys(antes), ...Object.keys(depois)])];
  const alterados = arquivos.filter(f => antes[f]?.hash !== depois[f]?.hash);
  const inesperados = arquivos.filter(f => !antes[f] || !depois[f] || antes[f].corpo !== depois[f].corpo || antes[f].seo !== depois[f].seo || (!antes[f].elegivel && antes[f].hash !== depois[f].hash));
  const semLayout = arquivos.filter(f => depois[f]?.elegivel && !depois[f].apresentacao);
  const resultado = { verificadoEm: new Date().toISOString(), arquivos: arquivos.length, alterados: alterados.length,
    artigosPreservados: arquivos.filter(f => antes[f]?.corpo && antes[f].corpo === depois[f]?.corpo).length,
    inesperados, semLayout, aceita: !inesperados.length && !semLayout.length };
  fs.writeFileSync(path.join(pasta, 'preservacao.json'), JSON.stringify(resultado, null, 2));
  console.log(JSON.stringify(resultado, null, 2));
  if (!resultado.aceita) process.exitCode = 1;
}
