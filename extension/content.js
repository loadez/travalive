// content.js — runs in the ISOLATED world. Bridges chrome.storage <-> the MAIN-world
// inject.js (via window.postMessage) AND serves the popup (via chrome.runtime messages).
// inject.js can't touch chrome.*; the popup can't touch the page — content.js is the hub.
(() => {
  'use strict';
  const DEFAULTS = { enabled: true, target: 10, hud: false }; // target = the GLOBAL default; hud = debug overlay (off by default)
  const clamp = (n) => Math.max(1, Math.min(60, n));

  // videoId of THIS page (content scripts share the page's location)
  const vid = () => {
    try {
      const u = new URL(location.href);
      if (u.pathname.startsWith('/live/')) return u.pathname.split('/')[2] || null;
      return u.searchParams.get('v');
    } catch (_) { return null; }
  };

  const pushCfg = (cfg) => window.postMessage({ source: 'ytsync-ext', cfg }, '*');
  const pushPer = (videoId, target) => window.postMessage({ source: 'ytsync-ext', perVideo: { videoId, target } }, '*');

  // global config -> page, on load / popup change / SPA navigation
  chrome.storage.sync.get(DEFAULTS, pushCfg);
  chrome.storage.onChanged.addListener((c, area) => { if (area === 'sync') chrome.storage.sync.get(DEFAULTS, pushCfg); });
  document.addEventListener('yt-navigate-finish', () => chrome.storage.sync.get(DEFAULTS, pushCfg));

  // latest latency mode reported by inject.js (for the popup); { videoId, latencyClass }
  let status = { videoId: null, latencyClass: null };

  // messages FROM inject.js (MAIN world): per-video target gets + latency-mode status.
  // Per-video targets live in storage.local (not sync — unbounded entries, sync caps ~512).
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data;
    if (!d || d.source !== 'ytsync-ext-page') return;
    if (d.type === 'get' && d.videoId) {
      chrome.storage.local.get('tgt:' + d.videoId, (o) => {
        const t = o['tgt:' + d.videoId];
        pushPer(d.videoId, typeof t === 'number' ? t : null);
      });
    } else if (d.type === 'status') {
      status = { videoId: d.videoId || null, latencyClass: d.latencyClass || null };
    }
  });

  // popup <-> content: report context (current videoId + targets) and set the stream's target.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.source !== 'ytsync-popup') return;
    if (msg.type === 'getctx') {
      const videoId = vid();
      const latencyClass = status.videoId === videoId ? status.latencyClass : null;
      chrome.storage.sync.get(DEFAULTS, (s) => {
        if (!videoId) return sendResponse({ videoId: null, perTarget: null, defaultTarget: s.target, latencyClass: null });
        chrome.storage.local.get('tgt:' + videoId, (o) => {
          const p = o['tgt:' + videoId];
          sendResponse({ videoId, perTarget: typeof p === 'number' ? p : null, defaultTarget: s.target, latencyClass });
        });
      });
      return true; // async sendResponse
    }
    if (msg.type === 'settarget' && typeof msg.target === 'number' && isFinite(msg.target)) {
      const t = clamp(msg.target);
      const videoId = vid();
      // drop a stale write: the popup's stream must still be the tab's current stream
      if (msg.videoId && msg.videoId !== videoId) { sendResponse({ ok: false, stale: true }); return true; }
      if (videoId) {
        chrome.storage.local.set({ ['tgt:' + videoId]: t });
        pushPer(videoId, t); // live-update the page immediately (no reload needed)
      }
      sendResponse({ ok: true, videoId });
      return true;
    }
  });
})();
