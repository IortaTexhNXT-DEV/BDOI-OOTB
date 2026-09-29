import { createSlice } from "@reduxjs/toolkit";
import {
  getpersonalDetailsMiddleware,
  patchpersonalDetailsMiddleware,
  getEndorsementPolicyDetailsMiddleware,
} from "./personalDetailsMiddleware";

const initialState = {
  loading: false,
  error: "",
  personalDetails: {
    LossandDamagecoverage: "",
    LossandDamagecoverageRate: "",
    LossandDamagecoveragepremium: "",
    ActsofNatureRate: "",
    ActsofNaturepremium: "",
    BodilyInjury: "",
    PreferredName: "",
    BodilyInjuryCoveragePremium: "",
    PropertyDamage: "",
    PropertyDamageCoveragePremium: "",
    AutopassengerpersonalAccident: "",
    APPATotalCoverage: "",
    TotalSumInsured: "",
    NETpremium: "",
    ValueAddedTax: "",
    Others: "",
    DocumentaryStampTax: "",
    LocalGovtTax: "",
    Discount: "",
    Grosspremium: "",
    TNVS: "",
    MotorNumber: "",
    ChassisNumber: "",
    Mortgage: "",
    CertNumber: "",
    PlateNumber: "",
    MVFileNumber: "",
    AuthenCode: "",
    VehicleBrand: "",
    ModelYear: "",
    ModelVariant: "",
    VehicleModel: "",
    VehicleColor: "",
    SeatingCapacity: "",
    CompanyName: "",
    TaxNumber: "",
    FirstName: "",
    LastName: "",
    EmailID: "",
    ContactNumber: "",
    HouseNo: "",
    Barangay: "",
    Country: "",
    Province: "",
    City: "",
    ZIPCode: "",
    DateofBirth: "",
    FromDate: "",
    ToDate: "",
    NumberofDays: "",
    Title: "",
    Declaration: "",
    OthersPremium: "",
    ActsOfNatureRate: "",
  },
  personalDetailspatch: {},
  endorsementPolicyDetails: {},
};
const personalDetailsReducer = createSlice({
  name: "personalDetailsReducer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //getpersonalDetailsMiddleware

    builder.addCase(getpersonalDetailsMiddleware.pending, (state) => {
      state.loading = true;
      state.error = "";
    });
    builder.addCase(getpersonalDetailsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.personalDetails = {
        ...state.personalDetails,
        ...action.payload,
      };
    });
    builder.addCase(getpersonalDetailsMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // getEndorsementPolicyDetailsMiddleware

    builder.addCase(getEndorsementPolicyDetailsMiddleware.pending, (state) => {
      state.loading = true;
      state.error = "";
    });
    builder.addCase(
      getEndorsementPolicyDetailsMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.endorsementPolicyDetails = {
          ...state.endorsementPolicyDetails,
          ...action.payload,
        };
      }
    );
    builder.addCase(
      getEndorsementPolicyDetailsMiddleware.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //patchpersonalDetailsMiddleware

    builder.addCase(patchpersonalDetailsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchpersonalDetailsMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.personalDetailspatch = action.payload;
      }
    );
    builder.addCase(
      patchpersonalDetailsMiddleware.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default personalDetailsReducer.reducer;
