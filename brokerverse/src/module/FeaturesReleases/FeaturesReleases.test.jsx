import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import featuresService from "../../services/featuresService";
import FeatureCatalogue from "./FeatureCatalogue";
import PlatformFeatures from "./PlatformFeatures";

jest.mock("../../services/featuresService", () => ({
  __esModule: true,
  default: {
    catalogue: jest.fn(), exportCatalogue: jest.fn(), platformFeatures: jest.fn(), changes: jest.fn(), admins: jest.fn(), preview: jest.fn(),
    requestChange: jest.fn(), decide: jest.fn(), withdraw: jest.fn(), exportState: jest.fn(), promote: jest.fn(), addAdmin: jest.fn(), refreshState: jest.fn(),
  },
}));

const rows = [
  { key: "receipts", name: "Receipts and post-dated cheques", module: "Accounts", tier: "PHASE_1", status: "on", alwaysOn: true, requirements: ["TIS-BRD-COLL-03"],
    dependsOn: [], decisionPending: false, enabledAt: null, enabledBy: null, releaseRef: null, description: "Official receipts" },
  { key: "payables", name: "Accounts payable", module: "Accounts", tier: "PHASE_2", status: "on", alwaysOn: false, requirements: ["TIS-BRD-NIA-03"],
    dependsOn: ["suppliers"], decisionPending: false, enabledAt: "2026-10-10T02:00:00Z", enabledBy: "iorta TechNXT", releaseRef: "CR-2027-004", description: "Supplier invoices" },
  { key: "campaigns", name: "Marketing campaigns", module: "Sales & Marketing", tier: "FUTURE", status: "off", alwaysOn: false, requirements: [],
    dependsOn: [], decisionPending: true, decision: { question: "Wanted?", options: ["No", "Yes"] }, enabledAt: null, enabledBy: null, releaseRef: null,
    description: "E-mail campaigns to consenting clients" },
];

beforeEach(() => {
  localStorage.setItem("USER_ID", "usr_maker");
  featuresService.catalogue.mockResolvedValue(rows);
  featuresService.platformFeatures.mockResolvedValue(rows);
  featuresService.changes.mockResolvedValue([
    { id: 1, ref: "FCR-00001", action: "enable", tier: "PHASE_2", plan: [{ key: "payables", name: "Accounts payable" }], reason: "Contracted release", releaseRef: "CR-1",
      immediate: true, status: "pending", requestedBy: "usr_maker", requestedByName: "Maker", requestedAt: "2026-10-10T02:00:00Z" },
  ]);
  featuresService.admins.mockResolvedValue([]);
});

describe("Features & Releases (TISPH, read only)", () => {
  it("lists the catalogue with tier, status and enabling facts, without any enable control", async () => {
    render(<MemoryRouter><FeatureCatalogue /></MemoryRouter>);
    const table = await screen.findByTestId("feature-catalogue");
    expect(await within(table).findByText("Accounts payable")).toBeInTheDocument();
    expect(within(table).getByText("CR-2027-004")).toBeInTheDocument();
    expect(within(table).getAllByText("Decision pending").length).toBe(1);
    expect(screen.queryByText("Enable Phase 2")).toBeNull();
    expect(screen.queryByText(/Enable selected/)).toBeNull();
    expect(screen.getByText("Export to Excel")).toBeInTheDocument();
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
