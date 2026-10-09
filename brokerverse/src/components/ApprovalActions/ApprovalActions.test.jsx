import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "../../i18n";
import ApprovalActions, { isInitiator } from "./index";

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
