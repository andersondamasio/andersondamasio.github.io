const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { paginaComAdsense, scriptUrl, validarAdsense } = require('./site-adsense');

async function main() {
  const root = process.cwd(), output = '.editorial/qa-adsense';
  fs.mkdirSync(output, { recursive: true });
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
  const server = http.createServer((req, res) => {
    try {
      const local = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.resolve(root, local);
      if (!file.startsWith(root + path.sep) || local.split('/').some(s => s.startsWith('.')) || !types[path.extname(file)]) throw new Error('404');
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] });
      res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = process.env.SITE_PREVIEW_URL || `http://127.0.0.1:${server.address().port}`;
  let browser;
  const results = [], references = new Map();
  try {
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const noindex = JSON.parse(fs.readFileSync('dados/indexacao.json', 'utf8')).decisoes.find(d => d.acao === 'noindex').url;
    const files = ['index.html', 'artigos/inteligencia-artificial/engenharia-de-contexto-para-memoria-custo-e-precisao-em-aplicacoes-de-ia-generativa.html', 'artigos/explorando-os-segredos-do-reservoir-sampling.html', 'contato.html', 'artigos/index.html', noindex];
    for (const width of [1440, 390]) for (const theme of ['light', 'dark']) for (const mode of ['success', 'failure', 'pending']) for (const file of files) {
      const ctx = await browser.createBrowserContext(), p = await ctx.newPage();
      const pending = [], errors = [];
      let requests = 0;
      const stub = { status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: 'window.__adsenseQaLoads = (window.__adsenseQaLoads || 0) + 1;' };
      await p.setViewport({ width, height: 900 });
      await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
      await p.setRequestInterception(true);
      p.on('pageerror', error => errors.push(error.message));
      p.on('request', r => {
        // No impressions or clicks: simulate the vendor response, never execute real ads.
        if (r.url() === scriptUrl) {
          requests++;
          if (mode === 'pending') { pending.push(r); return; }
          return mode === 'success' ? r.respond(stub) : r.abort('failed');
        }
        return r.url().startsWith(origin + '/') || r.url().startsWith('data:') ? r.continue() : r.abort();
      });
      const response = await p.goto(`${origin}/${file}`, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      const $ = cheerio.load(await response.text());
      const expected = paginaComAdsense($, file) ? 1 : 0;
      assert.deepEqual(validarAdsense($, file), []);
      assert.equal(requests, expected, `${mode}: uma requisicao por pagina elegivel (${file})`);
      assert.ok(await p.$eval('main', el => el.innerText.trim().length > 0));
      if (width <= 760) {
        await p.click('.nav-toggle');
        assert.equal(await p.$eval('.nav-toggle', el => el.getAttribute('aria-expanded')), 'true');
        await p.keyboard.press('Escape');
      }
      await p.select('#theme-select', theme === 'light' ? 'dark' : 'light');
      assert.equal(await p.$eval('html', el => el.dataset.theme), theme === 'light' ? 'dark' : 'light');
      await p.select('#theme-select', 'system');
      if (mode === 'pending' && expected) assert.equal(await p.evaluate(() => window.__adsenseQaLoads), undefined, 'Navegacao funciona antes do script responder');
      for (const request of pending) await request.respond(stub);
      if (mode !== 'failure' && expected) await p.waitForFunction(() => window.__adsenseQaLoads === 1).catch(error => {
        throw new Error(`Loader simulado nao executou: ${file}, ${width}px, ${theme}, ${mode}`, { cause: error });
      });
      await p.waitForFunction(() => [...document.images].every(img => img.complete));
      const geometry = await p.evaluate(() => ({
        boxes: ['header', 'main', 'h1', '#site-navigation', '#theme-select'].map(selector => {
          const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
          return { x, y, width, height };
        }), overflow: document.documentElement.scrollWidth > innerWidth + 1
      }));
      assert.equal(geometry.overflow, false);
      const key = `${file}/${width}/${theme}`;
      if (references.has(key)) assert.deepEqual(geometry, references.get(key), 'Falha ou atraso do AdSense nao desloca a pagina');
      else references.set(key, geometry);
      assert.deepEqual(errors, []);
      if (file === 'index.html' && mode === 'success') await p.screenshot({ path: path.join(output, `home-${width}-${theme}.png`) });
      results.push({ file, width, theme, mode, requests, expected, ...geometry });
      await ctx.close();
    }
    const report = { accepted: true, origin, verifiedAt: new Date().toISOString(), cases: results.length, limitation: 'Loader simulado: nao mede anuncios reais, receita, CLS apos veiculacao nem ranking.', results };
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
