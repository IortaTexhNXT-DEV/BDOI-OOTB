import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "../../../i18n";
import FinanceControls from "./FinanceControls";
import periodEndService from "../../../services/periodEndService";

jest.mock("../../../services/periodEndService", () => ({ __esModule: true, default: { financeControls: jest.fn(), saveFinanceControls: jest.fn() } }));

const ROWS = (canChange) => [
  { key: "finance.maker_checker_enabled", label: "Finance maker-checker", type: "boolean", value: true, canChange },
  { key: "accounting.reopen_closed_periods", label: "Reopen closed periods", type: "boolean", value: false, canChange },
  { key: "accounting.parked_events", label: "Parked events", type: "json", value: ["ap.payment", "sales_invoice.issue"], canChange },
];

describe("Finance Controls", () => {
  beforeEach(() => jest.resetAllMocks());

  it("lets Finance switch a control and saves only what changed", async () => {
    periodEndService.financeControls.mockResolvedValue(ROWS(true));
    periodEndService.saveFinanceControls.mockResolvedValue(ROWS(true));
    const onSaved = jest.fn();
    render(<FinanceControls onHide={() => {}} onSaved={onSaved} onError={() => {}} />);
    expect(await screen.findByText("Finance maker-checker")).toBeInTheDocument();
    expect(screen.getByText("ap.payment, sales_invoice.issue")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save controls" });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Reopen closed periods/));
    fireEvent.click(save);
    await waitFor(() => expect(periodEndService.saveFinanceControls).toHaveBeenCalledWith({ "accounting.reopen_closed_periods": true }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("shows the controls read-only to a user who cannot change them", async () => {
    periodEndService.financeControls.mockResolvedValue(ROWS(false));
    render(<FinanceControls onHide={() => {}} onSaved={() => {}} onError={() => {}} />);
    expect(await screen.findByText("Finance maker-checker")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save controls" })).toBeNull();
    expect(screen.getByLabelText(/Finance maker-checker/)).toBeDisabled();
  });
});
