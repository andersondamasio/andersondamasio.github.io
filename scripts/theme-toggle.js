document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('theme-toggle');
  if (btn) btn.style.display = "none";
  // ...restante do código
});


(function() {
  function getPreferredTheme() {
    // Sempre começa com claro (a menos que o usuário já tenha salvo preferência no localStorage)
    if (localStorage.getItem('theme')) return localStorage.getItem('theme');
    return 'light';
  }
  function setTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️ Claro' : '🌙 Escuro';
  }
  document.addEventListener('DOMContentLoaded', function() {
    var theme = getPreferredTheme();
    setTheme(theme);
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', function() {
        theme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
        localStorage.setItem('theme', theme);
        setTheme(theme);
      });
    }
  });
})();


