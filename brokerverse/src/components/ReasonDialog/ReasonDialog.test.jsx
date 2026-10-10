import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../../i18n";
import ReasonDialog from "./index";
import opsAccountingService from "../../services/opsAccountingService";
import { setDateFormat } from "../../utility/dateFormat";

jest.mock("../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn() } }));

const REASONS = [
  { code: "RCN-DUP", name: "Duplicate of another remittance", context: "remittance_cancel", requiresNote: false, sortOrder: 1, status: "Active" },
  { code: "RCN-OTHER", name: "Other", context: "remittance_cancel", requiresNote: true, sortOrder: 9, status: "Active" },
];

const pick = async (option) => {
  fireEvent.keyDown(screen.getByLabelText(/Reason/), { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, altKey: true });
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(option), hidden: true }));
};

const open = (props = {}) => render(
  <ReasonDialog visible onHide={props.onHide || jest.fn()} context="remittance_cancel" severity="danger" title="Cancel REM-2026-00021?"
    facts={[{ label: "Remittance", value: "REM-2026-00021" }, { label: "Due to insurer", value: 409141.43, type: "amount" }]}
    note="12 policies go back to the next run." confirmLabel="Cancel draft" onConfirm={props.onConfirm || jest.fn()} />
);

beforeEach(() => {
  setDateFormat("DD/MM/YYYY");
  opsAccountingService.masterRecords.mockResolvedValue({ rows: REASONS });
});

describe("ReasonDialog", () => {
  it("shows the verb, the facts, the consequence and the reason of the context", async () => {
    open();
    const d = within(screen.getByRole("dialog"));
    expect(d.getByText("Cancel REM-2026-00021?")).toBeInTheDocument();
    expect(d.getByRole("row", { name: /Remittance/ })).toHaveTextContent("REM-2026-00021");
    expect(d.getByText("12 policies go back to the next run.")).toBeInTheDocument();
    expect(d.getByRole("button", { name: "Cancel draft" })).toBeInTheDocument();
    await waitFor(() => expect(opsAccountingService.masterRecords).toHaveBeenCalledWith("reason-code", { status: "Active", context: "remittance_cancel" }));
  });

  it("does nothing until a reason is chosen, and asks for the note an Other reason needs", async () => {
    const onConfirm = jest.fn().mockResolvedValue({});
    const onHide = jest.fn();
    open({ onConfirm, onHide });
    fireEvent.click(screen.getByRole("button", { name: "Cancel draft" }));
    expect(await screen.findByText("Choose the reason")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    await pick("Other");
    fireEvent.click(screen.getByRole("button", { name: "Cancel draft" }));
    expect(await screen.findByText("This reason needs a note")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Note/), { target: { value: "Raised twice by the run" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel draft" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith({ reasonCode: "RCN-OTHER", note: "Raised twice by the run" }));
    await waitFor(() => expect(onHide).toHaveBeenCalledWith({ confirmed: true, value: undefined }));
  });

  it("stays open with the server's message when the decision is refused", async () => {
    const onHide = jest.fn();
    open({ onConfirm: jest.fn().mockRejectedValue(new Error("REM-2026-00021 was submitted by J. Cruz at 10:12.")), onHide });
    await pick("Duplicate");
    fireEvent.click(screen.getByRole("button", { name: "Cancel draft" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("REM-2026-00021 was submitted by J. Cruz at 10:12.");
    expect(onHide).not.toHaveBeenCalled();
  });
});
