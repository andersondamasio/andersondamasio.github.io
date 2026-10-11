const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');

async function main() {
  const root = process.cwd();
  const output = path.join(root, '.editorial', 'qa-theme');
  fs.mkdirSync(output, { recursive: true });
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    try {
      const local = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
      const file = path.resolve(root, local);
      if (!file.startsWith(root + path.sep) || local.split('/').some(s => s.startsWith('.')) || !types[path.extname(file)] || !fs.statSync(file).isFile()) throw new Error('404');
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)],
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; form-action 'none'; base-uri 'self'"
      });
      res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  if (process.argv.includes('--serve')) {
    fs.writeFileSync(path.join(output, 'preview.json'), JSON.stringify({ url: origin, pid: process.pid }, null, 2));
    console.log(`Previa local: ${origin}`);
    return;
  }
  let browser;
  const results = [];
  const interactions = [];
  try {
    const windowsChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || (fs.existsSync(windowsChrome) ? windowsChrome : puppeteer.executablePath()) });
    async function page(context, width, theme, javascript = true) {
      const p = await context.newPage();
      await p.setViewport({ width, height: width > 540 ? 1000 : 844 });
      await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
      await p.setJavaScriptEnabled(javascript);
      await p.setRequestInterception(true);
      p.on('request', req => {
        const url = new URL(req.url());
        if (url.origin === origin || url.protocol === 'data:') return req.continue();
        if (url.hostname === 'www.andersondamasio.com.br') return req.continue({ url: origin + url.pathname + url.search });
        return req.abort();
      });
      await p.evaluateOnNewDocument(() => {
        const observe = () => {
          if (!document.body) return requestAnimationFrame(observe);
          window.__firstThemeFrame = { theme: document.documentElement.dataset.theme, background: getComputedStyle(document.body).backgroundColor };
        };
        requestAnimationFrame(observe);
      });
      return p;
    }
    const arquivos = ['index.html', 'sobre.html', 'contato.html', 'termos.html', 'politica.html', 'obrigado.html',
      'guias.html', 'index2.html', 'artigos/index.html', 'artigos/arquitetura.html', 'arquivo/index.html',
      'artigos/explorando-os-segredos-do-reservoir-sampling.html',
      'artigos/design-tokens-a-arquitetura-secreta-por-tras-de-interfaces-de-usuario-incriveis.html',
      'artigos/desenvolvendo-sistemas-de-baixa-latencia-com-c-desafios-e-oportunidades.html',
      'artigos/inteligencia-artificial/engenharia-de-contexto-para-memoria-custo-e-precisao-em-aplicacoes-de-ia-generativa.html'];
    const manifesto = JSON.parse(fs.readFileSync(path.join(root, 'dados/indexacao.json'), 'utf8'));
    const noindex = manifesto.decisoes.find(d => d.acao === 'noindex')?.url;
    if (noindex) arquivos.push(noindex);
    const month = fs.readdirSync(path.join(root, 'arquivo')).filter(f => /^\d{4}-\d{2}\.html$/.test(f)).sort().at(-1);
    if (month) arquivos.push(`arquivo/${month}`);
    for (const width of [1440, 390, 320]) {
      for (const theme of ['light', 'dark']) {
        const context = await browser.createBrowserContext();
        const p = await page(context, width, theme);
        const errors = [];
        p.on('pageerror', e => errors.push(e.message));
        for (const file of arquivos) {
          errors.length = 0;
          const response = await p.goto(`${origin}/${file}`, { waitUntil: 'load' });
          assert.equal(response.status(), 200, file);
          await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const data = await p.evaluate(() => {
            const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
            const rect = el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
            const rgba = value => (value.match(/[\d.]+/g) || []).map(Number);
            const luminance = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
            function background(el) {
              if (!el) return [255, 255, 255];
              const bg = rgba(getComputedStyle(el).backgroundColor);
              const alpha = bg.length === 4 ? bg[3] : 1;
              if (alpha === 1) return bg;
              const parent = background(el.parentElement);
              return parent.map((v, i) => (bg[i] || 0) * alpha + v * (1 - alpha));
            }
            const lowContrast = [...document.querySelectorAll('h1,h2,h3,p,a,label,span,button,select,input,textarea,td,th,code,li')].filter(el => visible(el) &&
              ([...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()) || el.matches('select,input,textarea'))).flatMap(el => {
                const style = getComputedStyle(el), fg = rgba(style.color), bg = background(el);
                const l1 = luminance(fg), l2 = luminance(bg);
                const ratio = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
                const size = parseFloat(style.fontSize), large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
                return ratio + .01 >= (large ? 3 : 4.5) ? [] : [{ tag: el.tagName, text: (el.textContent || el.name).trim().slice(0, 70), ratio: Number(ratio.toFixed(2)), color: style.color, background: bg }];
              });
            const nav = document.querySelector('body > header > nav'), select = document.querySelector('#theme-select');
            for (const el of document.querySelectorAll('input:not([type="hidden"]),textarea,select')) {
              if (!visible(el)) continue;
              const style = getComputedStyle(el);
              const border = luminance(rgba(style.borderTopColor)), bg = luminance(background(el));
              const ratio = (Math.max(border, bg) + .05) / (Math.min(border, bg) + .05);
              if (ratio < 3) lowContrast.push({ tag: el.tagName, kind: 'control-border', ratio });
            }
            const n = rect(nav), s = rect(select);
            return { mode: document.documentElement.dataset.theme, control: select.value, firstFrame: window.__firstThemeFrame,
              background: getComputedStyle(document.body).backgroundColor,
              overlap: n.left < s.right && n.right > s.left && n.top < s.bottom && n.bottom > s.top,
              overflow: document.documentElement.scrollWidth > innerWidth + 1,
              lowContrast,
              brokenImages: [...document.images].filter(img => !img.complete || !img.naturalWidth).map(img => img.src),
              outside: [...document.querySelectorAll('h1,h2,h3,main p,nav a,.theme-control')].filter(el => visible(el) && !el.closest('.scroll-container,pre')).filter(el => {
                const r = rect(el); return r.left < -1 || r.right > innerWidth + 1;
              }).map(el => el.textContent.trim().slice(0, 60)) };
          });
          const name = `${file.replace(/\.html$/, '').replace(/\//g, '-')}-${width}-${theme}.png`;
          if (['index.html', 'contato.html', 'guias.html'].includes(file)) await p.screenshot({ path: path.join(output, name) });
          if (file.includes('design-tokens-')) {
            const code = await p.$('.article-body pre');
            if (code) await code.screenshot({ path: path.join(output, `codigo-${width}-${theme}.png`) });
          }
          results.push({ file, width, theme, ...data, errors: [...errors] });
        }
        await context.close();
      }
    }

    fs.writeFileSync(path.join(output, 'visual-cases.json'), JSON.stringify(results, null, 2));
    const context = await browser.createBrowserContext();
    const p = await page(context, 390, 'dark');
    const waitTheme = value => p.waitForFunction(v => document.documentElement.dataset.theme === v, { polling: 100 }, value);
    await p.goto(origin, { waitUntil: 'load' });
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
    await waitTheme('light');
    await p.select('#theme-select', 'dark'); await waitTheme('dark');
    await p.goto(`${origin}/sobre.html`, { waitUntil: 'load' }); await waitTheme('dark');
    assert.equal(await p.$eval('#theme-select', el => el.value), 'dark');
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    assert.equal(await p.evaluate(() => window.__firstThemeFrame.theme), 'dark');
    const other = await page(context, 390, 'light');
    await other.goto(`${origin}/contato.html`, { waitUntil: 'load' });
    await other.select('#theme-select', 'light'); await waitTheme('light');
    // A real visitor returns to the tab before interacting with it. Chromium defers
    // media-query change events for background tabs until their next rendering step.
    await p.bringToFront();
    await p.select('#theme-select', 'system');
    assert.equal(await p.evaluate(() => localStorage.getItem('theme')), null);
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]); await waitTheme('dark');
    await p.focus('#theme-select'); await p.keyboard.press('Home'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
    await waitTheme('light');
    assert.equal(await p.evaluate(() => document.activeElement.id), 'theme-select');
    interactions.push('system-change', 'manual-priority', 'navigation-persistence', 'cross-tab', 'return-system', 'keyboard');
    await p.select('#theme-select', 'dark');
    await p.emulateMediaType('print');
    assert.equal(await p.$eval('body', el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
    assert.equal(await p.$eval('.theme-control', el => getComputedStyle(el).display), 'none');
    interactions.push('print');
    await context.close();

    for (const scenario of ['no-js', 'blocked-storage', 'blocked-script']) {
      const ctx = await browser.createBrowserContext();
      const pg = await page(ctx, 320, 'dark', scenario !== 'no-js');
      if (scenario === 'blocked-storage') await pg.evaluateOnNewDocument(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('Blocked'); } }));
      if (scenario === 'blocked-script') { await pg.setRequestInterception(false); await pg.setRequestInterception(true); pg.removeAllListeners('request'); pg.on('request', req => req.url().startsWith(origin) && !req.url().includes('theme-toggle.js') ? req.continue() : req.abort()); }
      const errors = []; pg.on('pageerror', e => errors.push(e.message));
      await pg.goto(origin, { waitUntil: 'load' });
      const bg = await pg.$eval('body', el => getComputedStyle(el).backgroundColor);
      assert.equal(bg, 'rgb(23, 25, 27)', scenario);
      if (scenario === 'blocked-storage') {
        await pg.select('#theme-select', 'light');
        assert.equal(await pg.$eval('html', el => el.dataset.theme), 'light');
        assert.deepEqual(errors, []);
      } else assert.equal(await pg.$eval('.theme-control', el => getComputedStyle(el).display), 'none');
      interactions.push(scenario); await ctx.close();
    }
    const failures = results.filter(r => r.mode !== r.theme || r.control !== 'system' || r.firstFrame?.theme !== r.theme || r.overflow || r.overlap || r.outside.length || r.brokenImages.length || r.lowContrast.length || r.errors.length);
    const report = { verifiedAt: new Date().toISOString(), accepted: !failures.length, note: 'Local Chrome; external trackers blocked. Contrast checks are automated, not a full accessibility certification.', cases: results.length, interactions, failures, results };
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ accepted: report.accepted, cases: report.cases, interactions, failures }, null, 2));
    if (!report.accepted) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
