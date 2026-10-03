import { kindOfText } from "./tableNumericAlign";

describe("table column classification", () => {
  it("recognises amounts, counts and percentages as numbers", () => {
    expect(kindOfText("₱12,500.00")).toBe("num");
    expect(kindOfText("PHP 1,000")).toBe("num");
    expect(kindOfText("42")).toBe("num");
    expect(kindOfText("12.5%")).toBe("num");
  });

  it("recognises dates, date-times and date ranges", () => {
    expect(kindOfText("03/10/2026")).toBe("date");
    expect(kindOfText("2026-10-03")).toBe("date");
    expect(kindOfText("03 Oct 2026")).toBe("date");
    expect(kindOfText("Oct 3, 2026")).toBe("date");
    expect(kindOfText("03/10/2026 14:05")).toBe("date");
    expect(kindOfText("01/10/2026 - 01/10/2027")).toBe("date");
    expect(kindOfText("03/09/2026 (30)")).toBe("date");
  });

  it("recognises document numbers and codes", () => {
    expect(kindOfText("POL-2026-00007")).toBe("code");
    expect(kindOfText("OR-2026-00006")).toBe("code");
  });

  it("leaves text alone", () => {
    expect(kindOfText("Juan dela Cruz")).toBeNull();
    expect(kindOfText("09171234599")).toBeNull();
    expect(kindOfText("")).toBeNull();
  });
});
