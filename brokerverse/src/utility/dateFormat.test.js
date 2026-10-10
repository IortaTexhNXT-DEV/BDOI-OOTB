import { calendarDateFormat, formatDate, formatInstant, instantParts, setDateFormat, setTimeZone, toIsoDate } from "./dateFormat";

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

describe("instants in the business time zone", () => {
  afterEach(() => {
    setTimeZone(null);
    setDateFormat("DD/MM/YYYY");
  });

  it("shows an instant on the business day and time of general.timezone", () => {
    setTimeZone("Asia/Manila");
    expect(instantParts("2026-10-09T17:03:00Z")).toEqual({ day: "2026-10-10", date: "10/10/2026", time: "01:03", text: "10/10/2026 01:03" });
    expect(formatInstant("2026-10-10T01:03:00.000Z")).toBe("10/10/2026 09:03");
    setDateFormat("YYYY-MM-DD");
    expect(formatInstant(new Date("2026-10-10T01:03:00Z"))).toBe("2026-10-10 09:03");
  });

  it("keeps a plain date as that calendar day and ignores an unknown zone", () => {
    setTimeZone("Asia/Manila");
    expect(instantParts("2026-10-31")).toEqual({ day: "2026-10-31", date: "31/10/2026", time: null, text: "31/10/2026" });
    setTimeZone("Not/AZone");
    expect(formatInstant(new Date(2026, 9, 10, 9, 3))).toBe("10/10/2026 09:03");
    expect(formatInstant(null)).toBe("-");
    expect(formatInstant("not a date", { empty: "" })).toBe("");
  });
});
