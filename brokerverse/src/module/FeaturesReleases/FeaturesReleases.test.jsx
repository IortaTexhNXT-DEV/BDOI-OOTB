import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import featuresService from "../../services/featuresService";
import { openConfirm } from "../../components/ConfirmDialog";
import FeatureCatalogue from "./FeatureCatalogue";
import PlatformFeatures from "./PlatformFeatures";

jest.mock("../../services/featuresService", () => ({
  __esModule: true,
  default: {
    catalogue: jest.fn(), exportCatalogue: jest.fn(), platformFeatures: jest.fn(), changes: jest.fn(), admins: jest.fn(), preview: jest.fn(),
    requestChange: jest.fn(), decide: jest.fn(), withdraw: jest.fn(), exportState: jest.fn(), promote: jest.fn(), addAdmin: jest.fn(), refreshState: jest.fn(),
    enabling: jest.fn(), tenantPreview: jest.fn(), tenantChanges: jest.fn(), tenantRequestChange: jest.fn(), tenantDecide: jest.fn(), tenantWithdraw: jest.fn(),
  },
}));
jest.mock("../../components/ConfirmDialog", () => ({ ...jest.requireActual("../../components/ConfirmDialog"), openConfirm: jest.fn() }));

const rows = [
  { key: "receipts", name: "Receipts and post-dated cheques", module: "Accounts", tier: "PHASE_1", status: "on", alwaysOn: true, requirements: ["TIS-BRD-COLL-03"],
    dependsOn: [], decisionPending: false, enabledAt: null, enabledBy: null, releaseRef: null, description: "Official receipts" },
  { key: "payables", name: "Accounts payable", module: "Accounts", tier: "PHASE_2", status: "on", alwaysOn: false, requirements: ["TIS-BRD-NIA-03"],
    dependsOn: ["suppliers"], decisionPending: false, enabledAt: "2026-10-10T02:00:00Z", enabledBy: "iorta TechNXT", releaseRef: "CR-2027-004", description: "Supplier invoices" },
  { key: "fixed-assets", name: "Fixed assets", module: "Accounts", tier: "PHASE_2", status: "off", alwaysOn: false, requirements: ["TIS-BRD-NIA-07", "MOM-S5-AP-ASSET-MASTER"],
    dependsOn: [], decisionPending: false, decision: { id: "FT-D01", question: "Asset master?", options: ["Phase 2 (enable with Phase 2)", "Asset master in Phase 1"],
      decided: { answer: "Phase 2 (enable with Phase 2)", by: "TISPH", on: "2026-10-11" } }, enabledAt: null, enabledBy: null, releaseRef: null, description: "Asset register" },
  { key: "campaigns", name: "Marketing campaigns", module: "Sales & Marketing", tier: "FUTURE", status: "off", alwaysOn: false, requirements: [],
    dependsOn: [], decisionPending: true, decision: { question: "Wanted?", options: ["No", "Yes"] }, enabledAt: null, enabledBy: null, releaseRef: null,
    description: "E-mail campaigns to consenting clients" },
];

const change = (extra) => ({ action: "enable", tier: null, plan: [{ key: "fixed-assets", name: "Fixed assets" }], reason: "Decision of TISPH", releaseRef: "TISPH-FT-D01",
  immediate: true, status: "pending", requestedAt: "2026-10-11T02:00:00Z", ...extra });

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ID", "usr_maker");
  featuresService.catalogue.mockResolvedValue(rows);
  featuresService.platformFeatures.mockResolvedValue(rows);
  featuresService.enabling.mockResolvedValue({ canEnable: false, tiers: ["PHASE_2"], approval: "four-eyes" });
  featuresService.changes.mockResolvedValue([
    { id: 1, ref: "FCR-00001", action: "enable", tier: "PHASE_2", plan: [{ key: "payables", name: "Accounts payable" }], reason: "Contracted release", releaseRef: "CR-1",
      immediate: true, status: "pending", requestedBy: "usr_maker", requestedByName: "Maker", requestedAt: "2026-10-10T02:00:00Z" },
  ]);
  featuresService.admins.mockResolvedValue([]);
  featuresService.refreshState.mockResolvedValue([]);
});

describe("Features & Releases (TISPH, read only)", () => {
  it("lists the catalogue with tier, status and enabling facts, without any enable control", async () => {
    render(<MemoryRouter><FeatureCatalogue /></MemoryRouter>);
    const table = await screen.findByTestId("feature-catalogue");
    expect(await within(table).findByText("Accounts payable")).toBeInTheDocument();
    expect(within(table).getByText("CR-2027-004")).toBeInTheDocument();
    // FT-D01 is decided (Phase 2); only the open decisions are flagged pending
    expect(within(table).getAllByText("Decision pending").length).toBe(1);
    expect(within(table).getByText("Decided by TISPH FT-D01")).toBeInTheDocument();
    await waitFor(() => expect(featuresService.enabling).toHaveBeenCalled());
    expect(screen.queryByText("Enable Phase 2")).toBeNull();
    expect(screen.queryByText(/Enable selected/)).toBeNull();
    expect(featuresService.tenantChanges).not.toHaveBeenCalled();
    expect(screen.getByText("Export to Excel")).toBeInTheDocument();
  });
});

describe("Features & Releases (SUPERID of TISPH)", () => {
  beforeEach(() => {
    featuresService.enabling.mockResolvedValue({ canEnable: true, tiers: ["PHASE_2"], approval: "four-eyes" });
    featuresService.tenantChanges.mockResolvedValue([
      change({ id: 2, ref: "FCR-00002", channel: "tenant", requestedBy: "usr_other", requestedByName: "Second SUPERID" }),
      change({ id: 3, ref: "FCR-00003", channel: "tenant", requestedBy: "usr_maker", requestedByName: "Me", plan: [{ key: "sales-dashboard", name: "Sales dashboard" }] }),
      change({ id: 4, ref: "FCR-00004", channel: "platform", requestedBy: "usr_vendor", requestedByName: "Vendor", plan: [{ key: "payables", name: "Accounts payable" }] }),
    ]);
    featuresService.tenantPreview.mockResolvedValue({ action: "enable", tier: "PHASE_2", changes: 1, features: [{ key: "fixed-assets", name: "Fixed assets", tier: "PHASE_2", from: "off", to: "on", records: 0, reason: "requested" }],
      menus: ["Accounts > Fixed Assets > Asset Register"], roles: [{ code: "tis-finance", name: "TIS Finance" }], jobs: [], connectors: [], settings: [], sections: [], readOnly: [] });
  });

  it("offers Enable Phase 2 with the impact preview of the tenant routes", async () => {
    render(<MemoryRouter><FeatureCatalogue /></MemoryRouter>);
    fireEvent.click(await screen.findByTestId("enable-phase-2"));
    await waitFor(() => expect(featuresService.tenantPreview).toHaveBeenCalledWith({ action: "enable", tier: "PHASE_2" }));
    expect(await screen.findByText("Accounts > Fixed Assets > Asset Register")).toBeInTheDocument();
    expect(screen.getByText("TIS Finance")).toBeInTheDocument();
    expect(featuresService.preview).not.toHaveBeenCalled();
  });

  it("lets a Phase 2 row be selected for enable or disable, never a Phase 1 or future row", async () => {
    render(<MemoryRouter><FeatureCatalogue /></MemoryRouter>);
    const table = await screen.findByTestId("feature-catalogue");
    await within(table).findByText("Fixed assets");
    expect(screen.getByTestId("enable-selected")).toBeDisabled();
    const rowOf = (name) => within(table).getByRole("row", { name: new RegExp(name) });
    // a Phase 1 or future-release row cannot be selected
    for (const name of ["Receipts and post-dated cheques", "Marketing campaigns"]) {
      const box = within(rowOf(name)).queryByRole("checkbox");
      if (box) fireEvent.click(box);
    }
    expect(screen.getByTestId("enable-selected")).toBeDisabled();
    fireEvent.click(within(rowOf("Fixed assets")).getByRole("checkbox"));
    expect(screen.getByTestId("enable-selected")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("disable-selected"));
    await waitFor(() => expect(featuresService.tenantPreview).toHaveBeenCalledWith({ action: "disable", features: ["fixed-assets"] }));
  });

  it("approves a change of another SUPERID, withdraws its own, and leaves a change of the platform alone", async () => {
    openConfirm.mockResolvedValue(true);
    featuresService.tenantDecide.mockResolvedValue({ message: "Change FCR-00002 approved and applied" });
    render(<MemoryRouter initialEntries={["/master/configuration/features?view=changes"]}><FeatureCatalogue /></MemoryRouter>);
    const changes = await screen.findByTestId("tenant-feature-changes");
    expect(await within(changes).findByText("FCR-00002")).toBeInTheDocument();
    expect(within(changes).queryByRole("button", { name: "Actions for FCR-00004" })).toBeNull();
    fireEvent.click(within(changes).getByRole("button", { name: "Actions for FCR-00003" }));
    const own = await screen.findAllByRole("menuitem");
    expect(own.map((m) => m.textContent)).toEqual(expect.arrayContaining([expect.stringMatching(/another SUPERID/), "Withdraw"]));
    fireEvent.keyDown(own[0], { key: "Escape" });
    fireEvent.click(within(changes).getByRole("button", { name: "Actions for FCR-00002" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    await waitFor(() => expect(featuresService.tenantDecide).toHaveBeenCalledWith(2, { decision: "approve" }));
    expect(featuresService.decide).not.toHaveBeenCalled();
  });
});

describe("Features & Releases (platform administrator)", () => {
  it("offers Enable Phase 2 and lists a change of its own without the approval", async () => {
    render(<MemoryRouter initialEntries={["/master/platform/features?view=changes"]}><PlatformFeatures /></MemoryRouter>);
    expect(screen.getByTestId("enable-phase-2")).toBeInTheDocument();
    const changes = await screen.findByTestId("feature-changes");
    expect(await within(changes).findByText("FCR-00001")).toBeInTheDocument();
  });
});
