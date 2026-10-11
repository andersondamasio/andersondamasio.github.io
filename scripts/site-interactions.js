(function () {
  'use strict';
  const experiencia = document.querySelector('.home-page [data-experience-start]');
  if (experiencia) {
    const inicio = Number(experiencia.dataset.experienceStart);
    const ano = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date()));
    // Keep the server-rendered fallback if the visitor's clock is behind.
    const anos = ano - inicio - 1;
    if (Number.isInteger(inicio) && inicio >= 1900 && anos >= Number(experiencia.textContent)) experiencia.textContent = String(anos);
  }
  const header = document.querySelector('.site-header');
  header?.querySelector('#theme-select')?.setAttribute('title', 'Tema do site');
  const toggle = header?.querySelector('.nav-toggle');
  const nav = header?.querySelector('#site-navigation');
  if (toggle && nav) {
    const fechar = () => { toggle.setAttribute('aria-expanded', 'false'); header.removeAttribute('data-menu-open'); };
    toggle.hidden = false;
    header.classList.add('navigation-ready');
    toggle.addEventListener('click', () => {
      const aberto = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(aberto));
      header.toggleAttribute('data-menu-open', aberto);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && header.hasAttribute('data-menu-open')) { fechar(); toggle.focus(); }
    });
    document.addEventListener('click', event => { if (!header.contains(event.target)) fechar(); });
    nav.addEventListener('click', event => { if (event.target.closest('a')) fechar(); });
    const media = window.matchMedia?.('(max-width: 760px)');
    if (media?.addEventListener) media.addEventListener('change', fechar);
  }

  const corpo = document.querySelector('.article-body');
  const titulos = corpo ? [...corpo.querySelectorAll('h2')].filter(h => h.textContent.trim()) : [];
  if (titulos.length >= 4 && !document.querySelector('.article-toc')) {
    const toc = document.createElement('details');
    toc.className = 'article-toc';
    const summary = document.createElement('summary');
    summary.textContent = 'Neste artigo';
    toc.append(summary);
    const navToc = document.createElement('nav');
    navToc.setAttribute('aria-label', 'Sum\u00e1rio do artigo');
    const lista = document.createElement('ol');
    titulos.forEach((heading, index) => {
      if (!heading.id) {
        const base = `secao-${index + 1}`;
        let id = base, extra = 1;
        while (document.getElementById(id)) id = `${base}-${extra++}`;
        heading.id = id;
      }
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = `#${encodeURIComponent(heading.id)}`;
      a.textContent = heading.textContent.trim();
      li.append(a); lista.append(li);
      a.addEventListener('click', () => {
        toc.open = false;
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      });
    });
    navToc.append(lista); toc.append(navToc); corpo.before(toc);
    // Restore a deep link after the generated heading IDs exist.
    if (location.hash) {
      try { const target = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (target && corpo.contains(target)) target.scrollIntoView(); } catch { /* Malformed URL fragment. */ }
    }
  }
})();
