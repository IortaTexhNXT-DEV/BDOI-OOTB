import { formatNumber, formatPercent, formatWithUnit, percentOf, progressValue, roundTo } from "./numberFormat";

describe("number display on dashboards", () => {
  it("rounds percentages to one decimal", () => {
    expect(formatPercent(33.33333333333333)).toBe("33.3%");
    expect(formatPercent(76.8888888888889)).toBe("76.9%");
    expect(formatPercent(80)).toBe("80%");
    expect(formatPercent("12.345", { decimals: 2 })).toBe("12.35%");
    expect(formatPercent(null)).toBe("-");
  });
  it("puts a space between a value and its unit", () => {
    expect(formatWithUnit(35.67, "days")).toBe("35.7 days");
    expect(formatWithUnit(4.2, "/5")).toBe("4.2/5");
    expect(formatWithUnit(88.24, "%")).toBe("88.2%");
    expect(formatWithUnit(undefined, "days")).toBe("-");
  });
  it("formats plain numbers and progress values", () => {
    expect(formatNumber(1234.56)).toBe("1,234.6");
    expect(roundTo(2.675, 2)).toBe(2.68);
    expect(progressValue(33.33333)).toBe(33);
    expect(progressValue(140)).toBe(100);
    expect(progressValue("x")).toBe(0);
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(1, 0)).toBe(0);
  });
});
