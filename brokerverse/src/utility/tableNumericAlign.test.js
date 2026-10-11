import { isCodeHeading, kindOfText, markTable } from "./tableNumericAlign";

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

  it("treats a column headed as a code as text, even when its codes are digits", () => {
    expect(isCodeHeading("Cost Centre Code")).toBe(true);
    expect(isCodeHeading("Rank Code")).toBe(true);
    expect(isCodeHeading("Amount")).toBe(false);
    expect(isCodeHeading("Encoded By")).toBe(false);
  });
});

const buildTable = (heads, rows) => {
  const wrapper = document.createElement("div");
  const table = document.createElement("table");
  table.innerHTML = `<thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead>`
    + `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`;
  wrapper.appendChild(table);
  document.body.appendChild(wrapper);
  markTable(table);
  return table;
};
const classesOf = (table, column) => Array.from(table.querySelectorAll(`tbody tr td:nth-child(${column + 1})`)).map((td) => td.className);

describe("table column sizing", () => {
  it("keeps status tags and short values on one line and gives names a minimum width", () => {
    const table = buildTable(["Slip No.", "Insured", "Insurer", "Age", "Status"], [
      ["BS-2026-90002", "Mindanao Agri Trading Inc.", "AXA Philippines Life and General Insurance Corporation", "4 days", '<span class="p-tag">Submitted</span>'],
      ["BS-2026-90001", "Northstar BPO Services Inc.", "Stronghold Insurance Company, Inc.", "10 days", '<span class="p-tag">Closed</span>'],
    ]);
    expect(classesOf(table, 0)).toEqual(["bv-code", "bv-code"]);
    expect(classesOf(table, 1)).toEqual(["bv-text", "bv-text"]);
    expect(classesOf(table, 2)).toEqual(["bv-text-wide", "bv-text-wide"]);
    expect(classesOf(table, 3)).toEqual(["bv-short", "bv-short"]);
    expect(classesOf(table, 4)).toEqual(["bv-status", "bv-status"]);
    expect(table.querySelector("thead th:nth-child(5)").className).toBe("bv-status");
  });

  it("does not take a tag with text beside it for a status column", () => {
    const table = buildTable(["Product"], [['Group Personal Accident <span class="p-tag">ACCIDENT</span>'], ['Motor <span class="p-tag">MOTOR</span>']]);
    expect(classesOf(table, 0)).toEqual(["bv-text", "bv-text"]);
  });
});
