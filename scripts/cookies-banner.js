function aceitarCookies() {
  const dataExpiracao = new Date();
  dataExpiracao.setFullYear(dataExpiracao.getFullYear() + 1);
  document.cookie = "cookieConsent=true; expires=" + dataExpiracao.toUTCString() + "; path=/";
  document.getElementById('cookie-banner').style.display = 'none';
}

function getCookie(nome) {
  const valor = "; " + document.cookie;
  const partes = valor.split("; " + nome + "=");
  if (partes.length === 2) return partes.pop().split(";").shift();
}

window.addEventListener('DOMContentLoaded', () => {
  if (getCookie('cookieConsent') === 'true') {
    document.getElementById('cookie-banner').style.display = 'none';
  }
});
