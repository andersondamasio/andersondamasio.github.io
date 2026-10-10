const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const { compararDatas } = require('../exemplos/temporal/comparar');
const root = path.join(__dirname, '..');
const ler = p => fs.readFileSync(path.join(root, p), 'utf8');

test('Temporal ausente exige decisao explicita, sem fallback silencioso', () => {
  assert.throws(() => compararDatas(null), /Temporal indisponivel/);
  assert.throws(() => compararDatas({}), /Temporal indisponivel/);
});

test('exemplos nativos executam no Chrome instalado sem rede externa', { timeout: 30000 }, async t => {
  const instalado = process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome';
  const executablePath = process.env.CHROME_PATH || (fs.existsSync(instalado) ? instalado : puppeteer.executablePath());
  const browser = await puppeteer.launch({ headless: true, executablePath });
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', req => req.abort());
    const navegador = await browser.version();
    t.diagnostic(navegador);
    await page.addScriptTag({ content: ler('exemplos/temporal/comparar.js') });
    const saida = await page.evaluate(() => compararDatas());
    assert.deepEqual(saida, {
      dataOriginal: '2026-02-13', seteDiasDepois: '2026-02-20',
      partida: '2026-03-07T12:00:00-05:00[America/New_York]',
      diaSeguinte: '2026-03-08T12:00:00-04:00[America/New_York]',
      horasTranscorridas: 23,
      apos24Horas: '2026-03-08T13:00:00-04:00[America/New_York]',
      horarioInexistenteRejeitado: true, horarioRepetidoRejeitado: true
    });
    assert.equal(await page.evaluate(() => {
      try { Temporal.PlainDate.from({ year: 2026, month: 2, day: 30 }, { overflow: 'reject' }); return false; }
      catch (e) { if (!(e instanceof RangeError)) throw e; return true; }
    }), true);
    // This fragment deliberately has no script: disclosure remains a browser responsibility.
    await page.setJavaScriptEnabled(false);
    await page.setContent(ler('exemplos/web-nativa/detalhes.txt'));
    const aberto = () => page.$eval('details', el => el.open);
    assert.equal(await aberto(), false);
    await page.click('summary');
    assert.equal(await aberto(), true);
    await page.focus('summary');
    await page.keyboard.press('Enter');
    assert.equal(await aberto(), false);
    await page.keyboard.press('Space');
    assert.equal(await aberto(), true);
    assert.equal(await page.$eval('details p', p => getComputedStyle(p).display !== 'none'), true);
    t.diagnostic('evidencia:' + JSON.stringify({ navegador, saida, em: new Date().toISOString(),
      details: { javascript: false, estados: [false, true, false, true], interacoes: ['inicial', 'clique', 'Enter', 'Space'] } }));
  } finally { await browser.close(); }
});
