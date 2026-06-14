# Unicode Guard

Unicode Guard is a Chrome extension that helps detect suspicious Unicode characters in links, domains and visible page text.

It is designed mainly for Latin-alphabet users and highlights common visual deception patterns that may be used in phishing, spoofing or misleading links.

## What it detects

Unicode Guard can flag patterns such as:

* Cyrillic, Greek and Armenian homoglyphs that resemble Latin letters.
* Risky Latin lookalikes inside domains, such as `ⅼ`, `ı`, `ł`, `ɑ` or `ꞵ`.
* Invisible or hard-to-see characters, such as soft hyphen, zero-width space and word joiner.
* Bidirectional text controls.
* Mixed-script domains.
* Punycode domains that decode to suspicious Unicode.
* Suspicious Unicode characters inside visible text, links, email-like strings and code blocks.

## Greek compatibility

The option **Include Greek characters in detection** is enabled by default. This is safer for Latin-alphabet users because Greek letters can be used to imitate Latin domains.

Users who regularly read Greek text or visit legitimate Greek IDN domains can disable this option. Mixed Latin+Greek domains are still treated as suspicious.

## Privacy

Unicode Guard works locally in the browser.

It does **not** collect, transmit, sell or share personal data.

The extension does not send page content, browsing history, credentials, form data or personal information to external servers.

User preferences are stored using Chrome extension storage.

## Permissions

Unicode Guard requests the following permissions:

### `storage`

Used to save extension options, such as text highlighting, link highlighting, badges, strict mode, Greek character detection and invisible character detection.

### `activeTab`

Used when the user opens the extension popup. It allows the extension to inspect the current tab URL, show whether the current domain contains suspicious Unicode, manually rescan the tab and reload the page when requested.

### `webNavigation`

Used to detect navigation to suspicious Unicode domains and redirect the user to a local warning page before continuing.

### `http://*/*` and `https://*/*`

Required to analyze visible text and links on web pages, including webmail, forums, search results, social networks and ordinary websites.

Unicode-based deception can appear on any website, so broad host permissions are needed for automatic protection.

The analysis is performed locally in the browser.

## Remote code

Unicode Guard does not use remote code.

All JavaScript, CSS, HTML and other resources are packaged inside the extension.

## Limitations

Unicode Guard is not an antivirus and does not provide complete phishing protection.

It is a visual inspection tool designed to help users notice suspicious Unicode-based tricks before trusting a link, domain, email address or visible text.

Some phishing attacks do not use Unicode. They may rely on spoofed email headers, compromised accounts, malicious attachments, fake login pages or other techniques that are outside the scope of this extension.

## Source availability

Source available for transparency and review.

All rights reserved unless a license is added later.
## Chrome Web Store

Unicode Guard is available on the Chrome Web Store:

[Install Unicode Guard](https://chromewebstore.google.com/detail/unicode-guard/gpdagfbaiclfhcjlhiokhdgehkomlgka)
