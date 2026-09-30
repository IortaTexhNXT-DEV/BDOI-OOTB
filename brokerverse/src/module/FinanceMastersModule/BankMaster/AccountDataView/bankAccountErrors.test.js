import { bankAccountErrors } from "./index";

const valid = {
  accountCode: "BDO-COLL",
  accountName: "Premium Collection Account",
  bankCode: "BDO",
  accountNumber: "0012-3456-7890",
  accountType: "Current Account",
  currency: "PHP",
};

describe("bankAccountErrors", () => {
  it("accepts a complete account", () => {
    expect(bankAccountErrors(valid)).toEqual({});
  });

  it("asks for the required fields", () => {
    const errors = bankAccountErrors({});
    expect(Object.keys(errors).sort()).toEqual(["accountCode", "accountName", "accountNumber", "accountType", "bankCode", "currency"]);
  });

  it("checks the formats of number, e-mail, phone and SWIFT code", () => {
    const errors = bankAccountErrors({ ...valid, accountNumber: "12ab", email: "x@y", contactNumber: "abc", swiftCode: "BNOR" });
    expect(Object.keys(errors).sort()).toEqual(["accountNumber", "contactNumber", "email", "swiftCode"]);
    expect(bankAccountErrors({ ...valid, swiftCode: "BNORPHMM", contactNumber: "+63 2 8840 7000" })).toEqual({});
  });
});
