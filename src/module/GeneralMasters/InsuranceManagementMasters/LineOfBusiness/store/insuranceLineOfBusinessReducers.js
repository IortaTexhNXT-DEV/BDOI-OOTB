import { createSlice } from "@reduxjs/toolkit";
import {
  getInsurancelineOfBusinessListMiddleWare,
  postInsurancelineOfBusinessMiddleWare,
  patchInsurancelineOfBusinessMiddleWare,
  getSearchInsurancelineOfBusinessMiddleware,
} from "./insuranceLineOfBusinessMiddleware";
const initialState = {
  loading: false,
  error: "",
  InsuranceLineOfBusinessList: [
    {
      id: 1,
      modifiedby: "Maria Santos",
      modifiedOn: "03/28/2025",
      Status: 1,
      businessCode: "LOB-MOT",
      LOBName: "Motor",
      description: "Comprehensive and CTPL motor vehicle insurance including private cars, commercial vehicles, and motorcycles",
      action: 1,
    },
    {
      id: 2,
      modifiedby: "Roberto Reyes",
      modifiedOn: "03/28/2025",
      Status: 1,
      businessCode: "LOB-FIRE",
      LOBName: "Fire & Allied Perils",
      description: "Property insurance covering fire, lightning, typhoon, flood, earthquake, and other allied perils as per Thailand Insurance Commission standards",
      action: 2,
    },
    {
      id: 3,
      modifiedby: "Juan Dela Cruz",
      modifiedOn: "03/27/2025",
      Status: 1,
      businessCode: "LOB-MAR",
      LOBName: "Marine",
      description: "Marine cargo and hull insurance for import/export shipments and vessel coverage in Thai waters",
      action: 3,
    },
    {
      id: 4,
      modifiedby: "Ana Garcia",
      modifiedOn: "03/27/2025",
      Status: 1,
      businessCode: "LOB-PA",
      LOBName: "Personal Accident",
      description: "Individual and group personal accident coverage including death, disability, and medical reimbursement benefits",
      action: 4,
    },
    {
      id: 5,
      modifiedby: "Pedro Gonzales",
      modifiedOn: "03/26/2025",
      Status: 1,
      businessCode: "LOB-ENG",
      LOBName: "Engineering",
      description: "Contractor's All Risk, Erection All Risk, Machinery Breakdown, and Electronic Equipment Insurance for construction and industrial projects",
      action: 5,
    },
    {
      id: 6,
      modifiedby: "Carmen Bautista",
      modifiedOn: "03/26/2025",
      Status: 1,
      businessCode: "LOB-LIAB",
      LOBName: "Liability",
      description: "General third party liability, professional indemnity, directors & officers liability, and product liability coverage",
      action: 6,
    },
    {
      id: 7,
      modifiedby: "Rosa Fernandez",
      modifiedOn: "03/25/2025",
      Status: 1,
      businessCode: "LOB-HEALTH",
      LOBName: "Health",
      description: "Group and individual health insurance including HMO coverage, hospitalization, and outpatient benefits",
      action: 7,
    },
    {
      id: 8,
      modifiedby: "Miguel Torres",
      modifiedOn: "03/25/2025",
      Status: 1,
      businessCode: "LOB-TRAVEL",
      LOBName: "Travel",
      description: "Domestic and international travel insurance covering medical emergencies, trip cancellation, and baggage loss",
      action: 8,
    },
    {
      id: 9,
      modifiedby: "Elena Martinez",
      modifiedOn: "03/24/2025",
      Status: 1,
      businessCode: "LOB-BOND",
      LOBName: "Bonds & Credit",
      description: "Surety bonds, performance bonds, bid bonds, and credit insurance for contractors and businesses",
      action: 9,
    },
    {
      id: 10,
      modifiedby: "Carlos Mendoza",
      modifiedOn: "03/24/2025",
      Status: 1,
      businessCode: "LOB-MISC",
      LOBName: "Miscellaneous",
      description: "Specialized insurance lines including aviation, livestock, crop insurance, and microinsurance products for the Thailand market",
      action: 10,
    },
  ],
  SearchTableList: [],
};
const insuranceManagementlineOfBusinessMasterReducer = createSlice({
  name: "mainAccountMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(
      getInsurancelineOfBusinessListMiddleWare.pending,
      (state) => {
        state.loading = true;
      }
    );
    builder.addCase(
      getInsurancelineOfBusinessListMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceLineOfBusinessList = action.payload;
      }
    );
    builder.addCase(
      getInsurancelineOfBusinessListMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.InsuranceLineOfBusinessList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //postInsurancelineOfBusiness

    builder.addCase(postInsurancelineOfBusinessMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postInsurancelineOfBusinessMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsuranceLineOfBusinessList = [
          ...state.InsuranceLineOfBusinessList,
          action.payload,
        ];
      }
    );
    builder.addCase(
      postInsurancelineOfBusinessMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //EditInsurancelineOfBusiness
    builder.addCase(patchInsurancelineOfBusinessMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchInsurancelineOfBusinessMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.InsuranceLineOfBusinessList = action.payload;
      }
    );
    builder.addCase(
      patchInsurancelineOfBusinessMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //searchInsurancelineOfBusiness
    builder.addCase(
      getSearchInsurancelineOfBusinessMiddleware.pending,
      (state) => {
        state.loading = true;
      }
    );
    builder.addCase(
      getSearchInsurancelineOfBusinessMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.SearchTableList = action.payload;
      }
    );
    builder.addCase(
      getSearchInsurancelineOfBusinessMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.SearchTableList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default insuranceManagementlineOfBusinessMasterReducer.reducer;
