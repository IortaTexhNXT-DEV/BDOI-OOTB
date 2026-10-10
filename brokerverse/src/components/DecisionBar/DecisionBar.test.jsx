import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "../../i18n";
import DecisionBar, { codeAmount } from "./index";

const decide = { canDecide: true, myLimit: 1000000, amount: 409141.43 };

describe("DecisionBar", () => {
  it("offers Approve (primary) and Reject (outlined danger) with the user's limit and the item's amount", () => {
    render(<DecisionBar decision={decide} onApprove={jest.fn()} onReject={jest.fn()} />);
    const bar = screen.getByRole("group", { name: "Decision" });
    expect(bar).toHaveTextContent("Your limit PHP 1,000,000.00");
    expect(bar).toHaveTextContent("This item PHP 409,141.43");
    expect(screen.getByRole("button", { name: "Approve" })).not.toHaveClass("p-button-outlined");
    expect(screen.getByRole("button", { name: "Reject" })).toHaveClass("p-button-outlined", "p-button-danger");
    expect(codeAmount(-1250.5)).toBe("PHP -1,250.50");
  });

  it("is used from the keyboard: Tab reaches Reject then Approve, Enter and Space press them", () => {
    const onApprove = jest.fn();
    const onReject = jest.fn();
    render(<DecisionBar decision={decide} onApprove={onApprove} onReject={onReject} />);
    userEvent.tab();
    expect(screen.getByRole("button", { name: "Reject" })).toHaveFocus();
    userEvent.keyboard("{Enter}");
    expect(onReject).toHaveBeenCalledTimes(1);
    userEvent.tab();
    expect(screen.getByRole("button", { name: "Approve" })).toHaveFocus();
    userEvent.keyboard(" ");
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it("shows the reason and who can decide instead of the buttons, never a disabled decision button", () => {
    render(<DecisionBar decision={{ canDecide: false, blockedCode: "ABOVE_LIMIT", blockedReason: "PHP 409,141.43 is above your approval limit of PHP 250,000.00.",
      eligibleApprovers: [{ id: "usr_9", name: "J. Cruz" }] }} onApprove={jest.fn()} onReject={jest.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent("PHP 409,141.43 is above your approval limit of PHP 250,000.00.");
    expect(screen.getByRole("note")).toHaveTextContent("Can decide: J. Cruz");
  });

  it("says when the user decides without a limit", () => {
    render(<DecisionBar decision={{ canDecide: true, myLimit: null, amount: 1200 }} onApprove={jest.fn()} onReject={jest.fn()} />);
    expect(screen.getByRole("group")).toHaveTextContent("No approval limit");
  });
});
