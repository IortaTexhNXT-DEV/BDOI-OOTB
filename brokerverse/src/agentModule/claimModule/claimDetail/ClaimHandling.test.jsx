import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import "../../../i18n";
import ClaimSettlements from "./ClaimSettlements";
import ClaimCommunications from "./ClaimCommunications";
import InsurerAdvice from "./InsurerAdvice";
import claimHandlingService from "../../../services/claimHandlingService";

jest.mock("../../../services/claimHandlingService", () => ({
  __esModule: true,
  default: { communications: jest.fn(), addCommunication: jest.fn(), completeFollowUp: jest.fn(), followUpInsurer: jest.fn(), recordAdvice: jest.fn() },
}));

const store = configureStore({ reducer: { systemSettingsReducer: () => ({ displayCurrency: "PHP" }) } });
const wrap = (ui) => render(<Provider store={store}>{ui}</Provider>);

beforeEach(() => jest.clearAllMocks());

describe("Claim settlements", () => {
  it("shows who requested and who approved each settlement by name", () => {
    wrap(<ClaimSettlements settlements={[
      { id: "s1", seq: 1, kind: "partial", settlementType: "Cheque", amount: 50000, approvedAmount: 45000, status: "approved", requestedBy: "Carla Mendoza", decidedBy: "Joel Ramos", decidedAt: "2026-10-05" },
      { id: "s2", seq: 2, kind: "final", settlementType: "Cheque", amount: 30000, approvedAmount: null, status: "pending", requestedBy: "Carla Mendoza" },
    ]} />);
    expect(screen.getByText("Partial")).toBeInTheDocument();
    expect(screen.getByText("Final")).toBeInTheDocument();
    expect(screen.getByText(/Joel Ramos/)).toBeInTheDocument();
    expect(screen.getByText("Pending approval")).toBeInTheDocument();
    expect(screen.queryByText(/usr_/)).toBeNull();
  });

  it("says so when there is no settlement", () => {
    wrap(<ClaimSettlements settlements={[]} />);
    expect(screen.getByText("No settlements yet.")).toBeInTheDocument();
  });
});

describe("Claim communications", () => {
  it("lists the log with the overdue follow-up and marks it done", async () => {
    claimHandlingService.communications.mockResolvedValue([
      { id: "c1", at: "2026-10-01T09:00:00+08:00", party: "insurer", partyLabel: "Insurer", direction: "out", method: "Email", subject: "Documents", message: "Sent the repair estimate",
        followUpDate: "2026-10-05", followUpDone: false, overdue: true, by: "Carla Mendoza" },
    ]);
    claimHandlingService.completeFollowUp.mockResolvedValue({});
    const notify = jest.fn();
    wrap(<ClaimCommunications claimId="clm_1" canEdit notify={notify} parties={[{ value: "insurer", label: "Insurer" }]} />);
    expect(await screen.findByText("Sent the repair estimate")).toBeInTheDocument();
    expect(screen.getByText(/Overdue/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark follow-up done" }));
    await waitFor(() => expect(claimHandlingService.completeFollowUp).toHaveBeenCalledWith("clm_1", "c1"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("success", "Follow-up marked done"));
  });

  it("needs a message before logging", async () => {
    claimHandlingService.communications.mockResolvedValue([]);
    wrap(<ClaimCommunications claimId="clm_1" canEdit notify={jest.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Log communication" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Enter the message.")).toBeInTheDocument();
    expect(claimHandlingService.addCommunication).not.toHaveBeenCalled();
  });

  it("offers no change without the right to edit", async () => {
    claimHandlingService.communications.mockResolvedValue([]);
    wrap(<ClaimCommunications claimId="clm_1" notify={jest.fn()} />);
    await screen.findByText("No communications logged.");
    expect(screen.queryByRole("button", { name: "Log communication" })).toBeNull();
  });
});

describe("Insurer advice", () => {
  it("shows the insurer's side of the claim and records the advice", async () => {
    claimHandlingService.recordAdvice.mockResolvedValue({});
    const onSaved = jest.fn();
    wrap(<InsurerAdvice canEdit onSaved={onSaved} notify={jest.fn()} statuses={[{ value: "approved", label: "Approved" }]}
      claim={{ id: "clm_1", insuranceCompanyClaimNumber: "MAL-CL-88120", insurerHandler: "Liza Tan", insurerAdvice: "approved", insurerAdviceLabel: "Approved", authorisationCode: "AUTH-5521" }} />);
    expect(screen.getByText("MAL-CL-88120")).toBeInTheDocument();
    expect(screen.getByText("AUTH-5521")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record insurer advice" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Save advice" }));
    await waitFor(() => expect(claimHandlingService.recordAdvice).toHaveBeenCalledWith("clm_1", expect.objectContaining({ insurerClaimNumber: "MAL-CL-88120", adviceStatus: "approved" })));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});
