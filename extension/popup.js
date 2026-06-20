// popup.js — UI. Enabled + Debug HUD write chrome.storage.sync (content.js relays to the page).
// The delay slider edits the CURRENT STREAM's target when you're on a YouTube video tab
// (per-video, via the content script); otherwise it edits the global default.

// localize any [data-i18n] element from _locales (browser picks en or pt_BR automatically)
for (const el of document.querySelectorAll('[data-i18n]')) {
  const m = chrome.i18n.getMessage(el.dataset.i18n);
  if (m) el.textContent = m;
}

const DEFAULTS = { enabled: true, target: 10, hud: false };
const $enabled = document.getElementById('enabled');
const $hud = document.getElementById('hud');
const $target = document.getElementById('target');
const $val = document.getElementById('val');
const $tLabel = document.getElementById('tLabel');
const $latInfo = document.getElementById('latInfo');

let ctxTab = null, ctxVideoId = null; // set once we know the active tab is a YT video

// friendly label for YouTube's latency mode (informational — steers a sane target)
function latText(c) {
  const key = { NORMAL: 'latNormal', LOW: 'latLow', ULTRALOW: 'latUltralow' }[c];
  const msg = key && chrome.i18n.getMessage(key);
  return msg || (c ? c.toLowerCase() : '');
}

chrome.storage.sync.get(DEFAULTS, (c) => {
  $enabled.checked = c.enabled;
  $hud.checked = c.hud;
  // default until the per-stream context resolves
  $target.value = c.target;
  $val.textContent = c.target;
});

// lock the slider until we know whether this tab is a YT video — otherwise a drag
// during the (async) getctx round-trip would write the global default by mistake
$target.disabled = true;

// ask the active tab's content script what stream we're on + its saved target
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs && tabs[0];
  if (!tab) { $target.disabled = false; return; }
  chrome.tabs.sendMessage(tab.id, { source: 'ytsync-popup', type: 'getctx' }, (resp) => {
    $target.disabled = false;
    if (chrome.runtime.lastError || !resp || !resp.videoId) return; // not a YT video tab → stay in default mode
    ctxTab = tab.id;
    ctxVideoId = resp.videoId;
    const t = resp.perTarget != null ? resp.perTarget : resp.defaultTarget;
    $target.value = t;
    $val.textContent = t;
    const lbl = chrome.i18n.getMessage('streamDelay');
    if (lbl) $tLabel.textContent = lbl;
    if (resp.latencyClass) {
      const label = chrome.i18n.getMessage('latClassLabel') || 'This live';
      $latInfo.textContent = `${label}: ${latText(resp.latencyClass)}`;
      $latInfo.hidden = false;
    }
  });
});

$enabled.addEventListener('change', () => chrome.storage.sync.set({ enabled: $enabled.checked }));
$hud.addEventListener('change', () => chrome.storage.sync.set({ hud: $hud.checked }));

$target.addEventListener('input', () => {
  const t = Number($target.value);
  $val.textContent = t;
  if (ctxVideoId && ctxTab != null) {
    chrome.tabs.sendMessage(ctxTab, { source: 'ytsync-popup', type: 'settarget', target: t, videoId: ctxVideoId });
  } else {
    chrome.storage.sync.set({ target: t }); // not on a stream → edit the global default
  }
});
