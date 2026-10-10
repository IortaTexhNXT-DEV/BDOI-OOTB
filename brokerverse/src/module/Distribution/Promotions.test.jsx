import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import Promotions from "./Promotions";
import service from "../../services/promotionService";
import mastersService from "../../services/mastersService";

jest.mock("../../services/promotionService", () => ({
  __esModule: true,
  default: { list: jest.fn(), get: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), act: jest.fn(), choices: jest.fn() },
}));
jest.mock("../../services/mastersService", () => ({ __esModule: true, default: { options: jest.fn() } }));

const PROMO = {
  id: "prm_1", code: "PRM-FORTUNER26", version: 1, name: "Fortuner and Vios launch rate", periodFrom: "2026-10-01", periodTo: "2026-12-31", benefit: "rate",
  excess: { 2: 2000 }, unitQuota: 500, unitsUsed: 12, lockInYears: null, productIds: [2], insurerIds: [2], channelTypes: ["financing_bank"],
  products: [{ id: 2, name: "Motor Vehicle Insurance" }], insurers: [{ id: 2, name: "Malayan Insurance Co., Inc." }], channelTypeLabels: ["Financing bank"],
  combineDealer: true, combineDiscount: false, status: "pending-approval", statusLabel: "Pending approval", lineCount: 1, createdById: "usr_maker", updatedById: "usr_maker",
  submittedById: "usr_maker", submittedAt: "2026-10-01T01:00:00Z",
  lines: [{ lineNo: 1, variantId: 17, brand: "Toyota", model: "Fortuner", variant: "2.4 G 4x2 AT", yearFrom: 2026, yearTo: 2027, promoOd: 1.6, minOd: 1.6, promoAon: 0.4, remitOd: 1.4, remitAon: 0.3 }],
  capCheck: { lines: [{ lineNo: 1, rateDiscount: 20, checks: [{ productId: 2, channelType: "financing_bank", result: "within" }] }] }, versions: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-sales-unit-head"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:promotions", "approve:promotions"]));
  localStorage.setItem("USER_ID", "usr_checker");
  service.list.mockResolvedValue([PROMO]);
  service.get.mockResolvedValue(PROMO);
  service.choices.mockResolvedValue({ products: [{ value: 2, label: "Motor Vehicle Insurance" }], variants: [{ value: 17, label: "Toyota Fortuner 2.4 G 4x2 AT" }],
    channelTypes: [{ value: "financing_bank", label: "Financing bank" }], standardRates: { ownDamage: 2, actsOfNature: 0.5 }, rateChangeReasons: [] });
  mastersService.options.mockResolvedValue([{ id: 2, label: "Malayan Insurance Co., Inc." }]);
});

const renderPage = () => render(<MemoryRouter><Promotions /></MemoryRouter>);

describe("promotions", () => {
  it("lists the promotions with their units and status", async () => {
    renderPage();
    expect(await screen.findByText("PRM-FORTUNER26")).toBeInTheDocument();
    expect(screen.getByText("12 / 500")).toBeInTheDocument();
    expect(screen.getByText("Pending approval")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add promotion" })).toBeNull();
  });

  it("a second user approves or returns a submitted promotion; the cap check of each line is shown", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /view/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Within cap")).toBeInTheDocument();
    expect(within(dialog).getByText("20.00%")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Return" })).toBeEnabled();
  });

  it("the maker cannot decide the promotion and may recall it", async () => {
    localStorage.setItem("USER_ID", "usr_maker");
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:promotions", "write:promotions", "approve:promotions"]));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /view/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Approve" })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Recall" })).toBeInTheDocument();
  });

  it("a maker adds a promotion with its vehicle lines", async () => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:promotions", "write:promotions"]));
    service.create.mockRejectedValue(Object.assign(new Error("Validation failed"), { errors: [{ path: "code", message: "Code is required" }] }));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Add promotion" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save draft" }));
    expect(await within(dialog).findByText("Code is required")).toBeInTheDocument();
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ benefit: "rate", lines: [expect.objectContaining({ variantId: null })] }));
  });
});
