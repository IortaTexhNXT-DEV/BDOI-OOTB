import React from "react";
import { render, screen } from "@testing-library/react";
import "../../i18n";
import IssuanceChecklist from "./IssuanceChecklist";
import placementService from "../../services/placementService";
import { hasPermission } from "../../utils/canOpen";

jest.mock("../../services/placementService", () => ({ __esModule: true, default: { issuanceChecklist: jest.fn(), checklistAction: jest.fn() } }));
jest.mock("../../utils/canOpen", () => ({ __esModule: true, hasPermission: jest.fn(), default: jest.fn() }));

const placement = { id: "plc_1", status: "checked", lob: "MOTOR", source: "quote", updatedAt: "2026-10-11T00:00:00Z" };
const checklist = (items, gate) => ({ applies: true, mode: "block", items, gate });
const item = (o) => ({ id: 1, code: "MIC-SI", document: "Sales invoice of the vehicle", required: true, canWaive: true, status: "pending", onFile: false, ...o });

describe("Motor issuance checklist panel", () => {
  beforeEach(() => jest.resetAllMocks());

  it("lists the documents with the gate and the actions of the maker", async () => {
    hasPermission.mockImplementation((p) => p === "write:quotations");
    placementService.issuanceChecklist.mockResolvedValue(checklist([item(), item({ id: 2, code: "MIC-GOVID", document: "Valid government ID of the insured", canWaive: false, status: "waiver-requested", waiverRequestedById: "u2", waiverReason: "Later" })],
      { missing: 2, documents: [], required: 2 }));
    render(<IssuanceChecklist placement={placement} userId="u1" notify={jest.fn()} />);
    expect(await screen.findByText("Sales invoice of the vehicle")).toBeInTheDocument();
    expect(screen.getByText("2 mandatory missing")).toBeInTheDocument();
    expect(screen.getByLabelText("Receive")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Request waiver")).toHaveLength(1);
    // only an approver (approve:policies) decides a waiver
    expect(screen.queryByLabelText("Approve waiver")).not.toBeInTheDocument();
  });

  it("lets an approver decide a waiver another user requested, never their own", async () => {
    hasPermission.mockReturnValue(true);
    placementService.issuanceChecklist.mockResolvedValue(checklist([item({ status: "waiver-requested", waiverRequestedById: "u2" }), item({ id: 3, code: "MIC-DR", document: "Delivery receipt", status: "waiver-requested", waiverRequestedById: "u1" })],
      { missing: 2, documents: [], required: 2 }));
    render(<IssuanceChecklist placement={placement} userId="u1" notify={jest.fn()} />);
    await screen.findByText("Delivery receipt");
    expect(screen.getAllByLabelText("Approve waiver")).toHaveLength(1);
  });

  it("shows nothing when the checklist does not apply", async () => {
    placementService.issuanceChecklist.mockResolvedValue({ applies: false, items: [], gate: { missing: 0 } });
    const { container } = render(<IssuanceChecklist placement={placement} userId="u1" notify={jest.fn()} />);
    await new Promise((r) => { setTimeout(r, 0); });
    expect(container.textContent).toBe("");
  });
});
