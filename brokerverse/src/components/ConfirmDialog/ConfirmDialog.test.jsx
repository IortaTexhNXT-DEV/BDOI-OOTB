import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../../i18n";
import ConfirmDialog from "./ConfirmDialog";
import ConfirmDialogHost from "./ConfirmDialogHost";
import { openConfirm } from "./openConfirm";
import { setDateFormat } from "../../utility/dateFormat";

const facts = [
  { label: "Remittances", value: 3, type: "number" },
  { label: "Total amount", value: 8457.5, type: "amount", currency: "PHP", emphasis: true },
  { label: "Processing date", value: "2026-10-10", type: "date" },
  { label: "Insurer", value: null },
];

const Harness = ({ onConfirm, onCancel, ...props }) => {
  const [open, setOpen] = useState(true);
  const [result, setResult] = useState(null);
  return (
    <>
      <ConfirmDialog visible={open} title="Process remittances" message="Submit the selected remittances for approval." facts={facts}
        note="The remittances can no longer be edited." confirmLabel="Process 3 remittances" onConfirm={onConfirm} onCancel={onCancel}
        onHide={(r) => { setOpen(false); setResult(r); }} {...props} />
      <output data-testid="result">{result ? JSON.stringify(result) : ""}</output>
    </>
  );
};

const dialog = () => screen.getByRole("dialog");
const answered = (text) => waitFor(() => expect(screen.getByTestId("result")).toHaveTextContent(text));

beforeEach(() => setDateFormat("DD/MM/YYYY"));

describe("ConfirmDialog", () => {
  it("summarises what is confirmed: title, sentence, facts table, consequence and an action verb next to Cancel", () => {
    render(<Harness />);
    const d = within(dialog());
    expect(d.getByText("Process remittances")).toBeInTheDocument();
    expect(d.getByText("Submit the selected remittances for approval.")).toBeInTheDocument();
    const total = d.getByRole("row", { name: /Total amount/ });
    expect(total).toHaveClass("bv-confirm__fact--total");
    expect(within(total).getByRole("cell")).toHaveClass("bv-confirm__num");
    expect(within(total).getByRole("cell")).toHaveTextContent("8,457.50");
    expect(d.getByRole("row", { name: /Processing date/ })).toHaveTextContent("10/10/2026");
    expect(d.getByRole("row", { name: /Insurer/ })).toHaveTextContent("—");
    expect(d.getByText("The remittances can no longer be edited.")).toBeInTheDocument();
    expect(d.getByRole("button", { name: "Process 3 remittances" })).toBeInTheDocument();
    expect(d.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(d.queryByRole("button", { name: /^(yes|no)$/i })).toBeNull();
    // centred, never the side panel of the dialogs with a footer
    expect(dialog()).toHaveClass("bv-centered");
  });

  it("marks a destructive action with the danger tone and button", () => {
    render(<Harness severity="danger" confirmLabel="Delete supplier" />);
    expect(dialog()).toHaveClass("bv-confirm--danger");
    expect(screen.getByRole("button", { name: "Delete supplier" })).toHaveClass("p-button-danger");
  });

  it("runs the action with the button busy and closes once it succeeds", async () => {
    let finish;
    const onConfirm = jest.fn(() => new Promise((resolve) => { finish = resolve; }));
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Process 3 remittances" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Process 3 remittances" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(screen.getByTestId("result")).toHaveTextContent('{"confirmed":true}');
  });

  it("stays open and shows the error when the action fails", async () => {
    const onConfirm = jest.fn().mockRejectedValue(new Error("Remittance REM-1 is already settled"));
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Process 3 remittances" }));
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent("Remittance REM-1 is already settled");
    expect(screen.getByTestId("result")).toHaveTextContent("");
    expect(screen.getByRole("button", { name: "Process 3 remittances" })).toBeEnabled();
  });

  it("confirms with Enter and focuses the action", async () => {
    const onConfirm = jest.fn();
    render(<Harness onConfirm={onConfirm} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Process 3 remittances" })).toHaveFocus());
    fireEvent.keyDown(screen.getByText("Submit the selected remittances for approval."), { key: "Enter" });
    await answered('{"confirmed":true}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancels with Escape", async () => {
    const onCancel = jest.fn();
    render(<Harness onCancel={onCancel} />);
    const accept = screen.getByRole("button", { name: "Process 3 remittances" });
    await waitFor(() => expect(accept).toHaveFocus());
    fireEvent.keyDown(accept, { key: "Escape" });
    await answered('{"confirmed":false}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("asks for a required reason and passes it, trimmed, to the action", async () => {
    const onConfirm = jest.fn();
    render(<Harness onConfirm={onConfirm} severity="danger" confirmLabel="Reject remittance"
      input={{ type: "textarea", label: "Reason", required: true, minLength: 5 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject remittance" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Reason is required.");
    expect(onConfirm).not.toHaveBeenCalled();
    const box = screen.getByLabelText(/Reason/);
    fireEvent.change(box, { target: { value: " no " } });
    fireEvent.click(screen.getByRole("button", { name: "Reject remittance" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter at least 5 characters.");
    fireEvent.change(box, { target: { value: "  Amount does not match the statement  " } });
    fireEvent.click(screen.getByRole("button", { name: "Reject remittance" }));
    await answered("Amount does not match the statement");
    expect(onConfirm).toHaveBeenCalledWith("Amount does not match the statement");
  });
});

describe("openConfirm", () => {
  const closed = (name) => waitFor(() => expect(screen.queryByRole("button", { name })).toBeNull());

  it("resolves true once the action has run, false when cancelled, and keeps PrimeReact's option names working", async () => {
    render(<ConfirmDialogHost />);
    const accept = jest.fn();
    let answer;
    act(() => { answer = openConfirm({ header: "Generate statement", message: "Generate the September statement?", acceptLabel: "Generate statement", accept }); });
    fireEvent.click(await screen.findByRole("button", { name: "Generate statement" }));
    await closed("Generate statement");
    await expect(answer).resolves.toBe(true);
    expect(accept).toHaveBeenCalledTimes(1);

    const reject = jest.fn();
    act(() => { answer = openConfirm({ title: "Delete supplier", confirmLabel: "Delete supplier", severity: "danger", reject }); });
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await closed("Delete supplier");
    await expect(answer).resolves.toBe(false);
    expect(reject).toHaveBeenCalledTimes(1);
  });

  it("returns the value entered, or null when cancelled", async () => {
    render(<ConfirmDialogHost />);
    const ask = { title: "Escalate exception", confirmLabel: "Escalate", input: { label: "Escalate to", required: true } };
    let answer;
    act(() => { answer = openConfirm(ask); });
    fireEvent.change(await screen.findByLabelText(/Escalate to/), { target: { value: "Finance Manager" } });
    fireEvent.keyDown(screen.getByLabelText(/Escalate to/), { key: "Enter" });
    await closed("Escalate");
    await expect(answer).resolves.toBe("Finance Manager");

    act(() => { answer = openConfirm(ask); });
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await closed("Escalate");
    await expect(answer).resolves.toBeNull();
  });
});
