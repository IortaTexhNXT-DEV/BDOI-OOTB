import { getCategoriesForLob, isMotorLob, isOtherLob } from "./endorsementCategories";

describe("line of business of a policy", () => {
  it("counts Motor and CTPL as motor, by code or product name", () => {
    for (const v of ["MOTOR", "Motor Vehicle Insurance", "CTPL", "Compulsory Third Party Liability"]) expect(isMotorLob(v)).toBe(true);
    for (const v of ["LIFE", "Credit Life - Voluntary", "Personal Accident", "Comprehensive General Liability", null]) expect(isMotorLob(v)).toBe(false);
  });

  it("knows the lines without a vehicle; an unknown or empty line keeps the motor screens", () => {
    for (const v of ["ACCIDENT", "LIFE", "Credit Life - Compulsory", "Travel Insurance", "Group Personal Accident", "Parcel / Courier Insurance", "MARINE"]) expect(isOtherLob(v)).toBe(true);
    for (const v of ["MOTOR", "CTPL", "FIRE", "Industrial All Risks", "", null, "Standard"]) expect(isOtherLob(v)).toBe(false);
  });

  it("offers no motor details or coverage change endorsement on a line without a vehicle", () => {
    expect(getCategoriesForLob("LIFE").map((c) => c.typeId)).toEqual(["1", "4", "5"]);
    expect(getCategoriesForLob("MOTOR").map((c) => c.typeId)).toEqual(["1", "2", "3", "4", "5"]);
    expect(getCategoriesForLob("Fire and Allied Perils").map((c) => c.typeId)).toEqual(["fire_regular", "fire_cancel"]);
  });
});
