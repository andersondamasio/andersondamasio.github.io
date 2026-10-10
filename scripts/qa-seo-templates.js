const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const puppeteer = require("puppeteer");
const { agruparArquivo } = require("./seo-archive");

async function main() {
  const root = process.cwd();
  const diretorio = path.join(root, ".editorial", "qa-templates");
  fs.mkdirSync(diretorio, { recursive: true });
  const tipos = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".ico": "image/x-icon", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml" };
  const servidor = http.createServer((req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      const local = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
      const arquivo = path.resolve(root, local);
      const tipo = tipos[path.extname(arquivo)];
      if (!arquivo.startsWith(`${root}${path.sep}`) || !tipo || !fs.statSync(arquivo).isFile()) throw new Error("Nao encontrado");
      res.writeHead(200, { "Content-Type": tipo }); res.end(fs.readFileSync(arquivo));
    } catch { res.writeHead(404); res.end("Nao encontrado"); }
  });
  await new Promise(resolve => servidor.listen(0, "127.0.0.1", resolve));
  const origem = `http://127.0.0.1:${servidor.address().port}`;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || puppeteer.executablePath() });
    const registros = JSON.parse(fs.readFileSync("titulos.json", "utf8"));
    const recente = registros.filter(r => r.url && r.localizacao?.estado !== "pendente").sort((a, b) => String(b.data).localeCompare(String(a.data)))[0].url;
    const meses = agruparArquivo(registros.filter(r => r.url && r.localizacao?.estado !== "pendente"));
    const mesMaior = [...meses].sort((a, b) => b.artigos.length - a.artigos.length)[0]?.url;
    const extras = process.argv.slice(2);
    if (extras.some(arquivo => !/^artigos\/[a-z0-9/-]+\.html$/.test(arquivo))) throw new Error("QA adicional exige caminho local de artigo.");
    const guias = fs.existsSync("guias.html") ? "guias.html" : null;
    const arquivos = [...new Set(["index.html", "sobre.html", "index2.html", recente, "artigos/index.html", "arquivo/index.html", mesMaior, guias, ...extras].filter(Boolean))];
    const resultados = [];
    const fluxosLeituras = [];
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 720 }]) {
      const contexto = await browser.createBrowserContext();
      const pagina = await contexto.newPage();
      await pagina.setViewport(viewport);
      const erros = [];
      pagina.on("pageerror", erro => erros.push(erro.message));
      await pagina.setRequestInterception(true);
      pagina.on("request", req => {
        const url = new URL(req.url());
        if (url.origin === origem || url.protocol === "data:") return req.continue();
        if (url.hostname === "www.andersondamasio.com.br") return req.continue({ url: `${origem}${url.pathname}${url.search}` });
        return req.abort();
      });
      for (const arquivo of arquivos) {
        erros.length = 0;
        const resposta = await pagina.goto(`${origem}/${arquivo}`, { waitUntil: "networkidle0" });
        if (resposta.status() !== 200) throw new Error(`HTTP ${resposta.status()} para ${arquivo}`);
        const cookie = await pagina.$("#cookie-banner button");
        if (cookie && await cookie.isVisible()) {
          await cookie.click();
          if (await pagina.$eval("#cookie-banner", el => getComputedStyle(el).display !== "none")) throw new Error("Consentimento nao fechou o aviso.");
        }
        const avaliacao = await pagina.evaluate(() => ({
          titulo: document.querySelector("h1")?.textContent.trim(),
          h1: document.querySelectorAll("h1").length,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          botoesSobreCodigo: [...document.querySelectorAll('.article-body pre')].filter(pre => {
            const botao = pre.querySelector('.copy-button');
            const codigo = pre.querySelector('code');
            return botao && codigo && botao.getBoundingClientRect().bottom > codigo.getBoundingClientRect().top;
          }).length,
          imagensQuebradas: [...document.images].filter(img => !img.complete || img.naturalWidth === 0).map(img => img.src),
          textoForaDaTela: [...document.querySelectorAll("h1,h2,main p,main li,nav a")].filter(el => {
            const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1) && !el.closest(".scroll-container");
          }).map(el => el.textContent.trim().slice(0, 80))
        }));
        const nome = `${arquivo === recente ? "artigo" : arquivo.replace(/\.html$/, "").replace(/\//g, "-")}-${viewport.width}.png`;
        await pagina.screenshot({ path: path.join(diretorio, nome), fullPage: false });
        if (arquivo === recente) {
          const bloco = await pagina.$(".article-validation");
          await bloco.screenshot({ path: path.join(diretorio, `editorial-${viewport.width}.png`) });
        }
        resultados.push({ arquivo, viewport, ...avaliacao, erros: [...erros], screenshot: nome });
      }
      await pagina.goto(`${origem}/index.html`, { waitUntil: "networkidle0" });
      await Promise.all([pagina.waitForNavigation({ waitUntil: "networkidle0" }), pagina.click('.profile-links a[href="/sobre.html"]')]);
      if (!pagina.url().endsWith("/sobre.html")) throw new Error("Navegacao do perfil falhou.");
      await pagina.goto(`${origem}/arquivo/index.html`, { waitUntil: "networkidle0" });
      await Promise.all([pagina.waitForNavigation({ waitUntil: "networkidle0" }), pagina.click(`a[href="/${mesMaior}"]`)]);
      if (!pagina.url().endsWith(`/${mesMaior}`)) throw new Error("Navegacao para o mes falhou.");
      await pagina.click(".archive-date-selector summary");
      await pagina.click(".archive-days a:last-child");
      const diaVisivel = await pagina.evaluate(() => {
        const alvo = document.querySelector(location.hash);
        return alvo && alvo.getBoundingClientRect().top >= document.querySelector("header").getBoundingClientRect().bottom;
      });
      if (!diaVisivel) throw new Error("Cabecalho encobre o dia selecionado.");
      const destino = await pagina.$eval(".article-index a", el => el.getAttribute("href"));
      await Promise.all([pagina.waitForNavigation({ waitUntil: "networkidle0" }), pagina.click(".article-index a")]);
      if (!pagina.url().endsWith(destino) || !(await pagina.$(".article-body"))) throw new Error("Navegacao do arquivo para artigo falhou.");
      if (guias) {
        await pagina.setJavaScriptEnabled(false);
        await pagina.goto(`${origem}/index.html`, { waitUntil: "networkidle0" });
        await Promise.all([pagina.waitForNavigation({ waitUntil: "networkidle0" }), pagina.click('.selected-readings h2 a')]);
        if (!pagina.url().endsWith('/guias.html')) throw new Error("Navegacao para guias sem JavaScript falhou.");
        await pagina.click('.reading-topics a:last-child');
        const topico = await pagina.evaluate(() => {
          const alvo = document.querySelector(location.hash);
          return { seletor: location.hash, visivel: Boolean(alvo && alvo.getBoundingClientRect().top >= document.querySelector('header').getBoundingClientRect().bottom) };
        });
        if (!topico.visivel) throw new Error("Cabecalho encobre o tema selecionado nos guias.");
        await pagina.screenshot({ path: path.join(diretorio, `guias-topico-${viewport.width}.png`), fullPage: false });
        const link = `${topico.seletor} .reading-list a`;
        const artigo = await pagina.$eval(link, el => el.getAttribute('href'));
        await Promise.all([pagina.waitForNavigation({ waitUntil: "networkidle0" }), pagina.click(link)]);
        if (!pagina.url().endsWith(artigo) || !(await pagina.$('.article-body'))) throw new Error("Navegacao do guia para artigo sem JavaScript falhou.");
        fluxosLeituras.push({ largura: viewport.width, javascript: false, topico: topico.seletor, artigo, aceita: true });
      }
      await contexto.close();
    }
    const aceita = resultados.every(r => r.h1 === 1 && !r.overflow && !r.botoesSobreCodigo && !r.imagensQuebradas.length && !r.textoForaDaTela.length && !r.erros.length);
    const relatorio = { verificadoEm: new Date().toISOString(), aceita, observacao: "Servidor local temporario; analytics e dominios externos bloqueados durante QA.", resultados, fluxosLeituras };
    fs.writeFileSync(path.join(diretorio, "resultado.json"), JSON.stringify(relatorio, null, 2));
    console.log(JSON.stringify(relatorio, null, 2));
    if (!aceita) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => servidor.close(resolve));
  }
}

main().catch(erro => { console.error(erro.message); process.exitCode = 1; });
