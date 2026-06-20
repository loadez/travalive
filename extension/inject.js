// inject.js — runs in the PAGE's MAIN world so it can reach YouTube's player API
// (getStatsForNerds / movie_player) and set video.playbackRate directly.
// It reads YT's own live latency and nudges playbackRate to hold it at the effective target.
(() => {
  'use strict';

  // cfg.target = the GLOBAL DEFAULT delay. The EFFECTIVE target is per-video: a
  // stream-specific override (set from the popup) wins when present, because different
  // lives have different latency floors (football ~7s vs a low-latency stream ~3s).
  // hud is a DEBUG overlay — off by default.
  const cfg = { enabled: true, target: 10, hud: false };

  let curVid = null;        // YouTube videoId of the player we're controlling
  let perVidTarget = null;  // override for curVid (s), or null = use cfg.target (the default)
  let latClass = null;      // stream latency mode (NORMAL/LOW/ULTRALOW) — informs the popup
  const effTarget = () => (perVidTarget != null ? perVidTarget : cfg.target);
  const clampTgt = (n) => Math.max(1, Math.min(60, n));

  // tuning
  const TICK = 500;     // control loop period (ms)
  const TOL = 0.4;      // deadband (s) — within this of target, run 1.0x
  const GAIN = 0.30;    // how hard to push per second of error
  const MAXR = 2.0, MINR = 0.8;  // catch-up can be fast (2x); slow-down stays gentle (0.8x) to avoid slow-mo

  // current videoId from the URL (watch?v=ID or /live/ID); null if not on a video page
  function videoId() {
    try {
      const u = new URL(location.href);
      if (u.pathname.startsWith('/live/')) return u.pathname.split('/')[2] || null;
      return u.searchParams.get('v');
    } catch (_) { return null; }
  }

  // ask the isolated content script (it owns chrome.storage) for this video's saved target
  const reqTarget = (vid) => window.postMessage({ source: 'ytsync-ext-page', type: 'get', videoId: vid }, '*');
  // tell content the stream's latency mode so the popup can show it (NORMAL/LOW/ULTRALOW)
  const sendStatus = () => window.postMessage({ source: 'ytsync-ext-page', type: 'status', videoId: curVid, latencyClass: latClass }, '*');

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== 'ytsync-ext') return;
    // global config (enabled / hud / default target)
    if (e.data.cfg) {
      const inc = e.data.cfg;
      if (typeof inc.enabled === 'boolean') cfg.enabled = inc.enabled;
      if (typeof inc.hud === 'boolean') cfg.hud = inc.hud;
      if (typeof inc.target === 'number' && isFinite(inc.target)) cfg.target = clampTgt(inc.target);
      if (!cfg.enabled) release(lastVideo); // release on disable (without stealing a manual rate)
      paint();
    }
    // per-video target (from a get reply or a live popup change) — only for the video we're on
    if (e.data.perVideo && e.data.perVideo.videoId === curVid) {
      const t = e.data.perVideo.target;
      perVidTarget = (typeof t === 'number' && isFinite(t)) ? clampTgt(t) : null;
      paint();
    }
  });

  const getPlayer = () =>
    document.getElementById('movie_player') ||
    document.querySelector('.html5-video-player');

  // YouTube plays ads in the SAME <video> element and marks the player with 'ad-showing'.
  // During an ad the latency reading is meaningless — never control it, let ads play at 1x.
  const isAd = (p) => !!(p && p.classList && p.classList.contains('ad-showing'));

  // THE signal: YouTube's "Live Latency" (stats-for-nerds, live_latency_secs).
  // It is the real seconds-behind-live WHILE you're at the live head, and YouTube
  // zeroes it the moment you scrub off the head (LIVE button unlit). So one field
  // gives BOTH: the at-head gate (>0 => control, ~0/absent => hands off) AND the
  // latency value to hold. Same field on every viewer/browser => same reference =>
  // actually synced. We only sync inside YouTube's own "live" window (no backend/NTP).
  function liveLatency(p) {
    try {
      if (p && typeof p.getStatsForNerds === 'function') {
        const s = p.getStatsForNerds() || {};
        if (s.live_latency_secs != null) {
          const n = parseFloat(String(s.live_latency_secs).replace(/[^\d.]/g, ''));
          if (!isNaN(n) && n >= 0 && n < 600) return n;
        }
      }
    } catch (_) {}
    return null; // no signal => treat as off-head => hands off
  }

  // YouTube's latency mode for this stream (NORMAL / LOW / ULTRALOW). A stream property,
  // same for every viewer — purely informational (shown in the popup), never auto-controls.
  // NOTE: it lives in getVideoStats().latency_class (a clean enum), NOT in getStatsForNerds()
  // (which only has live_mode, a human-readable string).
  function latencyClass(p) {
    try {
      if (p && typeof p.getVideoStats === 'function') {
        const s = p.getVideoStats() || {};
        if (s.latency_class) return String(s.latency_class).toUpperCase();
      }
    } catch (_) {}
    return null;
  }

  // Release control WITHOUT stealing the user's manual speed: only undo a non-1 rate we set
  // and that the user hasn't changed since.
  function release(v) {
    if (v && appliedRate != null &&
        Math.abs(v.playbackRate - appliedRate) < 0.01 && Math.abs(appliedRate - 1) > 0.01) {
      v.playbackRate = 1;
    }
    appliedRate = null;
  }

  // duration===Infinity is the strongest live signal; otherwise check THIS player only
  // (never a global document query — a live badge elsewhere on the page must not count).
  const isLive = (p, v) =>
    (v && v.duration === Infinity) ||
    (p && p.classList && p.classList.contains('ytp-live')) ||
    (p && !!p.querySelector('.ytp-live-badge'));

  // ---- HUD (DEBUG overlay only — display, never a control surface) ----
  let hud, lastVideo = null, appliedRate = null; // appliedRate = the rate WE last set (null = none)
  function ensureHud() {
    if (hud && hud.isConnected) return; // recreate if YT's SPA re-render detached it
    hud = document.createElement('div');
    Object.assign(hud.style, {
      position: 'fixed', top: '10px', left: '10px', zIndex: 2147483647,
      background: 'rgba(0,0,0,.80)', color: '#39ff14',
      font: '12px/1.45 ui-monospace,Menlo,Consolas,monospace',
      padding: '4px 8px', borderRadius: '5px', pointerEvents: 'none',
      whiteSpace: 'pre', letterSpacing: '.3px'
    });
    (document.body || document.documentElement).appendChild(hud);
  }
  let hudText = '';
  function paint() { if (hud) hud.textContent = hudText; }

  // ---- control loop ----
  function loop() {
    try {
      // track the current video; when it changes, drop the old override and fetch this one's
      const vid = videoId();
      if (vid !== curVid) { curVid = vid; perVidTarget = null; latClass = null; if (vid) reqTarget(vid); }

      const p = getPlayer();
      // surface the stream's latency mode to the popup (only on change)
      const lc = latencyClass(p);
      if (lc !== latClass) { latClass = lc; sendStatus(); }
      // scope the video to THIS player — never a global query (sidebar previews,
      // miniplayer and ads are other <video> elements that must not be touched).
      const v = p ? (p.querySelector('video.html5-main-video') || p.querySelector('video')) : null;
      lastVideo = v;
      const live = !!(v && p && isLive(p, v));
      const lls = live ? liveLatency(p) : null;   // null / ~0 => off the live head
      const atHead = lls != null && lls > 0.05;
      // control ONLY at the live head, enabled, playing, not an ad
      if (live && atHead && cfg.enabled && !v.paused && !isAd(p)) {
        const err = lls - effTarget();             // +ve = too far behind -> speed up
        let rate = 1;
        if (err > TOL) rate = Math.min(MAXR, 1 + err * GAIN);
        else if (err < -TOL) rate = Math.max(MINR, 1 + err * GAIN);
        if (Math.abs(v.playbackRate - rate) > 0.01) v.playbackRate = rate;
        appliedRate = rate;
        hudText = `▶ sync  lat ${lls.toFixed(1)}s → ${effTarget()}s  ${rate.toFixed(2)}x`;
        if (cfg.hud) { ensureHud(); if (hud) hud.style.display = ''; paint(); }
        else if (hud) hud.style.display = 'none';
      } else {
        // off the live head (scrubbed back to review), paused, disabled, ad, or VOD:
        // HANDS OFF — release only OUR rate, never the user's manual speed.
        release(v);
        if (live && !atHead && cfg.enabled && !isAd(p) && cfg.hud) {
          // live stream but behind the head: show we're intentionally idle, not broken
          ensureHud();
          hudText = `⏸ behind live — hands off (your speed). Click LIVE to sync.`;
          if (hud) hud.style.display = '';
          paint();
        } else if (hud) {
          hud.style.display = 'none';
        }
      }
    } catch (_) {}
    setTimeout(loop, TICK);
  }
  loop();
})();
