import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import DealerProgrammes from "./DealerProgrammes";
import service from "../../services/distributionService";
import mastersService from "../../services/mastersService";

jest.mock("../../services/distributionService", () => ({
  __esModule: true,
  default: { programmes: jest.fn(), salesBatches: jest.fn(), channelOptions: jest.fn(), previewOptions: jest.fn(), premiumPreview: jest.fn(), dealerSales: jest.fn() },
}));
jest.mock("../../services/mastersService", () => ({ __esModule: true, default: { options: jest.fn() } }));

const TAL = { id: 2, code: "TAL-CASH-2026", name: "Toyota Alabang buyers 2026 (half subsidy)", dealerName: "Toyota Alabang, Inc.", bankName: "TFS", insurerName: "AXA",
  vehicleType: "private_cars", ownDamageRate: 2, actsOfNatureRate: 0.5, includeCtpl: true, ctplTermYears: 3, freeFirstYear: false, subsidyPayer: "dealer", subsidyType: "percent",
  subsidyValue: 50, issueMode: "quotation", sales: 1, status: "active" };
const TMK = { ...TAL, id: 1, code: "TMK-TFS-2026", freeFirstYear: true, subsidyType: "full", subsidyValue: 0, issueMode: "policy" };
const TCB = { ...TAL, id: 3, code: "TCB-TFS-2026", vehicleType: "light_medium_trucks", ctplTermYears: 1, subsidyPayer: "none", subsidyType: "full", subsidyValue: 0 };
const line = (code, kind, name, amount, payer, extra = {}) => ({ code, kind, name, base: null, rate: null, amount, payer, buyer: Math.round((amount - payer) * 100) / 100, ...extra });
const RESULT = {
  netPremium: 29000, taxes: 7322.5, ctplPremium: 1660.4, grossPremium: 37982.9, buyer: 18991.45, payer: 18991.45, payerType: "dealer",
  lines: [
    line("lossAndDamageCoveragePremium", "cover", "Own Damage / Theft", 20000, 10000, { base: 1000000, rate: 2 }),
    line("actsOfNaturePremium", "cover", "Acts of Nature", 5000, 2500, { base: 1000000, rate: 0.5 }),
    line("bodilyInjuryCoveragePremium", "cover", "Excess Bodily Injury", 2000, 1000),
    line("propertyDamageCoveragePremium", "cover", "Property Damage", 2000, 1000),
    line("VAT", "tax", "Value Added Tax", 3480, 1740, { rate: 12 }),
    line("DST", "tax", "Documentary Stamp Tax", 3625, 1812.5, { rate: 12.5 }),
    line("LGT", "tax", "Local Government Tax", 217.5, 108.75, { rate: 0.75 }),
    line("CTPL", "ctpl", "CTPL", 1660.4, 830.2, { years: 3 }),
  ],
  basis: { programmeCode: "TAL-CASH-2026", sumInsured: 1000000, ownDamageRate: 2, actsOfNatureRate: 0.5, vehicleTypeLabel: "Private cars", lgu: null, lgtRate: 0.75, insurerName: "AXA" },
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ROLES", JSON.stringify(["sales"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:motor-programmes", "write:motor-programmes"]));
  service.programmes.mockResolvedValue([TAL, TCB, TMK]);
  service.salesBatches.mockResolvedValue([]);
  service.channelOptions.mockResolvedValue([]);
  service.previewOptions.mockResolvedValue({ vehicleTypes: [{ value: "private_cars", label: "Private cars", ctplPremium: 610.4, ctplPremium3Year: 1660.4 }], lgus: [{ code: "MKT", name: "Makati", rate: 0.2 }] });
  service.premiumPreview.mockResolvedValue(RESULT);
  mastersService.options.mockResolvedValue([]);
});

const open = async (code) => {
  render(<MemoryRouter><DealerProgrammes /></MemoryRouter>);
  await screen.findByText(code);
  const row = screen.getAllByRole("row").find((r) => within(r).queryByText(code));
  fireEvent.click(within(row).getByRole("button", { name: "Premium preview" }));
  return screen.findByRole("dialog");
};

describe("Dealer Programmes", () => {
  it("summarises who pays in the list and keeps the page description behind the help icon", async () => {
    render(<MemoryRouter><DealerProgrammes /></MemoryRouter>);
    expect(await screen.findByText("Dealer 50%, buyer the rest")).toBeInTheDocument();
    expect(screen.getByText("Dealer, first year")).toBeInTheDocument();
    expect(screen.getByText("Buyer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About this page" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit programme" })).toHaveLength(3);
  });

  it("prices the car at the default price on opening and lists every line with who pays it", async () => {
    const dialog = await open("TAL-CASH-2026");
    expect(await within(dialog).findByText("Own Damage / Theft")).toBeInTheDocument();
    expect(service.premiumPreview).toHaveBeenCalledWith(2, { invoicePrice: 1000000, vehicleType: "private_cars", lguCode: undefined, financed: undefined });
    for (const name of ["Acts of Nature", "Excess Bodily Injury", "Property Damage", "Net premium", "Value Added Tax", "Documentary Stamp Tax", "Local Government Tax", "CTPL (3 years)"]) {
      expect(within(dialog).getByText(name)).toBeInTheDocument();
    }
    const net = within(dialog).getAllByRole("row").find((r) => within(r).queryByText("Net premium"));
    expect(within(net).getAllByText(/29,000\.00|14,500\.00/)).toHaveLength(3);
    expect(within(dialog).getByText("Dealer pays")).toBeInTheDocument();
    expect(within(dialog).getAllByText(/18,991\.45/).length).toBeGreaterThanOrEqual(2);
    expect(within(dialog).getByText(/Sum insured .*1,000,000\.00 · Own damage \/ theft 2\.00% · Acts of nature 0\.50% · Private cars · LGT 0\.75% \(standard rate\) · Programme TAL-CASH-2026/)).toBeInTheDocument();
  });

  it("computes again on Enter and keeps the last result while computing", async () => {
    const dialog = await open("TCB-TFS-2026");
    await within(dialog).findByText("Own Damage / Theft");
    let release;
    service.premiumPreview.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const price = within(dialog).getByLabelText(/Invoice price/);
    fireEvent.change(price, { target: { value: "1,500,000" } });
    fireEvent.keyDown(price, { key: "Enter" });
    expect(service.premiumPreview).toHaveBeenLastCalledWith(3, expect.objectContaining({ invoicePrice: 1500000 }));
    expect(within(dialog).getByText("Own Damage / Theft")).toBeInTheDocument();
    release(RESULT);
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Compute premium" })).toBeEnabled());
    expect(within(dialog).getAllByRole("button", { name: "Close" })).toHaveLength(2);
  });
});
