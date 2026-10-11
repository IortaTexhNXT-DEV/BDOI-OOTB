import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "../../i18n";
import userEvent from "@testing-library/user-event";
import ApprovalActions, { isInitiator } from "./index";
import { codeAmount } from "../../utility/currencyConverter";

const signIn = (user) => localStorage.setItem("user", JSON.stringify(user));

afterEach(() => localStorage.clear());

describe("maker-checker approval actions", () => {
  it("knows the initiator by user id or user name", () => {
    const me = { userId: "usr_12", username: "r.finance" };
    expect(isInitiator({ id: "usr_12" }, me)).toBe(true);
    expect(isInitiator({ username: "R.Finance" }, me)).toBe(true);
    expect(isInitiator("usr_99", me)).toBe(false);
    expect(isInitiator(null, me)).toBe(false);
  });

  it("disables Approve and Reject for the user who initiated the record and says why", () => {
    signIn({ userId: "usr_12", username: "r.finance", displayName: "Rosa Finance" });
    const onApprove = jest.fn();
    render(<ApprovalActions initiator={{ id: "usr_12" }} onApprove={onApprove} onReject={() => {}} approveLabel="Approve remittance" rejectLabel="Reject remittance" />);
    const approve = screen.getByRole("button", { name: "Approve remittance" });
    expect(approve).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject remittance" })).toBeDisabled();
    expect(approve).toHaveAccessibleDescription("You initiated this record. A different user must approve or reject it.");
  });

  it("lets another user decide", () => {
    signIn({ userId: "usr_40", username: "f.head" });
    const onApprove = jest.fn();
    const onReject = jest.fn();
    render(<ApprovalActions initiator={{ id: "usr_12", username: "r.finance" }} onApprove={onApprove} onReject={onReject} />);
    expect(screen.queryByText(/You initiated this record/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});

const decide = { canDecide: true, myLimit: 1000000, amount: 409141.43 };

describe("approval actions with the server's decision", () => {
  it("offers Approve (primary) and Reject (outlined danger) with the user's limit and the item's amount", () => {
    render(<ApprovalActions decision={decide} onApprove={jest.fn()} onReject={jest.fn()} />);
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
    render(<ApprovalActions decision={decide} onApprove={onApprove} onReject={onReject} />);
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
    render(<ApprovalActions decision={{ canDecide: false, blockedCode: "ABOVE_LIMIT", blockedReason: "PHP 409,141.43 is above your approval limit of PHP 250,000.00.",
      eligibleApprovers: [{ id: "usr_9", name: "J. Cruz" }] }} onApprove={jest.fn()} onReject={jest.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("note")).toHaveTextContent("PHP 409,141.43 is above your approval limit of PHP 250,000.00.");
    expect(screen.getByRole("note")).toHaveTextContent("Can decide: J. Cruz");
  });

  it("keeps Reject beside the reason when the user may return what they may not approve", () => {
    const onReject = jest.fn();
    render(<ApprovalActions decision={{ canDecide: false, blockedCode: "CONTENT_CHANGED", blockedReason: "This remittance changed after it was submitted." }}
      canReject onApprove={jest.fn()} onReject={onReject} />);
    expect(screen.getByRole("note")).toHaveTextContent("This remittance changed after it was submitted.");
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("says when the user decides without a limit", () => {
    render(<ApprovalActions decision={{ canDecide: true, myLimit: null, amount: 1200 }} onApprove={jest.fn()} onReject={jest.fn()} />);
    expect(screen.getByRole("group")).toHaveTextContent("No approval limit");
  });
});
