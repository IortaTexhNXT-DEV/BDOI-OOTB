import { createSlice } from "@reduxjs/toolkit";
import { getHirarchyListMiddleware, getHirarchyListByIdMiddleware, postAddHirarchyMiddleware, patchHirarchyEditMiddleware, getSearchHirarchyMiddleware, getHierarchyViewMiddleWare, getHierarchyPatchMiddleWare } from "./hierarchyMiddleware";
import SvgIconeye from "../../../../../assets/icons/SvgIconeye";
const initialState = {
  loading: false,
  error: "",
  hierarchTableList: [
    {
      id: 1,
      rankCode: "RK001 ",
      rankName: "RANK 1 ",
      levelNumber: "L4",
      description: "TEST PURPOSE",
      modifiedBy: "JOHNSON",
      modifiedOn: "12/12/23",
      status: "",
      action: ""
    },
    {
      id: 2,
      rankCode: "RK002 ",
      rankName: "RANK 2 ",
      levelNumber: "L3",
      description: "TEST PURPOSE",
      modifiedBy: "JOHNSON",
      modifiedOn: "2/1/24",
      status: "",
      action: ""
    }, 
    {
      id: 3,
      rankCode: "RK003 ",
      rankName: "RANK 3 ",
      description: "TEST PURPOSE",
      levelNumber: "L2",
      modifiedBy: "JOHNSON",
      modifiedOn: "2/1/24",
      status: "",
      action: ""
    }, 
    {
      id: 4,
      rankCode: "RK004",
      rankName: "RANK 4 ",
      levelNumber: "L2",
      description: "TEST PURPOSE",
      modifiedBy: "JOHNSON",
      modifiedOn: "2/1/24",
      status: "",
      action: ""
    }, 
  ]
  ,
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

      state.hierarchTableList = {};
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

      state.hierarchSeachList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });



    builder.addCase(postAddHirarchyMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddHirarchyMiddleware.fulfilled, (state, action) => {
      console.log(action.payload, 'find action.payload')
      state.loading = false;
      state.hierarchTableList = [...state.hierarchTableList, action.payload];
    });
    builder.addCase(postAddHirarchyMiddleware.rejected, (state, action) => {
      state.loading = false;

      //   state.paymentVocherList = state.paymentVocherList;
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
        console.log(updatedIndex, "updatedIndex");
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
