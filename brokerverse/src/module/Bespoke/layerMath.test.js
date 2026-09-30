import { layerProblems, layerShareTotal, nextLayer } from "./layerMath";
import { move, bespokeSeverity } from "./shared";

const layers = () => [
  { limit: 300, attachmentPoint: 0, premium: 60, participants: [{ insuranceCompanyId: 1, sharePercent: 40, isLead: true }, { insuranceCompanyId: 2, sharePercent: 30 }, { insuranceCompanyId: 3, sharePercent: 30 }] },
  { limit: 700, attachmentPoint: 300, premium: 40, participants: [{ insuranceCompanyId: 2, sharePercent: 60, isLead: true }, { insuranceCompanyId: 4, sharePercent: 40 }] },
];

describe("layering rules", () => {
  it("accepts a valid programme", () => {
    expect(layerProblems(layers(), { netPremium: 100 })).toEqual([]);
    expect(layerShareTotal(layers()[0])).toBe(100);
  });
  it("reports shares, leads, duplicates, contiguity and the premium", () => {
    const l = layers();
    l[0].participants[2].sharePercent = 20;
    l[1].participants[1].isLead = true;
    l[1].attachmentPoint = 250;
    l[1].participants.push({ insuranceCompanyId: 2, sharePercent: 0 });
    expect(layerProblems(l, { netPremium: 90 })).toEqual([
      "Layer 1: shares must total exactly 100% (they total 90%)",
      "Layer 2 must attach at 300, where layer 1 ends",
      "Layer 2: an insurer can take part only once in a layer",
      "Layer 2: exactly one participant must lead the layer",
      "The layer premiums total 100; they must add up to the net premium 90",
    ]);
  });
  it("adds the next layer where the last one ends", () => {
    expect(nextLayer(layers())).toMatchObject({ attachmentPoint: 1000, participants: [{ sharePercent: 100, isLead: true }] });
    expect(nextLayer([]).attachmentPoint).toBe(0);
  });
});

describe("bespoke helpers", () => {
  it("moves items and colours statuses", () => {
    expect(move([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(bespokeSeverity("signed")).toBe("success");
    expect(bespokeSeverity("countered")).toBe("warning");
  });
});
