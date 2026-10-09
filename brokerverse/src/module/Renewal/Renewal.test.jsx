import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import "../../i18n";
import AtRiskAnalysis from "./AtRiskAnalysis";
import NegotiationWorkspace from "./NegotiationWorkspace";
import service from "../../services/renewalsWorkspaceService";
import myWorkService from "../../services/myWorkService";
import { claimLobOf, lobUses, lossCauseOptions } from "../../agentModule/claimsModule/shared/claimJourney";
import { mapToApiLob } from "../../agentModule/claimsModule/claimDetails/store/claimDetailsMiddleWare";

jest.mock("../../services/renewalsWorkspaceService", () => ({
  __esModule: true,
  default: { getAtRisk: jest.fn(), getRenewal: jest.fn(), escalate: jest.fn(), getNegotiations: jest.fn(), decide: jest.fn(), addActivity: jest.fn(), submitForApproval: jest.fn() },
}));
jest.mock("../../services/myWorkService", () => ({
  __esModule: true,
  errorMessage: (e, fallback) => e?.message || fallback,
  default: { assignees: jest.fn(), createTask: jest.fn() },
}));

const store = configureStore({ reducer: { systemSettingsReducer: () => ({ displayCurrency: "PHP" }) } });
const wrap = (ui) => render(<Provider store={store}><MemoryRouter>{ui}</MemoryRouter></Provider>);

const RISK = {
  id: "rnw_1", renewalNumber: "RN-2026-00001", policyId: "pol_1", policyNumber: "POL-2025-00014", insuredName: "Mindanao Agri Trading Inc.", product: "Motor Vehicle Insurance",
  insurer: "FPG Insurance", expiryDate: "2026-11-12", daysToExpiry: 34, status: "Quote Sent", currentPremium: 68200, renewalPremium: 90931.5, riskScore: 60, riskCategory: "High",
  riskFactors: [{ code: "claims", factor: "Claims History", score: 25, details: "2 claims in the current term" }, { code: "firstRenewal", factor: "First Renewal", score: 15, details: "First renewal with the broker" },
    { code: "increase", factor: "Premium Increase", score: 20, details: "Premium up 33.3% on the renewal quote" }],
  scoreBreakdown: [
    { code: "claims", factor: "Claims History", value: "2 claims in the current term", weight: 25, points: 25 },
    { code: "unpaid", factor: "Unpaid Premium", value: null, weight: 20, points: 0 },
    { code: "firstRenewal", factor: "First Renewal", value: "First renewal with the broker", weight: 15, points: 15 },
    { code: "increase", factor: "Premium Increase", value: "Premium up 33.3% on the renewal quote", weight: 20, points: 20 },
  ],
  recommendedActions: ["Prepare an alternative quote", "Escalate to the unit head"], nextAction: null, lastContactDate: null, assignedAgent: "Ana Reyes",
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:renewals", "write:renewals", "approve:renewals"]));
  service.getAtRisk.mockResolvedValue([RISK]);
  service.getRenewal.mockResolvedValue({ activities: [{ id: 1, date: "2026-10-02", type: "Reminder", method: "Phone", description: "Called the client", by: "ana" }], notices: [] });
  myWorkService.assignees.mockResolvedValue([{ id: "usr_1", displayName: "Ana Reyes", self: true }]);
});

describe("At-Risk Policies", () => {
  it("lists the main drivers in plain words and opens the score breakdown as a table", async () => {
    wrap(<AtRiskAnalysis />);
    expect(await screen.findByText("2 claims in the current term")).toBeInTheDocument();
    expect(screen.getByText("Premium up 33.3% on the renewal quote")).toBeInTheDocument();
    expect(screen.queryByText(/statistically/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "POL-2025-00014" }));
    const breakdown = (await screen.findByText("Score breakdown")).closest("section");
    const rows = within(breakdown).getAllByRole("row");
    expect(rows.map((r) => r.textContent)).toEqual(expect.arrayContaining([expect.stringMatching(/Unpaid premium.*Not found.*20.*0/)]));
    expect(within(breakdown).getByText("Risk score (High)").closest("tr")).toHaveTextContent("60");
    expect(await screen.findByText("Called the client")).toBeInTheDocument();
  });

  it("creates a My Work task on the renewal from a recommended action", async () => {
    myWorkService.createTask.mockResolvedValue({ id: "tsk_1", title: "Prepare an alternative quote" });
    wrap(<AtRiskAnalysis />);
    fireEvent.click(await screen.findByRole("button", { name: "POL-2025-00014" }));
    const item = (await screen.findByText("Prepare an alternative quote")).closest("li");
    fireEvent.click(within(item).getByRole("button", { name: "Create task" }));
    const dialog = await screen.findByRole("dialog", { name: "New task" });
    expect(within(dialog).getByDisplayValue("Prepare an alternative quote")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create task" }));
    await waitFor(() => expect(myWorkService.createTask).toHaveBeenCalled());
    expect(myWorkService.createTask.mock.calls[0][0]).toMatchObject({ title: "Prepare an alternative quote", entity: "renewal", entityId: "rnw_1", priority: "high" });
  });

  it("escalates to the unit head from the recommended action", async () => {
    service.escalate.mockResolvedValue({ escalatedTo: [{ id: "usr_9", name: "Carlo Mendoza" }] });
    wrap(<AtRiskAnalysis />);
    fireEvent.click(await screen.findByRole("button", { name: "POL-2025-00014" }));
    const item = (await screen.findByText("Escalate to the unit head")).closest("li");
    fireEvent.click(within(item).getByRole("button", { name: "Escalate" }));
    const dialog = await screen.findByRole("dialog", { name: "Escalate to the unit head" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Escalate" }));
    await waitFor(() => expect(service.escalate).toHaveBeenCalledWith("rnw_1", undefined));
  });
});

describe("Negotiations", () => {
  const row = (statusCode, currentStage) => ({ id: `rnw_${statusCode}`, negotiationId: `RN-${statusCode}`, policyNumber: `POL-${statusCode}`, clientName: "Liza Mendoza", statusCode, currentStage,
    currentPremium: 27590, quotedPremium: 28950, premiumVariancePct: 4.9, expiryDate: "2026-11-22", daysToExpiry: 43, timeline: [], salesPerson: "Ana Reyes" });

  it("offers only the actions the stage of the selected renewal allows", async () => {
    service.getNegotiations.mockResolvedValue([row("pending-approval", "Pending Approval"), row("quoted", "Quote Sent")]);
    wrap(<NegotiationWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "POL-pending-approval" }));
    expect(await screen.findByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for approval" })).toBeNull();
  });
});

describe("claim sections by line of business", () => {
  const config = { lobFields: { MOTOR: ["driver", "vehicle"], default: [] }, lossCauses: { ACCIDENT: ["Death", "Disability", "Bodily Injury / Medical"], LIFE: ["Death - Natural Causes / Illness"], default: ["Accident"] } };

  it("reads the line of business of Credit Life, Personal Accident and motor products", () => {
    expect(claimLobOf("Credit Life - Voluntary")).toBe("LIFE");
    expect(claimLobOf("Personal Accident")).toBe("ACCIDENT");
    expect(claimLobOf(null, "Motor Vehicle Insurance")).toBe("MOTOR");
    expect(mapToApiLob("Credit Life - Compulsory")).toBe("LIFE");
    expect(mapToApiLob("Fire and Allied Perils")).toBe("FIRE");
    expect(mapToApiLob("")).toBe("MOTOR");
  });

  it("keeps the driver and vehicle sections to motor and offers the causes of the line", () => {
    expect(lobUses(config, "MOTOR", "driver")).toBe(true);
    expect(lobUses(config, "ACCIDENT", "driver")).toBe(false);
    expect(lobUses(config, "LIFE", "vehicle")).toBe(false);
    expect(lossCauseOptions(config, "ACCIDENT").map((o) => o.value)).toEqual(["Death", "Disability", "Bodily Injury / Medical"]);
    expect(lossCauseOptions(config, "LIFE").map((o) => o.value)).toEqual(["Death - Natural Causes / Illness"]);
  });
});
