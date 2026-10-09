/**
 * Colours of charts and status marks, from the active theme. Chart.js draws on a canvas, so it cannot read the CSS
 * custom properties itself: the colours are read from <html> (set by runtime/themeEngine.js, :root defaults of
 * bdoi/tokens.scss otherwise) and handed to the chart as data.
 *
 * A series palette is the brand's own: the primary colour, its tints and the accent (once). Status colours (success,
 * warning, danger) are the shared status tokens and are used only where a series means a status.
 *
 *   const theme = useChartTheme();
 *   datasets: [{ data, backgroundColor: theme.series(data.length) }]
 */
import { useMemo } from "react";
import { useBranding } from "./runtime/BrandingProvider";
import { isHex, mix, rgbOf } from "./runtime/themeEngine";
import { statusSeverity } from "../utils/statusSeverity";

const DEFAULTS = {
  primary: "#0072d8", secondary: "#004ea8", accent: "#fdb913",
  success: "#1d7f4e", warning: "#8a5a00", danger: "#b42318",
  text: "#4b4b4b", muted: "#656565", grid: "#e4e4e4", surface: "#ffffff",
};

/** Tint weights (towards white) of the primary colour, in the order the series take them; the accent comes third. */
const TINTS = [0, 0.45, null, 0.7, 0.25, 0.85, 0.58, 0.35, 0.78];

const read = (style, name, fallback) => {
  const v = style ? style.getPropertyValue(name).trim() : "";
  return isHex(v) ? v.toLowerCase() : fallback;
};

/** rgba() of a #rrggbb colour. */
export const withAlpha = (hex, alpha) => `rgba(${(rgbOf(hex) || [0, 0, 0]).join(", ")}, ${alpha})`;

/** The theme colours for charts, read from the document (the defaults without one). */
export function chartColors(root = typeof document !== "undefined" ? document.documentElement : null) {
  const style = root && typeof getComputedStyle === "function" ? getComputedStyle(root) : null;
  return {
    primary: read(style, "--bv-primary", DEFAULTS.primary),
    secondary: read(style, "--bv-secondary", DEFAULTS.secondary),
    accent: read(style, "--bv-accent", DEFAULTS.accent),
    success: read(style, "--color-success", DEFAULTS.success),
    warning: read(style, "--color-warning", DEFAULTS.warning),
    danger: read(style, "--color-danger", DEFAULTS.danger),
    text: read(style, "--color-text", DEFAULTS.text),
    muted: read(style, "--color-text-muted", DEFAULTS.muted),
    grid: read(style, "--color-border", DEFAULTS.grid),
    surface: DEFAULTS.surface,
  };
}

/** n series colours: the primary, its tints and the accent once; repeats after nine. */
export function seriesColors(colors, n) {
  return Array.from({ length: Math.max(0, n) }, (_, i) => {
    const w = TINTS[i % TINTS.length];
    return w === null ? colors.accent : mix(colors.primary, "#ffffff", w);
  });
}

/** Colour of a status for a chart series: success / warning / danger tokens, a primary tint for anything else. */
export function statusColor(colors, severity) {
  if (severity === "success" || severity === "warning" || severity === "danger") return colors[severity];
  if (severity === "secondary") return mix(colors.primary, "#ffffff", 0.7);
  return colors.primary;
}

/**
 * Colours of a series of status values (a status chart): the status colour of each (utils/statusSeverity), a lighter
 * shade of it for a second status of the same kind so that neighbouring slices stay apart.
 */
export function statusSeries(colors, statuses) {
  const used = {};
  return statuses.map((s) => {
    const base = statusColor(colors, statusSeverity(s));
    used[base] = (used[base] || 0) + 1;
    return used[base] === 1 ? base : mix(base, "#ffffff", Math.min(0.75, 0.3 * (used[base] - 1)));
  });
}

/** Chart.js options of the axes and legend in the theme's neutral greys, merged into `options`. */
export function themedOptions(colors, options = {}) {
  const scales = Object.fromEntries(Object.entries(options.scales || {}).map(([k, s]) => [k, {
    ...s,
    ticks: { color: colors.muted, ...(s.ticks || {}) },
    grid: { color: colors.grid, ...(s.grid || {}) },
  }]));
  const legend = options.plugins?.legend || {};
  return {
    ...options,
    ...(options.scales ? { scales } : {}),
    plugins: { ...(options.plugins || {}), legend: { ...legend, labels: { color: colors.text, ...(legend.labels || {}) } } },
  };
}

/**
 * The chart colours of the current theme, refreshed when the branding changes (the first paint of a dashboard can
 * come before the theme has loaded). Adds `series(n)`, `status(severity)`, `statuses(values)`, `alpha(hex, a)` and
 * `options(o)`.
 */
export function useChartTheme() {
  const { branding } = useBranding();
  return useMemo(() => {
    const colors = chartColors();
    return {
      ...colors,
      series: (n) => seriesColors(colors, n),
      status: (severity) => statusColor(colors, severity),
      statuses: (values) => statusSeries(colors, values),
      alpha: withAlpha,
      options: (o) => themedOptions(colors, o),
    };
  }, [branding]); // eslint-disable-line react-hooks/exhaustive-deps
}
