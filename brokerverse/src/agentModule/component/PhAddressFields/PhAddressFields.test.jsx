import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useFormik } from "formik";
import "../../../i18n";
import PhAddressFields from ".";
import addressService from "../../../services/addressService";

jest.mock("../../../services/addressService", () => ({
  __esModule: true,
  default: {
    getCountries: jest.fn(),
    getRegionsByCountry: jest.fn(),
    getProvincesByCountry: jest.fn(),
    getCitiesByProvince: jest.fn(),
    getBarangaysByCity: jest.fn(),
    getPostalCodeLookup: jest.fn(),
  },
}));

const ok = (data) => Promise.resolve({ success: true, data });
const REGIONS = [
  { id: 1, code: "NCR", name: "National Capital Region (NCR)" },
  { id: 7, code: "VII", name: "Region VII (Central Visayas)" },
];
const PROVINCES = [
  { id: 10, code: "NCR", name: "Metro Manila", regionId: 1, regionName: "National Capital Region (NCR)" },
  { id: 20, code: "CEB", name: "Cebu", regionId: 7, regionName: "Region VII (Central Visayas)" },
];
const CITIES = {
  20: [{ id: 200, name: "Mandaue City", zipCode: "6014", regionName: "Region VII (Central Visayas)" }],
  10: [{ id: 100, name: "Makati City", zipCode: "1200", regionName: "National Capital Region (NCR)" }],
};

let latest;
function Form({ initial }) {
  const formik = useFormik({ initialValues: { Country: "Philippines", Region: "", Province: "", City: "", Barangay: "", HouseNo: "", Street: "", ZIPCode: "", ...initial }, onSubmit: () => {} });
  latest = formik;
  return <PhAddressFields formik={formik} />;
}

beforeEach(() => {
  addressService.getCountries.mockReturnValue(ok([{ id: 1, code: "PH", name: "Philippines" }]));
  addressService.getRegionsByCountry.mockReturnValue(ok(REGIONS));
  addressService.getProvincesByCountry.mockReturnValue(ok(PROVINCES));
  addressService.getCitiesByProvince.mockImplementation((id) => ok(CITIES[id] || []));
  addressService.getBarangaysByCity.mockReturnValue(ok([]));
  addressService.getPostalCodeLookup.mockReturnValue(ok([{ region: "National Capital Region (NCR)", province: "Metro Manila", city: "Makati City", postalCode: "1200" }]));
});

describe("Philippine address fields", () => {
  it("shows the Philippine address parts, the barangay as free text when the list is not loaded", async () => {
    render(<Form initial={{}} />);
    for (const label of ["Region", "Province", "City / Municipality", "Barangay", "House / Unit No.", "Street / Subdivision", "ZIP Code"]) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
    expect(addressService.getRegionsByCountry).toHaveBeenCalledWith("PH");
  });

  it("writes a saved city under its master name and fills the region from the city", async () => {
    render(<Form initial={{ Province: "Cebu", City: "Mandaue" }} />);
    await waitFor(() => expect(latest.values.City).toBe("Mandaue City"));
    expect(latest.values.Region).toBe("Region VII (Central Visayas)");
    expect(addressService.getCitiesByProvince).toHaveBeenCalledWith(20);
  });

  it("fills city, province and region from a ZIP code typed first", async () => {
    render(<Form initial={{ ZIPCode: "1200" }} />);
    const zip = await screen.findByDisplayValue("1200");
    await act(async () => {
      zip.focus();
      zip.blur();
    });
    await waitFor(() => expect(latest.values.City).toBe("Makati City"));
    expect(latest.values).toMatchObject({ Province: "Metro Manila", Region: "National Capital Region (NCR)" });
  });
});
