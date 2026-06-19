// popup.js — tiny UI that just writes to chrome.storage.sync; content.js relays to the page.

// localize any [data-i18n] element from _locales (browser picks en or pt_BR automatically)
for (const el of document.querySelectorAll('[data-i18n]')) {
  const m = chrome.i18n.getMessage(el.dataset.i18n);
  if (m) el.textContent = m;
}

const DEFAULTS = { enabled: true, target: 10, hud: true };
const $enabled = document.getElementById('enabled');
const $hud = document.getElementById('hud');
const $target = document.getElementById('target');
const $val = document.getElementById('val');

chrome.storage.sync.get(DEFAULTS, (c) => {
  $enabled.checked = c.enabled;
  $hud.checked = c.hud;
  $target.value = c.target;
  $val.textContent = c.target;
});

$enabled.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: $enabled.checked });
});

$hud.addEventListener('change', () => {
  chrome.storage.sync.set({ hud: $hud.checked });
});

$target.addEventListener('input', () => {
  $val.textContent = $target.value;
  chrome.storage.sync.set({ target: Number($target.value) });
});
