import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import DialogFooter, { RecordTitle } from "./index";

jest.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k, d) => (typeof d === "string" ? d : k) }) }));

describe("DialogFooter", () => {
  it("puts Close on the left and the primary, secondary and destructive actions on the right", () => {
    const close = jest.fn();
    render(<DialogFooter onClose={close} primary={{ label: "Submit", onClick: jest.fn() }} secondary={[{ label: "Edit", onClick: jest.fn() }]}
      destructive={[{ label: "Withdraw", onClick: jest.fn() }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Withdraw" })).toHaveClass("p-button-danger");
    expect(screen.getByRole("button", { name: "Edit" })).toHaveClass("p-button-outlined");
  });

  it("collapses three or more secondary actions into one menu", () => {
    render(<DialogFooter secondary={[{ label: "A", onClick: jest.fn() }, { label: "B", onClick: jest.fn() }, { label: "C", onClick: jest.fn() }]} />);
    expect(screen.queryByRole("button", { name: "A" })).toBeNull();
    expect(screen.getByRole("button", { name: "More actions" })).toBeInTheDocument();
  });

  it("titles a record with its number, version and status", () => {
    render(<RecordTitle number="SCH-0001" version={2} status="active" statusLabel="Active" />);
    expect(screen.getByText("SCH-0001")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });
});
