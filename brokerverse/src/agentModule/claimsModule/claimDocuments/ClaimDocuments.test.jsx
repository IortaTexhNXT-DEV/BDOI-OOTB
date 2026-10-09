import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import "../../../i18n";
import ClaimDocuments from ".";
import claimsService from "../../../services/claimsService";
import service from "../../../services/opsAccountingService";
import { CONTINUE_ROUTE, stepForStatus } from "../shared/claimJourney";

jest.mock("../../../services/claimsService", () => ({ __esModule: true, default: { getClaimDetails: jest.fn() } }));
jest.mock("../../../services/opsAccountingService", () => ({
  __esModule: true,
  default: { claimChecklist: jest.fn(), updateChecklistItem: jest.fn(), addChecklistItem: jest.fn(), uploadChecklistItem: jest.fn(), remindClaimant: jest.fn(), submitClaimToInsurer: jest.fn() },
}));

const store = configureStore({ reducer: { systemSettingsReducer: () => ({ displayCurrency: "PHP" }) } });
const wrap = () => render(
  <Provider store={store}>
    <MemoryRouter initialEntries={["/agent/claimrequest/documents/clm_1"]}>
      <Routes>
        <Route path="/agent/claimrequest/documents/:id" element={<ClaimDocuments />} />
        <Route path="/agent/claimrequest/requestapproval/:id" element={<p>review step</p>} />
      </Routes>
    </MemoryRouter>
  </Provider>,
);

const CLAIM = { id: "clm_1", claimNumber: "CLM-2026-00031", lifecycleStatus: "registered", claimStatus: "Registered", lob: "MOTOR", policyNumber: "POL-2026-00007",
  policyHolderName: "Liza Mendoza", typeOfIncident: "Theft", submittedToInsurerAt: null };
const item = (id, documentName, status, extra = {}) => ({ id, documentName, status, required: true, receivedOn: status === "received" ? "2026-10-05" : null, fileName: null, ...extra });
const checklist = (items, extra = {}) => {
  const required = items.filter((i) => i.required);
  const missing = required.filter((i) => i.status === "pending").length;
  return {
    claimId: "clm_1", claimNumber: CLAIM.claimNumber, lob: "MOTOR", lossCause: "Theft", requireComplete: true, submittedToInsurerAt: null, reminders: [],
    summary: { required: required.length, receivedRequired: required.length - missing, missingRequired: missing, missingOptional: items.filter((i) => !i.required && i.status === "pending").length, complete: !missing },
    items, ...extra,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  claimsService.getClaimDetails.mockResolvedValue({ success: true, data: CLAIM });
});

describe("claim Documents step", () => {
  it("shows what is in and, while required documents are missing, offers to remind the claimant", async () => {
    service.claimChecklist.mockResolvedValue(checklist([item(1, "Claim Form", "received"), item(2, "Affidavit of Theft", "pending"), item(3, "Police Report", "pending"),
      item(4, "Policy", "waived", { waiveReason: "Copy on file", updatedAt: "2026-10-06T02:00:00Z" })]));
    service.remindClaimant.mockResolvedValue({ to: "liza@example.ph", missing: ["Affidavit of Theft", "Police Report"] });
    wrap();
    expect(await screen.findByText("2 of 4 required documents in")).toBeInTheDocument();
    const next = screen.getByRole("region", { name: "Next step" });
    expect(next).toHaveTextContent("2 required documents missing: remind the claimant");
    expect(within(next).queryByRole("button", { name: "Submit to insurer" })).toBeNull();
    fireEvent.click(within(next).getByRole("button", { name: "Remind the claimant" }));
    await waitFor(() => expect(service.remindClaimant).toHaveBeenCalledWith("clm_1"));
    expect(screen.getByText("Copy on file")).toBeInTheDocument();
  });

  it("asks for a reason before a document is waived", async () => {
    service.claimChecklist.mockResolvedValue(checklist([item(2, "Affidavit of Theft", "pending")]));
    service.updateChecklistItem.mockResolvedValue({});
    wrap();
    const row = await screen.findByRole("row", { name: /Affidavit of Theft/ });
    fireEvent.click(within(row).getByRole("button", { name: "More actions" }));
    fireEvent.click(await screen.findByText("Waive"));
    const dialog = await screen.findByRole("dialog", { name: "Waive Affidavit of Theft" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Waive" }));
    expect(await within(dialog).findByText("Say why the document is not needed")).toBeInTheDocument();
    expect(service.updateChecklistItem).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Why is the document not needed/), { target: { value: "Vehicle recovered the same day" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Waive" }));
    await waitFor(() => expect(service.updateChecklistItem).toHaveBeenCalledWith("clm_1", 2, { status: "waived", waiveReason: "Vehicle recovered the same day" }));
  });

  it("submits the claim file to the insurer once every required document is in, then moves on to the review", async () => {
    service.claimChecklist.mockResolvedValueOnce(checklist([item(1, "Claim Form", "received"), item(2, "Police Report", "received")]))
      .mockResolvedValue(checklist([item(1, "Claim Form", "received"), item(2, "Police Report", "received")], { submittedToInsurerAt: "2026-10-08T03:00:00Z" }));
    service.submitClaimToInsurer.mockResolvedValue({});
    wrap();
    const next = await screen.findByRole("region", { name: "Next step" });
    await waitFor(() => expect(next).toHaveTextContent("All required documents received: submit the claim file to the insurer"));
    fireEvent.click(within(next).getByRole("button", { name: "Submit to insurer" }));
    const dialog = await screen.findByRole("dialog", { name: "Submit the claim file to the insurer" });
    fireEvent.change(within(dialog).getByLabelText("Reference (e-mail, transmittal)"), { target: { value: "E-mail to FPG claims" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit to insurer" }));
    await waitFor(() => expect(service.submitClaimToInsurer).toHaveBeenCalledWith("clm_1", { reference: "E-mail to FPG claims" }));
    fireEvent.click(await within(next).findByRole("button", { name: "Continue to review" }));
    expect(await screen.findByText("review step")).toBeInTheDocument();
  });
});

describe("step of a claim", () => {
  it("keeps a registered claim at its documents until the file goes to the insurer", () => {
    expect(stepForStatus("registered", { submittedToInsurerAt: null })).toBe("documents");
    expect(stepForStatus("registered", { submittedToInsurerAt: "2026-10-08T03:00:00Z" })).toBe("review");
    expect(stepForStatus("registered")).toBe("review");
    expect(CONTINUE_ROUTE.documents("clm_1")).toBe("/agent/claimrequest/documents/clm_1");
  });
});
