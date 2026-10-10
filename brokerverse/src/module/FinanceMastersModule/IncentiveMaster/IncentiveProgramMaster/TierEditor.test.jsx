import { fireEvent, render, screen } from "@testing-library/react";
import "../../../../i18n";
import TierEditor, { bandKind, previewPayout, tierProblem } from "./TierEditor";

const policyTiers = [
  { level: "0-10 policies", basis: "perUnit", value: 500, maxPayout: 5000 },
  { level: "11-20 policies", basis: "perUnit", value: 750, maxPayout: 15000 },
  { level: "21+", basis: "fixed", value: 20000, maxPayout: null },
];

describe("TierEditor", () => {
  it("reads the kind of band from the tiers, else from the measure", () => {
    expect(bandKind("premium", [{ level: "80-90%" }])).toBe("percent");
    expect(bandKind("policies", [])).toBe("count");
    expect(bandKind("premium", [{ level: "" }])).toBe("percent");
  });

  it("finds overlapping, missing and open bands as the server does", () => {
    expect(tierProblem(policyTiers, "count")).toBeNull();
    expect(tierProblem([{ level: "80-90%", value: 2 }, { level: "90-100%", value: 3 }], "percent")).toBeNull();
    expect(tierProblem([{ level: "0-10", value: 1 }, { level: "10-20", value: 1 }], "count")).toMatchObject({ index: 1, key: "tierOverlap" });
    expect(tierProblem([{ level: "80-90%", value: 1 }, { level: "95%+", value: 1 }], "percent"))
      .toEqual({ index: 1, key: "tierGap", values: { from: 90, to: 95 } });
    expect(tierProblem([{ level: "10+", value: 1 }, { level: "20+", value: 1 }], "count")).toMatchObject({ key: "tierOpenNotLast" });
    expect(tierProblem([{ level: "", value: 1 }], "count")).toMatchObject({ key: "tierFromRequired" });
    expect(tierProblem([{ level: "0-10", value: null }], "count")).toMatchObject({ key: "tierValueRequired" });
  });

  it("previews the payout of a sample achievement", () => {
    expect(previewPayout(policyTiers, "count", 4, 20)).toMatchObject({ amount: 2000, tier: policyTiers[0] });
    expect(previewPayout(policyTiers, "count", 15, 20)).toMatchObject({ amount: 11250 });
    expect(previewPayout(policyTiers, "count", 30, 20)).toMatchObject({ amount: 20000 });
    const premium = [{ level: "80-100%", basis: "percentOfAchieved", value: 2, maxPayout: 1500 }, { level: "100%+", basis: "percentOfAchieved", value: 3 }];
    expect(previewPayout(premium, "percent", 90, 100000)).toMatchObject({ amount: 1500 });
    expect(previewPayout(premium, "percent", 120, 100000)).toMatchObject({ amount: 3600 });
    expect(previewPayout(premium, "percent", 50, 100000)).toEqual({ tier: null, amount: 0 });
  });

  it("adds a tier that starts where the last one ends", () => {
    const onChange = jest.fn();
    render(<TierEditor value={[{ level: "0-10", basis: "perUnit", value: 500 }]} onChange={onChange} metric="policies" target={20} />);
    fireEvent.click(screen.getByText("Add tier"));
    expect(onChange).toHaveBeenLastCalledWith([
      { level: "0-10", basis: "perUnit", type: "Fixed Amount", value: 500, maxPayout: null },
      { level: "11+", basis: "perUnit", type: "Fixed Amount", value: null, maxPayout: null },
    ]);
  });
});
