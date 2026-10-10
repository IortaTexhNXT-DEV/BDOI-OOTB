/**
 * The data colours and the Chart.js look of every chart (docs/developer-guide/dashboards.md). Chart.js draws on a
 * canvas, so it cannot read the CSS custom properties itself: the colours are read from <html> (the --bv-viz-* tokens of
 * bdoi/dataviz.scss, the ink of the brand theme set by runtime/themeEngine.js) and handed to the chart as data. The
 * defaults are those of dataviz.json.
 *
 * One data colour system, whatever the brand:
 *  - categorical: seven validated hues in a fixed order (series 1, 2 ...); an eighth series and beyond fold into the
 *    neutral "other" grey. A business entity (insurer, line of business, channel) keeps its own slot on every chart.
 *  - sequential (magnitude, ordered buckets) and diverging (variance against a target, grey midpoint) ramps.
 *  - status (good / warning / serious / critical) only where a series means a state, always with an icon and a label.
 *  - the brand accent (Toyota red) is not a data colour.
 *
 *   const chart = useChartTheme();
 *   datasets: [{ data, backgroundColor: chart.series(1)[0] }]   // or chart.primary
 *   <Chart options={chart.options({ scales: { y: {} } })} />
 */
import { useMemo } from "react";
import { useBranding } from "./runtime/BrandingProvider";
import { isHex, mix, rgbOf } from "./runtime/themeEngine";
import { statusSeverity } from "../utils/statusSeverity";
import DATA_VIZ from "./dataviz.json";

export const PALETTE = DATA_VIZ;

const read = (style, name, fallback) => {
  const v = style ? style.getPropertyValue(name).trim() : "";
  return isHex(v) ? v.toLowerCase() : fallback;
};

/** rgba() of a #rrggbb colour. */
export const withAlpha = (hex, alpha) => `rgba(${(rgbOf(hex) || [0, 0, 0]).join(", ")}, ${alpha})`;

/** The data colours and the chart ink, read from the document (the dataviz.json values without one). */
export function chartColors(root = typeof document !== "undefined" ? document.documentElement : null) {
  const style = root && typeof getComputedStyle === "function" ? getComputedStyle(root) : null;
  const status = Object.fromEntries(Object.entries(DATA_VIZ.status).map(([k, s]) => [k, read(style, `--bv-viz-${k}`, s.fill)]));
  const statusText = Object.fromEntries(Object.entries(DATA_VIZ.status).map(([k, s]) => [k, read(style, `--bv-viz-${k}-text`, s.text)]));
  const steps = [100, 200, 300, 400, 500, 600, 700];
  const font = style ? style.getPropertyValue("--bv-font-family").trim() : "";
  return {
    categorical: DATA_VIZ.categorical.map((hex, i) => read(style, `--bv-viz-cat-${i + 1}`, hex)),
    other: read(style, "--bv-viz-other", DATA_VIZ.other),
    sequentialRamp: DATA_VIZ.sequential.map((hex, i) => read(style, `--bv-viz-seq-${steps[i]}`, hex)),
    divergingRamp: {
      below: DATA_VIZ.diverging.below.map((hex, i) => read(style, `--bv-viz-div-below-${3 - i}`, hex)),
      midpoint: read(style, "--bv-viz-div-mid", DATA_VIZ.diverging.midpoint),
      above: DATA_VIZ.diverging.above.map((hex, i) => read(style, `--bv-viz-div-above-${i + 1}`, hex)),
    },
    statusFill: status,
    statusText,
    // the ink of the brand theme (Toyota: near-black headings); the greys of the data foundation
    ink: read(style, "--bv-heading-text", DATA_VIZ.ink.primary),
    text: read(style, "--bv-viz-ink-secondary", DATA_VIZ.ink.secondary),
    muted: read(style, "--bv-viz-ink-muted", DATA_VIZ.ink.muted),
    grid: read(style, "--bv-viz-grid", DATA_VIZ.ink.grid),
    axis: read(style, "--bv-viz-axis", DATA_VIZ.ink.axis),
    surface: read(style, "--bv-viz-surface", DATA_VIZ.ink.surface),
    fontFamily: font || '"Nunito", Arial, sans-serif',
  };
}

/** n series colours in the fixed categorical order; the eighth and later series take the "other" grey. */
export function seriesColors(colors, n) {
  return Array.from({ length: Math.max(0, n) }, (_, i) => colors.categorical[i] || colors.other);
}

const ENTITY_RULES = Object.fromEntries(Object.entries(DATA_VIZ.entities).map(([dimension, rules]) => [
  dimension, rules.map(([key, pattern], slot) => ({ key, slot, re: new RegExp(pattern, "i") })),
]));

/** The key and categorical slot of a business entity ("Pioneer Insurance & Surety Corp." -> pioneer, slot 0); null when it has none. */
export function entityOf(dimension, name) {
  const rule = (ENTITY_RULES[dimension] || []).find((r) => r.re.test(String(name || "")));
  return rule ? { key: rule.key, slot: rule.slot } : null;
}

/** The fixed colour of a business entity: the same on every chart; the "other" grey for one outside the list. */
export function entityColor(colors, dimension, name) {
  const e = entityOf(dimension, name);
  return e ? colors.categorical[e.slot] : colors.other;
}

/**
 * Colours of the entities of one chart: each its own fixed colour; a second entity of the same kind in the chart (Group
 * personal accident beside Personal accident) and entities outside the list take the first slot no other entity of the
 * chart uses, so two marks of a chart never share a colour. The "other" grey once the seven slots are taken.
 */
export function entityColors(colors, dimension, names) {
  const wanted = names.map((n) => entityOf(dimension, n)?.slot);
  const taken = new Set();
  const first = wanted.map((slot) => {
    if (slot === undefined || taken.has(slot)) return null;
    taken.add(slot);
    return slot;
  });
  const free = colors.categorical.map((_, i) => i).filter((i) => !wanted.includes(i));
  return first.map((slot) => {
    if (slot !== null) return colors.categorical[slot];
    const next = free.shift();
    return next === undefined ? colors.other : colors.categorical[next];
  });
}

/**
 * n steps of the sequential ramp, light to dark (ordered buckets: ageing, tiers, funnel stages). Starts at the third
 * step so the lightest mark still stands out from the card.
 */
export function sequentialColors(colors, n) {
  const ramp = colors.sequentialRamp.slice(2);
  if (n <= 1) return [ramp[ramp.length - 2]];
  return Array.from({ length: n }, (_, i) => ramp[Math.round((i * (ramp.length - 1)) / (n - 1))]);
}

/** The diverging colour of a variance: below the target warm, above it cool, the grey midpoint within `tolerance`. */
export function divergingColor(colors, variance, scale = 1, tolerance = 0) {
  const v = Number(variance) || 0;
  if (Math.abs(v) <= tolerance) return colors.divergingRamp.midpoint;
  const step = Math.min(2, Math.floor((Math.abs(v) / (Math.abs(scale) || 1)) * 3));
  return v < 0 ? colors.divergingRamp.below[2 - step] : colors.divergingRamp.above[step];
}

const SEVERITY = { success: "good", good: "good", warning: "warning", serious: "serious", danger: "critical", critical: "critical" };

/** Colour of a status for a chart mark: good / warning / serious / critical (or the PrimeReact names); grey for anything else. */
export function statusColor(colors, severity) {
  const key = SEVERITY[severity];
  return key ? colors.statusFill[key] : colors.other;
}

/**
 * Colours of a series of status values (a status chart): the status colour of each (utils/statusSeverity), a lighter
 * shade of it for a second status of the same kind so that neighbouring bars stay apart.
 */
export function statusSeries(colors, statuses) {
  const used = {};
  return statuses.map((s) => {
    const base = statusColor(colors, statusSeverity(s));
    used[base] = (used[base] || 0) + 1;
    return used[base] === 1 ? base : mix(base, "#ffffff", Math.min(0.6, 0.25 * (used[base] - 1)));
  });
}

const scaleDefaults = (colors, scale, isIndexAxis) => ({
  ...scale,
  border: { color: colors.axis, ...(scale.border || {}) },
  ticks: { color: colors.muted, font: { size: 12 }, ...(scale.ticks || {}) },
  // hairline, solid, one step off the surface; no rules across the categories
  grid: { color: colors.grid, lineWidth: 1, drawTicks: false, ...(isIndexAxis ? { display: false } : {}), ...(scale.grid || {}) },
});

/**
 * Chart.js options in the data theme, merged into `options`: neutral axes and hairline grid, the legend at the bottom
 * with point keys, the tooltip (white, values first), thin bars with a rounded data end, 2px lines with ringed points
 * and a 2px surface gap between pie and stacked segments.
 */
export function themedOptions(colors, options = {}) {
  const indexAxis = options.indexAxis === "y" ? "y" : "x";
  const scales = Object.fromEntries(Object.entries(options.scales || {}).map(([k, s]) => [k, scaleDefaults(colors, s, (s.axis || k.charAt(0)) === indexAxis)]));
  const plugins = options.plugins || {};
  const legend = plugins.legend || {};
  const tooltip = plugins.tooltip || {};
  const elements = options.elements || {};
  return {
    responsive: true,
    ...options,
    font: { family: colors.fontFamily, ...(options.font || {}) },
    color: colors.text,
    ...(options.scales ? { scales } : {}),
    elements: {
      ...elements,
      bar: { borderRadius: 4, borderSkipped: "start", maxBarThickness: 24, borderWidth: 0, ...(elements.bar || {}) },
      line: { borderWidth: 2, tension: 0, borderCapStyle: "round", borderJoinStyle: "round", fill: false, ...(elements.line || {}) },
      point: { radius: 4, hoverRadius: 5, hitRadius: 12, borderWidth: 2, borderColor: colors.surface, ...(elements.point || {}) },
      arc: { borderWidth: 2, borderColor: colors.surface, ...(elements.arc || {}) },
    },
    plugins: {
      ...plugins,
      legend: {
        position: "bottom",
        ...legend,
        labels: { color: colors.text, usePointStyle: true, pointStyle: "rectRounded", boxWidth: 8, boxHeight: 8, padding: 16, font: { size: 12 }, ...(legend.labels || {}) },
      },
      tooltip: {
        backgroundColor: colors.surface,
        borderColor: colors.axis,
        borderWidth: 1,
        titleColor: colors.muted,
        bodyColor: colors.ink,
        titleFont: { size: 12, weight: "normal" },
        bodyFont: { size: 13, weight: "bold" },
        padding: 10,
        boxPadding: 6,
        usePointStyle: true,
        ...tooltip,
      },
    },
  };
}

/** Whether chart data has anything to draw: some dataset with a value other than zero. */
export function hasChartData(data) {
  return (data?.datasets || []).some((ds) => (ds.data || []).some((v) => {
    const n = typeof v === "object" && v !== null ? Number(v.y ?? v.x ?? v.r) : Number(v);
    return Number.isFinite(n) && n !== 0;
  }));
}

/**
 * A 45° (or 135°) line texture over a fill colour, tone on tone: the identity channel for colour-blind viewing and for
 * print. Falls back to the plain colour where there is no canvas (tests).
 */
export function patternFill(color, index = 0) {
  if (typeof document === "undefined") return color;
  const size = 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx) return color;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = mix(color, "#000000", 0.45);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (index % 2 === 0) {
    ctx.moveTo(0, size); ctx.lineTo(size, 0); ctx.moveTo(-size / 2, size / 2); ctx.lineTo(size / 2, -size / 2); ctx.moveTo(size / 2, size * 1.5); ctx.lineTo(size * 1.5, size / 2);
  } else {
    ctx.moveTo(0, 0); ctx.lineTo(size, size); ctx.moveTo(-size / 2, size / 2); ctx.lineTo(size / 2, size * 1.5); ctx.moveTo(size / 2, -size / 2); ctx.lineTo(size * 1.5, size / 2);
  }
  ctx.stroke();
  return ctx.createPattern(canvas, "repeat") || color;
}

/**
 * Chart.js plugin: targets and other reference values as a thin line across the plot with its label at the end, so a
 * target never takes a series colour. options.plugins.bvReference = { lines: [{ value, label, axis: "y" }] }.
 */
export const referenceLinePlugin = {
  id: "bvReference",
  afterDatasetsDraw(chart, _args, lines) {
    const list = lines?.lines;
    if (!Array.isArray(list) || !list.length) return;
    const { ctx, chartArea } = chart;
    list.forEach((line) => {
      const scale = chart.scales[line.scale || line.axis || "y"];
      if (!scale || line.value === null || line.value === undefined || !Number.isFinite(Number(line.value))) return;
      const at = scale.getPixelForValue(Number(line.value));
      const horizontal = scale.isHorizontal ? !scale.isHorizontal() : true;
      ctx.save();
      ctx.strokeStyle = line.color || "#4b4b4b";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      if (horizontal) {
        if (at < chartArea.top || at > chartArea.bottom) { ctx.restore(); return; }
        ctx.moveTo(chartArea.left, at); ctx.lineTo(chartArea.right, at);
      } else {
        if (at < chartArea.left || at > chartArea.right) { ctx.restore(); return; }
        ctx.moveTo(at, chartArea.top); ctx.lineTo(at, chartArea.bottom);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (line.label) {
        ctx.font = `600 11px ${chart.options.font?.family || "sans-serif"}`;
        ctx.fillStyle = line.color || "#4b4b4b";
        ctx.textBaseline = "bottom";
        if (horizontal) {
          ctx.textAlign = "right";
          ctx.fillText(line.label, chartArea.right - 4, at - 3);
        } else {
          ctx.textAlign = "left";
          ctx.fillText(line.label, at + 4, chartArea.top + 12);
        }
      }
      ctx.restore();
    });
  },
};

/**
 * Chart.js plugin: direct labels. Line charts of up to four series name each series beside its last point; bar
 * charts of one series write the value at the tip of each bar when it fits (the tooltip and the table view carry it
 * otherwise). options.plugins.bvDirectLabels = { format: (v) => text } (false to switch off).
 */
export const directLabelPlugin = {
  id: "bvDirectLabels",
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts || opts.enabled === false) return;
    const { ctx, chartArea } = chart;
    const visible = chart.data.datasets.map((ds, i) => ({ ds, i, meta: chart.getDatasetMeta(i) })).filter((d) => !d.meta.hidden && d.meta.visible !== false);
    const type = chart.config.type;
    ctx.save();
    ctx.font = `600 11px ${chart.options.font?.family || "sans-serif"}`;
    ctx.fillStyle = opts.color || "#4b4b4b";
    if (type === "line" && visible.length <= 4 && visible.length >= 2) {
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const placed = [];
      visible.forEach(({ ds, meta }) => {
        const last = [...meta.data].reverse().find((p) => p && Number.isFinite(p.y));
        if (!last) return;
        // labels that would collide are left to the legend and the tooltip
        if (placed.some((y) => Math.abs(y - last.y) < 12)) return;
        placed.push(last.y);
        ctx.fillText(ds.label || "", Math.min(last.x + 8, chartArea.right + 8), last.y);
      });
    }
    if (type === "bar" && visible.length === 1 && opts.format) {
      const { ds, meta } = visible[0];
      const horizontal = chart.options.indexAxis === "y";
      ctx.textBaseline = horizontal ? "middle" : "bottom";
      ctx.textAlign = horizontal ? "left" : "center";
      meta.data.forEach((bar, j) => {
        const text = opts.format(ds.data[j]);
        if (!text) return;
        const width = ctx.measureText(text).width;
        if (horizontal) {
          if (bar.x + 6 + width <= chartArea.right + (chart.options.layout?.padding?.right || 0)) ctx.fillText(text, bar.x + 6, bar.y);
        } else if (bar.y - 4 - 12 >= chartArea.top - 16 && width <= (bar.width || 0) + 24) {
          ctx.fillText(text, bar.x, bar.y - 4);
        }
      });
    }
    ctx.restore();
  },
};

/**
 * The chart colours of the current theme, refreshed when the branding changes (the first paint of a dashboard can
 * come before the theme has loaded). `primary` is the first data colour (series 1), not the brand colour.
 */
export function useChartTheme() {
  const { branding } = useBranding();
  return useMemo(() => {
    const colors = chartColors();
    return {
      ...colors,
      primary: colors.categorical[0],
      success: colors.statusFill.good,
      warning: colors.statusFill.warning,
      danger: colors.statusFill.critical,
      series: (n) => seriesColors(colors, n),
      entity: (dimension, name) => entityColor(colors, dimension, name),
      entities: (dimension, names) => entityColors(colors, dimension, names),
      sequential: (n) => sequentialColors(colors, n),
      diverging: (variance, scale, tolerance) => divergingColor(colors, variance, scale, tolerance),
      status: (severity) => statusColor(colors, severity),
      statuses: (values) => statusSeries(colors, values),
      alpha: withAlpha,
      options: (o) => themedOptions(colors, o),
    };
  }, [branding]); // eslint-disable-line react-hooks/exhaustive-deps
}
