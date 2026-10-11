import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../i18n";
import SchemeIssuance from "./SchemeIssuance";
import SchemeApplication from "./SchemeApplication";
import { schemeIssuanceService as service } from "../../services/dealerSchemesService";
import mastersService from "../../services/mastersService";
import distributionService from "../../services/distributionService";

jest.mock("../../services/dealerSchemesService", () => ({
  __esModule: true,
  saveBlob: jest.fn(),
  schemeIssuanceService: { list: jest.fn(), get: jest.fn(), choices: jest.fn(), create: jest.fn(), update: jest.fn(), addItem: jest.fn(), uploadItem: jest.fn(), itemAct: jest.fn(),
    decideWaiver: jest.fn(), sendToInsurer: jest.fn(), decline: jest.fn(), changeInsurer: jest.fn(), issue: jest.fn(), cancel: jest.fn(), bookings: jest.fn(), bookingsTemplate: jest.fn(),
    uploadBookings: jest.fn() },
}));
jest.mock("../../services/mastersService", () => ({ __esModule: true, default: { options: jest.fn() } }));
jest.mock("../../services/distributionService", () => ({ __esModule: true, default: { channelOptions: jest.fn() } }));

const APP = {
  id: "sap_1", applicationNumber: "SAP-2026-90012", status: "ready", statusLabel: "Ready to issue", schemeId: "sch_1", schemeNo: "S1-STD-2026", schemeType: "scheme1",
  schemeTypeLabel: "Scheme 1", loanAccount: "8005123456", bookingDate: "2026-10-05", loanTermMonths: 60, releaseDate: "2026-10-07", borrowerName: "Ramon Villanueva",
  borrower: { firstName: "Ramon", lastName: "Villanueva", idType: "PhilID", idNumber: "1234" }, kycSource: "tfs", kycSourceLabel: "TFSPH KYC confirmation",
  dealerName: "Toyota Makati", vehicle: { make: "Toyota", model: "Vios", yearModel: 2026 }, vehicleLabel: "2026 Toyota Vios", invoicePrice: 1000000, insuranceCompanyId: 2,
  insurerName: "Pioneer Insurance & Surety Corp.", araSignedOn: "2026-10-05", araPaymentMode: "ADA", grossPremium: 35634.84, problems: [],
  checklist: { required: 2, in: 1, missing: 1 }, createdById: "usr_ops",
  pricing: { line: "Toyota Vios, All variants", policyYears: 5, payerLabel: "Dealer", year1: { grossPremium: 35634.84 }, schedule: [{ year: 1, sumInsured: 1000000, grossPremium: 35634.84, whoPays: "Dealer" }] },
  items: [
    { id: 1, code: "SCH-LOAN", document: "Loan booking advice from TFSPH", kyc: false, required: true, canWaive: false, status: "received", statusLabel: "Received", remark: "Original on file" },
    { id: 2, code: "SCH-MORTGAGE", document: "Chattel mortgage", kyc: false, required: true, canWaive: true, status: "waiver-requested", statusLabel: "Waiver requested",
      waiverReason: "LTO registration in progress", waiverRequestedById: "usr_ops" },
  ],
  gate: { in: 1, required: 2, missing: 1 },
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-ops-officer"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:scheme-issuance", "write:scheme-issuance"]));
  localStorage.setItem("USER_ID", "usr_ops");
  service.list.mockResolvedValue({ data: [APP], counts: { all: 1, ready: 1 } });
  service.get.mockResolvedValue(APP);
  service.bookings.mockResolvedValue([{ id: "sbb_1", batchNumber: "SB-2026-90003", fileName: "tfs-bookings.xlsx", rowsTotal: 25, rowsCreated: 23, rowsFailed: 2 }]);
  service.choices.mockResolvedValue({ schemes: [{ value: "sch_1", label: "S1-STD-2026", schemeType: "scheme1", insurerIds: [2] }], banks: [], paymentModes: [{ code: "ADA", label: "ADA" }],
    kycSources: [], primaryIds: ["PhilID"], secondaryIds: [] });
  mastersService.options.mockResolvedValue([{ id: 2, label: "Pioneer Insurance & Surety Corp." }]);
  distributionService.channelOptions.mockResolvedValue([]);
});

describe("Scheme Issuance", () => {
  it("lists the applications with the scheme, loan, premium and documents; the uploads tab lists the loan bookings batches", async () => {
    render(<MemoryRouter><SchemeIssuance /></MemoryRouter>);
    expect(await screen.findByText("SAP-2026-90012")).toBeInTheDocument();
    expect(screen.getByText("8005123456")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Loan bookings upload"));
    expect(await screen.findByText("SB-2026-90003")).toBeInTheDocument();
  });

  it("a new application keeps a Draft of what is missing: the save is sent and the field errors shown", async () => {
    service.create.mockRejectedValue(Object.assign(new Error("The TFS loan account must have 10 digits"), { errors: [{ path: "loanAccount", message: "The TFS loan account must have 10 digits" }] }));
    render(<MemoryRouter><SchemeIssuance /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "New application" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect((await within(dialog).findAllByText("The TFS loan account must have 10 digits")).length).toBeGreaterThan(0);
    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ loanTermMonths: 60, borrower: expect.objectContaining({ nationality: "Filipino" }) }));
  });

  it("the application page: the checklist, Send to insurer when Ready; the requester of a waiver cannot decide it", async () => {
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:scheme-issuance", "write:scheme-issuance", "approve:scheme-issuance"]));
    render(<MemoryRouter initialEntries={["/sales/scheme-issuance/sap_1"]}><Routes><Route path="/sales/scheme-issuance/:id" element={<SchemeApplication />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("Loan booking advice from TFSPH")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 required documents in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send to insurer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve waiver" })).toBeNull();
  });

  it("another approver decides the waiver", async () => {
    localStorage.setItem("USER_ID", "usr_head");
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:scheme-issuance", "approve:scheme-issuance"]));
    render(<MemoryRouter initialEntries={["/sales/scheme-issuance/sap_1"]}><Routes><Route path="/sales/scheme-issuance/:id" element={<SchemeApplication />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "Approve waiver" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject waiver" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send to insurer" })).toBeNull();
  });
});
