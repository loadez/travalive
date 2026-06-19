# TravaLive

A browser extension that **holds a YouTube live stream at a fixed delay behind live** (default 10s),
so a group watching the same stream stays **frame-synced** — everyone reacts to the goal at the same instant.

Built for World Cup 2026 watch-alongs (Casé TV lives on YouTube) over Discord.

## How it works

YouTube's player already knows how far behind live you are (the "Live Latency" in stats-for-nerds),
anchored to the stream's ingestion timeline — the **same authoritative reference for every viewer**.
So we don't need our own clock/NTP:

1. Read YT's live latency (fallback: distance from the DVR live edge).
2. Nudge `video.playbackRate` (up to 2x to catch up, <1x to ease back) to hold it at the target.
3. Everyone sets the **same target** → everyone converges on the same captured frame → synced.

### Architecture
- `inject.js` — runs in the page **MAIN world** (MV3 `world: "MAIN"`) so it can reach
  `movie_player.getStatsForNerds()` and set `playbackRate`. Control loop + on-screen HUD.
- `content.js` — isolated world; bridges `chrome.storage` ⇄ page via `postMessage`.
- `popup.html/js` — toggle + target-delay slider; writes `chrome.storage.sync`.

Only acts on **live** streams (ignores normal VODs). HUD top-left shows: `lat 18.3s → 10s 1.45x [yt]`.

## Limits
- **Can't go below the stream's real latency floor** (set by the broadcaster). If Casé runs Normal
  latency you can't force 10s; with Low/Ultra-low you can.
- Audio is chipmunky during 2x catch-up (v1 leaves it; pitch-fix is a later cut).

## Install (tonight — yourself)
**Chrome/Brave/Edge:** `chrome://extensions` → enable *Developer mode* → *Load unpacked* → pick the `extension/` folder.
**Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → pick `extension/manifest.json` (temporary = until restart).

Open a Casé TV live, click the toolbar icon, set the target, watch the HUD lock on.

## Distribution to friends (fast-follow — non-tech, one-click)
- **Firefox AMO self-distribution** = fast lane: `web-ext sign` → Mozilla signs a private `.xpi` in minutes →
  share a link → one-click install, no public listing, no multi-day review.
- **Chrome Web Store** = one-click "Add" but ~days of review ($5 one-time dev fee). Publish in parallel if friends are Chrome-only.
- Add real icons (16/48/128) before either store submission.

## Roadmap (cut from v1)
- "Host sets target for the room" sync (tiny backend / shared code) instead of everyone typing the same number.
- Pitch-corrected catch-up (Web Audio) so 2x doesn't sound chipmunky.
- Auto-detect the latency floor and clamp the slider to it.

## Privacy
No data collection. No servers, no network requests, no tracking. The only thing stored is your
own settings (target delay + toggles), kept locally via `chrome.storage.sync`. The single
permission is `storage`; the content scripts run only on `youtube.com/watch*` and `/live/*`.

## License
[GPL-3.0-only](LICENSE) — GNU General Public License v3.0 only. Forks/derivatives must stay
open-source under the same license.
