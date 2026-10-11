const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');

async function main() {
  const output = '.editorial/qa-presentation';
  fs.mkdirSync(output, { recursive: true });
  const origin = process.env.SITE_PREVIEW_URL || JSON.parse(fs.readFileSync('.editorial/qa-theme/preview.json', 'utf8')).url;
  const article = 'artigos/inteligencia-artificial/engenharia-de-contexto-para-memoria-custo-e-precisao-em-aplicacoes-de-ia-generativa.html';
  const pages = ['index.html', 'sobre.html', 'contato.html', 'artigos/index.html', 'guias.html', article, 'artigos/explorando-os-segredos-do-reservoir-sampling.html'];
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = [], interactions = [];
  async function page(width, theme, javascript = true, blocked = false) {
    const ctx = await browser.createBrowserContext(), p = await ctx.newPage();
    await p.setViewport({ width, height: 900 });
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
    await p.setJavaScriptEnabled(javascript);
    await p.setRequestInterception(true);
    p.on('request', r => {
      if (blocked && r.url().endsWith('/scripts/site-interactions.js')) return r.abort();
      if (r.url().startsWith(origin) || r.url().startsWith('data:')) return r.continue();
      return r.abort();
    });
    return { ctx, p };
  }
  try {
    for (const width of [1440, 820, 390, 320]) for (const theme of ['light', 'dark']) {
      const { ctx, p } = await page(width, theme);
      const errors = [];
      p.on('pageerror', error => errors.push(error.message));
      for (const file of pages) {
        errors.length = 0;
        const response = await p.goto(`${origin}/${file}`, { waitUntil: 'load' });
        assert.equal(response.status(), 200);
        await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const brandLoaded = await p.$eval('.brand-mark', el => new Promise(resolve => {
          const url = getComputedStyle(el).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
          if (!url) return resolve(false);
          const img = new Image(); img.onload = () => resolve(img.naturalWidth > 0); img.onerror = () => resolve(false); img.src = url;
        }));
        const data = await p.evaluate(() => {
          const visible = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
          const targets = [...document.querySelectorAll('header a,header select,header button')].filter(visible);
          const boxes = targets.map(e => ({ text: e.textContent || e.getAttribute('aria-label'), r: e.getBoundingClientRect() }));
          const overlaps = boxes.flatMap((a, i) => boxes.slice(i + 1).filter(b => a.r.left < b.r.right && a.r.right > b.r.left && a.r.top < b.r.bottom && a.r.bottom > b.r.top).map(b => [a.text, b.text]));
          return { headerHeight: document.querySelector('header').getBoundingClientRect().height,
            overflow: document.documentElement.scrollWidth > innerWidth + 1, overlaps,
            resolvedTheme: document.documentElement.dataset.theme,
            brokenImages: [...document.images].filter(img => !img.complete || !img.naturalWidth).map(img => img.src),
            outside: [...document.querySelectorAll('h1,h2,main p,nav a,header button,header select')].filter(visible).filter(e => !e.closest('pre,.scroll-container')).filter(e => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(e => e.textContent.slice(0, 80)),
            toc: document.querySelectorAll('.article-toc').length,
            activeLinks: document.querySelectorAll('#site-navigation a[aria-current]').length };
        });
        const name = file === article ? 'artigo' : file.replace(/\.html$/, '').replace(/\//g, '-');
        if (['index', 'contato', 'artigos-index', 'artigo', 'guias'].includes(name) && width !== 820) await p.screenshot({ path: path.join(output, `${name}-${width}-${theme}.png`) });
        await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        const footer = await p.evaluate(() => {
          const banner = document.querySelector('#cookie-banner');
          if (!banner || getComputedStyle(banner).display === 'none') return { covered: [] };
          const top = banner.getBoundingClientRect().top;
          return { cookieHeight: banner.getBoundingClientRect().height,
            covered: [...document.querySelectorAll('footer a')].filter(e => e.getBoundingClientRect().bottom > top + 1).map(e => e.textContent) };
        });
        if (file === 'index.html' && width === 390) await p.screenshot({ path: path.join(output, `rodape-${theme}.png`) });
        results.push({ file, width, theme, brandLoaded, ...data, ...footer, errors: [...errors] });
      }
      await ctx.close();
    }

    const { ctx, p } = await page(320, 'dark');
    await p.goto(origin, { waitUntil: 'load' });
    await p.focus('.nav-toggle'); await p.keyboard.press('Enter');
    assert.equal(await p.$eval('.nav-toggle', e => e.getAttribute('aria-expanded')), 'true');
    await p.keyboard.press('Tab');
    assert.equal(await p.evaluate(() => document.activeElement.closest('nav')?.id), 'site-navigation');
    await p.keyboard.press('Escape');
    assert.equal(await p.$eval('.nav-toggle', e => e.getAttribute('aria-expanded')), 'false');
    assert.equal(await p.evaluate(() => document.activeElement.className), 'nav-toggle');
    await p.click('.nav-toggle');
    const navigation = p.waitForNavigation({ waitUntil: 'load' });
    await p.click('#site-navigation a[href="/guias.html"]'); await navigation;
    assert.ok(p.url().endsWith('/guias.html'));
    assert.equal(await p.$eval('#site-navigation a[aria-current]', e => e.getAttribute('href')), '/guias.html');
    interactions.push('menu-navigation');
    await p.click('.nav-toggle'); await p.click('main h1');
    assert.equal(await p.$eval('.nav-toggle', e => e.getAttribute('aria-expanded')), 'false');
    await p.click('.nav-toggle');
    await p.screenshot({ path: path.join(output, 'menu-320-dark.png') });
    await p.setViewport({ width: 1440, height: 900 });
    await p.waitForFunction(() => getComputedStyle(document.querySelector('.nav-toggle')).display === 'none');
    assert.ok(await p.$eval('#site-navigation', e => e.getBoundingClientRect().width > 0));
    interactions.push('keyboard-menu', 'escape-focus', 'outside-click', 'desktop-resize');

    await p.setViewport({ width: 390, height: 900 });
    await p.goto(`${origin}/${article}`, { waitUntil: 'load' });
    await p.click('.article-toc summary');
    await p.screenshot({ path: path.join(output, 'sumario-390-dark.png') });
    const href = await p.$eval('.article-toc a:nth-child(1)', e => e.getAttribute('href'));
    await p.click('.article-toc a');
    await p.waitForFunction(hash => location.hash === hash, {}, href);
    assert.equal(await p.$eval('.article-toc', e => e.open), false);
    assert.ok(await p.evaluate(hash => document.getElementById(decodeURIComponent(hash.slice(1))).getBoundingClientRect().top >= 0, href));
    await p.reload({ waitUntil: 'load' });
    assert.ok(await p.evaluate(hash => { const y = document.getElementById(decodeURIComponent(hash.slice(1))).getBoundingClientRect().top; return y >= 0 && y < 100; }, href));
    interactions.push('toc-navigation', 'toc-deep-link');

    await p.goto(`${origin}/contato.html`, { waitUntil: 'load' });
    assert.equal(await p.$eval('#contact-form', form => form.checkValidity()), false);
    assert.equal(await p.$eval('main h2', e => e.textContent), 'Envie uma mensagem');
    await p.click('#cookie-banner button');
    await p.waitForFunction(() => getComputedStyle(document.body).paddingBottom === '0px');
    await p.goto(origin, { waitUntil: 'load' });
    assert.equal(await p.$eval('#cookie-banner', e => getComputedStyle(e).display), 'none');
    interactions.push('contact-required', 'cookie-dismiss', 'cookie-persistence');
    await ctx.close();

    for (const scenario of ['no-javascript', 'blocked-interactions']) {
      const { ctx, p } = await page(320, 'dark', scenario !== 'no-javascript', scenario === 'blocked-interactions');
      await p.goto(`${origin}/${article}`, { waitUntil: 'load' });
      assert.ok(await p.$eval('#site-navigation', e => e.getBoundingClientRect().height > 0));
      assert.equal(await p.$('.article-toc'), null);
      if (scenario === 'no-javascript') assert.equal(await p.$eval('#cookie-banner', e => getComputedStyle(e).position), 'static');
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      interactions.push(scenario); await ctx.close();
    }
    const failures = results.filter(r => !r.brandLoaded || r.overflow || r.overlaps.length || r.brokenImages.length || r.outside.length || r.covered.length || r.errors.length || r.theme !== r.resolvedTheme || r.activeLinks !== 1 || (r.width <= 760 && r.headerHeight > 70));
    const report = { accepted: !failures.length, verifiedAt: new Date().toISOString(), cases: results.length, interactions, failures, results };
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
