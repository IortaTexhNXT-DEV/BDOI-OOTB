import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "../../../i18n";
import ClientOnboarding, { validateOnboarding, PH_MOBILE, PH_TIN } from ".";
import onboardingService from "./onboardingService";
import addressService from "../../../services/addressService";
import { menuList } from "../../../components/SideBar/list";
import { isPathAllowed } from "../../../utils/menuPermissions";
import { helpSectionFor } from "../../../components/HelpPanel/helpRoutes";

jest.mock("./onboardingService", () => ({
  __esModule: true,
  errorMessage: (e, fallback) => fallback,
  fieldErrors: () => ({}),
  default: { client: jest.fn(), profile: jest.fn(), options: jest.fn(), onboard: jest.fn(), updateKyc: jest.fn() },
}));
jest.mock("../../../services/addressService", () => ({
  __esModule: true,
  default: { getCountries: jest.fn(), getRegionsByCountry: jest.fn(), getProvincesByCountry: jest.fn(), getCitiesByProvince: jest.fn(), getBarangaysByCity: jest.fn(), getPostalCodeLookup: jest.fn() },
}));

const t = (k) => k;

describe("client onboarding checks", () => {
  it("accepts Philippine mobile numbers and TINs only", () => {
    expect(PH_MOBILE.test("09171234567")).toBe(true);
    expect(PH_MOBILE.test("+639171234567")).toBe(true);
    expect(PH_MOBILE.test("0217123456")).toBe(false);
    expect(PH_TIN.test("123-456-789-000")).toBe(true);
    expect(PH_TIN.test("123456789")).toBe(true);
    expect(PH_TIN.test("12-345")).toBe(false);
  });
  it("requires the identification of an individual and the registration of a juridical client", () => {
    const ind = validateOnboarding({ clientType: "individual", contactNumber: "0917 123 4567", City: "Makati City" }, t);
    expect(Object.keys(ind).sort()).toEqual(["DOB", "firstName", "idNumber", "idType", "lastName", "nationality"]);
    const jur = validateOnboarding({ clientType: "corporate", contactNumber: "123", companyName: "Acme Inc.", taxNumber: "bad" }, t);
    expect(Object.keys(jur).sort()).toEqual(["City", "contactNumber", "registrationAuthority", "registrationNumber", "taxNumber"]);
  });
});

describe("client onboarding access and help", () => {
  it("lets the client roles open the onboarding screen", () => {
    for (const role of ["sales", "operations"]) expect(isPathAllowed("/agent/client-onboarding/cl_1", menuList, [role])).toBe(true);
    expect(isPathAllowed("/agent/client-onboarding", menuList, ["accounting"])).toBe(false);
  });
  it("links the screen to its user manual section", () => {
    expect(helpSectionFor("/agent/client-onboarding/cl_1").id).toBe("onboard-a-client-before-the-first-policy");
  });
});

describe("client onboarding screen", () => {
  it("shows the KYC status, what is missing and the documents of an existing client, without a risk rating", async () => {
    for (const fn of Object.values(addressService)) fn.mockResolvedValue({ success: true, data: [] });
    onboardingService.options.mockResolvedValue([]);
    onboardingService.client.mockResolvedValue({ id: "cl_1", clientType: "individual", firstName: "Ramon", lastName: "Villanueva" });
    onboardingService.profile.mockResolvedValue({
      client: { id: "cl_1", clientCode: "CL-2026-00001", displayName: "Ramon Villanueva", clientType: "individual", kycStatus: "pending" },
      missing: ["ID number"], signatories: [], beneficialOwners: [], ownerWarnings: [], beneficialOwnerThreshold: 25,
      documents: [{ id: 1, docType: "government-id", relatedType: "client", relatedId: null, fileName: "id.pdf", storageKey: "kyc/id.pdf" }],
    });
    render(
      <MemoryRouter initialEntries={["/agent/client-onboarding/cl_1"]}>
        <Routes><Route path="/agent/client-onboarding/:id" element={<ClientOnboarding />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Ramon Villanueva (CL-2026-00001)")).toBeInTheDocument();
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
    expect(screen.getByText("Identification missing: ID number")).toBeInTheDocument();
    expect(screen.getAllByText("Government ID").length).toBeGreaterThan(0);
    expect(screen.queryByText(/risk rating/i)).not.toBeInTheDocument();
    expect(onboardingService.profile).toHaveBeenCalledWith("cl_1");
  });
});
