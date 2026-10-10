import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../../i18n";
import EndorsementWorkflowPanel from "./EndorsementWorkflowPanel";
import endorsementService from "../../../services/endorsementService";

jest.mock("../../../services/endorsementService", () => ({
  __esModule: true,
  default: { getEndorsementWorkflow: jest.fn(), getEndorsementTypes: jest.fn(), setEndorsementTypes: jest.fn(), submitEndorsementForApproval: jest.fn(), decideEndorsement: jest.fn(), sendEndorsementToInsurer: jest.fn() },
}));

const base = (extra = {}) => ({
  endorsementId: "end_1", endorsementNumber: "END-2026-00012", policyId: "pol_1", policyNumber: "POL-2026-95001", premiumDelta: 0, createdById: "usr_maker",
  endorsementTypes: [], endorsementTypeCodes: [], ...extra,
});
const wrap = (props) => render(<MemoryRouter><EndorsementWorkflowPanel endorsementId="end_1" {...props} /></MemoryRouter>);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("USER_ID", "usr_checker");
});

describe("endorsement approval and insurer steps", () => {
  it("a draft needs its types before it is submitted for approval", async () => {
    endorsementService.getEndorsementWorkflow.mockResolvedValue(base({ workflow: { approvalRequired: true, canSubmit: true } }));
    endorsementService.getEndorsementTypes.mockResolvedValue([{ code: "CPLT", name: "Change of Plate Number", section: "vehicle" }]);
    wrap();
    fireEvent.click(await screen.findByRole("button", { name: "Submit for approval" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose the endorsement types");
    expect(endorsementService.submitEndorsementForApproval).not.toHaveBeenCalled();
  });

  it("shows the types by section and the approval to a second user", async () => {
    endorsementService.getEndorsementWorkflow.mockResolvedValue(base({ status: "PendingApproval", workflow: { approvalRequired: true, canApprove: true },
      endorsementTypes: [{ code: "CPLT", name: "Change of Plate Number", section: "vehicle" }] }));
    wrap();
    expect(await screen.findByText("Vehicle: Change of Plate Number")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve endorsement" })).toBeEnabled();
  });

  it("offers Send to insurer once approved and Book endorsement once with the insurer", async () => {
    endorsementService.getEndorsementWorkflow.mockResolvedValueOnce(base({ status: "Approved", workflow: { canSend: true } }));
    const { unmount } = wrap();
    expect(await screen.findByRole("button", { name: "Send to insurer" })).toBeInTheDocument();
    unmount();
    endorsementService.getEndorsementWorkflow.mockResolvedValueOnce(base({ status: "PendingCustomer", workflow: { canComplete: true },
      premiumChange: { prorata: { unexpiredDays: 182, termDays: 365, annualNetDelta: 3500 } } }));
    wrap();
    expect(await screen.findByRole("button", { name: "Book endorsement" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("182 of 365 days")).toBeInTheDocument());
  });
});
