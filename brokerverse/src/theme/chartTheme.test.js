import { chartColors, seriesColors, statusColor, statusSeries, themedOptions, withAlpha } from "./chartTheme";

afterEach(() => document.documentElement.removeAttribute("style"));

describe("chart colours of the theme", () => {
  it("reads the brand colours set on the page, and the defaults without a theme", () => {
    expect(chartColors().primary).toBe("#0072d8");
    document.documentElement.style.setProperty("--bv-primary", "#1A1A1A");
    document.documentElement.style.setProperty("--bv-accent", "#eb0a1e");
    const c = chartColors();
    expect(c.primary).toBe("#1a1a1a");
    expect(c.accent).toBe("#eb0a1e");
    expect(c.danger).toBe("#b42318");
  });

  it("draws series in the primary colour, its tints and the accent once", () => {
    const c = { ...chartColors(), primary: "#1a1a1a", accent: "#eb0a1e" };
    const s = seriesColors(c, 5);
    expect(s[0]).toBe("#1a1a1a");
    expect(s[2]).toBe("#eb0a1e");
    expect(s.filter((x) => x === "#eb0a1e")).toHaveLength(1);
    expect(new Set(s).size).toBe(5);
    expect(seriesColors(c, 12)).toHaveLength(12);
  });

  it("keeps status colours for statuses only, a lighter shade for a second status of the same kind", () => {
    const c = chartColors();
    expect(statusColor(c, "danger")).toBe("#b42318");
    expect(statusColor(c, "info")).toBe(c.primary);
    const s = statusSeries(c, ["Settled", "Rejected", "Approved", "Registered"]);
    expect(s[0]).toBe(c.success);
    expect(s[1]).toBe(c.danger);
    expect(s[2]).not.toBe(c.success);
    expect(s[3]).toBe(c.primary);
  });

  it("puts the axis and legend text in the theme greys without losing the chart's own options", () => {
    const o = themedOptions(chartColors(), { plugins: { legend: { position: "bottom" } }, scales: { y: { ticks: { callback: String } } } });
    expect(o.plugins.legend.position).toBe("bottom");
    expect(o.plugins.legend.labels.color).toBe("#4b4b4b");
    expect(o.scales.y.ticks.callback).toBe(String);
    expect(o.scales.y.grid.color).toBe("#e4e4e4");
    expect(withAlpha("#0072d8", 0.1)).toBe("rgba(0, 114, 216, 0.1)");
  });
});
