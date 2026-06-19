// content.js — runs in the ISOLATED world. Bridges chrome.storage <-> the MAIN-world
// inject.js via window.postMessage (inject.js can't touch chrome.* APIs).
(() => {
  'use strict';
  const DEFAULTS = { enabled: true, target: 10, hud: true };

  const push = (cfg) => window.postMessage({ source: 'ytsync-ext', cfg }, '*');

  // initial config + re-push whenever the popup changes it
  chrome.storage.sync.get(DEFAULTS, push);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    chrome.storage.sync.get(DEFAULTS, push);
  });

  // YouTube is a SPA — re-push on soft navigations so a freshly-loaded player gets config
  document.addEventListener('yt-navigate-finish', () => chrome.storage.sync.get(DEFAULTS, push));
})();
