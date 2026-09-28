import { createSlice } from "@reduxjs/toolkit";
import { getEmployeeListMiddleware, getEmployeeListByIdMiddleware, postAddEmployeeMiddleware, patchEmployeeEditMiddleware, getSearchEmployeeMiddleware, getEmployeViewMiddleWare, getEmployeEditMiddleWare } from "./employeeMiddleware";
// import SvgIconeye from "../../../assets/icons/SvgIconeye";
const initialState = {
  loading: false,
  error: "",
  employeeTableList: [
    {
      id: 1,
      employeeCode: "100021 ",
      firstName: "CARLOS",
      middleName: "PETERSON",
      lastName: "WATSON",
      employeeType: "AGENT",
      designation: "SALES AGENT",
      reportingTo: "JOHN Doe",
      branchCode: "BRANCH0123",
      departmentCode: "DEPART123",
      idProofType: "DRIVING LICENCE",
      idNumber: "12345678",
      addressLine1: "",
      addressLine2: "",
      addressLine3: "",
      city: "MATI",
      state: "DAVAO ORIENTAL",
      country: "PHILIPPINES",
      modifiedBy: "JOHN",
      modifiedOn: "12/12/2023",

    },
    {
      id: 2,
      employeeCode: "100022 ",
      firstName: "RINA BAUTISTA",
      middleName: "PETERSON",
      lastName: "WATSON",
      employeeType: "AGENT",
      designation: "SALES AGENT",
      reportingTo: "JOHN Doe",
      branchCode: "Branch0123",
      departmentCode: "Depart123",
      idProofType: "DRIVING LICENCE",
      idNumber: "12345678",
      addressLine1: "",
      addressLine2: "",
      addressLine3: "",
      city: "DON SALVADOR BENEDICTO",
      state: "NEGROS OCCIDENTAL",
      country: "PHILIPPINES",
      modifiedBy: "JOHN",
      modifiedOn: "12/12/2023",

    },
    {
      id: 3,
      employeeCode: "100023",
      firstName: "NOEL TOLETE ",
      middleName: "PETERSON",
      lastName: "WATSON",
      employeeType: "AGENT",
      designation: "SALES AGENT",
      reportingTo: "JOHN Doe",
      branchCode: "BRANCH0123",
      departmentCode: "Depart123",
      idProofType: "DRIVING LICENCE",
      idNumber: "12345678",
      addressLine1: "",
      addressLine2: "",
      addressLine3: "",
      city: "SANTA TERESITA",
      state: "QUEZON CITY",
      country: "PHILIPPINES",
      modifiedBy: "JOHN",
      modifiedOn: "12/12/2023",

    },





  ],
  employeeEditData: {},
  employeeSeachDetailList: [],
  employeeViewData: {}
};
let nextId1 = 4
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

      state.employeeTableList = {};
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

      state.employeeTableList = {};
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

      state.employeeSeachDetailList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });



    builder.addCase(postAddEmployeeMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postAddEmployeeMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        const newItem2 = { ...action.payload, id: nextId1++ };
        state.employeeTableList = [...state.employeeTableList, newItem2];
        console.log(state.employeeTableList, "departmentList")
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
