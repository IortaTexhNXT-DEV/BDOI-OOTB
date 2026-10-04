/**
 * WCAG 2.1 contrast of a theme. Text on the primary colour (buttons), on the header and on the table header must reach
 * AA for normal text (4.5:1): a theme that fails one of these is refused. The other pairs (side bar, links, document
 * colours) give a warning the administrator can accept.
 */
export const AA_NORMAL = 4.5;

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const isHex = (v) => HEX.test(String(v || '').trim());

/** '#abc' / '#aabbcc' -> '#aabbcc' (lower case); null when not a hex colour. */
export function normHex(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!HEX.test(s)) return null;
  return s.length === 4 ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}` : s;
}

export function rgbOf(hex) {
  const h = normHex(hex);
  if (!h) return null;
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance (WCAG 2.1). */
export function luminance(hex) {
  const rgb = rgbOf(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio of two colours, 1..21 (rounded to 2 decimals). */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/**
 * Contrast checks of a resolved theme: [{ key, label, fg, bg, ratio, required, ok, blocking }]. `blocking` checks
 * refuse the theme when they fail; the others warn.
 */
export function contrastChecks(theme) {
  const c = theme.colors || {};
  const d = theme.documents || {};
  const docAccent = d.accentColor || d.tableHeaderBg || c.secondary;
  const pairs = [
    ['buttonText', 'Button text on button colour', c.buttonText, c.buttonBg, true],
    ['primaryText', 'Text on the primary colour', c.primaryText, c.primary, true],
    ['buttonHover', 'Button text on button hover colour', c.buttonText, c.buttonHoverBg, true],
    ['headerText', 'Header text on header background', c.headerText, c.headerBg, true],
    ['tableHeaderText', 'Table header text on table header background', c.tableHeaderText, c.tableHeaderBg, true],
    ['sidebarText', 'Side bar text on side bar background', c.sidebarText, c.sidebarBg, false],
    ['sidebarActiveText', 'Active menu item text on its background', c.sidebarActiveText, c.sidebarActiveBg, false],
    ['link', 'Links on white cards', c.link, '#ffffff', false],
    ['headingText', 'Page headings on the page background', c.headingText, c.pageBg, false],
    ['emailHeader', 'E-mail header text', theme.email?.headerText, theme.email?.headerBg, false],
    ['docTableHeader', 'Document table header text', d.tableHeaderText || '#ffffff', d.tableHeaderBg || docAccent, true],
    ['docHeading', 'Document section headings', d.headingColor || docAccent, d.headingBg || '#ffffff', false],
  ];
  return pairs.filter(([, , fg, bg]) => isHex(fg) && isHex(bg)).map(([key, label, fg, bg, blocking]) => {
    const ratio = contrastRatio(fg, bg);
    return { key, label, fg: normHex(fg), bg: normHex(bg), ratio, required: AA_NORMAL, ok: ratio >= AA_NORMAL, blocking };
  });
}

/** A darker shade of a colour that reaches `target` contrast on `bg` (for "use a darker red for text on white"). */
export function darkenFor(hex, bg = '#ffffff', target = AA_NORMAL) {
  let rgb = rgbOf(hex);
  if (!rgb) return null;
  for (let i = 0; i < 60; i += 1) {
    const h = `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    if (contrastRatio(h, bg) >= target) return h;
    rgb = rgb.map((v) => Math.max(0, Math.floor(v * 0.95)));
  }
  return '#000000';
}
