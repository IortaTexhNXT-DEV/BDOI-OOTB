import { createSlice } from "@reduxjs/toolkit";
import { getHirarchyListMiddleware, getHirarchyListByIdMiddleware, postAddHirarchyMiddleware, patchHirarchyEditMiddleware, getSearchHirarchyMiddleware, getHierarchyViewMiddleWare, getHierarchyPatchMiddleWare } from "./hierarchyMiddleware";
import SvgIconeye from "../../../../../assets/icons/SvgIconeye";
const initialState = {
  loading: false,
  error: "",
  hierarchTableList: [],
  hierarchSeachList: [],
  hierarchListDetails: {},
  getViewData: {},
  getPatchData: {}
};
const receiptsReducer = createSlice({
  name: "designation",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getHirarchyListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getHirarchyListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.hierarchTableList = action.payload;
    });
    builder.addCase(getHirarchyListMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.hierarchTableList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getHirarchyListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getHirarchyListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.hierarchListDetails = action.payload;
    });
    builder.addCase(getHirarchyListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.hierarchListDetails = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getSearchHirarchyMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getSearchHirarchyMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.hierarchSeachList = action.payload;
    });
    builder.addCase(getSearchHirarchyMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.hierarchSeachList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postAddHirarchyMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddHirarchyMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.hierarchTableList = [...state.hierarchTableList, action.payload];
    });
    builder.addCase(postAddHirarchyMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(patchHirarchyEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchHirarchyEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.hierarchTableList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.hierarchTableList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.hierarchTableList = updatedCurrencyList;
        } else {
          state.hierarchTableList = [...state.hierarchTableList, action.payload];
        }
      }
    );
    builder.addCase(
      patchHirarchyEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.branchList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getHierarchyViewMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getHierarchyViewMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.getViewData = action.payload;
      }
    );
    builder.addCase(
      getHierarchyViewMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.getViewData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getHierarchyPatchMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getHierarchyPatchMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.getPatchData = action.payload;
      }
    );
    builder.addCase(
      getHierarchyPatchMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.getPatchData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default receiptsReducer.reducer;
