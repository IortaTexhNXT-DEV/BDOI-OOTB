/*
 * PostCSS plugin (build time, wired in craco.config.js): every literal brand colour of the compiled BDOI theme in the
 * application's CSS (component stylesheets, the generated PrimeReact theme, inline SCSS) becomes a CSS custom property
 * with the same colour as its fallback, e.g. `#0072d8` -> `var(--bv-primary, #0072d8)`.
 *
 * So a broker theme saved in Master > System Settings > Theme and Branding (applied at runtime by
 * src/theme/runtime/themeEngine.js) restyles every screen, including the ~1,000 colour literals in screen
 * stylesheets, without touching those files and without a rebuild. With no theme loaded the output looks exactly
 * as before (the fallbacks are the original colours). Declarations of the --bv-* properties themselves are left alone.
 *
 * The same goes for the font: ~1,400 screen rules name the default font ("Nunito", Arial, sans-serif) literally, so a
 * theme with another font (Inter for Toyota Insurance Services) showed two typefaces side by side. Those declarations
 * become `var(--bv-font-family, "Nunito", Arial, sans-serif)`.
 */
const HEX = {
  "#0072d8": "--bv-primary", // CTA Blue
  "#005fb4": "--bv-primary-dark", // CTA hover
  "#004ea8": "--bv-secondary", // Header Blue
  "#e5f5ff": "--bv-primary-050", // Background Blue
  "#eef8ff": "--bv-primary-050",
  "#f5faff": "--bv-table-stripe",
  "#99c1e7": "--bv-field-border", // Text Field Blue
  "#bfdcf2": "--bv-primary-100",
  "#fdb913": "--bv-accent", // Yellow accent
};
const RGBA = [
  [/rgba\(\s*0\s*,\s*114\s*,\s*216\s*,/gi, "rgba(var(--bv-primary-rgb, 0, 114, 216),"],
  [/rgba\(\s*0\s*,\s*78\s*,\s*168\s*,/gi, "rgba(var(--bv-secondary-rgb, 0, 78, 168),"],
];
/**
 * Other blues of older screen stylesheets (#0066cc, #001e60, #1976d2 ...): the brand colour of the default theme in
 * another shade. Saturated blues follow the theme by lightness: dark -> secondary, mid -> primary, very light ->
 * primary tint. Greys, status colours and every other hue are left alone.
 */
// the info severity of the component library (messages, tags, badges) stays semantic
// and the data colours of charts (src/theme/dataviz.json) are not brand colours: a theme never repaints them
const dataViz = require("../src/theme/dataviz.json");
const KEEP = new Set([
  "#3b82f6", "#2563eb", "#1d4ed8", "#0ea5e9", "#0284c7", "#0369a1", "#e0f2fe", "#bae6fd", "#dbeafe", "#eff6ff", "#bfdbfe", "#93c5fd", "#60a5fa",
  ...dataViz.categorical, ...dataViz.sequential, ...dataViz.diverging.below, ...dataViz.diverging.above,
]);

function blueRole(hex) {
  if (KEEP.has(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return null;
  const d = max - min;
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 195 || h > 235 || sat < 0.45 || l >= 0.97) return null; // near-white tints stay neutral
  // --bv-alt-* are set only by a brand theme (themeEngine.js): with the default theme each shade stays as it was
  if (l < 0.28) return "--bv-alt-secondary";
  if (l <= 0.62) return "--bv-alt-primary";
  if (l >= 0.9) return "--bv-alt-primary-050";
  return "--bv-alt-primary-100";
}

// a hex literal that is not already the fallback of a var() and not part of a longer hex value
const HEX_RE = /(?<!var\(--bv-[a-z0-9-]+,\s*)#[0-9a-f]{6}(?![0-9a-f])/gi;

function themeValue(value) {
  let out = value.replace(HEX_RE, (m) => {
    const hex = m.toLowerCase();
    const role = HEX[hex] || blueRole(hex);
    return role ? `var(${role}, ${hex})` : m;
  });
  for (const [re, to] of RGBA) out = out.replace(re, to);
  return out;
}

// a font stack that starts with the default font, not already a var()
const DEFAULT_FONT_RE = /^\s*["']?Nunito["']?\s*(,|$)/i;

function themeFont(value) {
  return DEFAULT_FONT_RE.test(value) ? `var(--bv-font-family, ${value.trim()})` : value;
}

// One pass at the very end (OnceExit), not a Declaration visitor: postcss-preset-env adds a plain-colour fallback
// before every var() declaration, and a visitor would turn that fallback into a var() again, forever.
const plugin = () => ({
  postcssPlugin: "brokerverse-brand-vars",
  OnceExit(root) {
    root.walkDecls((decl) => {
      if (decl.prop.startsWith("--bv-")) return;
      // the name of a @font-face is a name, not a font to theme
      if (decl.prop === "font-family" && decl.parent?.name !== "font-face") {
        const font = themeFont(decl.value);
        if (font !== decl.value) decl.value = font;
        return;
      }
      if (!/#[0-9a-f]{6}|rgba\(/i.test(decl.value)) return;
      const next = themeValue(decl.value);
      if (next !== decl.value) decl.value = next;
    });
  },
});
plugin.postcss = true;
plugin.themeValue = themeValue;
plugin.themeFont = themeFont;
module.exports = plugin;
