import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../../i18n";
import incentiveService from "../../services/incentiveService";
import opsAccountingService from "../../services/opsAccountingService";
import { printView } from "../../components/Print";
import BatchDetailDialog from "./BatchDetailDialog";
import { formatMeasure, monthOptions } from "./common";
import MyPrograms, { tierPayout } from "./MyPrograms";
import Statement from "./Statement";
import { parameterField, reportParameters } from "./Reports";

jest.mock("../../services/incentiveService", () => ({
  __esModule: true,
  default: {
    getCalculation: jest.fn(), calculationActivity: jest.fn(), rejectCalculation: jest.fn(), approveCalculation: jest.fn(), myPrograms: jest.fn(), agents: jest.fn(),
    statement: jest.fn(),
  },
}));
jest.mock("../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn() } }));
jest.mock("primereact/chart", () => ({ Chart: () => <div data-testid="chart" /> }));
jest.mock("../../components/Print", () => ({
  ...jest.requireActual("../../components/Print"),
  printView: jest.fn(),
}));

const signIn = (user, permissions) => {
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("USER_ROLES", JSON.stringify(["accounting"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};
afterEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

const BATCH = {
  batchId: "CALC-2026-00007", period: "September 2026", periodFrom: "2026-09-01", periodTo: "2026-09-30", programsIncluded: ["INC-2026-002"], status: "Pending Approval",
  totalAmount: 61500, agentCount: 3, createdBy: "Mara Maker", createdById: "usr_maker", createdByUsername: "m.maker", submittedBy: "Sid Submitter",
  submittedById: "usr_sub", submittedByUsername: "s.sub", submittedAt: "2026-10-01T02:00:00.000Z", createdAt: "2026-10-01T01:00:00.000Z",
  details: [{ id: 1, agentName: "Juan Dela Cruz", agentCode: "AG001", program: "New Business Champion", metric: "policies", achieved: 18, achievementPercent: 90,
    tier: "11-20 policies", adjustments: 0, baseIncentive: 13500, finalAmount: 13500 }],
};
const ACTIVITY = [{ id: "1", at: "2026-10-01T01:00:00.000Z", date: "01/10/2026", time: "09:00", actionCode: "calculate", actionLabel: "Calculate",
  user: { username: "m.maker", displayName: "Mara Maker", roles: ["Accounting"], role: "Accounting" }, fromStatus: null, toStatus: "Calculated", remarks: "September run", changes: [] }];

const pick = async (label, option) => {
  fireEvent.keyDown(screen.getByLabelText(label), { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, altKey: true });
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(option), hidden: true }));
};

describe("calculation batch details", () => {
  beforeEach(() => {
    incentiveService.getCalculation.mockResolvedValue(BATCH);
    incentiveService.calculationActivity.mockResolvedValue(ACTIVITY);
  });

  it("shows the batch in one view with its facts, agent results and activity, without tabs", async () => {
    signIn({ userId: "usr_chk", username: "c.check" }, ["read:incentive", "write:incentive", "approve:incentive"]);
    render(<BatchDetailDialog batchId="CALC-2026-00007" onHide={() => {}} onChanged={() => {}} />);
    expect(await screen.findByRole("heading", { name: "CALC-2026-00007" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.getByRole("heading", { name: "Summary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agent results" })).toBeInTheDocument();
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("11-20 policies")).toBeInTheDocument();
    expect(await screen.findByText("September run")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve batch" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
  });

  it("disables the decision for the user who ran or submitted the batch and says why", async () => {
    signIn({ userId: "usr_sub", username: "s.sub" }, ["read:incentive", "write:incentive", "approve:incentive"]);
    render(<BatchDetailDialog batchId="CALC-2026-00007" onHide={() => {}} onChanged={() => {}} />);
    expect(await screen.findByRole("button", { name: "Approve batch" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(screen.getByText("You ran or submitted this batch. A different user must approve or reject it.")).toBeInTheDocument();
  });

  it("disables the decision without the approval permission", async () => {
    signIn({ userId: "usr_other", username: "o.other" }, ["read:incentive", "write:incentive"]);
    render(<BatchDetailDialog batchId="CALC-2026-00007" onHide={() => {}} onChanged={() => {}} />);
    expect(await screen.findByRole("button", { name: "Approve batch" })).toBeDisabled();
    expect(screen.getByText("Approving incentive batches needs the incentive approval permission.")).toBeInTheDocument();
  });

  it("rejects with a reason of the Reason Codes master", async () => {
    signIn({ userId: "usr_chk", username: "c.check" }, ["read:incentive", "write:incentive", "approve:incentive"]);
    opsAccountingService.masterRecords.mockResolvedValue({ rows: [
      { code: "IBR-RATES", name: "Rates or targets to be corrected", context: "incentive_batch_reject", requiresNote: false, sortOrder: 1, status: "Active" },
    ] });
    incentiveService.rejectCalculation.mockResolvedValue({ ...BATCH, status: "Rejected" });
    const onChanged = jest.fn();
    render(<BatchDetailDialog batchId="CALC-2026-00007" onHide={() => {}} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject calculation batch" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject batch" }));
    expect(incentiveService.rejectCalculation).not.toHaveBeenCalled();
    await waitFor(() => expect(opsAccountingService.masterRecords).toHaveBeenCalledWith("reason-code", { status: "Active", context: "incentive_batch_reject" }));
    await pick("Reason*", "Rates or targets");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject batch" }));
    await waitFor(() => expect(incentiveService.rejectCalculation).toHaveBeenCalledWith("CALC-2026-00007", { reasonCode: "IBR-RATES", note: undefined }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});

describe("My Programs", () => {
  const program = {
    programId: 2, programCode: "INC-2026-002", programName: "New Business Champion", targetMetric: "Policy Count", metric: "policies", target: 20, achieved: 0,
    achievementPercent: 0, potentialEarning: 0, tier: null, daysRemaining: 0, ended: true, startDate: "2026-07-01", endDate: "2026-09-30", periodFrom: "2026-09-01",
    periodTo: "2026-09-30", calculationFrequency: "Monthly", programStatus: "Active", applicableTo: ["Individual Agent"],
    tiers: [{ level: "0-10 policies", type: "Fixed Amount", value: 500, maxPayout: 5000, basis: "perUnit" }], nextTier: null,
  };

  it("shows a count target as a count, an ended program with its end date, and no empty chart", async () => {
    signIn({ userId: "usr_a", username: "a.agent" }, ["read:profile"]);
    incentiveService.myPrograms.mockResolvedValue({ agentId: "usr_a", assignedPrograms: [program], activity: [] });
    render(<MyPrograms />);
    expect(await screen.findByText("Ended 30/09/2026")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.queryByText("₱20.00")).toBeNull();
    expect(screen.queryByTestId("chart")).toBeNull();
    expect(screen.getByText("No achievement recorded yet in the current periods.")).toBeInTheDocument();
    expect(screen.getByText("No incentive activity yet.")).toBeInTheDocument();
    expect(screen.queryByText(/Tips/)).toBeNull();
  });

  it("opens the program details in one view with tiers and performance", async () => {
    signIn({ userId: "usr_a", username: "a.agent" }, ["read:profile"]);
    incentiveService.myPrograms.mockResolvedValue({ agentId: "usr_a", assignedPrograms: [{ ...program, ended: false, daysRemaining: 12, achieved: 4, achievementPercent: 20,
      nextTier: { level: "11-20 policies", needed: 7 } }], activity: [] });
    render(<MyPrograms />);
    fireEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("tab")).toBeNull();
    expect(within(dialog).getByRole("heading", { name: "Tiers" })).toBeInTheDocument();
    expect(within(dialog).getByText("7 more to reach 11-20 policies")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Based on current achievement/)).toBeNull();
  });

  it("formats measures and tier payouts", () => {
    expect(formatMeasure(20, "policies")).toBe("20");
    expect(formatMeasure(85.5, "renewal-rate")).toBe("85.5%");
    expect(formatMeasure(500000, "premium")).toMatch(/500,000\.00/);
    const t = (k, o) => `${k}:${JSON.stringify(o || {})}`;
    expect(tierPayout({ value: 2, basis: "percentOfAchieved", maxPayout: null }, t)).toContain("payPercentAchieved");
    expect(tierPayout({ value: 500, basis: "perUnit", maxPayout: 5000 }, t)).toContain("payMaximum");
    expect(monthOptions(2, new Date(2026, 1, 10))).toEqual([
      { label: "February 2026", value: "2026-02", from: "2026-02-01", to: "2026-02-28" },
      { label: "January 2026", value: "2026-01", from: "2026-01-01", to: "2026-01-31" },
    ]);
  });
});

describe("Statement", () => {
  it("prints the statement as a document of its own and lists payments as a table", async () => {
    signIn({ userId: "usr_a", username: "a.agent" }, ["read:profile"]);
    printView.mockResolvedValue();
    incentiveService.statement.mockResolvedValue({
      eligible: true, agentName: "Ivy Agent", agentCode: "AG900", branch: "Head Office", period: "September 2026", statementDate: "2026-10-10", totalEarnings: 1000,
      ytdEarnings: 3000, pendingPayment: 0, lastPayment: 1000, lastPaymentDate: "2026-09-30", programBreakdown: [], monthlyTrend: [],
      paymentHistory: [{ batchId: "CALC-2026-00003", period: "September 2026", periodKey: "2026-09", programs: ["New Business Champion"], amount: 1000, status: "Paid",
        paymentDate: "2026-09-30", paymentReference: "PV-1" }],
    });
    render(<Statement />);
    expect(await screen.findByText("PV-1")).toBeInTheDocument();
    expect(screen.queryByText(/Important Notes/)).toBeNull();
    expect(screen.queryByText(/Contact Information/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Print" }));
    await waitFor(() => expect(printView).toHaveBeenCalledTimes(1));
    expect(printView.mock.calls[0][1]).toEqual({ title: "Incentive statement AG900 September 2026" });
  });
});

describe("Reports", () => {
  it("maps the template parameters to the fields the API reads", () => {
    expect(["Period", "Program", "Agent", "Branch", "Date Range", "Minimum Achievement %", "Top N", "Other"].map(parameterField))
      .toEqual(["period", "program", "agent", "branch", "range", "minAchievement", "topN", null]);
    expect(reportParameters({ period: "2026-09", program: null, from: "2026-01-01", to: "", topN: 5 })).toEqual({ period: "2026-09", from: "2026-01-01", topN: 5 });
  });
});
