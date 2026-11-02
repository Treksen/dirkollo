// Sets light/dark before the first paint so there is no flash. Kept as a file (not inline) so the Content-Security-Policy can block inline scripts.
try {
  var t = localStorage.getItem('theme') || 'light'
  document.documentElement.dataset.theme = (t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)) ? 'dark' : 'light'
} catch (e) { /* storage blocked: stay light */ }
