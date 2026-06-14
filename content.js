(() => {
  "use strict";

  const UG = UnicodeGuardUtils;
  let settings = UG.withDefaults();
  let scanTimer = null;
  let periodicTimer = null;
  let alreadyScanning = false;
  let lastFullScanAt = 0;
  let listenersInstalled = false;
  let extensionContextAlive = true;
  let mutationObserver = null;

  function isExtensionContextAlive() {
    if (!extensionContextAlive) return false;
    try {
      return typeof chrome !== "undefined" && !!chrome.runtime && !!chrome.runtime.id;
    } catch (e) {
      extensionContextAlive = false;
      return false;
    }
  }

  function isContextInvalidatedError(e) {
    return !!(e && String(e.message || e).includes("Extension context invalidated"));
  }

  function deactivateAfterContextInvalidated() {
    extensionContextAlive = false;
    if (scanTimer) { clearTimeout(scanTimer); scanTimer = null; }
    if (periodicTimer) { clearInterval(periodicTimer); periodicTimer = null; }
    try { if (mutationObserver) mutationObserver.disconnect(); } catch (e) {}
  }

  function safeChromeMessage(key, fallback = "") {
    if (!isExtensionContextAlive()) return fallback;
    try {
      return chrome.i18n.getMessage(key) || fallback;
    } catch (e) {
      if (isContextInvalidatedError(e)) deactivateAfterContextInvalidated();
      return fallback;
    }
  }

  function safeExtensionUrl(path) {
    if (!isExtensionContextAlive()) return null;
    try {
      return chrome.runtime.getURL(path);
    } catch (e) {
      if (isContextInvalidatedError(e)) deactivateAfterContextInvalidated();
      return null;
    }
  }

  const SKIP_TAGS = new Set([
    "SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION",
    "CANVAS", "SVG"
  ]);

  // Do not skip CODE/PRE: ChatGPT and many mail/web UIs render suspicious examples inside code blocks.
  // Wrapping individual characters in spans keeps the visible text inspectable.
  function shouldSkipNode(node) {
    if (!node || !node.parentElement) return true;
    const parent = node.parentElement;
    if (SKIP_TAGS.has(parent.tagName)) return true;
    if (parent.closest("[data-unicode-guard='1']")) return true;
    if (parent.isContentEditable) return true;
    return false;
  }

  function issueTitle(issue) {
    return `${safeChromeMessage("contentCharPrefix", "Unicode Guard")}: ${issue.code} — ${issue.reason}`;
  }

  function createMark(ch, issue) {
    const span = document.createElement("span");
    span.dataset.unicodeGuard = "1";
    span.dataset.ugOriginal = ch;
    span.className = "unicode-guard-mark";
    span.dataset.ugCode = issue.code;
    span.dataset.ugType = issue.type || "";
    span.dataset.ugSeverity = issue.severity || "medium";
    span.title = issueTitle(issue);
    span.textContent = issue.type === "control" ? UG.visibleControlToken(issue.cp) : ch;
    return span;
  }

  function unwrapMark(span) {
    const original = span.dataset.ugOriginal !== undefined ? span.dataset.ugOriginal : span.textContent;
    const text = document.createTextNode(original);
    const parent = span.parentNode;
    span.replaceWith(text);
    if (parent && parent.normalize) parent.normalize();
  }

  function cleanupTextMarks(root) {
    const queryRoot = root && root.querySelectorAll ? root : document;
    const marks = queryRoot.querySelectorAll(".unicode-guard-mark[data-unicode-guard='1']");
    for (const span of marks) unwrapMark(span);
  }

  function restoreLink(a) {
    a.classList.remove("unicode-guard-link-warning");
    a.querySelectorAll(":scope > .unicode-guard-badge[data-unicode-guard='1']").forEach(b => b.remove());
    if (Object.prototype.hasOwnProperty.call(a.dataset, "unicodeGuardOriginalTitle")) {
      const originalTitle = a.dataset.unicodeGuardOriginalTitle;
      if (originalTitle) a.setAttribute("title", originalTitle);
      else a.removeAttribute("title");
      delete a.dataset.unicodeGuardOriginalTitle;
    }
    delete a.dataset.unicodeGuardLinkCheckedHref;
  }

  function cleanupLinks(root, removeBadgesOnly = false) {
    const queryRoot = root && root.querySelectorAll ? root : document;
    const badges = queryRoot.querySelectorAll(".unicode-guard-badge[data-unicode-guard='1']");
    for (const badge of badges) badge.remove();
    if (removeBadgesOnly) return;
    const links = queryRoot.querySelectorAll("a.unicode-guard-link-warning, area.unicode-guard-link-warning");
    for (const a of links) restoreLink(a);
  }

  function clearLinkScanCache(root) {
    const queryRoot = root && root.querySelectorAll ? root : document;
    queryRoot.querySelectorAll("a[data-unicode-guard-link-checked-href], area[data-unicode-guard-link-checked-href]").forEach(a => {
      delete a.dataset.unicodeGuardLinkCheckedHref;
    });
  }

  function cleanupAll() {
    cleanupTextMarks(document);
    cleanupLinks(document);
    clearLinkScanCache(document);
  }

  function isLatinLikeChar(ch) {
    return /[A-Za-z0-9]/.test(ch) || UG.isAllowedLatinExtra(ch) || UG.isLatinConfusable(ch);
  }

  function looksLikeSensitiveToken(text, index) {
    const left = text.slice(Math.max(0, index - 64), index);
    const right = text.slice(index + 1, Math.min(text.length, index + 65));
    const around = left + "•" + right;
    if (/@/.test(around)) return true;
    if (/\bhttps?:\/\/|\bwww\./i.test(around)) return true;
    if (/[A-Za-z0-9][A-Za-z0-9._-]*•[A-Za-z0-9._-]*\.[A-Za-z]{2,}/.test(around)) return true;
    const prev = [...left].pop() || "";
    const next = [...right][0] || "";
    if (isLatinLikeChar(prev) && isLatinLikeChar(next)) return true;
    return false;
  }

  function charIssueForTextContext(ch, text, index) {
    const cp = ch.codePointAt(0);
    const sensitive = looksLikeSensitiveToken(text, index);

    if (
      settings.highlightInvisible &&
      UG.isSoftFormatControl &&
      UG.isSoftFormatControl(cp) &&
      !settings.markFormatControlsEverywhere &&
      !settings.strictMode
    ) {
      if (!sensitive) return null;
      return {
        char: ch, cp, code: UG.codePointHex(cp), type: "control", severity: "medium",
        reason: UG.controlLabel(cp) + " dentro de dominio/email/URL o palabra latina"
      };
    }

    const contextSettings = Object.assign({}, settings);
    if (sensitive) {
      contextSettings.forceLatinConfusables = true;
      contextSettings.forceGreekCharacters = true;
    }
    return UG.charIssue(ch, contextSettings);
  }

  function processTextNode(node) {
    if (shouldSkipNode(node)) return;
    const text = node.nodeValue;
    if (!text || text.length === 0 || !/[^\x00-\x7F]/.test(text)) return;

    let hasIssue = false;
    let idx = 0;
    for (const ch of text) {
      if (charIssueForTextContext(ch, text, idx)) { hasIssue = true; break; }
      idx += ch.length;
    }
    if (!hasIssue) return;

    const frag = document.createDocumentFragment();
    let buffer = "";
    function flushBuffer() {
      if (buffer) { frag.appendChild(document.createTextNode(buffer)); buffer = ""; }
    }

    idx = 0;
    for (const ch of text) {
      const issue = charIssueForTextContext(ch, text, idx);
      if (issue) { flushBuffer(); frag.appendChild(createMark(ch, issue)); }
      else buffer += ch;
      idx += ch.length;
    }
    flushBuffer();
    node.parentNode.replaceChild(frag, node);
  }

  function scanText(root) {
    if (!settings.highlightPageText) return;
    const walkerRoot = root && root.nodeType === Node.DOCUMENT_NODE ? (document.body || document.documentElement) : (root || document.body || document.documentElement);
    if (!walkerRoot) return;

    const walker = document.createTreeWalker(walkerRoot, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !/[^\x00-\x7F]/.test(node.nodeValue)) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    const MAX_TEXT_NODES_PER_PASS = 1200;
    while (walker.nextNode() && nodes.length < MAX_TEXT_NODES_PER_PASS) nodes.push(walker.currentNode);
    for (const node of nodes) processTextNode(node);
  }

  function makeWarningUrl(originalUrl, result) {
    const baseUrl = safeExtensionUrl("warning.html");
    if (!baseUrl) return null;
    const params = new URLSearchParams({
      url: originalUrl,
      host: result.originalHost || "",
      unicodeHost: result.unicodeHost || "",
      issues: JSON.stringify(UG.firstIssuesSummary(result.issues || [], 12))
    });
    return baseUrl + "?" + params.toString();
  }

  function linkWarningTitle(result, href) {
    const lines = [
      safeChromeMessage("contentLinkWarning", "Unicode Guard: link with suspicious domain"),
      `${safeChromeMessage("contentUrl", "URL")}: ${href}`,
      `${safeChromeMessage("contentDomain", "Domain")}: ${result.originalHost}`,
      `${safeChromeMessage("contentUnicodeDomain", "Unicode domain")}: ${result.unicodeHost}`,
      "",
      ...UG.firstIssuesSummary(result.issues, 8)
    ];
    return lines.join("\n");
  }

  function analyzeAnchor(a) {
    const rawHref = a.getAttribute("href") || "";
    const normalizedHref = a.href || rawHref;
    const rawResult = UG.analyzeUrlText(rawHref, settings, document.baseURI);
    if (rawResult.suspicious) return { result: rawResult, hrefForDisplay: rawHref, targetUrl: normalizedHref || rawHref, rawSuspicious: true };
    try {
      const parsed = new URL(normalizedHref, document.baseURI);
      if (!/^https?:$/i.test(parsed.protocol)) return { result: { suspicious: false }, hrefForDisplay: normalizedHref, targetUrl: normalizedHref };
      const normalizedResult = UG.analyzeHostname(parsed.hostname, settings);
      return { result: normalizedResult, hrefForDisplay: normalizedHref, targetUrl: normalizedHref, rawSuspicious: false };
    } catch (e) {
      return { result: { suspicious: false }, hrefForDisplay: rawHref, targetUrl: normalizedHref || rawHref };
    }
  }

  function markLink(a, result, hrefForDisplay) {
    if (!Object.prototype.hasOwnProperty.call(a.dataset, "unicodeGuardOriginalTitle")) {
      a.dataset.unicodeGuardOriginalTitle = a.getAttribute("title") || "";
    }
    a.classList.add("unicode-guard-link-warning");
    const title = linkWarningTitle(result, hrefForDisplay);
    a.title = title;
    if (!settings.showBadges || a.tagName !== "A") {
      a.querySelectorAll(":scope > .unicode-guard-badge[data-unicode-guard='1']").forEach(b => b.remove());
      return;
    }
    let badge = a.querySelector(":scope > .unicode-guard-badge[data-unicode-guard='1']");
    if (!badge) {
      badge = document.createElement("span");
      badge.dataset.unicodeGuard = "1";
      badge.className = "unicode-guard-badge";
      badge.textContent = safeChromeMessage("linkBadge", "Unicode");
      a.appendChild(badge);
    }
    badge.title = title;
  }

  function scanLinks(root) {
    if (!settings.highlightLinks) return;
    const queryRoot = root && (root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE) ? root : document;
    const links = queryRoot.querySelectorAll ? queryRoot.querySelectorAll("a[href], area[href]") : [];
    const settingKey = [settings.strictMode, settings.includeGreekCharacters, settings.showBadges].join("|");

    for (const a of links) {
      const rawHref = a.getAttribute("href") || "";
      const currentKey = rawHref + " || " + (a.href || "") + " || " + settingKey;
      if (a.dataset.unicodeGuardLinkCheckedHref === currentKey) continue;
      a.dataset.unicodeGuardLinkCheckedHref = currentKey;

      const analysis = analyzeAnchor(a);
      if (!analysis.result || !analysis.result.suspicious) { restoreLink(a); continue; }
      markLink(a, analysis.result, analysis.hrefForDisplay);
    }
  }

  function interceptSuspiciousClick(event) {
    if (!settings.enabled || !settings.highlightLinks) return;
    const a = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!a) return;
    const analysis = analyzeAnchor(a);
    if (!analysis.result || !analysis.result.suspicious) return;
    event.preventDefault();
    event.stopPropagation();
    const rawHref = a.getAttribute("href") || analysis.targetUrl || "";
    const targetUrl = (() => {
      try { return new URL(rawHref, document.baseURI).href; }
      catch (e) { return analysis.targetUrl || rawHref; }
    })();
    const warningUrl = makeWarningUrl(targetUrl, analysis.result);
    if (warningUrl) location.href = warningUrl;
  }

  function scanPage(root, forceFull = false) {
    if (!isExtensionContextAlive()) { deactivateAfterContextInvalidated(); return; }
    if (alreadyScanning) return;
    if (!settings.enabled) { cleanupAll(); return; }
    const now = Date.now();
    if (forceFull && now - lastFullScanAt < 350) return;
    if (forceFull) lastFullScanAt = now;
    const target = root || document.body || document.documentElement;
    if (!target) return;

    alreadyScanning = true;
    try {
      if (!settings.highlightPageText) cleanupTextMarks(target);
      else scanText(target);

      if (!settings.highlightLinks) cleanupLinks(target);
      else {
        if (!settings.showBadges) cleanupLinks(target, true);
        scanLinks(target);
      }
    } finally { alreadyScanning = false; }
  }

  function scheduleScan(root, delay = 250, forceFull = false) {
    if (!isExtensionContextAlive()) { deactivateAfterContextInvalidated(); return; }
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => scanPage(root || document.body || document.documentElement, forceFull), delay);
  }

  function scheduleStartupScans() {
    if (!isExtensionContextAlive()) return;
    const delays = [0, 250, 750, 1500, 3000, 6000, 10000];
    for (const delay of delays) setTimeout(() => scanPage(document.body || document.documentElement, true), delay);
  }

  function startPeriodicDynamicRescan() {
    if (periodicTimer) clearInterval(periodicTimer);
    periodicTimer = setInterval(() => {
      if (!isExtensionContextAlive()) { deactivateAfterContextInvalidated(); return; }
      if (!settings.enabled || document.hidden) return;
      if (!settings.highlightPageText && !settings.highlightLinks) return;
      scanPage(document.body || document.documentElement, true);
    }, 12000);
  }

  async function loadSettings() {
    if (!isExtensionContextAlive()) { settings = UG.withDefaults(); return; }
    try { settings = UG.withDefaults(await chrome.storage.sync.get(UG.DEFAULT_SETTINGS)); }
    catch (e) {
      if (isContextInvalidatedError(e)) deactivateAfterContextInvalidated();
      settings = UG.withDefaults();
    }
  }

  function installListenersOnce() {
    if (listenersInstalled) return;
    listenersInstalled = true;
    document.addEventListener("click", interceptSuspiciousClick, true);
    document.addEventListener("auxclick", interceptSuspiciousClick, true);
    window.addEventListener("load", () => scheduleScan(document.body || document.documentElement, 1000, true), { once: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleScan(document.body || document.documentElement, 250, true); });
    window.addEventListener("focus", () => scheduleScan(document.body || document.documentElement, 400, true));

    let scrollDebounce = null;
    window.addEventListener("scroll", () => {
      if (scrollDebounce) clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(() => scanPage(document.body || document.documentElement, true), 500);
    }, { passive: true, capture: true });

    mutationObserver = new MutationObserver((mutations) => {
      if (!settings.enabled) return;
      let bestRoot = null;
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const node of mutation.addedNodes) {
            if (!node) continue;
            if (node.nodeType === Node.TEXT_NODE && node.parentElement) { bestRoot = node.parentElement; break; }
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.dataset && node.dataset.unicodeGuard === "1") continue;
              if (node.closest && node.closest("[data-unicode-guard='1']")) continue;
              bestRoot = node; break;
            }
          }
        } else if (mutation.type === "characterData") {
          bestRoot = mutation.target.parentElement || document.body || document.documentElement;
        }
        if (bestRoot) break;
      }
      if (bestRoot) scheduleScan(bestRoot, 160, false);
    });
    const observerRoot = document.documentElement || document.body;
    if (observerRoot) mutationObserver.observe(observerRoot, { subtree: true, childList: true, characterData: true });

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (!isExtensionContextAlive()) { deactivateAfterContextInvalidated(); return; }
        if (area !== "sync") return;
        for (const key of Object.keys(changes)) settings[key] = changes[key].newValue;
        settings = UG.withDefaults(settings);
        cleanupAll();
        startPeriodicDynamicRescan();
        scheduleScan(document.body || document.documentElement, 100, true);
      });
    } catch (e) {
      if (isContextInvalidatedError(e)) deactivateAfterContextInvalidated();
    }

    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!isExtensionContextAlive()) { deactivateAfterContextInvalidated(); return false; }
        if (message && message.type === "UG_FORCE_RESCAN") {
          cleanupAll();
          scheduleScan(document.body || document.documentElement, 50, true);
          sendResponse({ ok: true });
          return true;
        }
        return false;
      });
    } catch (e) {
      if (isContextInvalidatedError(e)) deactivateAfterContextInvalidated();
    }
  }

  async function init() {
    if (!isExtensionContextAlive()) return;
    await loadSettings();
    if (!isExtensionContextAlive()) return;
    installListenersOnce();
    if (!settings.enabled) { cleanupAll(); return; }
    scheduleStartupScans();
    startPeriodicDynamicRescan();
  }

  init();
})();
