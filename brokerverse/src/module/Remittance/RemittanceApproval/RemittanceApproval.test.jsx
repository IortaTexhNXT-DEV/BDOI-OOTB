import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RemittanceApproval from "./index";
import remittanceService from "../../../services/remittanceService";
import opsAccountingService from "../../../services/opsAccountingService";
import { loadSettings } from "../shared";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, d) => (typeof d === "string" ? d : d?.defaultValue) || k }) }));
jest.mock("../../../hooks/useFormatCurrency", () => ({ useFormatCurrency: () => ({ formatCurrency: (v) => `PHP ${v}` }) }));
jest.mock("../../../services/authService", () => ({ __esModule: true, default: { getUser: () => ({ userId: "usr_me" }) } }));
jest.mock("../../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn() } }));
jest.mock("../../../services/remittanceService", () => ({
  __esModule: true,
  default: { listApprovals: jest.fn(), approvalHistory: jest.fn(), listApprovers: jest.fn(), approve: jest.fn(), reject: jest.fn(), delegate: jest.fn() },
}));
jest.mock("../shared", () => ({
  ...jest.requireActual("../shared"),
  loadSettings: jest.fn(),
}));

const ROW = { id: 21, priority: "Normal", referenceNo: "REM-2026-00021", transactionType: "Insurer Remittance", initiator: "M. Reyes", initiatorId: "usr_4",
  submissionDate: "2026-10-06 10:12", amount: 409141.43, slaHours: 24, slaRemaining: 12, currentLevel: 1, requiredLevels: 1, status: "Pending" };
const REASONS = [
  { code: "RRJ-RATES", name: "Rates to be corrected", context: "remittance_reject", requiresNote: false, sortOrder: 1130, status: "Active" },
  { code: "RRJ-OTHER", name: "Other", context: "remittance_reject", requiresNote: true, sortOrder: 1190, status: "Active" },
];

const pick = async (label, option) => {
  fireEvent.keyDown(screen.getByLabelText(label), { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, altKey: true });
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(option), hidden: true }));
};

describe("Remittance approval: rejecting", () => {
  beforeEach(() => {
    remittanceService.listApprovals.mockResolvedValue([ROW]);
    remittanceService.approvalHistory.mockResolvedValue([]);
    remittanceService.listApprovers.mockResolvedValue([]);
    remittanceService.reject.mockResolvedValue({});
    opsAccountingService.masterRecords.mockResolvedValue({ rows: REASONS });
    loadSettings.mockResolvedValue({});
  });

  it("asks for a reason of the remittance rejection list and sends its code, never free text", async () => {
    render(<MemoryRouter><RemittanceApproval /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "common.reject" }));
    await waitFor(() => expect(opsAccountingService.masterRecords).toHaveBeenCalledWith("reason-code", { status: "Active", context: "remittance_reject" }));
    // nothing is sent until a reason is chosen
    fireEvent.click(screen.getByRole("button", { name: "remittance.approvals.rejectVerb" }));
    expect(await screen.findByText("Choose the reason")).toBeInTheDocument();
    expect(remittanceService.reject).not.toHaveBeenCalled();
    await pick("Reason*", "Rates to be corrected");
    fireEvent.click(screen.getByRole("button", { name: "remittance.approvals.rejectVerb" }));
    await waitFor(() => expect(remittanceService.reject).toHaveBeenCalledWith(21, { reasonCode: "RRJ-RATES", note: undefined }));
  });
});
