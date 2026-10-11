import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import SchemeMaster from "./SchemeMaster";
import { schemesService as service } from "../../services/dealerSchemesService";
import mastersService from "../../services/mastersService";
import distributionService from "../../services/distributionService";

jest.mock("../../services/dealerSchemesService", () => ({
  __esModule: true,
  saveBlob: jest.fn(),
  schemesService: { list: jest.fn(), get: jest.fn(), choices: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn(), copy: jest.fn(), act: jest.fn(), preview: jest.fn(),
    exportList: jest.fn(), linesTemplate: jest.fn(), uploadLines: jest.fn() },
}));
jest.mock("../../services/mastersService", () => ({ __esModule: true, default: { options: jest.fn() } }));
jest.mock("../../services/distributionService", () => ({ __esModule: true, default: { channelOptions: jest.fn() } }));

const SCHEME = {
  id: "sch_1", schemeNo: "S1-STD-2026", version: 1, schemeType: "scheme1", schemeTypeLabel: "Scheme 1", description: "Scheme 1 standard", effectiveFrom: "2026-10-15",
  effectiveTo: "2027-10-14", bankChannelId: "ch_seed_tfs", bankName: "Toyota Financial Services Philippines Corporation", allDealers: true, dealers: [], dealerChannelIds: [],
  insurerIds: [2], insurers: [{ id: 2, name: "Pioneer Insurance & Surety Corp." }], productId: 2, productName: "Motor Vehicle Insurance", vehicleClasses: ["private_cars"],
  perils: [{ code: "OD", name: "Own Damage / Theft", included: true, rate: 2, basisLabel: "% of sum insured", mandatory: true }], commissionPct: 25, dealerCommissionPct: 85, tisphPct: 15,
  termYears: 5, siSchedule: [100, 90, 80, 70, 60], schedule: [{ year: 1, sumInsuredPct: 100, exampleSumInsured: 1000000, whoPays: "dealer", whoPaysLabel: "Dealer" }],
  status: "pending-approval", statusLabel: "Pending approval", lineCount: 1, equivalents: { commission: 0.5, remitting: 1.5, dealer: 0.425, tisph: 0.075 },
  createdById: "usr_maker", updatedById: "usr_maker", submittedById: "usr_maker", submittedAt: "2026-10-11T01:00:00Z", warnings: [],
  lines: [{ lineNo: 1, vehicle: "Toyota Vios, All variants", brand: "Toyota", model: "Vios", yearFrom: 2026, yearTo: 2027, siFrom: 500000, siTo: 1300000, vehicleClass: "private_cars", check: "OK" }],
  versions: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-general-manager"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:schemes", "approve:schemes"]));
  localStorage.setItem("USER_ID", "usr_checker");
  service.list.mockResolvedValue({ data: [SCHEME], counts: { all: 1, "pending-approval": 1 } });
  service.get.mockResolvedValue(SCHEME);
  service.choices.mockResolvedValue({ products: [{ value: 2, label: "Motor Vehicle Insurance" }], vehicleClasses: [{ value: "private_cars", label: "Private cars" }],
    perils: [{ code: "OD", name: "Own Damage / Theft", mandatory: true, basisLabel: "% of sum insured" }], schemeTypes: [{ value: "scheme1", label: "Scheme 1" }],
    year1PaidBy: [{ value: "dealer", label: "Dealer" }], standardRates: { ownDamage: 2, actsOfNature: 0.5 }, defaultTermYears: 5, defaultSchedule: [100, 90, 80, 70, 60], maxTermYears: 5 });
  mastersService.options.mockResolvedValue([{ id: 2, label: "Pioneer Insurance & Surety Corp." }]);
  distributionService.channelOptions.mockResolvedValue([]);
});

const renderPage = () => render(<MemoryRouter><SchemeMaster /></MemoryRouter>);

describe("Scheme Master", () => {
  it("lists the schemes with their dealers, insurers, lines, commission and status; no add button without write:schemes", async () => {
    renderPage();
    expect(await screen.findByText("S1-STD-2026")).toBeInTheDocument();
    expect(screen.getByText("All dealers")).toBeInTheDocument();
    expect(screen.getByText("Pioneer Insurance & Surety Corp.")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New scheme" })).toBeNull();
  });

  it("another user approves or returns a submitted scheme", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /view/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Return" })).toBeEnabled();
  });

  it("the maker cannot approve the scheme and may recall it", async () => {
    localStorage.setItem("USER_ID", "usr_maker");
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:schemes", "write:schemes", "approve:schemes"]));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /view/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "Approve" })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Recall" })).toBeInTheDocument();
  });

  it("a maker adds a scheme; the field errors of the server are shown", async () => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:schemes", "write:schemes"]));
    service.create.mockRejectedValue(Object.assign(new Error("Validation failed"), { errors: [{ path: "schemeNo", message: "Scheme No. is required" }] }));
    renderPage();
    const add = await screen.findByRole("button", { name: "New scheme" });
    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save draft" }));
    expect(await within(dialog).findByText("Scheme No. is required")).toBeInTheDocument();
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ schemeType: "scheme1", termYears: 5, siSchedule: [100, 90, 80, 70, 60],
      perils: [expect.objectContaining({ code: "OD", included: true })] }));
  });
});
