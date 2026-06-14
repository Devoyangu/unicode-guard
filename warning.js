function msg(key) {
  return chrome.i18n.getMessage(key) || key;
}

function applyI18n() {
  document.documentElement.lang = chrome.i18n.getUILanguage().slice(0, 2) || "en";
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = msg(el.dataset.i18n);
  });
}

function param(name) {
  return new URLSearchParams(location.search).get(name) || "";
}

applyI18n();

const originalUrl = param("url");
document.getElementById("url").textContent = originalUrl;
document.getElementById("host").textContent = param("host");
document.getElementById("unicodeHost").textContent = param("unicodeHost");

let issues = [];
try {
  issues = JSON.parse(param("issues") || "[]");
} catch (e) {
  issues = [];
}

const ul = document.getElementById("issues");
if (issues.length === 0) {
  const li = document.createElement("li");
  li.textContent = msg("warningGenericReason");
  ul.appendChild(li);
} else {
  for (const issue of issues) {
    const li = document.createElement("li");
    li.textContent = issue;
    ul.appendChild(li);
  }
}

document.getElementById("back").addEventListener("click", () => {
  if (history.length > 1) history.back();
  else window.close();
});

document.getElementById("continue").addEventListener("click", async () => {
  if (!originalUrl) return;
  chrome.runtime.sendMessage({ type: "UG_ADD_BYPASS", url: originalUrl }, () => {
    location.href = originalUrl;
  });
});
