import React from "react";
import fs from "fs";
import path from "path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import OffersTable from "./OffersTable";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, d) => (typeof d === "string" ? d : k) }) }));

const offers = [
  { id: 1, insuranceCompanyName: "Maagap Insurance", insurerReference: "MI-REF-9", status: "offered", premium: 1000, taxes: 120, premiumTotal: 1120, rate: 1.2, offeredShare: 100,
    deductibles: "PHP 5,000 per claim", terms: "Excludes flood", validityDate: "2026-12-31", isBest: true },
  { id: 2, insuranceCompanyName: "Second Insurer", status: "declined", declineReason: "Outside appetite" },
];
const money = (n) => `PHP ${n}`;

describe("OffersTable", () => {
  it("shows the insurer first with its reference and status, gross premium with net and taxes, and one Terms column", () => {
    render(<OffersTable offers={offers} statusOf={(s) => <span>{s}</span>} money={money} date={(d) => d || "-"} canEdit onEdit={jest.fn()} />);
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads.slice(0, 6)).toEqual(["placement.fields.insurer", "placement.fields.grossPremium", "placement.fields.rate", "placement.fields.line", "placement.fields.terms", "placement.fields.validUntil"]);
    expect(heads).not.toContain("placement.fields.taxes");
    const first = screen.getAllByRole("row")[1];
    expect(first).toHaveClass("best-row");
    const cells = within(first).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Maagap Insurance");
    expect(cells[0]).toHaveTextContent("MI-REF-9");
    expect(cells[0]).toHaveTextContent("offered");
    expect(cells[1]).toHaveTextContent("PHP 1120");
    expect(cells[1]).toHaveTextContent("PHP 1000 + PHP 120");
    expect(within(cells[4]).getByTitle("PHP 5,000 per claim · Excludes flood")).toHaveClass("clamp-2");
  });

  it("puts the row actions in icon buttons with names", () => {
    const onEdit = jest.fn();
    const onPrint = jest.fn();
    render(<OffersTable offers={offers.slice(0, 1)} statusOf={() => null} money={money} date={(d) => d} canEdit onEdit={onEdit} onPrint={onPrint} />);
    fireEvent.click(screen.getByRole("button", { name: "placement.actions.edit" }));
    fireEvent.click(screen.getByRole("button", { name: "placement.actions.printSlip" }));
    expect(onEdit).toHaveBeenCalledWith(offers[0]);
    expect(onPrint).toHaveBeenCalledWith(offers[0]);
  });

  it("keeps the offers table free of a fixed minimum width and sticky columns (fits at 1366px)", () => {
    const scss = fs.readFileSync(path.join(__dirname, "index.scss"), "utf8");
    const block = scss.slice(scss.indexOf(".participant-table.offers {"));
    expect(block.slice(0, block.indexOf("\n}"))).not.toMatch(/^  min-width/m);
    expect(scss).not.toMatch(/position:\s*sticky/);
  });
});
