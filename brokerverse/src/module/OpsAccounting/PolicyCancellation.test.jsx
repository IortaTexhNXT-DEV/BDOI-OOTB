import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n";
import PolicyCancellation, { keptPercent, resultCards } from "./PolicyCancellation";
import service from "../../services/opsAccountingService";

jest.mock("../../services/opsAccountingService", () => ({
  __esModule: true,
  default: { cancellationReasons: jest.fn(), cancellationQuote: jest.fn(), searchPolicies: jest.fn(), createCancellation: jest.fn() },
}));

const QUOTE = {
  policyId: "pol_1", policyNumber: "POL-2026-00001", inceptionDate: "2026-01-01", expiryDate: "2027-01-01", effectiveDate: "2026-04-11", totalDays: 365, daysInForce: 100,
  daysLeft: 265, method: "short-period", factor: 0.6, shortPeriodBand: { code: "SP04", maxDays: 122, retainedPercent: 40, description: "Not exceeding 4 months" },
  basePremium: 10000, retainedNetPremium: 4000, returnNetPremium: 6000, taxes: { vat: 720, dst: 0, lgt: 45, fst: 0, other: 0 }, grossReturn: 6765, commissionReversed: 900,
};
const t = (key, opts) => (opts ? `${key} ${JSON.stringify(opts)}` : key);

describe("Policy Cancellation", () => {
  beforeEach(() => {
    service.cancellationReasons.mockResolvedValue([{ code: "INSURED_REQUEST", name: "Cancelled at the request of the insured", initiatedBy: "insured", method: "auto" }]);
    service.cancellationQuote.mockResolvedValue(QUOTE);
  });

  it("states the band applied and what the insurer keeps for this policy", () => {
    expect(keptPercent(QUOTE)).toBe(40);
    expect(keptPercent({ ...QUOTE, shortPeriodBand: null, method: "pro-rata", factor: 0.726027 })).toBe(27.4);
    expect(keptPercent({ ...QUOTE, shortPeriodBand: null, method: "manual", factor: null })).toBeNull();
    const cards = Object.fromEntries(resultCards(QUOTE, t).map((c) => [c.key, c]));
    expect(cards.inForce.value).toBe("100 / 365");
    expect(cards.band.value).toBe("Not exceeding 4 months");
    expect(cards.kept.value).toBe("40%");
    expect(Object.keys(cards)).toEqual(["inForce", "band", "kept", "retained", "returnNet", "taxes", "client", "insurer"]);
  });

  it("shows only the result of the policy, not the short-period scale", async () => {
    render(<MemoryRouter initialEntries={["/operations/policy-cancellation?policy=pol_1"]}><PolicyCancellation /></MemoryRouter>);
    fireEvent.click(await screen.findByText("Compute return premium"));
    expect(await screen.findByText("Return premium of POL-2026-00001")).toBeInTheDocument();
    expect(service.cancellationQuote).toHaveBeenCalledWith(expect.objectContaining({ policyId: "pol_1", method: "auto", cancellationType: "FULL" }));
    expect(screen.getByText("Not exceeding 4 months")).toBeInTheDocument();
    expect(screen.getByText("Refund to the client")).toBeInTheDocument();
    expect(screen.queryByText("Up to (days in force)")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
