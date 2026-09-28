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
  InsuranceCompanyList: [],
  searchInsuranceList: [],
  InsuranceMasterView: {},
  InsuranceMasterPatchData: {},
};
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
        state.InsuranceCompanyList = action.payload;
      }
    );
    builder.addCase(
      getInsuranceCompanyListMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.InsuranceCompanyList = [];
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
        const newItem2 = action.payload;
        state.InsuranceCompanyList = [...state.InsuranceCompanyList, newItem2];
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

        state.searchInsuranceList = [];
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