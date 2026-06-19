# Contributing to TravaLive

Thanks for helping! TravaLive is **vanilla JS — no build step, no dependencies**. What you see in
`extension/` is exactly what ships. (PT-BR contributions/issues welcome too.)

## Dev setup

1. Clone the repo.
2. Load `extension/` unpacked (see [README](README.md) → Install → manual).
3. Edit files in `extension/`, then hit *reload* on the extension to see changes.

## Architecture — three contexts, don't collapse them

- **`extension/inject.js`** — runs in the page **MAIN world**. The only place that can reach the YouTube
  player API (`getVideoStats()` / `getStatsForNerds()`) and set `video.playbackRate`. Control loop + HUD. No `chrome.*`.
- **`extension/content.js`** — isolated world. The only place with `chrome.storage`. Bridges config to the page via `postMessage`.
- **`extension/popup.{html,js}`** — UI; writes `chrome.storage.sync`. Never talks to tabs directly.

Message contract (keep `source` stable): `{ source: 'ytsync-ext', cfg: { enabled, target, hud } }`.

## Invariants (please don't break)

- Act only on a **live** at the **live head**. Never touch normal VODs, ads, or a speed the **user** set manually.
- On disable / leaving the head, release **only the rate we set** — never clobber the user's playback speed.
- YouTube is an SPA — re-query player/video each tick.
- Control tuning (deadband `TOL`, gain, rate clamps, tick) lives at the top of `inject.js`.

## Testing

No automated harness. Walk [TESTING.md](TESTING.md) in **both** Chrome and Firefox before opening a PR.

## Commits & PRs

- **Conventional Commits**, single-line header: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:` …
- Keep it **dependency-free and loadable unpacked with zero tooling**.
- In the PR, say which browser(s) and which TESTING.md scenarios you checked.

## License

By contributing, you agree your contributions are licensed under **GPL-3.0-only**.
