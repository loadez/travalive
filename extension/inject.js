// inject.js — runs in the PAGE's MAIN world so it can reach YouTube's player API
// (getStatsForNerds / movie_player) and set video.playbackRate directly.
// It reads YT's own live latency and nudges playbackRate to hold it at `target`.
(() => {
  'use strict';

  const cfg = { enabled: true, target: 10, hud: true }; // target = seconds behind live; SAME value across friends = synced. hud = show debug overlay

  // tuning
  const TICK = 500;     // control loop period (ms)
  const TOL = 0.4;      // deadband (s) — within this of target, run 1.0x
  const GAIN = 0.30;    // how hard to push per second of error
  const MAXR = 2.0, MINR = 0.8;  // catch-up can be fast (2x); slow-down stays gentle (0.8x) to avoid slow-mo

  // receive config from the isolated content script (storage bridge)
  window.addEventListener('message', (e) => {
    if (e.source === window && e.data && e.data.source === 'ytsync-ext' && e.data.cfg) {
      // validate before trusting — the postMessage bridge is spoofable from page scope
      const inc = e.data.cfg;
      if (typeof inc.enabled === 'boolean') cfg.enabled = inc.enabled;
      if (typeof inc.hud === 'boolean') cfg.hud = inc.hud;
      if (typeof inc.target === 'number' && isFinite(inc.target))
        cfg.target = Math.max(2, Math.min(60, inc.target));
      if (!cfg.enabled) release(lastVideo); // release on disable (without stealing a manual rate)
      paint();
    }
  });

  const getPlayer = () =>
    document.getElementById('movie_player') ||
    document.querySelector('.html5-video-player');

  // YouTube plays ads in the SAME <video> element and marks the player with 'ad-showing'.
  // During an ad the latency reading is meaningless — never control it, let ads play at 1x.
  const isAd = (p) => !!(p && p.classList && p.classList.contains('ad-showing'));

  // YouTube's "Live Latency" stat (stats-for-nerds). Reads ~0 when you are NOT at the live
  // head (scrubbed back into the DVR / the LIVE button is unlit). Used only as an at-head flag.
  function liveLatencySecs(p) {
    try {
      if (p && typeof p.getStatsForNerds === 'function') {
        const s = p.getStatsForNerds() || {};
        if (s.live_latency_secs != null) {
          const n = parseFloat(String(s.live_latency_secs).replace(/[^\d.]/g, ''));
          if (!isNaN(n)) return n;
        }
      }
    } catch (_) {}
    return null;
  }

  // Are we sitting at the live head (LIVE button lit)? Only then do we control speed.
  // Behind the head (user scrubbed back to review) => hands off entirely.
  function atLiveHead(p) {
    // 1) DOM: the LIVE badge carries 'ytp-live-badge-is-livehead' when lit at the edge
    const badge = p && p.querySelector('.ytp-live-badge');
    if (badge && badge.classList.contains('ytp-live-badge-is-livehead')) return true;
    // 2) stats: live_latency_secs ~0 => behind the head; > 0 => at the head
    const lls = liveLatencySecs(p);
    if (lls != null) return lls > 0.05;
    // 3) badge present but not livehead => behind; otherwise can't tell => assume head
    if (badge) return false;
    return true;
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

  // Returns {value, source} of how many seconds behind live we are.
  // 1) raw numeric `lat` (Chrome: getVideoStats().lat — accurate even scrubbed back), else
  // 2) DVR-edge offset (seekable.end - currentTime — plain HTML5, works in every browser).
  // We deliberately do NOT read the "live_latency_secs"/samples label: it reports "0.00s"
  // off-edge (and stale samples), which produced the 0.5x / stuck-2x misbehaviour (esp. Firefox).
  function latency(p, v) {
    for (const getter of ['getVideoStats', 'getStatsForNerds']) {
      try {
        if (p && typeof p[getter] === 'function') {
          const n = parseFloat((p[getter]() || {}).lat);
          if (!isNaN(n) && n > 0 && n < 600) return { value: n, source: 'yt' };
        }
      } catch (_) {}
    }
    // edge offset — distance behind the stream's available edge; same reference for everyone
    const sk = v && v.seekable;
    if (sk && sk.length) {
      const off = sk.end(sk.length - 1) - v.currentTime;
      if (off > 0 && off < 600) return { value: off, source: 'edge' };
    }
    return null;
  }

  // ---- HUD ----
  let hud, lastVideo = null, appliedRate = null; // appliedRate = the rate WE last set (null = none)
  function ensureHud() {
    if (hud) return;
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
      const p = getPlayer();
      const v = document.querySelector('video');
      lastVideo = v;
      const live = !!(v && p && isLive(p, v));
      const head = live && atLiveHead(p);
      // control ONLY at the live head, enabled, playing, not an ad
      if (live && head && cfg.enabled && !v.paused && !isAd(p)) {
        const lat = latency(p, v);
        if (lat) {
          const err = lat.value - cfg.target;          // +ve = too far behind -> speed up
          let rate = 1;
          if (err > TOL) rate = Math.min(MAXR, 1 + err * GAIN);
          else if (err < -TOL) rate = Math.max(MINR, 1 + err * GAIN);
          if (Math.abs(v.playbackRate - rate) > 0.01) v.playbackRate = rate;
          appliedRate = rate;
          hudText = `▶ sync  lat ${lat.value.toFixed(1)}s → ${cfg.target}s  ${rate.toFixed(2)}x  [${lat.source}]`;
        } else {
          hudText = `▶ sync  (no latency signal yet)`;
        }
        if (cfg.hud) { ensureHud(); if (hud) hud.style.display = ''; paint(); }
        else if (hud) hud.style.display = 'none';
      } else {
        // not at the live head (scrubbed back to review), paused, disabled, ad, or VOD:
        // HANDS OFF — release only OUR rate, never the user's manual speed.
        release(v);
        if (live && !head && cfg.enabled && cfg.hud) {
          // live video but behind the head: show we're intentionally idle, not broken
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
