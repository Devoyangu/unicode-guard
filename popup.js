const UG = UnicodeGuardUtils;
const IDS = Object.keys(UG.DEFAULT_SETTINGS);

function msg(key) {
  return chrome.i18n.getMessage(key) || key;
}

function applyI18n() {
  document.documentElement.lang = chrome.i18n.getUILanguage().slice(0, 2) || "en";
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = msg(el.dataset.i18n);
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(UG.DEFAULT_SETTINGS);
  const settings = UG.withDefaults(stored);
  for (const id of IDS) {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(settings[id]);
  }
}

async function saveSetting(id, checked) {
  await chrome.storage.sync.set({ [id]: checked });
  try {
    const tab = await getActiveTab();
    if (tab && tab.id) chrome.tabs.sendMessage(tab.id, { type: "UG_FORCE_RESCAN" });
  } catch (e) {}
}

async function analyzeCurrentTab() {
  const status = document.getElementById("status");
  const tab = await getActiveTab();

  if (!tab || !tab.url || !/^https?:\/\//i.test(tab.url)) {
    status.className = "status";
    status.textContent = msg("popupNotAnalyzable");
    return;
  }

  const settings = UG.withDefaults(await chrome.storage.sync.get(UG.DEFAULT_SETTINGS));
  const parsed = new URL(tab.url);
  const result = UG.analyzeHostname(parsed.hostname, settings);

  if (!result.suspicious) {
    status.className = "status ok";
    status.textContent = msg("popupDomainOk") + "\n" + parsed.hostname;
    return;
  }

  status.className = "status bad";
  status.textContent = [
    msg("popupSuspiciousDomain"),
    result.originalHost,
    "",
    msg("popupUnicodeForm"),
    result.unicodeHost,
    "",
    ...UG.firstIssuesSummary(result.issues, 6)
  ].join("\n");
}

document.addEventListener("DOMContentLoaded", async () => {
  applyI18n();
  await loadSettings();
  await analyzeCurrentTab();

  for (const id of IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("change", () => saveSetting(id, el.checked));
  }

  document.getElementById("reload").addEventListener("click", async () => {
    const tab = await getActiveTab();
    if (tab && tab.id) chrome.tabs.reload(tab.id);
    window.close();
  });
});
