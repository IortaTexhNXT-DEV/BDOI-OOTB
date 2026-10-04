import { createSlice } from "@reduxjs/toolkit";

import {
  getClaimDetailsViewData,
  postClaimDetailsData,
  getClaimDetailsForEdit,
} from "./claimDetailsMiddleWare";

const initialState = {
  loading: false,
  error: "",
  claimDetailsViewData: {},
  claimThirdParty: {},
  policyHolderName: "",
  policyNumber: "",
  claimNumber: "",
};

const claimDetailsReducers = createSlice({
  name: "claimDetailsReducers",
  initialState,
  reducers: {
    setPolicyHolderData: (state, action) => {
      state.policyHolderName = action.payload.policyHolderName || "";
      state.policyNumber = action.payload.policyNumber || "";
      state.claimNumber = action.payload.claimNumber || "";
    },
    clearPolicyHolderData: (state) => {
      state.policyHolderName = "";
      state.policyNumber = "";
      state.claimNumber = "";
    },
  },
  extraReducers: (builder) => {
    builder.addCase(getClaimDetailsViewData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getClaimDetailsViewData.fulfilled, (state, action) => {
      state.loading = false;
      state.claimDetailsViewData = action.payload;
    });
    builder.addCase(getClaimDetailsViewData.rejected, (state, action) => {
      state.loading = false;
      state.claimDetailsViewData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(postClaimDetailsData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postClaimDetailsData.fulfilled, (state, action) => {
      state.loading = false;
      state.claimThirdParty = action.payload;
      // Persist policyholder address edits for createClaim policyInfo
      const p = action.payload || {};
      state.claimDetailsViewData = {
        ...state.claimDetailsViewData,
        PolicyHolderName:
          p.PolicyHolderName ?? state.claimDetailsViewData?.PolicyHolderName,
        HouseNo: p.HouseNo ?? state.claimDetailsViewData?.HouseNo,
        Barangay: p.Barangay ?? state.claimDetailsViewData?.Barangay,
        CountryName: p.CountryName ?? state.claimDetailsViewData?.CountryName,
        Province: p.Province ?? state.claimDetailsViewData?.Province,
        CityName: p.CityName ?? state.claimDetailsViewData?.CityName,
        ZipCode: p.ZipCode ?? state.claimDetailsViewData?.ZipCode,
        RoadThanon: p.RoadThanon ?? state.claimDetailsViewData?.RoadThanon,
        SoiAlley: p.SoiAlley ?? state.claimDetailsViewData?.SoiAlley,
        MooVillage: p.MooVillage ?? state.claimDetailsViewData?.MooVillage,
      };
    });
    builder.addCase(postClaimDetailsData.rejected, (state, action) => {
      state.loading = false;
      state.claimThirdParty = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // Handle getClaimDetailsForEdit actions
    builder.addCase(getClaimDetailsForEdit.pending, (state) => {
      state.loading = true;
      state.claimThirdParty = {};
    });
    builder.addCase(getClaimDetailsForEdit.fulfilled, (state, action) => {
      state.loading = false;
      const payload = action.payload || {};
      state.claimDetailsViewData = payload;
      // Hydrate claimThirdParty from edit payload so driver fields are not stale
      state.claimThirdParty = {
        driverName: payload.driverName || "",
        driverHouseNo: payload.driverHouseNo || "",
        driverBarangay: payload.driverBarangay || "",
        driverCountry: payload.driverCountry || "",
        driverProvince: payload.driverProvince || "",
        driverCity: payload.driverCity || "",
        driverZipCode: payload.driverZipCode || "",
        driverRoadThanon: payload.driverRoadThanon || "",
        driverSoiAlley: payload.driverSoiAlley || "",
        driverMooVillage: payload.driverMooVillage || "",
        InsuranceCompanyN: payload.InsuranceCompanyN || "",
        name: payload.name || "",
        contactNumber: payload.contactNumber || "",
        plateNumber: payload.plateNumber || "",
        unit: payload.unit || "",
        shop: payload.shop || "",
      };
    });
    builder.addCase(getClaimDetailsForEdit.rejected, (state, action) => {
      state.loading = false;
      state.claimDetailsViewData = {};
      state.claimThirdParty = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export const { setPolicyHolderData, clearPolicyHolderData } =
  claimDetailsReducers.actions;
export default claimDetailsReducers.reducer;
