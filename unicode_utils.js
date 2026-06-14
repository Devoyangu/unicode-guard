/* Unicode Guard - shared Unicode detection utilities.
   Latin-focused protection against common IDN/homoglyph tricks.
*/
(function (global) {
  "use strict";

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    highlightPageText: true,
    highlightInvisible: true,
    highlightLinks: true,
    blockSuspiciousDomains: true,
    strictMode: false,
    includeGreekCharacters: true,
    showBadges: true,
    markFormatControlsEverywhere: false
  });

  // Explicitly allowed European Latin characters. Deliberately conservative:
  // suspicious Latin lookalikes are handled separately, especially in domains/URLs.
  const ALLOWED_LATIN_EXTRA =
    "áéíóúÁÉÍÓÚñÑüÜçÇ" +
    "àèìòùÀÈÌÒÙ" +
    "âêîôûÂÊÎÔÛ" +
    "äëïöÄËÏÖ" +
    "åÅæÆœŒøØß";

  const SAFE_COMMON_SYMBOLS =
    "€£¥¢©®™°ºª·•…–—−“”‘’«»‹›×÷±≤≥≠≈→←↑↓↔✓✔✕✖🚀📱";

  const CONTROL_NAMES = new Map([
    [0x00AD, "SHY / SOFT HYPHEN"],
    [0x034F, "CGJ / COMBINING GRAPHEME JOINER"],
    [0x061C, "ALM / ARABIC LETTER MARK"],
    [0x180E, "MVS / MONGOLIAN VOWEL SEPARATOR"],
    [0x200B, "ZWSP / ZERO WIDTH SPACE"],
    [0x200C, "ZWNJ / ZERO WIDTH NON-JOINER"],
    [0x200D, "ZWJ / ZERO WIDTH JOINER"],
    [0x200E, "LRM / LEFT-TO-RIGHT MARK"],
    [0x200F, "RLM / RIGHT-TO-LEFT MARK"],
    [0x202A, "LRE / LEFT-TO-RIGHT EMBEDDING"],
    [0x202B, "RLE / RIGHT-TO-LEFT EMBEDDING"],
    [0x202C, "PDF / POP DIRECTIONAL FORMATTING"],
    [0x202D, "LRO / LEFT-TO-RIGHT OVERRIDE"],
    [0x202E, "RLO / RIGHT-TO-LEFT OVERRIDE"],
    [0x2060, "WJ / WORD JOINER"],
    [0x2061, "FUNCTION APPLICATION"],
    [0x2062, "INVISIBLE TIMES"],
    [0x2063, "INVISIBLE SEPARATOR"],
    [0x2064, "INVISIBLE PLUS"],
    [0x2066, "LRI / LEFT-TO-RIGHT ISOLATE"],
    [0x2067, "RLI / RIGHT-TO-LEFT ISOLATE"],
    [0x2068, "FSI / FIRST STRONG ISOLATE"],
    [0x2069, "PDI / POP DIRECTIONAL ISOLATE"],
    [0x206A, "INHIBIT SYMMETRIC SWAPPING"],
    [0x206B, "ACTIVATE SYMMETRIC SWAPPING"],
    [0x206C, "INHIBIT ARABIC FORM SHAPING"],
    [0x206D, "ACTIVATE ARABIC FORM SHAPING"],
    [0x206E, "NATIONAL DIGIT SHAPES"],
    [0x206F, "NOMINAL DIGIT SHAPES"],
    [0xFEFF, "BOM / ZERO WIDTH NO-BREAK SPACE"]
  ]);

  // Controls that sometimes appear legitimately in Gmail and other web UIs.
  // In normal page text they are marked only in sensitive contexts. In domains/URLs
  // they are always suspicious.
  const SOFT_FORMAT_CONTROLS = new Set([
    0x00AD, 0x034F, 0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF
  ]);

  const BIDI_DANGEROUS_CONTROLS = new Set([
    0x061C, 0x200E, 0x200F,
    0x202A, 0x202B, 0x202C, 0x202D, 0x202E,
    0x2066, 0x2067, 0x2068, 0x2069,
    0x206A, 0x206B, 0x206C, 0x206D, 0x206E, 0x206F
  ]);

  const SCRIPT_TESTS = [
    ["Latin", /\p{Script=Latin}/u],
    ["Cyrillic", /\p{Script=Cyrillic}/u],
    ["Greek", /\p{Script=Greek}/u],
    ["Armenian", /\p{Script=Armenian}/u],
    ["Hebrew", /\p{Script=Hebrew}/u],
    ["Arabic", /\p{Script=Arabic}/u],
    ["Devanagari", /\p{Script=Devanagari}/u],
    ["Han", /\p{Script=Han}/u],
    ["Hiragana", /\p{Script=Hiragana}/u],
    ["Katakana", /\p{Script=Katakana}/u],
    ["Hangul", /\p{Script=Hangul}/u]
  ];

  const CYRILLIC_CONFUSABLES = new Map([
    ["а", "parece 'a' latina, pero es cirílica"], ["е", "parece 'e' latina, pero es cirílica"],
    ["о", "parece 'o' latina, pero es cirílica"], ["р", "parece 'p' latina, pero es cirílica"],
    ["с", "parece 'c' latina, pero es cirílica"], ["х", "parece 'x' latina, pero es cirílica"],
    ["у", "parece 'y' latina, pero es cirílica"], ["ѕ", "parece 's' latina, pero es cirílica"],
    ["і", "parece 'i' latina, pero es cirílica"], ["ј", "parece 'j' latina, pero es cirílica"],
    ["ӏ", "parece 'l' latina, pero es cirílica"], ["ԁ", "parece 'd' latina, pero es cirílica"],
    ["ԛ", "parece 'q' latina, pero es cirílica"], ["ԝ", "parece 'w' latina, pero es cirílica"],
    ["А", "parece 'A' latina, pero es cirílica"], ["В", "parece 'B' latina, pero es cirílica"],
    ["Е", "parece 'E' latina, pero es cirílica"], ["К", "parece 'K' latina, pero es cirílica"],
    ["М", "parece 'M' latina, pero es cirílica"], ["Н", "parece 'H' latina, pero es cirílica"],
    ["О", "parece 'O' latina, pero es cirílica"], ["Р", "parece 'P' latina, pero es cirílica"],
    ["С", "parece 'C' latina, pero es cirílica"], ["Т", "parece 'T' latina, pero es cirílica"],
    ["Х", "parece 'X' latina, pero es cirílica"], ["І", "parece 'I' latina, pero es cirílica"],
    ["Ј", "parece 'J' latina, pero es cirílica"]
  ]);

  const GREEK_CONFUSABLES = new Map([
    ["Α", "parece 'A' latina, pero es griega"], ["Β", "parece 'B' latina, pero es griega"],
    ["Ε", "parece 'E' latina, pero es griega"], ["Ζ", "parece 'Z' latina, pero es griega"],
    ["Η", "parece 'H' latina, pero es griega"], ["Ι", "parece 'I' latina, pero es griega"],
    ["Κ", "parece 'K' latina, pero es griega"], ["Μ", "parece 'M' latina, pero es griega"],
    ["Ν", "parece 'N' latina, pero es griega"], ["Ο", "parece 'O' latina, pero es griega"],
    ["Ρ", "parece 'P' latina, pero es griega"], ["Τ", "parece 'T' latina, pero es griega"],
    ["Υ", "parece 'Y' latina, pero es griega"], ["Χ", "parece 'X' latina, pero es griega"],
    ["α", "parece 'a' latina, pero es griega"], ["β", "parece 'b' latina, pero es griega"],
    ["γ", "puede confundirse visualmente con 'y/g' latina"], ["ε", "parece 'e' latina, pero es griega"],
    ["ι", "parece 'i/l' latina, pero es griega"], ["κ", "parece 'k' latina, pero es griega"],
    ["μ", "parece 'u/m' latina, pero es griega"], ["ν", "parece 'v' latina, pero es griega"],
    ["ο", "parece 'o' latina, pero es griega"], ["ρ", "parece 'p' latina, pero es griega"],
    ["τ", "parece 't' latina, pero es griega"], ["υ", "parece 'u/y' latina, pero es griega"],
    ["χ", "parece 'x' latina, pero es griega"], ["ϲ", "parece 'c' latina, pero es griega"],
    ["ϳ", "parece 'j' latina, pero es griega"]
  ]);

  const ARMENIAN_CONFUSABLES = new Map([
    ["օ", "parece 'o' latina, pero es armenia"], ["ս", "parece 'u' latina, pero es armenia"],
    ["ո", "parece 'n' latina, pero es armenia"], ["հ", "parece 'h' latina, pero es armenia"],
    ["ց", "puede simular letras latinas en dominios"], ["ք", "puede simular letras latinas en dominios"]
  ]);

  // Latin-script characters that are legitimate in some languages but often abused in
  // domains and fake brand names. In normal page text they are only flagged in
  // sensitive contexts unless strict mode is enabled.
  const LATIN_CONFUSABLES = new Map([
    ["ı", "i latina sin punto; puede simular 'i/l'"], ["ȷ", "j latina sin punto; puede simular 'j'"],
    ["ɩ", "letra iota latina; puede simular 'i/l'"], ["ɪ", "I latina pequeña; puede simular 'i/l'"],
    ["Ɩ", "letra iota latina; puede simular 'l/I'"], ["ꞁ", "letra latina parecida a 'l/I'"],
    ["ⅼ", "número romano cincuenta; parece 'l' latina"], ["Ⅰ", "número romano uno; parece 'I' latina"],
    ["Ⅱ", "número romano dos; puede simular 'II'"], ["Ⅲ", "número romano tres; puede simular 'III'"],
    ["Ⅳ", "número romano cuatro; puede simular 'IV'"], ["Ⅴ", "número romano cinco; parece 'V' latina"],
    ["Ⅵ", "número romano seis; puede simular 'VI'"], ["Ⅶ", "número romano siete; puede simular 'VII'"],
    ["Ⅷ", "número romano ocho; puede simular 'VIII'"], ["Ⅸ", "número romano nueve; puede simular 'IX'"],
    ["Ⅹ", "número romano diez; parece 'X' latina"], ["Ⅼ", "número romano cincuenta; parece 'L' latina"],
    ["Ⅽ", "número romano cien; parece 'C' latina"], ["Ⅾ", "número romano quinientos; parece 'D' latina"],
    ["Ⅿ", "número romano mil; parece 'M' latina"],
    ["ɑ", "alfa latina; puede simular 'a'"], ["ɒ", "alfa latina girada; puede simular 'a/o'"],
    ["ɡ", "g latina de una planta; puede simular 'g'"], ["ɢ", "G latina pequeña; puede simular 'G'"],
    ["ʋ", "v latina con gancho; puede simular 'v/u'"], ["ƅ", "letra latina tone six; puede simular 'b'"],
    ["Ƅ", "letra latina tone six mayúscula; puede simular 'b'"], ["ꞵ", "beta latina; puede simular 'b/β'"],
    ["ƿ", "letra wynn; puede simular 'p'"], ["ł", "l latina barrada; puede simular 'l' en dominios"],
    ["ƚ", "l latina barrada; puede simular 'l/t'"], ["ǀ", "letra click; parece barra vertical/l"],
    ["ǁ", "letra click; parece doble barra/l"], ["ǃ", "letra click; parece signo de exclamación"],
    ["ᴀ", "letra latina pequeña; puede simular 'a'"], ["ʙ", "letra latina pequeña; puede simular 'b'"],
    ["ᴄ", "letra latina pequeña; puede simular 'c'"], ["ᴅ", "letra latina pequeña; puede simular 'd'"],
    ["ᴇ", "letra latina pequeña; puede simular 'e'"], ["ꜰ", "letra latina pequeña; puede simular 'f'"],
    ["ʜ", "letra latina pequeña; puede simular 'h'"], ["ᴊ", "letra latina pequeña; puede simular 'j'"],
    ["ᴋ", "letra latina pequeña; puede simular 'k'"], ["ʟ", "letra latina pequeña; puede simular 'l'"],
    ["ᴍ", "letra latina pequeña; puede simular 'm'"], ["ɴ", "letra latina pequeña; puede simular 'n'"],
    ["ᴏ", "letra latina pequeña; puede simular 'o'"], ["ᴘ", "letra latina pequeña; puede simular 'p'"],
    ["ʀ", "letra latina pequeña; puede simular 'r'"], ["ꜱ", "letra latina pequeña; puede simular 's'"],
    ["ᴛ", "letra latina pequeña; puede simular 't'"], ["ᴜ", "letra latina pequeña; puede simular 'u'"],
    ["ᴠ", "letra latina pequeña; puede simular 'v'"], ["ᴡ", "letra latina pequeña; puede simular 'w'"],
    ["ʏ", "letra latina pequeña; puede simular 'y'"], ["ᴢ", "letra latina pequeña; puede simular 'z'"]
  ]);

  function withDefaults(settings) {
    return Object.assign({}, DEFAULT_SETTINGS, settings || {});
  }

  function codePointHex(cp) {
    return "U+" + cp.toString(16).toUpperCase().padStart(4, "0");
  }

  function isAsciiAllowed(ch) {
    const cp = ch.codePointAt(0);
    return cp === 0x09 || cp === 0x0A || cp === 0x0D || (cp >= 0x20 && cp <= 0x7E);
  }

  function isAllowedLatinExtra(ch) { return ALLOWED_LATIN_EXTRA.includes(ch); }
  function isSafeCommonSymbol(ch) { return SAFE_COMMON_SYMBOLS.includes(ch); }
  function isCombiningMark(ch) { return /\p{Mark}/u.test(ch); }
  function isInvisibleOrBidiControl(cp) { return CONTROL_NAMES.has(cp); }
  function isSoftFormatControl(cp) { return SOFT_FORMAT_CONTROLS.has(cp); }
  function isDangerousBidiControl(cp) { return BIDI_DANGEROUS_CONTROLS.has(cp); }
  function controlLabel(cp) { return CONTROL_NAMES.get(cp) || "CONTROL"; }
  function visibleControlToken(cp) { return "⟦" + controlLabel(cp).split(" / ")[0] + "⟧"; }
  function isLatinConfusable(ch) { return LATIN_CONFUSABLES.has(ch); }
  function isGreekConfusable(ch) { return GREEK_CONFUSABLES.has(ch); }

  function getScript(ch) {
    for (const [name, rx] of SCRIPT_TESTS) if (rx.test(ch)) return name;
    if (/\p{Script=Common}/u.test(ch)) return "Common";
    if (/\p{Script=Inherited}/u.test(ch)) return "Inherited";
    return "Other";
  }

  function isLatinScriptLetter(ch) { return /\p{Script=Latin}/u.test(ch) && /\p{Letter}/u.test(ch); }
  function isMathematicalAlphanumeric(cp) { return cp >= 0x1D400 && cp <= 0x1D7FF; }
  function isFullwidthOrHalfwidth(cp) { return cp >= 0xFF00 && cp <= 0xFFEF; }

  function makeControlIssue(ch, cp, reasonSuffix) {
    return {
      char: ch, cp, code: codePointHex(cp), type: "control",
      severity: isDangerousBidiControl(cp) ? "high" : "medium",
      reason: controlLabel(cp) + (reasonSuffix || " invisible/control direccional")
    };
  }

  function makeConfusableIssue(ch, reason, severity) {
    const cp = ch.codePointAt(0);
    return { char: ch, cp, code: codePointHex(cp), type: "confusable", severity: severity || "high", reason };
  }

  function charIssue(ch, rawSettings) {
    const settings = withDefaults(rawSettings);
    const cp = ch.codePointAt(0);

    if (isAsciiAllowed(ch)) return null;
    if (isAllowedLatinExtra(ch)) return null;
    if (isSafeCommonSymbol(ch)) return null;

    if (settings.highlightInvisible && isInvisibleOrBidiControl(cp)) {
      if (isSoftFormatControl(cp) && !settings.markFormatControlsEverywhere && !settings.strictMode) return null;
      return makeControlIssue(ch, cp, " invisible/control direccional");
    }

    if (isMathematicalAlphanumeric(cp)) {
      return { char: ch, cp, code: codePointHex(cp), type: "math", severity: "high", reason: "letra matemática Unicode; puede simular letras latinas" };
    }

    if (isFullwidthOrHalfwidth(cp)) {
      return { char: ch, cp, code: codePointHex(cp), type: "fullwidth", severity: "medium", reason: "forma fullwidth/halfwidth; puede simular texto latino" };
    }

    if (CYRILLIC_CONFUSABLES.has(ch)) return makeConfusableIssue(ch, CYRILLIC_CONFUSABLES.get(ch));
    if (ARMENIAN_CONFUSABLES.has(ch)) return makeConfusableIssue(ch, ARMENIAN_CONFUSABLES.get(ch));

    const script = getScript(ch);

    if (script === "Greek") {
      if (settings.includeGreekCharacters === false && !settings.forceGreekCharacters && !settings.strictMode) return null;
      if (GREEK_CONFUSABLES.has(ch)) return makeConfusableIssue(ch, GREEK_CONFUSABLES.get(ch));
      return { char: ch, cp, code: codePointHex(cp), type: "script", severity: "medium", reason: "carácter de alfabeto Greek dentro de texto latino" };
    }

    if (LATIN_CONFUSABLES.has(ch) && (settings.forceLatinConfusables || settings.strictMode)) {
      return makeConfusableIssue(ch, LATIN_CONFUSABLES.get(ch));
    }

    if (isLatinScriptLetter(ch) && !settings.strictMode) return null;

    if (script === "Cyrillic" || script === "Armenian") {
      return { char: ch, cp, code: codePointHex(cp), type: "script", severity: "medium", reason: "carácter de alfabeto " + script + " dentro de texto latino" };
    }

    if (isCombiningMark(ch)) {
      return { char: ch, cp, code: codePointHex(cp), type: "combining", severity: "medium", reason: "marca combinante Unicode; revisar visualmente" };
    }

    if (settings.strictMode) {
      return { char: ch, cp, code: codePointHex(cp), type: "strict", severity: "low", reason: "Unicode no incluido en la lista permitida" };
    }

    return null;
  }

  function domainCharIssue(ch, rawSettings) {
    const cp = ch.codePointAt(0);
    if (isInvisibleOrBidiControl(cp)) return makeControlIssue(ch, cp, " dentro de dominio/URL");
    return charIssue(ch, Object.assign({}, rawSettings || {}, {
      highlightInvisible: true,
      markFormatControlsEverywhere: true,
      forceLatinConfusables: true
    }));
  }

  function analyzeString(text, rawSettings) {
    const settings = withDefaults(rawSettings);
    const issues = [];
    if (!settings.enabled || !text) return issues;
    for (const ch of text) {
      const issue = charIssue(ch, settings);
      if (issue) issues.push(issue);
    }
    return issues;
  }

  function digitValue(code) {
    if (code >= 48 && code <= 57) return code - 22;
    if (code >= 65 && code <= 90) return code - 65;
    if (code >= 97 && code <= 122) return code - 97;
    return 36;
  }

  function adapt(delta, numPoints, firstTime) {
    const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
    delta = firstTime ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    let k = 0;
    while (delta > Math.floor(((base - tMin) * tMax) / 2)) {
      delta = Math.floor(delta / (base - tMin));
      k += base;
    }
    return k + Math.floor(((base - tMin + 1) * delta) / (delta + skew));
  }

  function decodePunycodeLabel(label) {
    if (!label.toLowerCase().startsWith("xn--")) return label;
    const input = label.slice(4);
    const base = 36, tMin = 1, tMax = 26, initialN = 128, initialBias = 72, delimiter = "-";
    let n = initialN, i = 0, bias = initialBias;
    const output = [];
    let index = 0;
    const basic = input.lastIndexOf(delimiter);
    if (basic > -1) {
      for (let j = 0; j < basic; j++) output.push(input[j]);
      index = basic + 1;
    }
    while (index < input.length) {
      const oldi = i;
      let w = 1;
      for (let k = base; ; k += base) {
        if (index >= input.length) throw new Error("Punycode incompleto");
        const digit = digitValue(input.charCodeAt(index++));
        if (digit >= base) throw new Error("Dígito punycode inválido");
        i += digit * w;
        const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
        if (digit < t) break;
        w *= (base - t);
      }
      const outLen = output.length + 1;
      bias = adapt(i - oldi, outLen, oldi === 0);
      n += Math.floor(i / outLen);
      i %= outLen;
      output.splice(i, 0, String.fromCodePoint(n));
      i++;
    }
    return output.join("");
  }

  function unicodeHostname(hostname) {
    if (!hostname) return "";
    return hostname.replace(/\.$/, "").split(".").map(label => {
      try { return decodePunycodeLabel(label); } catch (e) { return label; }
    }).join(".");
  }

  function scriptsInLabel(label) {
    const scripts = new Set();
    for (const ch of label) {
      if (isAsciiAllowed(ch) && /[A-Za-z]/.test(ch)) { scripts.add("Latin"); continue; }
      if (isAllowedLatinExtra(ch) || LATIN_CONFUSABLES.has(ch)) { scripts.add("Latin"); continue; }
      const cp = ch.codePointAt(0);
      if (isInvisibleOrBidiControl(cp)) continue;
      const script = getScript(ch);
      if (script !== "Common" && script !== "Inherited") scripts.add(script);
    }
    return scripts;
  }

  function analyzeHostname(hostname, rawSettings) {
    const settings = withDefaults(rawSettings);
    const originalHost = (hostname || "").replace(/\.$/, "");
    const decodedHost = unicodeHostname(originalHost);
    const issues = [];
    if (!settings.enabled || !originalHost) return { suspicious: false, originalHost, unicodeHost: decodedHost, issues };

    const labels = decodedHost.split(".");
    for (const label of labels) {
      if (!label) continue;
      for (const ch of label) {
        const issue = domainCharIssue(ch, settings);
        if (issue) issues.push(Object.assign({ label }, issue));
      }

      const scripts = scriptsInLabel(label);
      const hasLatin = scripts.has("Latin");
      const nonLatin = [...scripts].filter(s => s !== "Latin");
      if (hasLatin && nonLatin.length > 0) {
        issues.push({ char: label, cp: 0, code: "MIXED", type: "mixed-script", severity: "high", label, reason: "mezcla latín con " + nonLatin.join(", ") + " en el mismo dominio" });
      } else if (nonLatin.some(s => s === "Cyrillic" || s === "Armenian" || (s === "Greek" && settings.includeGreekCharacters !== false))) {
        issues.push({ char: label, cp: 0, code: "SCRIPT", type: "non-latin-domain", severity: "medium", label, reason: "dominio con alfabeto " + nonLatin.join(", ") });
      }
    }

    return { suspicious: issues.length > 0, originalHost, unicodeHost: decodedHost, issues };
  }

  function extractRawHostnameFromUrlText(urlText, baseHref) {
    if (!urlText) return "";
    let raw = String(urlText).trim();
    raw = raw.replace(/^[<("'“‘]+|[>)"'”’]+$/g, "");
    let hostPart = "";
    const schemeMatch = raw.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^\/?#]+)/);
    if (schemeMatch) {
      hostPart = schemeMatch[1];
    } else if (raw.startsWith("//")) {
      const m = raw.match(/^\/\/([^\/?#]+)/);
      hostPart = m ? m[1] : "";
    } else if (/^[^\s\/?#@]+\.[^\s\/?#]+/.test(raw)) {
      const m = raw.match(/^([^\s\/?#]+)/);
      hostPart = m ? m[1] : "";
    } else {
      try {
        const parsed = new URL(raw, baseHref || global.location?.href || undefined);
        hostPart = parsed.hostname;
      } catch (e) { return ""; }
    }
    const at = hostPart.lastIndexOf("@");
    if (at >= 0) hostPart = hostPart.slice(at + 1);
    if (hostPart.startsWith("[")) {
      const end = hostPart.indexOf("]");
      return end >= 0 ? hostPart.slice(1, end) : hostPart;
    }
    hostPart = hostPart.replace(/:\d+$/, "");
    return hostPart;
  }

  function analyzeUrlText(urlText, rawSettings, baseHref) {
    const rawHost = extractRawHostnameFromUrlText(urlText, baseHref);
    if (!rawHost) return { suspicious: false, originalHost: "", unicodeHost: "", issues: [] };
    return analyzeHostname(rawHost, rawSettings);
  }

  function firstIssuesSummary(issues, maxItems) {
    return issues.slice(0, maxItems || 8).map(issue => {
      const ch = issue.type === "control" ? visibleControlToken(issue.cp) : issue.char;
      return `${ch} ${issue.code}: ${issue.reason}`;
    });
  }

  global.UnicodeGuardUtils = {
    DEFAULT_SETTINGS, ALLOWED_LATIN_EXTRA, SAFE_COMMON_SYMBOLS, CONTROL_NAMES,
    CYRILLIC_CONFUSABLES, GREEK_CONFUSABLES, ARMENIAN_CONFUSABLES, LATIN_CONFUSABLES,
    withDefaults, codePointHex, isAsciiAllowed, isAllowedLatinExtra, isSafeCommonSymbol,
    isLatinScriptLetter, isInvisibleOrBidiControl, isSoftFormatControl, isDangerousBidiControl,
    visibleControlToken, controlLabel, getScript, isLatinConfusable, isGreekConfusable,
    charIssue, domainCharIssue, analyzeString, analyzeHostname, analyzeUrlText,
    extractRawHostnameFromUrlText, unicodeHostname, decodePunycodeLabel, firstIssuesSummary
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
