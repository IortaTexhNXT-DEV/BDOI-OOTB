import { createSlice } from "@reduxjs/toolkit";
import { getEmployeeListMiddleware, getEmployeeListByIdMiddleware, postAddEmployeeMiddleware, patchEmployeeEditMiddleware, getSearchEmployeeMiddleware, getEmployeViewMiddleWare, getEmployeEditMiddleWare } from "./employeeMiddleware";
// import SvgIconeye from "../../../assets/icons/SvgIconeye";
const initialState = {
  loading: false,
  error: "",
  employeeTableList: [],
  employeeEditData: {},
  employeeSeachDetailList: [],
  employeeViewData: {}
};
const employeeReducer = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getEmployeeListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getEmployeeListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.employeeTableList = action.payload;
    });
    builder.addCase(getEmployeeListMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.employeeTableList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getEmployeeListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getEmployeeListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.employeeTableList = action.payload;
    });
    builder.addCase(getEmployeeListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.employeeTableList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getSearchEmployeeMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getSearchEmployeeMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.employeeSeachDetailList = action.payload;
    });
    builder.addCase(getSearchEmployeeMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.employeeSeachDetailList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });



    builder.addCase(postAddEmployeeMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postAddEmployeeMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        const newItem2 = action.payload;
        state.employeeTableList = [...state.employeeTableList, newItem2];
      }
    );
    builder.addCase(postAddEmployeeMiddleware.rejected, (state, action) => {
      state.loading = false;

      //   state.paymentVocherList = state.paymentVocherList;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });


    builder.addCase(patchEmployeeEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    
    builder.addCase(
      patchEmployeeEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.employeeTableList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.employeeTableList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.employeeTableList = updatedCurrencyList;

        } else {
          state.employeeTableList = [...state.employeeTableList, action.payload];
        }
      }
    );
    builder.addCase(
      patchEmployeeEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );


    builder.addCase(getEmployeViewMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getEmployeViewMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.employeeViewData = action.payload;
      }
    );
    builder.addCase(
      getEmployeViewMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.employeeViewData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );


    builder.addCase(getEmployeEditMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getEmployeEditMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;

        state.employeeEditData = action.payload;
      }
    );
    builder.addCase(
      getEmployeEditMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.employeeEditData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );


  },
});

export default employeeReducer.reducer;
