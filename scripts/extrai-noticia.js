import puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

// Verifica se recebeu URL como argumento
if (process.argv.length < 3) {
  console.error('Uso: node extrai-noticia.js <URL-da-noticia>');
  process.exit(1);
}
const url = process.argv[2];

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Aguarda alguns segundos para garantir carregamento completo
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Captura o HTML renderizado
  const html = await page.content();

  // Usa Readability para extrair conteúdo principal
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  await browser.close();

  // Mostra só resumo e texto principal no console, de forma simples
  console.log(JSON.stringify({
    resumoFonte: article.excerpt || '',
    textoPrincipal: article.textContent || ''
  }, null, 2));
})();
