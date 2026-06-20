// content.js — runs in the ISOLATED world. Bridges chrome.storage <-> the MAIN-world
// inject.js via window.postMessage (inject.js can't touch chrome.* APIs).
(() => {
  'use strict';
  const DEFAULTS = { enabled: true, target: 10, hud: true }; // target = the GLOBAL default delay

  const push = (cfg) => window.postMessage({ source: 'ytsync-ext', cfg }, '*');

  // initial config + re-push whenever the popup changes it
  chrome.storage.sync.get(DEFAULTS, push);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    chrome.storage.sync.get(DEFAULTS, push);
  });

  // YouTube is a SPA — re-push on soft navigations so a freshly-loaded player gets config
  document.addEventListener('yt-navigate-finish', () => chrome.storage.sync.get(DEFAULTS, push));

  // Per-stream target: inject.js (MAIN world) asks us to read/write tgt:<videoId>.
  // Kept in storage.local (not sync) — per-video entries are unbounded and sync caps at ~512 items.
  const clamp = (n) => Math.max(2, Math.min(60, n));
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== 'ytsync-ext-page' || !d.videoId) return;
    const key = 'tgt:' + d.videoId;
    if (d.type === 'get') {
      chrome.storage.local.get(key, (o) => {
        const t = o[key];
        window.postMessage({ source: 'ytsync-ext', perVideo: { videoId: d.videoId, target: typeof t === 'number' ? t : null } }, '*');
      });
    } else if (d.type === 'set' && typeof d.target === 'number' && isFinite(d.target)) {
      chrome.storage.local.set({ [key]: clamp(d.target) });
    }
  });
})();
