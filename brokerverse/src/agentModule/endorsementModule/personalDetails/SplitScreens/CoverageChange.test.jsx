import { priceCoverage } from "./CoverageChange";

const TAXES = { valueAddedTax: 0.12, documentaryStampTax: 0.125, localGovernmentTax: 0.0075 };
const amount = (v) => Number(String(v).replace(/,/g, ""));

describe("endorsement coverage price", () => {
  it("adds the CTPL tariff to the gross without taxing it again, as the quotation does", () => {
    const issued = { LossandDamagecoverage: "2000000", LossandDamagecoverageRate: "2", CtplCoverageRate: "610.40", BodilyInjury: "100000", BodilyInjuryCoveragePremium: "1000",
      PropertyDamage: "100000", PropertyDamageCoveragePremium: "1000", AutopassengerpersonalAccident: "25000", APPAcoveragePremium: "125", APPATotalCoverage: "125000" };
    const priced = priceCoverage(issued, TAXES, "2", { issuedPerPerson: "25000", seats: 5 });
    expect(amount(priced.NETpremium)).toBe(42125);
    expect(amount(priced.ValueAddedTax)).toBe(5055);
    expect(amount(priced.Grosspremium)).toBeCloseTo(42125 + 5055 + 5265.63 + 315.94 + 610.4, 2);
  });
});
