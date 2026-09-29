import { splitPreview, shareTotal, participantProblem } from "./shared";

const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);

describe("co-insurance participant helpers", () => {
  it("splits like the server: co-insurers rounded, the remainder on the lead", () => {
    const rows = splitPreview(
      [{ insuranceCompanyId: 1, sharePercent: 33.3333, isLead: true }, { insuranceCompanyId: 2, sharePercent: 33.3333 }, { insuranceCompanyId: 3, sharePercent: 33.3334 }],
      { sumInsured: 1000, premium: 100.01, premiumTotal: 100.06, commissionAmount: 15 },
    );
    expect(rows.map((r) => r.premium)).toEqual([33.33, 33.34, 33.34]);
    expect(Math.round(rows.reduce((s, r) => s + r.premiumTotal, 0) * 100) / 100).toBe(100.06);
  });

  it("validates one lead, distinct insurers and a 100% total", () => {
    expect(shareTotal([{ sharePercent: 60 }, { sharePercent: 40 }])).toBe(100);
    expect(participantProblem([], t)).toBe("placement.participants.needOne");
    expect(participantProblem([{ insuranceCompanyId: 1, sharePercent: 60, isLead: true }, { insuranceCompanyId: 1, sharePercent: 40 }], t)).toBe("placement.participants.duplicate");
    expect(participantProblem([{ insuranceCompanyId: 1, sharePercent: 60, isLead: true }, { insuranceCompanyId: 2, sharePercent: 40, isLead: true }], t)).toBe("placement.participants.oneLead");
    expect(participantProblem([{ insuranceCompanyId: 1, sharePercent: 60, isLead: true }, { insuranceCompanyId: 2, sharePercent: 30 }], t)).toContain("placement.participants.mustTotal");
    expect(participantProblem([{ insuranceCompanyId: 1, sharePercent: 60, isLead: true }, { insuranceCompanyId: 2, sharePercent: 40 }], t)).toBeNull();
  });
});
