import puppeteer from 'puppeteer';
import fs from 'fs';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const url = 'https://cgn.inf.br/noticia/1852029/acidente-entre-carreta-e-caminhao-guincho-e-registrado-em-cascavel;

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Troque este trecho:
  // await page.waitForTimeout(2000);
  // POR:
  await new Promise(resolve => setTimeout(resolve, 2000));

  const html = await page.content();

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  fs.writeFileSync('noticia_extraida.json', JSON.stringify(article, null, 2), 'utf8');
  console.log('\nTÍTULO:', article.title);
  console.log('\nRESUMO:', article.excerpt || '(sem resumo)');
  console.log('\nTEXTO PRINCIPAL:\n', article.textContent);

  await browser.close();
})();
