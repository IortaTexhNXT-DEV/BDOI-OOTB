import { createSlice } from "@reduxjs/toolkit";
import {
  getInsurancePolicyTypeMiddleWare,
  postInsurancePolicyTypeMiddleWare,
  patchInsurancePolicyTypeMiddleWare,
  getSearchInsurancePolicyTypeMiddleware,
} from "./insurancePolicyTypeMiddleware";
const initialState = {
  loading: false,
  error: "",
  InsurancePolicyType: [
    {
      id: 1,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 0,
      policytypeCode: "Policy0123",
      policyTypeName: "Motor Comprehensive",
      product: "Motor",
      policyTypeDescription: "policyTypeDescription",
      action: 1,
    },
    {
      id: 2,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 1,
      policytypeCode: "Policy0123",
      policyTypeName: "Motor Comprehensive",
      product: "Motor",
      policyTypeDescription: "policyTypeDescription",
      action: 2,
    },
    {
      id: 3,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 0,
      policytypeCode: "Policy0123",
      policyTypeName: "Motor Comprehensive",
      product: "Motor",
      policyTypeDescription: "policyTypeDescription",
      action: 3,
    },
    {
      id: 4,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 1,
      policytypeCode: "Policy0123",
      policyTypeName: "Motor Comprehensive",
      product: "Motor",
      policyTypeDescription: "policyTypeDescription",
      action: 4,
    },
    {
      id: 5,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 0,
      policytypeCode: "Policy0123",
      policyTypeName: "Motor Comprehensive",
      product: "Motor",
      policyTypeDescription: "policyTypeDescription",
      action: 5,
    },
    {
      id: 6,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 1,
      policytypeCode: "Policy0123",
      policyTypeName: "Motor Comprehensive",
      product: "Motor",
      policyTypeDescription: "policyTypeDescription",
      action: 6,
    },
    {
      id: 7,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 0,
      policytypeCode: "Policy0123",
      policyTypeName: "Motor Comprehensive",
      product: "Motor",
      policyTypeDescription: "policyTypeDescription",
      action: 7,
    },
    {
      id: 8,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 1,
      policytypeCode: "Policy0123",
      policyTypeName: "Motor Comprehensive",
      product: "Motor",
      policyTypeDescription: "policyTypeDescription",
      action: 8,
    },
    {
      id: 9,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 0,
      policytypeCode: "Policy0123",
      policyTypeName: "Motor Comprehensive",
      product: "Motor",
      policyTypeDescription: "policyTypeDescription",
      action: 9,
    },
    {
      id: 10,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 0,
      policytypeCode: "Policy0123",
      policyTypeName: "Motor Comprehensive",
      product: "Motor",
      policyTypeDescription: "policyTypeDescription",
      action: 10,
    },
  ],
  SearchTableList: [],
};
const insuranceManagementPolicyTypeMasterReducer = createSlice({
  name: "mainAccountMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getInsurancePolicyTypeMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getInsurancePolicyTypeMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsurancePolicyType = action.payload;
      }
    );
    builder.addCase(
      getInsurancePolicyTypeMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.InsurancePolicyType = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    //postInsurancePolicyType

    builder.addCase(postInsurancePolicyTypeMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postInsurancePolicyTypeMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.InsurancePolicyType = [
          ...state.InsurancePolicyType,
          action.payload,
        ];
      }
    );
    builder.addCase(
      postInsurancePolicyTypeMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //EditInsurancePolicyType
    builder.addCase(patchInsurancePolicyTypeMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchInsurancePolicyTypeMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.InsurancePolicyType = action.payload;
      }
    );
    builder.addCase(
      patchInsurancePolicyTypeMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
    //searchInsurancePolicyType
    builder.addCase(getSearchInsurancePolicyTypeMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getSearchInsurancePolicyTypeMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.SearchTableList = action.payload;
      }
    );
    builder.addCase(
      getSearchInsurancePolicyTypeMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.SearchTableList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default insuranceManagementPolicyTypeMasterReducer.reducer;
