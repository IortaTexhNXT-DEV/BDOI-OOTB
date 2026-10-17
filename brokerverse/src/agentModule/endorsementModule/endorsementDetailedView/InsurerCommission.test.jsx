import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../../i18n";
import { ConfirmDialogHost } from "../../../components/ConfirmDialog";
import endorsementService from "../../../services/endorsementService";
import EndorsementDetailedView from ".";

jest.mock("../../../services/endorsementService", () => ({ __esModule: true, default: { getEndorsementById: jest.fn(), setInsurerCommission: jest.fn() } }));
jest.mock("../endorsementWorkflow/EndorsementWorkflowPanel", () => ({ __esModule: true, default: () => null }));
jest.mock("../../../components/ActivityLog", () => ({ __esModule: true, RecordActivityLog: () => null }));
jest.mock("../../../components/ImportDialog", () => ({ __esModule: true, default: ({ visible, title }) => (visible ? <div role="dialog">{title}</div> : null) }));

const endorsement = (extra = {}) => ({ endorsementId: "end_1", endorsementNumber: "END-2026-00012", policyNumber: "POL-1", status: "Approved", premiumDelta: 5000,
  endorsementTypeIds: [3], insurerCommission: null, ...extra });
const signIn = (permissions) => {
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-ops-officer"]));
  localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
};
const show = () => render(
  <MemoryRouter initialEntries={["/agent/endorsementdetailedview/end_1"]}>
    <Routes><Route path="/agent/endorsementdetailedview/:endorsementId" element={<EndorsementDetailedView />} /></Routes>
    <ConfirmDialogHost />
  </MemoryRouter>
);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe("Insurer commission on an endorsement (TIS-BRD-COMM-07)", () => {
  it("records the insurer's commission on an open endorsement and shows it", async () => {
    signIn(["read:endorsements", "write:endorsements"]);
    endorsementService.getEndorsementById.mockResolvedValueOnce({ success: true, data: endorsement() })
      .mockResolvedValue({ success: true, data: endorsement({ insurerCommission: 1200.5 }) });
    endorsementService.setInsurerCommission.mockResolvedValue({});
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Insurer commission" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByRole("spinbutton"), { target: { value: "1200.50" } });
    fireEvent.blur(dialog.getByRole("spinbutton"));
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(endorsementService.setInsurerCommission).toHaveBeenCalledWith("end_1", 1200.5));
    expect(await screen.findByText("Insurer commission", { selector: "dt, span, div, th, label" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload insurer commission" }));
    expect(await screen.findByText("Upload Insurer Commission", { selector: "[role=dialog]" })).toBeInTheDocument();
  });

  it("offers no insurer commission action on a booked endorsement or to a reader", async () => {
    signIn(["read:endorsements", "write:endorsements"]);
    endorsementService.getEndorsementById.mockResolvedValue({ success: true, data: endorsement({ status: "Completed" }) });
    const { unmount } = show();
    expect(await screen.findByRole("button", { name: "Upload insurer commission" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Insurer commission" })).not.toBeInTheDocument();
    unmount();
    signIn(["read:endorsements"]);
    endorsementService.getEndorsementById.mockResolvedValue({ success: true, data: endorsement() });
    show();
    expect(await screen.findByRole("heading", { name: "END-2026-00012" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /insurer commission/i })).not.toBeInTheDocument();
  });
});
