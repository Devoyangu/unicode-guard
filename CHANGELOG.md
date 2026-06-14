# Changelog

## 0.3.4
- Shortened localized manifest descriptions to comply with Chrome Web Store limits.
- Store build keeps file:// access disabled.


## 0.3.3
- Store build without file:// access.
- Content script now handles Chrome "Extension context invalidated" after extension reload/update without throwing console errors.

## 0.3.1
- Developer build keeps `file:///*` support for local testing.
- Content scripts now run in all frames.
- Added support for `about:blank`, `srcdoc`, `blob:` and similar embedded frames when Chrome can attribute them to the parent page origin.
- This improves detection inside embedded previews such as ChatGPT file previews, although sandboxed frames may still prevent injection in some cases.

## 0.3.0

- Added generated extension icons.
- Prepared a Chrome Web Store friendly build with `manifest.json` at ZIP root.
- Removed `file:///*` from the store build.
- Reduced web accessible resources.
- Added optional Greek compatibility setting, enabled by default for safer detection.
- Added detection for additional risky Latin lookalikes such as `ⅼ`, `ı`, `ł`, `ɑ`, `ꞵ`, small-cap Latin letters and Roman numeral characters.
- Added more Cyrillic, Greek and Armenian homoglyph checks.
- Cleaned old highlights/badges when settings change.
- Restored original link titles when links are no longer suspicious.
- Reduced periodic rescanning frequency.

## 0.3.2

- Scans text inside `code` and `pre` blocks so Unicode homograph examples shown in ChatGPT, email clients, documentation pages and test pages are highlighted.
- Keeps iframe/file-access test behaviour from 0.3.1.
