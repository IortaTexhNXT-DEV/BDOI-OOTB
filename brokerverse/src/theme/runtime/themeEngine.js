/**
 * Runtime theme engine (broker branding). A theme is data (setting branding.theme, served by GET /api/branding); the
 * engine turns it into CSS custom properties on <html>. The compiled stylesheets read those properties
 * (src/theme/bdoi/tokens.scss, and every literal brand colour through scripts/postcss-brand-vars.js), so a saved
 * theme restyles every screen without a rebuild. With no theme the :root defaults (iorta TechNXT) apply.
 *
 * Status colours (success, warning, danger) are not themed.
 */

export const DEFAULT_COLORS = {
  primary: "#0072d8", primaryDark: "#005fb4", primaryText: "#ffffff", primaryLight: "#e5f5ff", secondary: "#004ea8", accent: "#fdb913",
  headerBg: "#ffffff", headerText: "#2e2e2e", sidebarBg: "#ffffff", sidebarText: "#004ea8", sidebarActiveBg: "#e5f5ff", sidebarActiveText: "#004ea8",
  tableHeaderBg: "#004ea8", tableHeaderText: "#ffffff", buttonBg: "#0072d8", buttonText: "#ffffff", buttonHoverBg: "#005fb4",
  link: "#0072d8", focusRing: "#0072d8", fieldBorder: "#99c1e7", pageBg: "#f6f6f6", headingText: "#2e2e2e",
};
export const DEFAULT_FONT_STACK = '"Nunito", Arial, sans-serif';
const GOOGLE_FONTS = /^https:\/\/fonts\.googleapis\.com\/css2\?[A-Za-z0-9+:;=&%@._-]+$/;

const HEX = /^#([0-9a-f]{6})$/i;
export const isHex = (v) => HEX.test(String(v || "").trim());

/** "#0072d8" -> [0, 114, 216] (null when not a #rrggbb colour). */
export function rgbOf(hex) {
  const m = HEX.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** Mix two colours: weight 0 = a, 1 = b. */
export function mix(a, b, weight) {
  const x = rgbOf(a);
  const y = rgbOf(b);
  if (!x || !y) return a;
  return toHex(x.map((v, i) => v + (y[i] - v) * weight));
}

/** WCAG 2.1 relative luminance and contrast ratio (same rules as the server, modules/branding/contrast.js). */
export function luminance(hex) {
  const rgb = rgbOf(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const px = (v, fallback) => `${Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v) : fallback}px`;

/**
 * CSS custom properties of a theme ({ colors, layout, radius, logo, preset }) and its font stack. Missing values fall
 * back to the default theme.
 */
export function themeToCssVars(theme = {}, { fontStack } = {}) {
  const c = { ...DEFAULT_COLORS, ...Object.fromEntries(Object.entries(theme.colors || {}).filter(([, v]) => isHex(v))) };
  const layout = theme.layout || {};
  const radius = theme.radius || {};
  const logo = theme.logo || {};
  const rgb = (hex) => (rgbOf(hex) || [0, 0, 0]).join(", ");
  const compact = layout.density === "compact";
  const darkTableHead = (luminance(c.tableHeaderBg) ?? 0) < 0.4;
  const brandTheme = theme.preset && theme.preset !== "iorta-technxt";
  return {
    "--bv-primary": c.primary,
    "--bv-primary-rgb": rgb(c.primary),
    "--bv-primary-dark": c.primaryDark,
    "--bv-primary-text": c.primaryText,
    "--bv-primary-050": c.primaryLight,
    "--bv-primary-100": brandTheme ? mix(c.primary, "#ffffff", 0.75) : "#bfdcf2",
    "--bv-secondary": c.secondary,
    "--bv-secondary-rgb": rgb(c.secondary),
    "--bv-accent": c.accent,
    "--bv-header-bg": c.headerBg,
    "--bv-header-text": c.headerText,
    "--bv-sidebar-bg": c.sidebarBg,
    "--bv-sidebar-text": c.sidebarText,
    "--bv-sidebar-muted": brandTheme ? mix(c.sidebarText, c.sidebarBg, 0.3) : "#656565",
    "--bv-sidebar-sub-text": brandTheme ? mix(c.sidebarText, c.sidebarBg, 0.12) : "#4b4b4b",
    "--bv-sidebar-active-bg": c.sidebarActiveBg,
    "--bv-sidebar-active-text": c.sidebarActiveText,
    "--bv-sidebar-hover-bg": brandTheme ? mix(c.sidebarBg, c.sidebarText, 0.07) : "#f6f6f6",
    "--bv-sidebar-rule": brandTheme ? mix(c.sidebarBg, c.sidebarText, 0.15) : "#e4e4e4",
    "--bv-sidebar-marker": brandTheme ? c.accent : c.primary,
    "--bv-marker": brandTheme ? c.accent : c.primary,
    "--bv-table-header-bg": c.tableHeaderBg,
    "--bv-table-header-text": c.tableHeaderText,
    "--bv-table-header-rule": darkTableHead ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.08)",
    "--bv-table-stripe": brandTheme ? mix(c.primaryLight, "#ffffff", 0.5) : "#f5faff",
    "--bv-button-bg": c.buttonBg,
    "--bv-button-text": c.buttonText,
    "--bv-button-hover-bg": c.buttonHoverBg,
    "--bv-link": c.link,
    "--bv-focus-ring": `rgba(${rgb(c.focusRing)}, 0.35)`,
    "--bv-focus-color": c.focusRing,
    "--bv-field-border": c.fieldBorder,
    "--bv-page-bg": c.pageBg,
    "--bv-heading-text": c.headingText,
    "--bv-font-family": fontStack || DEFAULT_FONT_STACK,
    "--bv-radius-sm": px(radius.sm, 8),
    "--bv-radius-md": px(radius.md, 12),
    "--bv-radius-lg": px(radius.lg, 16),
    "--bv-radius-button": px(radius.button ?? radius.sm, 8),
    "--bv-logo-app-height": px(logo.appHeight, 36),
    "--bv-logo-login-height": px(logo.loginHeight, 56),
    "--bv-row-height": compact ? "36px" : "44px",
    "--bv-cell-pad-y": compact ? "6px" : "10px",
  };
}

/** Load a Google Fonts stylesheet (only https://fonts.googleapis.com/css2?...); one link element, replaced on change. */
export function loadFontStylesheet(url, doc = document) {
  const id = "bv-theme-font";
  const existing = doc.getElementById(id);
  if (!url || !GOOGLE_FONTS.test(url)) {
    if (existing) existing.remove();
    return false;
  }
  if (existing && existing.getAttribute("href") === url) return true;
  const link = existing || doc.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = url;
  if (!existing) doc.head.appendChild(link);
  return true;
}

/**
 * Apply a branding payload (GET /api/branding: { theme, fontStack, fontUrl, faviconUrl }) to the document: CSS custom
 * properties and data attributes (density, header and side bar style) on <html>, the font stylesheet and the favicon.
 * Returns the variables set.
 */
export function applyBranding(branding, root = typeof document !== "undefined" ? document.documentElement : null) {
  if (!root || !branding) return {};
  const theme = branding.theme || {};
  const vars = themeToCssVars(theme, { fontStack: branding.fontStack });
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  // the other blues of older stylesheets (scripts/postcss-brand-vars.js) follow a brand theme; the default keeps them
  const alt = { "--bv-alt-primary": vars["--bv-primary"], "--bv-alt-secondary": vars["--bv-secondary"], "--bv-alt-primary-050": vars["--bv-primary-050"], "--bv-alt-primary-100": vars["--bv-primary-100"] };
  const brand = theme.preset && theme.preset !== "iorta-technxt";
  for (const [k, v] of Object.entries(alt)) {
    if (brand) root.style.setProperty(k, v);
    else root.style.removeProperty(k);
  }
  const layout = theme.layout || {};
  root.setAttribute("data-bv-density", layout.density || "comfortable");
  root.setAttribute("data-bv-header", layout.headerStyle || "light");
  root.setAttribute("data-bv-sidebar", layout.sidebarStyle || "light");
  root.setAttribute("data-bv-theme", theme.preset || "iorta-technxt");
  const doc = root.ownerDocument || document;
  loadFontStylesheet(branding.fontUrl, doc);
  if (branding.faviconUrl) {
    let link = doc.querySelector("link[rel='icon']");
    if (!link) {
      link = doc.createElement("link");
      link.rel = "icon";
      doc.head.appendChild(link);
    }
    if (link.getAttribute("href") !== branding.faviconUrl) link.href = branding.faviconUrl;
  }
  return vars;
}

/** Inline style object with a theme's variables, for previews (applied to one element, not the page). */
export function previewStyle(theme, fontStack) {
  return themeToCssVars(theme, { fontStack });
}
