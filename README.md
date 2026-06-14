# Unicode Guard

Unicode Guard is a Chrome extension that helps detect suspicious Unicode in links and page text.

It is focused on Latin-alphabet users and flags common phishing patterns such as:

- Cyrillic, Greek and Armenian homoglyphs that resemble Latin letters.
- Risky Latin lookalikes inside domains, such as `ⅼ`, `ı`, `ł`, `ɑ` or `ꞵ`.
- Invisible characters such as soft hyphen, zero-width space and word joiner.
- Bidi direction controls.
- Mixed-script domains.
- Punycode domains that decode to suspicious Unicode.

## Greek compatibility

The option **Include Greek characters in detection** is enabled by default. This is safer for Latin-alphabet users.

Users who regularly read Greek text or visit legitimate Greek IDN domains can disable it. Mixed Latin+Greek domains are still treated as suspicious.

## Privacy

The analysis runs locally in the browser. Unicode Guard does not send browsing data to external servers.

## Permissions

- `storage`: save extension options and temporary allow-list decisions.
- `activeTab`: inspect/reload the current tab from the popup after the user opens the extension.
- `webNavigation`: detect top-level navigation to suspicious domains and redirect to the local warning page.
- `http://*/*`, `https://*/*`: scan links and page text on websites.
