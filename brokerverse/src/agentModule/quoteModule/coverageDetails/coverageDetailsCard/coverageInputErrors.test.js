import coverageInputErrors from "./coverageInputErrors";

describe("coverageInputErrors", () => {
  it("accepts a positive sum insured and rates from 0 to 100", () => {
    expect(coverageInputErrors({ LossandDamagecoverage: "950,000", LossandDamagecoverageRate: "2" })).toEqual({});
  });

  it("rejects an empty, zero or negative sum insured", () => {
    expect(coverageInputErrors({ LossandDamagecoverageRate: "2" }).LossandDamagecoverage).toBeTruthy();
    expect(coverageInputErrors({ LossandDamagecoverage: "0", LossandDamagecoverageRate: "2" }).LossandDamagecoverage).toBeTruthy();
    expect(coverageInputErrors({ LossandDamagecoverage: "-950000", LossandDamagecoverageRate: "2" }).LossandDamagecoverage).toBeTruthy();
  });

  it("checks the rates of the covers that are included only", () => {
    const values = { LossandDamagecoverage: "950000", LossandDamagecoverageRate: "2", ActsofNatureRate: "-1", PersonalAccidentCoverRate: "150" };
    expect(coverageInputErrors(values)).toEqual({});
    expect(Object.keys(coverageInputErrors(values, { includeActsOfNature: true, includePersonalAccident: true })).sort()).toEqual([
      "ActsofNatureRate",
      "PersonalAccidentCoverRate",
    ]);
  });
});
