importScripts("unicode_utils.js");

const UG = UnicodeGuardUtils;
const BYPASS_TTL_MS = 30 * 60 * 1000;

async function getSettings() {
  const stored = await chrome.storage.sync.get(UG.DEFAULT_SETTINGS);
  return UG.withDefaults(stored);
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(Object.keys(UG.DEFAULT_SETTINGS));
  const initial = {};
  for (const [key, value] of Object.entries(UG.DEFAULT_SETTINGS)) {
    if (existing[key] === undefined) initial[key] = value;
  }
  if (Object.keys(initial).length > 0) {
    await chrome.storage.sync.set(initial);
  }
});

async function getBypassHosts() {
  const data = await chrome.storage.local.get({ bypassHosts: {} });
  return data.bypassHosts || {};
}

async function isBypassed(hostname) {
  const bypassHosts = await getBypassHosts();
  const until = bypassHosts[hostname];
  if (!until) return false;
  if (Date.now() > until) {
    delete bypassHosts[hostname];
    await chrome.storage.local.set({ bypassHosts });
    return false;
  }
  return true;
}

async function addBypass(hostname) {
  const bypassHosts = await getBypassHosts();
  bypassHosts[hostname] = Date.now() + BYPASS_TTL_MS;
  await chrome.storage.local.set({ bypassHosts });
}

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

async function maybeBlockNavigation(details) {
  if (details.frameId !== 0 || details.tabId < 0 || !isHttpUrl(details.url)) return;

  let parsed;
  try {
    parsed = new URL(details.url);
  } catch (e) {
    return;
  }

  const settings = await getSettings();
  if (!settings.enabled || !settings.blockSuspiciousDomains) return;
  if (await isBypassed(parsed.hostname)) return;

  const result = UG.analyzeHostname(parsed.hostname, settings);
  if (!result.suspicious) return;

  const params = new URLSearchParams({
    url: details.url,
    host: result.originalHost,
    unicodeHost: result.unicodeHost,
    issues: JSON.stringify(UG.firstIssuesSummary(result.issues, 12))
  });

  const warningUrl = chrome.runtime.getURL("warning.html") + "?" + params.toString();

  try {
    await chrome.tabs.update(details.tabId, { url: warningUrl });
  } catch (e) {
    // La pestaña puede haberse cerrado o cambiado.
  }
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  maybeBlockNavigation(details);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message && message.type === "UG_ADD_BYPASS" && message.url) {
      const parsed = new URL(message.url);
      await addBypass(parsed.hostname);
      sendResponse({ ok: true });
      return;
    }

    if (message && message.type === "UG_ANALYZE_URL" && message.url) {
      const settings = await getSettings();
      const parsed = new URL(message.url);
      const result = UG.analyzeHostname(parsed.hostname, settings);
      sendResponse({ ok: true, result });
      return;
    }

    sendResponse({ ok: false });
  })().catch(error => sendResponse({ ok: false, error: String(error) }));

  return true;
});
