import { epolicyFormValues } from "./EpolicyForm";

const placement = {
  id: "plc_1", placementNumber: "PS-2026-00001", lob: "MOTOR", insuredName: "Maria Santos", sumInsured: 1250000, netPremium: 18250, grossPremium: 22813.13, commissionAmount: 2737.5,
  inceptionDate: "2026-10-06", expiryDate: "2027-10-06", doc: { plateNumber: "TBA", insuranceVehicleDetails: [{ chassisNumber: "MHFXW42G5P0077777" }] },
  kycPrefill: { motorNumber: "2NRX777777", plateNumber: "" },
  participants: [{ insuranceCompanyId: 2, isLead: true }, { insuranceCompanyId: 3, isLead: false, insurerReference: "PIO-1", status: "pending" }],
};

describe("e-policy form", () => {
  it("starts from the slip: figures, period and the vehicle identifiers carried from the quotation (TBA is not carried)", () => {
    const v = epolicyFormValues(placement);
    expect(v).toMatchObject({ participantName: "Maria Santos", sumInsured: 1250000, netPremium: 18250, commissionAmount: 2737.5, insurerPolicyNumber: "" });
    expect(v.vehicle).toEqual({ chassisNumber: "MHFXW42G5P0077777", motorNumber: "2NRX777777", plateNumber: "", mvFileNumber: "" });
    expect(v.effectiveDate.getFullYear()).toBe(2026);
    expect(v.references).toEqual({ 3: "PIO-1" });
  });

  it("starts from the e-policy returned to the insurer when there is one", () => {
    const v = epolicyFormValues({ ...placement, epolicy: { insurerPolicyNumber: "MAL-1", netPremium: 18400, participantName: "Maria L. Santos", vehicle: { plateNumber: "NCA 4521" } } });
    expect(v).toMatchObject({ insurerPolicyNumber: "MAL-1", netPremium: 18400, participantName: "Maria L. Santos" });
    expect(v.vehicle.plateNumber).toBe("NCA 4521");
  });
});
