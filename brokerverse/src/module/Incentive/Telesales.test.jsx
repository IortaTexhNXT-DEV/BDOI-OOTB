import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "../../i18n";
import incentiveService from "../../services/incentiveService";
import BatchDetailDialog from "./BatchDetailDialog";
import { telesalesLine } from "./Statement";
import TelesalesProgramDialog, { ancTo, upTo } from "../FinanceMastersModule/IncentiveMaster/IncentiveProgramMaster/TelesalesProgramDialog";

jest.mock("../../services/incentiveService", () => ({
  __esModule: true,
  default: {
    getCalculation: jest.fn(), calculationActivity: jest.fn(), batchPolicies: jest.fn(), excludePolicy: jest.fn(), includePolicy: jest.fn(), recalculate: jest.fn(), exportBatch: jest.fn(),
    telesalesDefaults: jest.fn(), telesalesOptions: jest.fn(), getTelesalesProgram: jest.fn(), createTelesalesProgram: jest.fn(), saveTelesalesDraft: jest.fn(), submitTelesalesVersion: jest.fn(),
  },
}));

const signIn = (permissions) => {
  localStorage.setItem("user", JSON.stringify({ userId: "usr_acct", username: "acct" }));
  localStorage.setItem("USER_ROLES", JSON.stringify(["accounting"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};
afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

const LINE = { id: 4, agentId: "usr_g", agentName: "Geralyn Ramos", program: "Telesales Incentive Program", counted: 37, nbCount: 31, renewalCount: 6, anc: 6412.5, level: 3,
  baseAmount: 23800, additionalAmount: 2000, recoveryAmount: 0, taxAmount: 1290, whtPct: 5, result: "Qualified", adjustments: 0, finalAmount: 24510 };
const BATCH = { batchId: "CALC-2026-00011", period: "September 2026", periodFrom: "2026-09-01", periodTo: "2026-09-30", programsIncluded: ["TSI-2026-001"], status: "Calculated",
  isTelesales: true, totalAmount: 24510, grossTotal: 25800, taxTotal: 1290, agentCount: 1, createdBy: "Accounting", details: [LINE],
  executionLog: [{ at: "2026-10-05T06:00:00Z", step: "Calculation complete", detail: null }] };
const POLICY = { id: 1, policyId: "pol_1", policyNumber: "POL-2026-004655", caller: "Geralyn Ramos", kind: "NB", fullyPaidOn: "2026-09-12", commissionSettledOn: "2026-09-21",
  eligibleOn: "2026-09-21", netCommission: 6412.5, status: "Counted" };

describe("telesales batch (FR-TSI-031 to 035, 042)", () => {
  beforeEach(() => {
    incentiveService.getCalculation.mockResolvedValue(BATCH);
    incentiveService.calculationActivity.mockResolvedValue([]);
    incentiveService.batchPolicies.mockResolvedValue([POLICY]);
  });

  it("shows the telesales columns, the policies, Export and Recalculate to a user who calculates", async () => {
    signIn(["read:incentive", "write:incentive"]);
    render(<BatchDetailDialog batchId="CALC-2026-00011" onHide={() => {}} onChanged={() => {}} />);
    expect(await screen.findByText("37 (31 / 6)")).toBeInTheDocument();
    expect(screen.getByText("Qualified")).toBeInTheDocument();
    expect(screen.getByText("Tax 5.00% (PHP)")).toBeInTheDocument();
    expect(await screen.findByText("POL-2026-004655")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export to Excel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recalculate" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exclude" }));
    await screen.findByText("Exclude policy POL-2026-004655");
    const buttons = screen.getAllByRole("button", { name: "Exclude", hidden: true });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(await screen.findByText("A reason and a remark are required to exclude a policy")).toBeInTheDocument();
    expect(incentiveService.excludePolicy).not.toHaveBeenCalled();
  });

  it("offers neither Exclude nor Recalculate to a reader or on an approved batch", async () => {
    incentiveService.getCalculation.mockResolvedValue({ ...BATCH, status: "Approved" });
    signIn(["read:incentive", "write:incentive"]);
    render(<BatchDetailDialog batchId="CALC-2026-00011" onHide={() => {}} onChanged={() => {}} />);
    expect(await screen.findByText("POL-2026-004655")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exclude" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Recalculate" })).toBeNull();
  });

  it("words the statement line of a caller", () => {
    const t = (k, o) => ({ "incentive.telesales.counted": "Counted", "incentive.telesales.anc": "ANC", "incentive.telesales.level": "Level", "incentive.telesales.base": "Base",
      "incentive.telesales.recovery": "Recovery", "incentive.telesales.tax": `Tax ${o?.pct}%` }[k] || k);
    const text = telesalesLine({ counted: 16, nbCount: 12, renewalCount: 4, anc: 3905.1, level: 1, baseAmount: 4200, additionalAmount: 0, recoveryAmount: -300, taxAmount: 195, whtPct: 5 }, t);
    expect(text).toMatch(/^Counted: 16 \(12 \/ 4\)/);
    expect(text).toMatch(/Recovery/);
    expect(text).not.toMatch(/additional/);
  });
});

describe("telesales program dialog (FR-TSI-001 to 005)", () => {
  const DEFAULTS = { minPolicies: 15, whtPct: 5, excessMethod: "banded", effectiveFrom: "2026-11-01", targetMetric: "Average Net Commission (ANC)", products: [{ id: 2, name: "Motor Vehicle Insurance" }],
    defaultProducts: [2], tiers: [{ ancFrom: 2500, nbAmount: 300, renewalAmount: 150 }, { ancFrom: 4000, nbAmount: 500, renewalAmount: 250 }], bands: [{ over: 30, every: 5, amount: 2000 }] };
  beforeEach(() => {
    incentiveService.telesalesDefaults.mockResolvedValue(DEFAULTS);
    incentiveService.telesalesOptions.mockResolvedValue({ callers: [], teamLeaders: [], insurers: [] });
  });

  it("fills ANC to from the next level and Up to from the next band", () => {
    expect(ancTo(DEFAULTS.tiers, 0)).toBe(3999.99);
    expect(ancTo(DEFAULTS.tiers, 1)).toBeNull();
    expect(upTo([{ over: 30 }, { over: 50 }], 0)).toBe(50);
    expect(upTo([{ over: 30 }], 0)).toBeNull();
  });

  it("proposes the delivered defaults and shows the server's message under the field", async () => {
    signIn(["write:masters"]);
    const error = Object.assign(new Error("Validation failed"), { errors: [{ path: "products", message: "Telesales programs apply to Motor products only" }] });
    incentiveService.createTelesalesProgram.mockRejectedValue(error);
    render(<TelesalesProgramDialog visible onHide={() => {}} onSaved={() => {}} />);
    expect(await screen.findByDisplayValue("15")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(incentiveService.createTelesalesProgram).toHaveBeenCalledWith(expect.objectContaining({ minPolicies: 15, whtPct: 5, products: [2], effectiveFrom: "2026-11-01" })));
    expect(await screen.findByText("Telesales programs apply to Motor products only")).toBeInTheDocument();
  });
});
