import { createSlice } from "@reduxjs/toolkit";
import {
  getInsuranceCoverMiddleWare,
  postInsuranceCoverMiddleWare,
  patchInsuranceCoverMiddleWare,
  getSearchInsuranceCoverMiddleware,
} from "./insuranceCoverMiddleware";
const initialState = {
  loading: false,
  error: "",
  InsuranceCoverList: [
    {
      id: 1,
      modifiedby: "Maria Santos",
      modifiedOn: "03/28/2025",
      Status: 1,
      coverCode: "COV-CTPL",
      coverName: "Compulsory Third Party Liability",
      coverDescription: "Mandatory insurance for bodily injury/death to third parties as required by LTO. Covers up to ₱100,000 per person",
      policyType: "Motor",
      lineOfBusiness: "Motor",
      isMandatory: true,
      minCoverage: "₱100,000",
      action: 1,
    },
    {
      id: 2,
      modifiedby: "Roberto Reyes",
      modifiedOn: "03/28/2025",
      Status: 1,
      coverCode: "COV-OD",
      coverName: "Own Damage",
      coverDescription: "Covers damage to insured vehicle from collision, overturning, fire, theft, malicious acts, and accidental external means",
      policyType: "Motor",
      lineOfBusiness: "Motor",
      isMandatory: false,
      deductible: "₱2,000 - ₱5,000",
      action: 2,
    },
    {
      id: 3,
      modifiedby: "Juan Dela Cruz",
      modifiedOn: "03/27/2025",
      Status: 1,
      coverCode: "COV-AOG",
      coverName: "Acts of God / Acts of Nature",
      coverDescription: "Coverage for typhoon, flood, earthquake, volcanic eruption, and other natural calamities common in Thailand",
      policyType: "Motor",
      lineOfBusiness: "Motor",
      isMandatory: false,
      deductible: "0.5% - 1% of Sum Insured",
      action: 3,
    },
    {
      id: 4,
      modifiedby: "Ana Garcia",
      modifiedOn: "03/27/2025",
      Status: 1,
      coverCode: "COV-VTPL",
      coverName: "Voluntary Third Party Liability",
      coverDescription: "Extended third party coverage for bodily injury and property damage beyond CTPL limits. Up to ₱1,000,000",
      policyType: "Motor",
      lineOfBusiness: "Motor",
      isMandatory: false,
      maxCoverage: "₱1,000,000",
      action: 4,
    },
    {
      id: 5,
      modifiedby: "Pedro Gonzales",
      modifiedOn: "03/26/2025",
      Status: 1,
      coverCode: "COV-PA",
      coverName: "Personal Accident",
      coverDescription: "Covers driver and passengers for death and permanent disability due to vehicular accident",
      policyType: "Motor",
      lineOfBusiness: "Motor",
      isMandatory: false,
      sumInsured: "₱50,000 - ₱200,000 per person",
      action: 5,
    },
    {
      id: 6,
      modifiedby: "Carmen Bautista",
      modifiedOn: "03/26/2025",
      Status: 1,
      coverCode: "COV-FIRE",
      coverName: "Fire & Lightning",
      coverDescription: "Basic fire insurance covering loss/damage due to fire, lightning, and gas explosion for buildings and contents",
      policyType: "Fire",
      lineOfBusiness: "Fire",
      isMandatory: false,
      basis: "Replacement or Market Value",
      action: 6,
    },
    {
      id: 7,
      modifiedby: "Rosa Fernandez",
      modifiedOn: "03/25/2025",
      Status: 1,
      coverCode: "COV-TYPHOON",
      coverName: "Typhoon & Flood",
      coverDescription: "Extended coverage for windstorm, typhoon, hurricane, cyclone, flood, and water damage",
      policyType: "Fire",
      lineOfBusiness: "Fire",
      isMandatory: false,
      deductible: "₱20,000 or 2% of loss",
      action: 7,
    },
    {
      id: 8,
      modifiedby: "Miguel Torres",
      modifiedOn: "03/25/2025",
      Status: 1,
      coverCode: "COV-EQ",
      coverName: "Earthquake Fire & Shock",
      coverDescription: "Coverage for earthquake, fire following earthquake, and earthquake shock damage",
      policyType: "Fire",
      lineOfBusiness: "Fire",
      isMandatory: false,
      deductible: "5% of Sum Insured",
      action: 8,
    },
    {
      id: 9,
      modifiedby: "Elena Martinez",
      modifiedOn: "03/24/2025",
      Status: 1,
      coverCode: "COV-BI",
      coverName: "Business Interruption",
      coverDescription: "Covers loss of gross profit due to interruption of business following an insured peril",
      policyType: "Fire",
      lineOfBusiness: "Fire",
      isMandatory: false,
      indemnityPeriod: "6-12 months",
      action: 9,
    },
    {
      id: 10,
      modifiedby: "Carlos Mendoza",
      modifiedOn: "03/24/2025",
      Status: 1,
      coverCode: "COV-CARGO",
      coverName: "Marine Cargo All Risk",
      coverDescription: "Comprehensive coverage for goods in transit by sea, air, or land including loading/unloading",
      policyType: "Marine",
      lineOfBusiness: "Marine",
      isMandatory: false,
      coverage: "Warehouse to Warehouse",
      action: 10,
    },
    {
      id: 11,
      modifiedby: "Teresa Aquino",
      modifiedOn: "03/23/2025",
      Status: 1,
      coverCode: "COV-SRCC",
      coverName: "Strikes, Riots & Civil Commotion",
      coverDescription: "Extended coverage for losses due to strikes, riots, civil commotion, and terrorism",
      policyType: "Various",
      lineOfBusiness: "Multiple",
      isMandatory: false,
      applicableTo: "Motor, Fire, Marine",
      action: 11,
    },
    {
      id: 12,
      modifiedby: "Jose Rizal",
      modifiedOn: "03/23/2025",
      Status: 1,
      coverCode: "COV-MED",
      coverName: "Medical Reimbursement",
      coverDescription: "Covers hospitalization and medical expenses due to accident or illness",
      policyType: "Health/PA",
      lineOfBusiness: "Health",
      isMandatory: false,
      annualLimit: "₱60,000 - ₱500,000",
      action: 12,
    },
    {
      id: 13,
      modifiedby: "Andres Bonifacio",
      modifiedOn: "03/22/2025",
      Status: 1,
      coverCode: "COV-GTPL",
      coverName: "General Third Party Liability",
      coverDescription: "Protection against legal liability for bodily injury or property damage to third parties arising from business operations",
      policyType: "Liability",
      lineOfBusiness: "Liability",
      isMandatory: false,
      limit: "₱1M - ₱50M",
      action: 13,
    },
    {
      id: 14,
      modifiedby: "Emilio Aguinaldo",
      modifiedOn: "03/22/2025",
      Status: 1,
      coverCode: "COV-WC",
      coverName: "Workmen's Compensation",
      coverDescription: "Mandatory coverage for employees as per Labor Code for work-related injuries, illness, or death",
      policyType: "Liability",
      lineOfBusiness: "Liability",
      isMandatory: true,
      basis: "Payroll-based",
      action: 14,
    },
    {
      id: 15,
      modifiedby: "Corazon Aquino",
      modifiedOn: "03/21/2025",
      Status: 1,
      coverCode: "COV-CAR",
      coverName: "Contractor's All Risk",
      coverDescription: "Comprehensive coverage for construction projects including materials, equipment, third party liability, and maintenance period",
      policyType: "Engineering",
      lineOfBusiness: "Engineering",
      isMandatory: false,
      projectBased: true,
      action: 15,
    },
  ],
  SearchTableList: [],
};
const insuranceManagementCoverMasterReducer = createSlice({
  name: "mainAccountMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getInsuranceCoverMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getInsuranceCoverMiddleWare.fulfilled, (state, action) => {
      state.loading = false;
      state.InsuranceCoverList = action.payload;
    });
    builder.addCase(getInsuranceCoverMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.InsuranceCoverList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //postInsuranceCover

    builder.addCase(postInsuranceCoverMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postInsuranceCoverMiddleWare.fulfilled, (state, action) => {
      state.loading = false;
      state.InsuranceCoverList = [...state.InsuranceCoverList, action.payload];
    });
    builder.addCase(postInsuranceCoverMiddleWare.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    //EditInsuranceCover
    builder.addCase(patchInsuranceCoverMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchInsuranceCoverMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.InsuranceCoverList = action.payload;
      }
    );
    builder.addCase(patchInsuranceCoverMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.editList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    //searchInsuranceCover
    builder.addCase(getSearchInsuranceCoverMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getSearchInsuranceCoverMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.SearchTableList = action.payload;
      }
    );
    builder.addCase(
      getSearchInsuranceCoverMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.SearchTableList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default insuranceManagementCoverMasterReducer.reducer;
