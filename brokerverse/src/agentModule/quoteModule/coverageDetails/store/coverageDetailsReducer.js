import { createSlice } from "@reduxjs/toolkit";
import {
  postcoverageDetailsMiddleware,
  submitRenewalCoverageMiddleware,
  getPolicyRenewalCoverageMiddleware,
} from "./coverageDetailsMiddleware";

const initialState = {
  loading: false,
  error: "",
  CoverageDetails: {},
  renewalCoverage: {
    loading: false,
    error: "",
    data: {},
    list: [],
    pagination: null,
  },
};
const CoverageDetailsReducer = createSlice({
  name: "CoverageDetailsReducer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    //postPolicyDetailsMiddleware

    builder.addCase(postcoverageDetailsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postcoverageDetailsMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.CoverageDetails = action.payload;
      }
    );
    builder.addCase(postcoverageDetailsMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(submitRenewalCoverageMiddleware.pending, (state) => {
      state.renewalCoverage.loading = true;
      state.renewalCoverage.error = "";
    });
    builder.addCase(
      submitRenewalCoverageMiddleware.fulfilled,
      (state, action) => {
        state.renewalCoverage.loading = false;
        const { coverage, renewalRecord, renewalId, isUpdate } = action.payload;

        state.renewalCoverage.data = coverage || {};

        if (
          Array.isArray(state.renewalCoverage.list) &&
          state.renewalCoverage.list.length
        ) {
          if (isUpdate) {
            state.renewalCoverage.list = state.renewalCoverage.list.map(
              (item) => {
                const itemId = item?.id || item?._id || item?.renewalId;
                if (renewalId && itemId === renewalId) {
                  return {
                    ...item,
                    ...renewalRecord,
                  };
                }
                return item;
              }
            );
          } else {
            state.renewalCoverage.list = [
              renewalRecord,
              ...state.renewalCoverage.list,
            ];
          }
        } else {
          state.renewalCoverage.list = renewalRecord ? [renewalRecord] : [];
        }
      }
    );
    builder.addCase(
      submitRenewalCoverageMiddleware.rejected,
      (state, action) => {
        state.renewalCoverage.loading = false;
        state.renewalCoverage.error =
          action.payload?.error || action.error?.message || "";
      }
    );

    builder.addCase(getPolicyRenewalCoverageMiddleware.pending, (state) => {
      state.renewalCoverage.loading = true;
      state.renewalCoverage.error = "";
    });
    builder.addCase(
      getPolicyRenewalCoverageMiddleware.fulfilled,
      (state, action) => {
        state.renewalCoverage.loading = false;
        state.renewalCoverage.data = action.payload.coverage || {};
        state.renewalCoverage.list = action.payload.data || [];
        state.renewalCoverage.pagination = action.payload.pagination || null;
      }
    );
    builder.addCase(
      getPolicyRenewalCoverageMiddleware.rejected,
      (state, action) => {
        state.renewalCoverage.loading = false;
        state.renewalCoverage.error =
          action.payload?.error || action.error?.message || "";
      }
    );
  },
});

export default CoverageDetailsReducer.reducer;
