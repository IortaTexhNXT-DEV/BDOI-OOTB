import { calendarDateFormat, formatDate, setDateFormat, toIsoDate } from "./dateFormat";

describe("configured date format (F14)", () => {
  beforeEach(() => setDateFormat("DD/MM/YYYY"));

  it("shows ISO dates and timestamps as DD/MM/YYYY", () => {
    expect(formatDate("2026-09-08")).toBe("08/09/2026");
    expect(formatDate(new Date(2026, 8, 29, 14, 5), { withTime: true })).toBe("29/09/2026 14:05");
    expect(calendarDateFormat()).toBe("dd/mm/yy");
  });
  it("is idempotent for text already in the configured format", () => {
    expect(formatDate("08/09/2026")).toBe("08/09/2026");
    expect(toIsoDate("08/09/2026")).toBe("2026-09-08");
  });
  it("keeps API values ISO (local calendar date, no time-zone shift)", () => {
    expect(toIsoDate(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
    expect(toIsoDate(null)).toBeNull();
  });
  it("returns text that is not a date unchanged and the empty marker for no value", () => {
    expect(formatDate("N/A")).toBe("N/A");
    expect(formatDate(null)).toBe("-");
    expect(formatDate("", { empty: "" })).toBe("");
  });
});
