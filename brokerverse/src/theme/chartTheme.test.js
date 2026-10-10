import {
  PALETTE, chartColors, divergingColor, entityColor, entityColors, entityOf, hasChartData, seriesColors, sequentialColors, statusColor, statusSeries, themedOptions, withAlpha,
} from "./chartTheme";

const fs = require("fs");
const path = require("path");
const postcssBrandVars = require("../../scripts/postcss-brand-vars");

afterEach(() => document.documentElement.removeAttribute("style"));

const TOYOTA_RED = "#eb0a1e";

describe("data colours", () => {
  it("are the same in the stylesheet tokens and in the charts", () => {
    const scss = fs.readFileSync(path.join(__dirname, "bdoi", "dataviz.scss"), "utf8");
    const token = (name) => new RegExp(`--bv-viz-${name}:\\s*(#[0-9a-f]{6})`).exec(scss)?.[1];
    PALETTE.categorical.forEach((hex, i) => expect(token(`cat-${i + 1}`)).toBe(hex));
    [100, 200, 300, 400, 500, 600, 700].forEach((step, i) => expect(token(`seq-${step}`)).toBe(PALETTE.sequential[i]));
    expect(token("other")).toBe(PALETTE.other);
    expect(token("div-mid")).toBe(PALETTE.diverging.midpoint);
    Object.entries(PALETTE.status).forEach(([k, s]) => {
      expect(token(k)).toBe(s.fill);
      expect(token(`${k}-text`)).toBe(s.text);
    });
  });

  it("never use the brand accent (Toyota red) and are never repainted by a brand theme", () => {
    const all = [...PALETTE.categorical, ...PALETTE.sequential, ...PALETTE.diverging.below, ...PALETTE.diverging.above, PALETTE.other];
    expect(all).not.toContain(TOYOTA_RED);
    all.forEach((hex) => expect(postcssBrandVars.themeValue(`1px solid ${hex}`)).toBe(`1px solid ${hex}`));
  });

  it("draws series in the fixed categorical order and folds the eighth and later into the other grey", () => {
    document.documentElement.style.setProperty("--bv-accent", TOYOTA_RED);
    const c = chartColors();
    expect(seriesColors(c, 3)).toEqual(PALETTE.categorical.slice(0, 3));
    const ten = seriesColors(c, 10);
    expect(ten.slice(0, 7)).toEqual(PALETTE.categorical);
    expect(ten.slice(7)).toEqual([PALETTE.other, PALETTE.other, PALETTE.other]);
    expect(ten).not.toContain(TOYOTA_RED);
  });

  it("keeps one colour per insurer, line of business and channel, whatever the order of a chart", () => {
    const c = chartColors();
    expect(entityOf("insurer", "Pioneer Insurance & Surety Corp.")).toEqual({ key: "pioneer", slot: 0 });
    expect(entityColor(c, "insurer", "Stronghold Insurance Company, Inc.")).toBe(PALETTE.categorical[3]);
    expect(entityColor(c, "insurer", "MAAGAP")).toBe(PALETTE.categorical[1]);
    expect(entityColor(c, "insurer", "Malayan Insurance Co., Inc.")).toBe(PALETTE.other);
    expect(entityColor(c, "lob", "Compulsory Third Party Liability")).toBe(PALETTE.categorical[1]);
    expect(entityColor(c, "lob", "Motor Vehicle Insurance")).toBe(PALETTE.categorical[0]);
    expect(entityColor(c, "lob", "Group Personal Accident")).toBe(entityColor(c, "lob", "PA"));
    expect(entityColor(c, "lob", "Credit Life - Voluntary")).toBe(PALETTE.categorical[3]);
    expect(entityColor(c, "channel", "Toyota Financial Services Philippines Corporation")).toBe(PALETTE.categorical[0]);
    expect(entityColor(c, "channel", "Toyota Makati, Inc.")).toBe(PALETTE.categorical[1]);
  });

  it("never gives two marks of one chart the same colour", () => {
    const c = chartColors();
    const colors = entityColors(c, "lob", ["Motor Vehicle Insurance", "Group Personal Accident", "Personal Accident", "Engineering"]);
    expect(colors[0]).toBe(PALETTE.categorical[0]);
    expect(colors[1]).toBe(PALETTE.categorical[2]);
    expect(new Set(colors).size).toBe(4);
    expect(entityColors(c, "insurer", ["Stronghold", "Pioneer"])).toEqual([PALETTE.categorical[3], PALETTE.categorical[0]]);
  });

  it("orders buckets on one ramp, light to dark, and colours a variance by its side of the target", () => {
    const c = chartColors();
    const ramp = sequentialColors(c, 4);
    expect(ramp).toHaveLength(4);
    expect(ramp[0]).toBe(PALETTE.sequential[2]);
    expect(ramp[3]).toBe(PALETTE.sequential[6]);
    expect(divergingColor(c, 0)).toBe(PALETTE.diverging.midpoint);
    expect(divergingColor(c, -10, 10)).toBe(PALETTE.diverging.below[0]);
    expect(divergingColor(c, 1, 10)).toBe(PALETTE.diverging.above[0]);
  });

  it("keeps status colours for statuses only, a lighter shade for a second status of the same kind", () => {
    const c = chartColors();
    expect(statusColor(c, "danger")).toBe(PALETTE.status.critical.fill);
    expect(statusColor(c, "serious")).toBe(PALETTE.status.serious.fill);
    expect(statusColor(c, "info")).toBe(PALETTE.other);
    const s = statusSeries(c, ["Settled", "Rejected", "Approved"]);
    expect(s[0]).toBe(PALETTE.status.good.fill);
    expect(s[1]).toBe(PALETTE.status.critical.fill);
    expect(s[2]).not.toBe(s[0]);
  });

  it("puts axes, grid and legend in the neutral ink without losing the chart's own options", () => {
    const o = themedOptions(chartColors(), { indexAxis: "y", plugins: { legend: { position: "right" } }, scales: { x: { ticks: { callback: String } }, y: {} } });
    expect(o.plugins.legend.position).toBe("right");
    expect(o.plugins.legend.labels.color).toBe(PALETTE.ink.secondary);
    expect(o.scales.x.ticks.callback).toBe(String);
    expect(o.scales.x.grid.color).toBe(PALETTE.ink.grid);
    expect(o.scales.y.grid.display).toBe(false);
    expect(o.elements.bar.maxBarThickness).toBe(24);
    expect(o.elements.line.borderWidth).toBe(2);
    expect(withAlpha("#345d9b", 0.1)).toBe("rgba(52, 93, 155, 0.1)");
  });

  it("tells an empty chart from one with figures", () => {
    expect(hasChartData({ datasets: [{ data: [0, 0] }] })).toBe(false);
    expect(hasChartData({ datasets: [] })).toBe(false);
    expect(hasChartData({ datasets: [{ data: [0, 3] }] })).toBe(true);
  });
});
