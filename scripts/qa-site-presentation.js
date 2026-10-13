const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { secaoAtual } = require('./site-presentation');

async function main() {
  const output = '.editorial/qa-presentation';
  fs.mkdirSync(output, { recursive: true });
  const origin = process.env.SITE_PREVIEW_URL || JSON.parse(fs.readFileSync('.editorial/qa-theme/preview.json', 'utf8')).url;
  const article = 'artigos/inteligencia-artificial/engenharia-de-contexto-para-memoria-custo-e-precisao-em-aplicacoes-de-ia-generativa.html';
  const selection = JSON.parse(fs.readFileSync('dados/leituras-selecionadas.json', 'utf8'));
  const home = cheerio.load(fs.readFileSync('index.html', 'utf8'));
  const archive = cheerio.load(fs.readFileSync('arquivo/index.html', 'utf8'));
  const month = archive('a[href]').map((_, e) => archive(e).attr('href')).get().find(href => /^\/arquivo\/\d{4}-\d{2}\.html$/.test(href));
  const pages = [...new Set(['index.html', 'sobre.html', 'contato.html', 'obrigado.html', 'politica.html', 'termos.html', 'artigos/index.html', 'guias.html', 'arquivo/index.html', month.slice(1), 'index2.html', 'artigos/inteligencia-artificial.html', article,
    ...selection.grupos.flatMap(g => g.leituras.map(r => r.url)), ...home('.article-index a').map((_, e) => home(e).attr('href').replace(/^\//, '')).get()])];
  const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const results = [], interactions = [], headerAlignment = [];
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
    for (const width of [1920, 1440, 1051, 1050, 820, 761, 760, 390, 320]) for (const theme of ['light', 'dark']) {
      const { ctx, p } = await page(width, theme);
      let reference;
      for (const file of ['index.html', 'artigos/index.html', 'sobre.html', 'contato.html', 'guias.html', article]) {
        const response = await p.goto(`${origin}/${file}`, { waitUntil: 'load' });
        assert.equal(response.status(), 200);
        if (width <= 760) await p.click('.nav-toggle');
        const geometry = await p.evaluate(() => {
          const rect = selector => {
            const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
            return { x, y, width, height };
          };
          return {
            header: rect('.site-header'), mark: rect('.site-header .brand-mark'),
            navigation: rect('#site-navigation'), theme: rect('#theme-select'),
            toggle: rect('.nav-toggle'),
            links: [...document.querySelectorAll('#site-navigation a')].map(el => {
              const { x, y, width, height } = el.getBoundingClientRect();
              return { x, y, width, height };
            })
          };
        });
        const context = `${file}, ${width}px, ${theme}`;
        const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= 1, `${label}: ${actual} vs ${expected} (${context})`);
        if (reference) {
          for (const key of ['header', 'mark', 'navigation', 'theme', 'toggle']) {
            for (const dimension of ['x', 'y', 'width', 'height']) close(geometry[key][dimension], reference[key][dimension], `${key}.${dimension}`);
          }
          assert.equal(geometry.links.length, reference.links.length, context);
          for (const [i, link] of geometry.links.entries()) {
            for (const dimension of ['x', 'y', 'width', 'height']) close(link[dimension], reference.links[i][dimension], `link ${i}.${dimension}`);
          }
        } else reference = geometry;
        close(geometry.navigation.x + geometry.navigation.width / 2, width / 2, 'Menu centralizado');
        if (width > 760) {
          const boxes = await p.$$eval('.site-brand, #site-navigation, .theme-control', elements => elements.map(el => {
            const { left, right, top, bottom } = el.getBoundingClientRect();
            return { left, right, top, bottom };
          }));
          assert.ok(boxes[0].right <= boxes[1].left && boxes[1].right <= boxes[2].left, `Cabecalho sem sobreposicao (${context})`);
          assert.ok(geometry.header.height <= 70, `Cabecalho compacto (${context})`);
        }
        assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, context);
        headerAlignment.push({ file, width, theme, ...geometry });
      }
      await ctx.close();
    }

    for (const width of [1440, 820, 390, 320]) for (const theme of ['light', 'dark']) {
      const { ctx, p } = await page(width, theme);
      const errors = [];
      p.on('pageerror', error => errors.push(error.message));
      for (const file of pages) {
        errors.length = 0;
        const response = await p.goto(`${origin}/${file}`, { waitUntil: 'load' });
        assert.equal(response.status(), 200);
        await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        if (file === 'index.html') {
          const home = await p.evaluate(() => {
            const cards = [...document.querySelectorAll('.reading-card')];
            return {
              intro: document.querySelector('.profile-description').textContent,
              profileLinks: [...document.querySelectorAll('.profile-links a')].map(a => a.textContent),
              cards: cards.length, recent: document.querySelectorAll('.article-index > li').length,
              columns: new Set(cards.map(el => Math.round(el.getBoundingClientRect().left))).size,
              inside: cards.every(el => [...el.children].every(child => child.getBoundingClientRect().right <= el.getBoundingClientRect().right && child.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom)),
              nameSize: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),
              commercialContact: document.querySelectorAll('main a[href="/contato.html"]').length
            };
          });
          assert.match(home.intro, /Atuo no desenvolvimento de sistemas h\u00e1 mais de \d+ anos\./);
          assert.deepEqual(home.profileLinks, ['Sobre mim', 'LinkedIn']);
          assert.equal(home.cards, 3); assert.equal(home.recent, 3);
          assert.equal(home.columns, width <= 760 ? 1 : 3);
          assert.ok(home.inside && home.nameSize <= 32);
          assert.equal(home.commercialContact, 0);
          const actions = await p.$$eval('.home-section-heading > a', links => links.map(el => {
            const css = getComputedStyle(el);
            return { font: css.fontFamily, size: css.fontSize, weight: css.fontWeight, color: css.color, decoration: css.textDecorationLine };
          }));
          assert.equal(actions.length, 2);
          assert.deepEqual(actions[0], actions[1], 'Guias e artigos usam o mesmo estilo de acesso');
        }
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
            navStyles: [...document.querySelectorAll('#site-navigation a')].map(el => {
              const css = getComputedStyle(el);
              return { label: el.textContent, weight: css.fontWeight, size: css.fontSize, line: css.lineHeight, font: css.fontFamily };
            }),
            footerStyles: [...document.querySelectorAll('.footer-navigation a')].map(el => getComputedStyle(el).fontWeight),
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
        results.push({ file, width, theme, brandLoaded, expectedActiveLinks: secaoAtual(file) ? 1 : 0, ...data, ...footer, errors: [...errors] });
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
    // Observe client validation without ever posting a real message to FormSubmit.
    await p.evaluate(() => {
      window.__contactSubmission = null;
      document.querySelector('#contact-form').addEventListener('submit', event => {
        window.__contactSubmission = { prevented: event.defaultPrevented, fields: Object.fromEntries(new FormData(event.target)) };
        event.preventDefault();
      });
    });
    await p.type('#nome', 'Teste local');
    await p.type('#email', 'qa@example.org');
    await p.type('#mensagem', '             ');
    async function submitContact() {
      await p.$eval('#contact-form button[type="submit"]', el => el.scrollIntoView({ block: 'center' }));
      assert.ok(await p.$eval('#contact-form button[type="submit"]', el => {
        const r = el.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
      }), 'Botao do formulario acessivel apos rolagem, inclusive com aviso de cookies');
      await p.click('#contact-form button[type="submit"]');
    }
    await submitContact();
    assert.equal(await p.evaluate(() => window.__contactSubmission?.prevented), true);
    assert.equal(await p.$eval('#mensagem', el => el.validity.customError), true);
    await p.$eval('#mensagem', el => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.type('#mensagem', 'Mensagem de teste local sem envio externo.');
    await p.$eval('[name="_honey"]', el => { el.value = 'spam'; });
    await submitContact();
    assert.equal(await p.evaluate(() => window.__contactSubmission?.prevented), true);
    await p.$eval('[name="_honey"]', el => { el.value = ''; });
    await submitContact();
    const submission = await p.evaluate(() => window.__contactSubmission);
    assert.equal(submission.prevented, false);
    assert.equal(submission.fields.mensagem, 'Mensagem de teste local sem envio externo.');
    assert.equal(submission.fields._next, 'https://www.andersondamasio.com.br/obrigado.html');
    interactions.push('contact-whitespace', 'contact-honeypot', 'contact-valid-without-external-send');
    await p.click('#cookie-banner button');
    await p.waitForFunction(() => getComputedStyle(document.body).paddingBottom === '0px');
    await p.goto(origin, { waitUntil: 'load' });
    assert.equal(await p.$eval('#cookie-banner', e => getComputedStyle(e).display), 'none');
    interactions.push('contact-required', 'cookie-dismiss', 'cookie-persistence');
    const readings = await p.$$eval('.reading-link', links => links.map(a => a.getAttribute('href')));
    for (const href of readings) {
      await p.goto(origin, { waitUntil: 'load' });
      const navigation = p.waitForNavigation({ waitUntil: 'load' });
      await p.click(`.reading-link[href="${href}"]`); await navigation;
      assert.equal(new URL(p.url()).pathname, href);
      assert.equal(await p.$eval('link[rel="canonical"]', el => new URL(el.href).pathname), href);
      assert.ok(await p.$('.article-body'));
    }
    interactions.push('home-selected-readings');
    await ctx.close();

    for (const scenario of ['no-javascript', 'blocked-interactions']) {
      const { ctx, p } = await page(320, 'dark', scenario !== 'no-javascript', scenario === 'blocked-interactions');
      await p.goto(`${origin}/${article}`, { waitUntil: 'load' });
      assert.ok(await p.$eval('#site-navigation', e => e.getBoundingClientRect().height > 0));
      assert.equal(await p.$('.article-toc'), null);
      if (scenario === 'no-javascript') assert.equal(await p.$eval('#cookie-banner', e => getComputedStyle(e).position), 'static');
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await p.goto(origin, { waitUntil: 'load' });
      assert.equal(await p.$$eval('.reading-link', links => links.length), 3);
      assert.match(await p.$eval('.profile-description', el => el.textContent), /h\u00e1 mais de \d+ anos/);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      interactions.push(scenario); await ctx.close();
    }
    const failures = results.filter(r => !r.brandLoaded || r.overflow || r.overlaps.length || r.brokenImages.length || r.outside.length || r.covered.length || r.errors.length || r.theme !== r.resolvedTheme || r.activeLinks !== r.expectedActiveLinks || r.navStyles.some(s => s.weight !== '500' || s.size !== '15px' || s.line !== '21px' || s.font !== '"Segoe UI", sans-serif') || r.footerStyles.some(weight => weight !== '400') || (r.width <= 760 && r.headerHeight > 70));
    const report = { accepted: !failures.length, verifiedAt: new Date().toISOString(), cases: results.length, headerCases: headerAlignment.length, interactions, failures, results, headerAlignment };
    fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ...report, results: undefined, headerAlignment: undefined }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
