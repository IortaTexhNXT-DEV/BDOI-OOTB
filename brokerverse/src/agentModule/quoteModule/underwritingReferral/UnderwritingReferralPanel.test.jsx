import React from "react";
import { render, screen } from "@testing-library/react";
import "../../../i18n";
import UnderwritingReferralPanel from "./UnderwritingReferralPanel";

const QUOTE = {
  quotationId: "qt_1", quotationNumber: "QT-2026-00042", totalSumInsured: 1450000, currency: "PHP", createdById: "usr_maker",
  underwritingReferral: { status: "pending", authorityRoles: ["tis-ops-unit-head"], authorityRoleNames: ["TIS Operations Unit Head"], reasons: ["VEH_AGE_LIMIT: Vehicle older than 15 years"] },
};

beforeEach(() => {
  localStorage.setItem("USER_ROLES", JSON.stringify(["tis-ops-unit-head"]));
});

describe("underwriting referral decision", () => {
  it("another Operations Unit Head may approve or decline", () => {
    localStorage.setItem("USER_ID", "usr_checker");
    render(<UnderwritingReferralPanel quotation={QUOTE} />);
    expect(screen.getByRole("button", { name: "Approve referral" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Decline referral" })).toBeEnabled();
  });

  it("the user who raised the quotation sees the decision blocked (maker-checker)", () => {
    localStorage.setItem("USER_ID", "usr_maker");
    render(<UnderwritingReferralPanel quotation={QUOTE} />);
    expect(screen.getByRole("button", { name: "Approve referral" })).toBeDisabled();
    expect(screen.getByText("You initiated this record. A different user must approve or reject it.")).toBeInTheDocument();
  });

  it("a user outside the authority role sees no decision", () => {
    localStorage.setItem("USER_ROLES", JSON.stringify(["tis-sales-associate"]));
    render(<UnderwritingReferralPanel quotation={QUOTE} />);
    expect(screen.queryByRole("button", { name: "Approve referral" })).toBeNull();
    expect(screen.getByText("Vehicle older than 15 years")).toBeInTheDocument();
  });
});
