import React from "react";
import { render, screen } from "@testing-library/react";
import { ScheduleTable, cellValue } from "./common";
import { isPathAllowed } from "../../utils/menuPermissions";
import { menuList } from "../../components/SideBar/list";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k, o) => (o && o.defaultValue) || k }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

describe("BIR forms and invoicing screens", () => {
  it("shows a schedule with its columns and totals", () => {
    const schedule = {
      columns: [{ key: "atc", label: "ATC" }, { key: "tax", label: "Tax withheld", type: "money" }],
      rows: [{ atc: "WI515", tax: 500 }, { atc: "WC515", tax: 2500.05 }],
      totals: { tax: 3000.05 },
    };
    render(<ScheduleTable schedule={schedule} />);
    expect(screen.getByText("ATC")).toBeInTheDocument();
    expect(screen.getByText("WI515")).toBeInTheDocument();
    expect(screen.getByText("birTax.total")).toBeInTheDocument();
    expect(cellValue({ rate: 2.5 }, { key: "rate", type: "number" })).toBe("2.5");
  });

  it("opens the tax screens and the insurer overrides to Accounting only", () => {
    for (const path of ["/accounts/tax/withholding-returns", "/accounts/tax/sales-invoices", "/accounts/tax/cas", "/commission/insurer-overrides/computations"]) {
      expect(isPathAllowed(path, menuList, ["accounting"])).toBe(true);
      expect(isPathAllowed(path, menuList, ["sales"])).toBe(false);
    }
  });
});
