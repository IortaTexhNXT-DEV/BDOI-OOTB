import React from "react";
import { render, screen } from "@testing-library/react";
import "../../../i18n";
import CommissionService from "../../../services/commissionService";
import CommissionBreakdown from ".";

jest.mock("../../../services/commissionService", () => ({ __esModule: true, default: { policyBreakdown: jest.fn(), recomputePolicy: jest.fn() } }));

const breakdown = {
  policyNumber: "POL-2026-00412", stored: true, remittance: "REM-2026-00021", remittanceApproved: true, billingStatement: null, settlementBasis: "net",
  recompute: { allowed: false, reason: "The commission of POL-2026-00412 cannot be recomputed: it is on approved remittance REM-2026-00021." },
  basis: {
    rateBasis: "issuing-remitting", status: "ok", ruleLevel: "insurer + product + motor type", ruleVersion: 1, netPremium: 32125, insurerRemitting: 15993.75, grossCommission: 16131.25, varianceShare: 4800, sharedTotal: 4800, retained: 11331.25,
    scheme: null, warnings: [],
    perils: [
      { code: "OD", name: "Own Damage / Theft", basis: "issuing-remitting", sumInsured: 1200000, premium: 24000, issuing: 2, insurerNet: 0.95, tisRemitting: 1.7, insurerRemitting: 11400, commission: 12600, varianceShare: 3600 },
      { code: "BI", name: "Bodily Injury", basis: "premium-pct", sumInsured: 100000, premium: 1000, commissionPct: 25, insurerRemitting: 750, commission: 250, varianceShare: 0 },
    ],
    shares: [{ lineNo: 1, name: "Ramon Bautista", basis: "variance", value: 0.3, min: 0, max: 0.3, amount: 4800, note: "OD 2 - 1.7 / AON 0.5 - 0.4" }],
  },
};

beforeEach(() => {
  localStorage.clear();
  CommissionService.policyBreakdown.mockResolvedValue({ data: breakdown });
});

describe("Commission breakdown", () => {
  it("shows the perils, the totals, the shares and why Recompute is not possible", async () => {
    localStorage.setItem("USER_ROLES", JSON.stringify(["tis-finance"]));
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["write:remittance"]));
    render(<CommissionBreakdown policyId="pol_1" />);
    expect(await screen.findByText("Own Damage / Theft")).toBeInTheDocument();
    expect(screen.getByText("Rated on the register")).toBeInTheDocument();
    expect(screen.getByText("Remittance REM-2026-00021")).toBeInTheDocument();
    expect(screen.getByText("Ramon Bautista")).toBeInTheDocument();
    expect(screen.getByText(/cannot be recomputed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recompute" })).toBeDisabled();
  });

  it("offers no Recompute without the remittance right", async () => {
    localStorage.setItem("USER_ROLES", JSON.stringify(["tis-ops-officer"]));
    localStorage.setItem("USER_PERMISSIONS", JSON.stringify(["read:commission-rules"]));
    render(<CommissionBreakdown policyId="pol_1" />);
    expect(await screen.findByText("Own Damage / Theft")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recompute" })).not.toBeInTheDocument();
  });
});
