import { createSlice } from "@reduxjs/toolkit";
import { getDesignationListByIdMiddleware, postAddDesignationMiddleware, patchDesignationEditMiddleware, getSearchDesignationMiddleware, getDesignationViewData, getDesignationPatchData } from "./designationMiddleware";
const initialState = {
  loading: false,
  error: "",
  designationDetailList: [],
  designationSearchList: [],
  getEditData: {},
  getViewData: {}
};
let nextId1=4
const receiptsReducer = createSlice({
  name: "designation",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getDesignationListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getDesignationListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.designationDetailList = action.payload;
    });
    builder.addCase(getDesignationListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.designationDetailList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getSearchDesignationMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getSearchDesignationMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.designationSearchList = action.payload;
    });
    builder.addCase(getSearchDesignationMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.designationSearchList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postAddDesignationMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postAddDesignationMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        const newItem2 = action.payload;
        state.designationDetailList = [...state.designationDetailList, newItem2];
      }
    );
    builder.addCase(postAddDesignationMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(patchDesignationEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchDesignationEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.designationDetailList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.designationDetailList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.designationDetailList = updatedCurrencyList;
        } else {
          state.designationDetailList = [...state.designationDetailList, action.payload];
        }
      }
    );
    builder.addCase(
      patchDesignationEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getDesignationViewData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getDesignationViewData.fulfilled,
      (state, action) => {
        state.loading = false;

        state.getViewData = action.payload;
      }
    );
    builder.addCase(
      getDesignationViewData.rejected,
      (state, action) => {
        state.loading = false;

        state.getViewData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getDesignationPatchData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getDesignationPatchData.fulfilled,
      (state, action) => {
        state.loading = false;

        state.getEditData = action.payload;
      }
    );
    builder.addCase(
      getDesignationPatchData.rejected,
      (state, action) => {
        state.loading = false;

        state.getEditData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default receiptsReducer.reducer;
