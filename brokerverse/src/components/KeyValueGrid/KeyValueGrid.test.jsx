import React from "react";
import { render, screen } from "@testing-library/react";
import "../../i18n";
import KeyValueGrid from "./index";
import { EMPTY_VALUE, formatValue } from "./formatValue";
import { setDateFormat, setTimeZone } from "../../utility/dateFormat";

const byClass = (name, text) => screen.queryByText((_, el) => !!el?.classList?.contains(name) && (!text || el.textContent.includes(text)));

afterEach(() => {
  setDateFormat("DD/MM/YYYY");
  setTimeZone(null);
});

describe("formatValue", () => {
  it("formats by type and shows a dash for an empty value", () => {
    expect(formatValue(1234.5, { type: "amount", currency: "PHP" })).toMatch(/1,234\.50$/);
    expect(formatValue("8457.5", { type: "amount" })).toMatch(/8,457\.50$/);
    expect(formatValue(1500, { type: "number" })).toBe("1,500");
    expect(formatValue(12.5, { type: "percent" })).toBe("12.5%");
    expect(formatValue("2026-10-31", { type: "date" })).toBe("31/10/2026");
    setTimeZone("Asia/Manila");
    expect(formatValue("2026-10-10T01:03:00Z", { type: "datetime" })).toBe("10/10/2026 09:03");
    expect(formatValue(false, { type: "boolean" })).toBe("No");
    expect(formatValue(["Motor", "Fire"])).toBe("Motor, Fire");
    for (const empty of [null, undefined, "", "  ", []]) expect(formatValue(empty, { type: "amount" })).toBe(EMPTY_VALUE);
    expect(formatValue(null, { empty: "-" })).toBe("-");
  });
});

describe("KeyValueGrid", () => {
  it("lists label above value, formats by type, keeps nodes and skips hidden items", () => {
    render(
      <KeyValueGrid columns={4} items={[
        { label: "Remittance date", value: "2026-10-10", type: "date" },
        { label: "Net amount", value: 8457.5, type: "amount", currency: "PHP" },
        { label: "Due date", value: null, type: "date" },
        { label: "Status", value: <strong>Approved</strong> },
        { label: "Batch", value: "BLK-1", hidden: true },
        { label: "Remarks", value: "Month end", span: "full" },
      ]} />
    );
    expect(byClass("bv-kv--cols-4")).toBeInTheDocument();
    expect(screen.getByText("Remittance date")).toHaveClass("bv-kv__label");
    expect(screen.getByText("10/10/2026")).toHaveClass("bv-kv__value");
    expect(screen.getByText(/8,457\.50/)).toHaveClass("bv-kv__value--num");
    expect(screen.getByText(EMPTY_VALUE)).toHaveClass("bv-kv__value--empty");
    expect(screen.getByText("Approved", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByText("Batch")).toBeNull();
    expect(byClass("bv-kv__item--full", "Remarks")).toHaveTextContent("Month end");
  });
});
