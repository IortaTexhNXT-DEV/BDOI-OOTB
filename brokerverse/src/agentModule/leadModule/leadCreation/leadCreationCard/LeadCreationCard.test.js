import i18n from "../../../../i18n";
import { formFromClient, validateProspect } from ".";

const t = i18n.t.bind(i18n);
const ageLimits = { min: 18, max: 100 };
const valid = {
  category: "Retail", FirstName: "Tala", LastName: "Reyes", PreferredName: "Tala", EmailID: "tala@example.ph", ContactNumber: "0917 111 2222",
  HouseNo: "12", Barangay: "Poblacion", Country: "Philippines", Province: "Metro Manila", City: "Makati City", ZIPCode: "1210", DateofBirth: new Date(1990, 4, 1), gender: "Female",
};

describe("prospect form checks", () => {
  it("accepts a complete retail prospect", () => {
    expect(validateProspect(valid, { t, ageLimits })).toEqual({});
  });

  it("names each missing or wrong field", () => {
    const errors = validateProspect({ ...valid, EmailID: "tala@", ContactNumber: "12", ZIPCode: "12345", DateofBirth: "", City: "" }, { t, ageLimits });
    expect(errors).toEqual({
      EmailID: "Enter a valid e-mail address", ContactNumber: expect.stringMatching(/^Enter a valid mobile number/), ZIPCode: "Enter the four-digit ZIP code",
      DateofBirth: "Enter this field", City: "Enter this field",
    });
  });

  it("asks a corporate prospect for the company and TIN, not for the contact person's birth date or gender", () => {
    const corporate = { ...valid, category: "Corporate", DateofBirth: "", gender: "" };
    expect(validateProspect(corporate, { t, ageLimits })).toEqual({ CompanyName: "Enter this field", TaxNumber: "Enter this field" });
    expect(validateProspect({ ...corporate, CompanyName: "Visayas Cold Storage Inc.", TaxNumber: "123-456-789" }, { t, ageLimits })).toEqual({});
    expect(validateProspect({ ...corporate, CompanyName: "X", TaxNumber: "1234" }, { t, ageLimits }).TaxNumber).toMatch(/^Enter the TIN/);
  });

  it("starts the form of an existing client from the client, linked to it", () => {
    const v = formFromClient({ clientId: "cl_1", clientType: "corporate", companyName: "Visayas Cold Storage Inc.", firstName: "Ana", lastName: "Cruz", emailId: "ana@vcs.ph",
      contactNumber: "09171234567", province: "Cebu", city: "Mandaue City", DOB: "1980-02-03" });
    expect(v).toMatchObject({ clientId: "cl_1", category: "Corporate", CompanyName: "Visayas Cold Storage Inc.", FirstName: "Ana", PreferredName: "Ana", EmailID: "ana@vcs.ph",
      Province: "Cebu", City: "Mandaue City", Country: "Philippines" });
    expect(v.DateofBirth.getFullYear()).toBe(1980);
  });
});
