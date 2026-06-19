# TravaLive — manual test guide

No automated harness (vanilla MV3, no build). Load unpacked and walk these scenarios.
Watch the green **HUD** (top-left). HUD line format:
`▶ sync  lat <X>s → <target>s  <rate>x  [<src>]`  ·  `src` = `yt` (raw lat) or `edge` (DVR offset).

## Load it
- **Chrome/Brave/Chromium:** `chrome://extensions` → dev mode → Load unpacked → `extension/`
- **Firefox:** `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `extension/manifest.json`

---

## Core control — at the live head

| # | Action | Expected |
|---|--------|----------|
| 1 | Open a YouTube **live**, enabled on | HUD shows, `lat` ≈ real latency, rate slews then settles. `[yt]` on Chrome, `[edge]` on Firefox. |
| 2 | Let it sit at the live edge (LIVE button lit) | Rate locks near **1.00x** once `lat` ≈ target. |
| 3 | Latency drifts above target (network hiccup) | Speeds up toward **2.0x** to catch back, then settles. |
| 4 | Latency below target | Slows **gently** (down to 0.8x max), never a 0.5x slam. |

## Hands-off — behind the live head (THE important one)

| # | Action | Expected |
|---|--------|----------|
| 5 | **Scrub back** into the DVR (LIVE button goes unlit) | HUD switches to `⏸ behind live — hands off (your speed)`. Rate is **NOT** touched. |
| 6 | While scrubbed back, set playback **0.5x** (slow-mo a replay) | Extension leaves it at **0.5x**. It must never force 1x or fight you. |
| 7 | Click **LIVE** to return to the head | Control resumes; rate goes back to syncing toward target. |

## Never-touch — VODs & ads

| # | Action | Expected |
|---|--------|----------|
| 8 | Open a **normal VOD** (not live) | Extension does nothing. Rate stays at whatever you set; HUD hidden. |
| 9 | Set a VOD to 1.5x manually | Stays 1.5x — never overridden. |
| 10 | An **ad** plays on a live | No 2x; ad plays at 1.0x; HUD hidden/idle during the ad. |

## Lifecycle

| # | Action | Expected |
|---|--------|----------|
| 11 | Toggle **Enabled** off while syncing | Our rate releases to 1.0x (but a manual rate you set is left alone). |
| 12 | Toggle **Debug HUD** off | HUD hides; **syncing continues** silently. |
| 13 | Change **Target delay** in the popup | New target takes effect within ~1s; rate re-slews. |
| 14 | SPA nav: live → another live | Re-attaches and syncs the new player. |
| 15 | Leave a live → open a VOD | Rate returns to 1.0x (our rate released), VOD untouched after. |

## i18n
- Browser language PT-BR → popup reads *Ativado / HUD de debug / Atraso alvo / feito por loadez*.
- Other languages → English.

---

### If something's off
Open the live's console and capture the at-head vs scrubbed-back state:
```js
const p = document.getElementById('movie_player');
console.log({
  livehead: !!p.querySelector('.ytp-live-badge.ytp-live-badge-is-livehead'),
  live_latency_secs: p.getStatsForNerds().live_latency_secs,
  lat: p.getVideoStats?.().lat,
  rate: document.querySelector('video').playbackRate,
});
```
Run it **at the live edge** and again **scrubbed back**, and compare.
