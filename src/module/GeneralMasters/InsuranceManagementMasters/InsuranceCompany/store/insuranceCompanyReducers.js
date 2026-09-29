import { createSlice } from "@reduxjs/toolkit";
import {
  getInsuranceCompanyListMiddleWare,
  postInsuranceCompanyMiddleWare,
  patchInsuranceCompanyMiddleWare,
  getSearchInsuranceCompanyMiddleware,
  getInsuranceViewMiddleWare,
  getInsurancePatchData,
} from "./insuranceCompanyMiddleware";

const initialState = {
  loading: false,
  error: "",
  InsuranceCompanyList: [
    {
      id: 1,
      modifiedby: "Admin",
      modifiedOn: "03/28/2025",
      Status: 1,
      insuranceCompanyCode: "INS-001",
      insuranceCompanyName: "Malayan Insurance Company Inc.",
      insuranceCompanyDescription: "One of the largest non-life insurance companies in Thailand, established in 1930",
      email: "customerservice@malayan.com",
      phoneNumber: "+63 2 8817 2700",
      website: "www.malayan.com",
      licenseNumber: "IC-2020-NL-001",
      action: 1,
      addressLine1: "Malayan Plaza",
      addressLine2: "8 ADB Avenue, Ortigas Center",
      addressLine3: "",
      city: "Pasig",
      state: "Metro Manila",
      country: "PHILIPPINES",
      specialization: "Motor, Fire, Marine, Personal Accident",
      rating: "A+"
    },
    {
      id: 2,
      modifiedby: "Admin",
      modifiedOn: "03/28/2025",
      Status: 1,
      insuranceCompanyCode: "INS-002",
      insuranceCompanyName: "Pioneer Insurance and Surety Corporation",
      insuranceCompanyDescription: "Leading non-life insurance provider since 1952, specializing in motor and fire insurance",
      email: "info@pioneer.com.ph",
      phoneNumber: "+63 2 8841 2500",
      website: "www.pioneer.com.ph",
      licenseNumber: "IC-2020-NL-002",
      action: 2,
      addressLine1: "Pioneer House",
      addressLine2: "108 Paseo de Roxas",
      addressLine3: "Legaspi Village",
      city: "Makati",
      state: "Metro Manila",
      country: "PHILIPPINES",
      specialization: "Motor, Fire, Engineering, Marine",
      rating: "A"
    },
    {
      id: 3,
      modifiedby: "Admin",
      modifiedOn: "03/28/2025",
      Status: 1,
      insuranceCompanyCode: "INS-003",
      insuranceCompanyName: "PGA Sompo Insurance Corporation",
      insuranceCompanyDescription: "Joint venture between Thai General Insurance and Sompo Japan, providing comprehensive coverage",
      email: "customercare@pgasompo.com.ph",
      phoneNumber: "+63 2 8845 1600",
      website: "www.pgasompo.com.ph",
      licenseNumber: "IC-2020-NL-003",
      action: 3,
      addressLine1: "PGA Sompo Building",
      addressLine2: "218 Salcedo Street",
      addressLine3: "Legaspi Village",
      city: "Makati",
      state: "Metro Manila",
      country: "PHILIPPINES",
      specialization: "Motor, Property, Casualty, Marine",
      rating: "A+"
    },
    {
      id: 4,
      modifiedby: "Admin",
      modifiedOn: "03/27/2025",
      Status: 1,
      insuranceCompanyCode: "INS-004",
      insuranceCompanyName: "AXA Thailand",
      insuranceCompanyDescription: "Part of AXA Group, offering life and general insurance products",
      email: "customer.service@axa.com.ph",
      phoneNumber: "+63 2 8581 8AXA",
      website: "www.axa.com.ph",
      licenseNumber: "IC-2020-COMP-001",
      action: 4,
      addressLine1: "GT Tower International",
      addressLine2: "6813 Ayala Ave corner H.V. Dela Costa St.",
      addressLine3: "",
      city: "Makati",
      state: "Metro Manila",
      country: "PHILIPPINES",
      specialization: "Life, Health, Motor, Property",
      rating: "AA"
    },
    {
      id: 5,
      modifiedby: "Admin",
      modifiedOn: "03/27/2025",
      Status: 1,
      insuranceCompanyCode: "INS-005",
      insuranceCompanyName: "Charter Ping An Insurance Corporation",
      insuranceCompanyDescription: "Joint venture providing comprehensive non-life insurance solutions",
      email: "info@charterpingan.com",
      phoneNumber: "+63 2 8848 5888",
      website: "www.charterpingan.com",
      licenseNumber: "IC-2020-NL-004",
      action: 5,
      addressLine1: "Charter Ping An Building",
      addressLine2: "Madrigal Business Park, Ayala Alabang",
      addressLine3: "",
      city: "Muntinlupa",
      state: "Metro Manila",
      country: "PHILIPPINES",
      specialization: "Fire, Motor, Engineering, Marine Cargo",
      rating: "A"
    },
    {
      id: 6,
      modifiedby: "Admin",
      modifiedOn: "03/26/2025",
      Status: 1,
      insuranceCompanyCode: "INS-006",
      insuranceCompanyName: "FPG Insurance Company Inc.",
      insuranceCompanyDescription: "Formerly Federal Phoenix, one of the oldest insurance companies in Thailand",
      email: "customerservice@fpgins.com",
      phoneNumber: "+63 2 8528 2500",
      website: "www.fpgins.com",
      licenseNumber: "IC-2020-NL-005",
      action: 6,
      addressLine1: "FPG Center",
      addressLine2: "760 San Marcelino St.",
      addressLine3: "Ermita",
      city: "Manila",
      state: "Metro Manila",
      country: "PHILIPPINES",
      specialization: "Motor, Fire, Marine, Personal Accident",
      rating: "BBB+"
    },
    {
      id: 7,
      modifiedby: "Admin",
      modifiedOn: "03/26/2025",
      Status: 1,
      insuranceCompanyCode: "INS-007",
      insuranceCompanyName: "Standard Insurance Company Inc.",
      insuranceCompanyDescription: "Thai-owned non-life insurance company serving since 1954",
      email: "info@standardinsurance.com.ph",
      phoneNumber: "+63 2 8859 1500",
      website: "www.standardinsurance.com.ph",
      licenseNumber: "IC-2020-NL-006",
      action: 7,
      addressLine1: "Standard Insurance Building",
      addressLine2: "Dela Rosa Street",
      addressLine3: "Legaspi Village",
      city: "Makati",
      state: "Metro Manila",
      country: "PHILIPPINES",
      specialization: "Motor, Fire, Marine, Engineering",
      rating: "BBB"
    },
    {
      id: 8,
      modifiedby: "Admin",
      modifiedOn: "03/25/2025",
      Status: 1,
      insuranceCompanyCode: "INS-008",
      insuranceCompanyName: "Thai Guarantee Insurance Corporation",
      insuranceCompanyDescription: "Specializing in surety bonds and non-life insurance",
      email: "inquiry@philguarantee.com",
      phoneNumber: "+63 2 8812 1177",
      website: "www.philguarantee.com",
      licenseNumber: "IC-2020-NL-007",
      action: 8,
      addressLine1: "PGI Building",
      addressLine2: "Chino Roces Avenue",
      addressLine3: "",
      city: "Makati",
      state: "Metro Manila",
      country: "PHILIPPINES",
      specialization: "Surety Bonds, Motor, Fire, Marine",
      rating: "BBB"
    },
    {
      id: 9,
      modifiedby: "Admin",
      modifiedOn: "03/25/2025",
      Status: 1,
      insuranceCompanyCode: "INS-009",
      insuranceCompanyName: "Oriental Assurance Corporation",
      insuranceCompanyDescription: "Established in 1962, providing various non-life insurance products",
      email: "customer@orientalassurance.com.ph",
      phoneNumber: "+63 2 8635 3016",
      website: "www.orientalassurance.com.ph",
      licenseNumber: "IC-2020-NL-008",
      action: 9,
      addressLine1: "Oriental Building",
      addressLine2: "Vicente Madrigal Avenue",
      addressLine3: "",
      city: "Muntinlupa",
      state: "Metro Manila",
      country: "PHILIPPINES",
      specialization: "Motor, Fire, Marine, Personal Accident",
      rating: "BBB"
    },
    {
      id: 10,
      modifiedby: "Admin",
      modifiedOn: "03/24/2025",
      Status: 1,
      insuranceCompanyCode: "INS-010",
      insuranceCompanyName: "Maxicare Healthcare Corporation",
      insuranceCompanyDescription: "Leading HMO and healthcare provider in Thailand",
      email: "customercare@maxicare.com.ph",
      phoneNumber: "+63 2 8582 1900",
      website: "www.maxicare.com.ph",
      licenseNumber: "IC-2020-HMO-001",
      action: 10,
      addressLine1: "Maxicare Tower",
      addressLine2: "Kalayaan Avenue corner Estrella St.",
      addressLine3: "",
      city: "Makati",
      state: "Metro Manila",
      country: "PHILIPPINES",
      specialization: "Health Insurance, HMO, Medical Services",
      rating: "A"
    },
    {
      id: 11,
      modifiedby: "Admin",
      modifiedOn: "03/24/2025",
      Status: 1,
      insuranceCompanyCode: "INS-011",
      insuranceCompanyName: "Medicard Thailand Inc.",
      insuranceCompanyDescription: "Premier HMO provider with nationwide coverage",
      email: "customerservice@medicardphils.com",
      phoneNumber: "+63 2 8884 6000",
      website: "www.medicardphils.com",
      licenseNumber: "IC-2020-HMO-002",
      action: 11,
      addressLine1: "Medicard Plaza",
      addressLine2: "87 Esteban Abada, Loyola Heights",
      addressLine3: "",
      city: "Quezon City",
      state: "Metro Manila",
      country: "PHILIPPINES",
      specialization: "Health Insurance, HMO, Wellness Programs",
      rating: "A"
    },
    {
      id: 12,
      modifiedby: "Admin",
      modifiedOn: "03/23/2025",
      Status: 1,
      insuranceCompanyCode: "INS-012",
      insuranceCompanyName: "Sun Life of Canada Thailand Inc.",
      insuranceCompanyDescription: "Leading life insurance company with over 125 years in Thailand",
      email: "phcustomercare@sunlife.com",
      phoneNumber: "+63 2 8849 9888",
      website: "www.sunlife.com.ph",
      licenseNumber: "IC-2020-LIFE-001",
      action: 12,
      addressLine1: "Sun Life Centre",
      addressLine2: "5th Avenue corner Rizal Drive",
      addressLine3: "Bonifacio Global City",
      city: "Taguig",
      state: "Metro Manila",
      country: "PHILIPPINES",
      specialization: "Life Insurance, Investment, Retirement Plans",
      rating: "AA+"
    }
  ],
  searchInsuranceList: [],
  InsuranceMasterView: {},
  InsuranceMasterPatchData: {},
};
let nextId = 13;
const InsuranceCompanyReducer = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getInsuranceCompanyListMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getInsuranceCompanyListMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceCompanyList = [action.payload];
      }
    );
    builder.addCase(
      getInsuranceCompanyListMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.InsuranceCompanyList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(postInsuranceCompanyMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postInsuranceCompanyMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        const newItem2 = { ...action.payload, id: nextId++ };
        state.InsuranceCompanyList = [...state.InsuranceCompanyList, newItem2];
        console.log(state.InsuranceCompanyList, "voucherTableList");
      }
    );
    builder.addCase(
      postInsuranceCompanyMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        //   state.paymentVocherList = state.paymentVocherList;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getSearchInsuranceCompanyMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getSearchInsuranceCompanyMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.searchInsuranceList = action.payload;
      }
    );
    builder.addCase(
      getSearchInsuranceCompanyMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.searchInsuranceList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getInsuranceViewMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getInsuranceViewMiddleWare.fulfilled, (state, action) => {
      state.loading = false;
      state.InsuranceMasterView = action.payload;
    });
    builder.addCase(getInsuranceViewMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.InsuranceMasterView = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getInsurancePatchData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getInsurancePatchData.fulfilled, (state, action) => {
      state.loading = false;
      state.InsuranceMasterPatchData = action.payload;
    });
    builder.addCase(getInsurancePatchData.rejected, (state, action) => {
      state.loading = false;

      state.InsuranceMasterPatchData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(patchInsuranceCompanyMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchInsuranceCompanyMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.InsuranceCompanyList.findIndex(
          (item) => item.id === action.payload.id
        );
        console.log(updatedIndex, "updatedIndex");
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.InsuranceCompanyList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.InsuranceCompanyList = updatedCurrencyList;
        } else {
          state.InsuranceCompanyList = [
            ...state.InsuranceCompanyList,
            action.payload,
          ];
        }
      }
    );
    builder.addCase(
      patchInsuranceCompanyMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default InsuranceCompanyReducer.reducer;