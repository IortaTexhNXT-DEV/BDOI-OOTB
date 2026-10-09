import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReasonPicker, { reasonOptions, reasonPayload, reasonProblem } from "./index";
import { reasonContextLabel } from "./contexts";
import opsAccountingService from "../../services/opsAccountingService";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, d) => (typeof d === "string" ? d : d?.defaultValue) || k }) }));
jest.mock("../../services/opsAccountingService", () => ({ __esModule: true, default: { masterRecords: jest.fn() } }));

const REASONS = [
  { code: "PCL-OTHER", name: "Other", context: "period_close", requiresNote: true, sortOrder: 590, status: "Active" },
  { code: "PCL-MONTHEND", name: "Month-end close completed", context: "period_close", requiresNote: false, sortOrder: 500, status: "Active" },
  { code: "PRO-LATE", name: "Late insurer statement", context: "period_reopen", requiresNote: false, sortOrder: 600, status: "Active" },
  { code: "PCL-OLD", name: "Retired reason", context: "period_close", requiresNote: false, sortOrder: 520, status: "Inactive" },
];

const pick = async (label, option) => {
  fireEvent.keyDown(screen.getByLabelText(label), { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, altKey: true });
  // the overlay is still entering (hidden to the accessibility tree) when it is clicked
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(option), hidden: true }));
};

const Harness = ({ onValue, showErrors }) => {
  const [value, setValue] = useState(null);
  return <ReasonPicker context="period_close" value={value} showErrors={showErrors} onChange={(v) => { setValue(v); onValue(v); }} />;
};

describe("ReasonPicker", () => {
  beforeEach(() => opsAccountingService.masterRecords.mockResolvedValue({ rows: REASONS }));

  it("offers the active reasons of the context in the master's order", () => {
    expect(reasonOptions(REASONS, ["period_close"])).toEqual([
      { label: "Month-end close completed", value: "PCL-MONTHEND", requiresNote: false },
      { label: "Other", value: "PCL-OTHER", requiresNote: true },
    ]);
  });

  it("reads the reasons of its context and gives the chosen reason with its note", async () => {
    const onValue = jest.fn();
    render(<Harness onValue={onValue} />);
    await waitFor(() => expect(opsAccountingService.masterRecords).toHaveBeenCalledWith("reason-code", { status: "Active", context: "period_close" }));
    await pick("Reason*", "Month-end close completed");
    expect(onValue).toHaveBeenLastCalledWith({ reasonCode: "PCL-MONTHEND", reasonLabel: "Month-end close completed", note: "", noteRequired: false });
    expect(screen.getByText("(optional)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Note/), { target: { value: "September books" } });
    expect(onValue).toHaveBeenLastCalledWith(expect.objectContaining({ reasonCode: "PCL-MONTHEND", note: "September books" }));
  });

  it("asks for the note when the reason needs one, and says what is missing once errors are shown", async () => {
    const onValue = jest.fn();
    const { rerender } = render(<Harness onValue={onValue} showErrors />);
    expect(screen.getByText("Choose the reason")).toBeInTheDocument();
    await pick("Reason*", "Other");
    expect(onValue).toHaveBeenLastCalledWith(expect.objectContaining({ reasonCode: "PCL-OTHER", noteRequired: true }));
    rerender(<Harness onValue={onValue} showErrors />);
    expect(screen.getByText("This reason needs a note")).toBeInTheDocument();
    expect(screen.queryByText("(optional)")).toBeNull();
  });

  it("checks a value and builds what the API takes", () => {
    expect(reasonProblem(null)).toBe("reason");
    expect(reasonProblem(null, { required: false })).toBeNull();
    expect(reasonProblem({ reasonCode: "PCL-OTHER", noteRequired: true, note: "  " })).toBe("note");
    expect(reasonProblem({ reasonCode: "PCL-OTHER", noteRequired: true, note: "Auditor request" })).toBeNull();
    expect(reasonPayload({ reasonCode: "PCL-MONTHEND", reasonLabel: "Month-end close completed", note: " " })).toEqual({ reasonCode: "PCL-MONTHEND", note: undefined });
    expect(reasonContextLabel((k, o) => o.defaultValue, "incentive_batch_reject")).toBe("Incentive batch reject");
  });
});
