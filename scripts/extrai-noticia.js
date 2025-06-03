import puppeteer from 'puppeteer';
import fs from 'fs';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

// Altere para a URL da notícia individual que deseja extrair!
const url = 'https://cgn.inf.br/noticia/1852029/acidente-entre-carreta-e-caminhao-guincho-e-registrado-em-cascavel';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });
  await page.waitForTimeout(2000);

  // Pega o HTML renderizado
  const html = await page.content();

  // Usa Readability para extrair conteúdo principal
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  // Salva tudo em JSON
  fs.writeFileSync('noticia_extraida.json', JSON.stringify(article, null, 2), 'utf8');

  // Mostra título e resumo no console
  console.log('\nTÍTULO:', article.title);
  console.log('\nRESUMO:', article.excerpt || '(sem resumo)');
  console.log('\nTEXTO PRINCIPAL:\n', article.textContent);

  await browser.close();
})();
