(function () {
  'use strict';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var preference = readPreference();

  function validPreference(value) {
    return value === 'light' || value === 'dark' ? value : 'system';
  }

  function readPreference() {
    try { return validPreference(window.localStorage.getItem('theme')); }
    catch (_) { return 'system'; }
  }

  function applyTheme() {
    var theme = preference === 'system' ? (media && media.matches ? 'dark' : 'light') : preference;
    root.setAttribute('data-theme', theme);
    var select = document.getElementById('theme-select');
    if (select) select.value = preference;
  }

  // Run in the head, before the first paint. Storage may be unavailable.
  applyTheme();
  root.classList.add('theme-ready');

  function bindControl() {
    var select = document.getElementById('theme-select');
    if (!select) return;
    select.value = preference;
    select.addEventListener('change', function () {
      preference = validPreference(select.value);
      try {
        if (preference === 'system') window.localStorage.removeItem('theme');
        else window.localStorage.setItem('theme', preference);
      } catch (_) { /* The current page still honors the visitor's choice. */ }
      applyTheme();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindControl, { once: true });
  else bindControl();

  if (media) {
    var onSystemChange = function () { if (preference === 'system') applyTheme(); };
    if (media.addEventListener) media.addEventListener('change', onSystemChange);
    else if (media.addListener) media.addListener(onSystemChange);
  }
  window.addEventListener('storage', function (event) {
    if (event.key !== 'theme' && event.key !== null) return;
    try { if (event.storageArea && event.storageArea !== window.localStorage) return; }
    catch (_) { return; }
    preference = readPreference();
    applyTheme();
  });
})();


