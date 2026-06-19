# TravaLive

**[English](README.md)** · [Português](README.pt-BR.md)

[![release](https://img.shields.io/github/v/release/loadez/travalive)](https://github.com/loadez/travalive/releases/latest)
![license](https://img.shields.io/badge/license-GPL--3.0--only-blue)
![manifest](https://img.shields.io/badge/manifest-v3-brightgreen)
![no build](https://img.shields.io/badge/build-none-lightgrey)

Hold a YouTube **live** at a fixed delay so you and your friends stay **frame-synced** — everyone
reacts to the goal at the same instant. Built for World Cup 2026 watch-alongs (Casé TV lives) over Discord.

## Install

**Stores (one-click — pending review):** Chrome Web Store · Firefox Add-ons _(coming soon)_.

**Now (manual):** download the [latest release](https://github.com/loadez/travalive/releases/latest), unzip, and load unpacked:
- **Chrome / Brave / Edge:** `chrome://extensions` → *Developer mode* → *Load unpacked* → the unzipped folder
- **Firefox:** `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → `manifest.json` _(temporary — removed on restart)_

Open a live, click the toolbar icon, set the target delay. Everyone in the group sets the **same number** → synced.

## How it works

YouTube's player already knows how far behind live you are — the same reference for every viewer — so there's no custom clock/NTP:

1. Read the live's latency (fallback: distance from the DVR edge).
2. Nudge `video.playbackRate` (up to **2×** to catch up, down to **0.8×** to ease back) to hold your target.
3. Same target everywhere → same captured frame → **synced**.

It only acts at the **live edge**; scrub back to review a replay and it leaves your playback speed alone. It skips **ads** and normal **VODs**. Optional HUD (top-left): `lat 12.3s → 10s  1.20x  [yt]`.

## Limits

- Can't sit closer to live than the broadcaster's real latency floor — the player can't show frames that haven't arrived yet.
- 2× catch-up sounds chipmunky (pitch-corrected catch-up is on the roadmap).

## Privacy & permissions

No data collection, no servers, no network calls. The only thing stored is your settings (target + toggles), kept locally via `chrome.storage.sync`. The single permission is `storage`; content scripts run only on `youtube.com/watch*` and `/live/*`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). It's vanilla JS — no build step, no dependencies.

## License

[GPL-3.0-only](LICENSE) — GNU General Public License v3.0 only.
