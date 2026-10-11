function aceitarCookies() {
  const dataExpiracao = new Date();
  dataExpiracao.setFullYear(dataExpiracao.getFullYear() + 1);
  document.cookie = "cookieConsent=true; expires=" + dataExpiracao.toUTCString() + "; path=/";
  document.getElementById('cookie-banner').style.display = 'none';
  document.documentElement.style.removeProperty('--cookie-space');
}

function getCookie(nome) {
  const valor = "; " + document.cookie;
  const partes = valor.split("; " + nome + "=");
  if (partes.length === 2) return partes.pop().split(";").shift();
}

window.addEventListener('DOMContentLoaded', () => {
  const banner = document.getElementById('cookie-banner');
  if (!banner) return;
  if (getCookie('cookieConsent') === 'true') {
    banner.style.display = 'none';
    return;
  }
  // Keep the full footer reachable while the notice is visible, including at zoom.
  const reservarEspaco = () => document.documentElement.style.setProperty('--cookie-space', `${banner.getBoundingClientRect().height}px`);
  banner.classList.add('cookies-ready');
  reservarEspaco();
  if (window.ResizeObserver) new ResizeObserver(reservarEspaco).observe(banner);
  else window.addEventListener('resize', reservarEspaco);
});
