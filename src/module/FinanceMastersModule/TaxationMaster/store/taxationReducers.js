import { createSlice } from "@reduxjs/toolkit";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import {
  getTaxationData,
  getTaxationSearchList,
  getTaxationView,
  getpatchTaxationEdit,
  patchTaxationEdit,
  postAddTaxationMiddileware,
} from "./taxationMiddleWare";
const initialState = {
  loading: false,
  error: "",
  addTaxation: {},
  taxationSearchList: [],
  taxationView: {},
  taxationEdit: {},
  getTaxationEdit: {},
  taxationList: [
    {
      id: "1",
      taxCode: "Tax0123",
      taxName: "DOC. STAMPS",
      taxRate: "30%",
      basis: "basic",
      remarks: "remarks",
      taxationDescription: "hh",
      effectiveFrom: "1/24/2023",
      effectiveTo: "1/23/2023",
      action: <SvgIconeye />,
    },
    {
      id: "2",
      taxCode: "Tax0456",
      taxName: "Sales Tax",
      taxRate: "15%",
      basis: "sales",
      remarks: "additional remarks",
      taxationDescription: "xyz",
      effectiveFrom: "2/24/2023",
      effectiveTo: "2/23/2023",
      action: <SvgIconeye />,
    },
    {
      id: "3",
      taxCode: "Tax0789",
      taxName: "Property Tax",
      taxRate: "5%",
      basis: "property",
      remarks: "property remarks",
      taxationDescription: "abc",
      effectiveFrom: "3/24/2023",
      effectiveTo: "3/23/2023",
      action: <SvgIconeye />,
    },
    {
      id: "4",
      taxCode: "Tax1012",
      taxName: "Excise Tax",
      taxRate: "12%",
      basis: "excise",
      remarks: "excise remarks",
      taxationDescription: "def",
      effectiveFrom: "4/24/2023",
      effectiveTo: "4/23/2023",
      action: <SvgIconeye />,
    },
    // {
    //     id: "5",
    //     taxCode: "Tax1315",
    //     taxName: "Value Added Tax",
    //     taxRate: "18%",
    //     basis: "VAT",
    //     remarks: "VAT remarks",
    //     taxationDescription: "ghi",
    //     effectiveFrom: '5/24/2023',
    //     effectiveTo: '5/23/2023',
    //     action: <SvgIconeye />
    // },
    // {
    //     id: "6",
    //     taxCode: "Tax1618",
    //     taxName: "Customs Duty",
    //     taxRate: "8%",
    //     basis: "customs",
    //     remarks: "customs remarks",
    //     taxationDescription: "jkl",
    //     effectiveFrom: '6/24/2023',
    //     effectiveTo: '6/23/2023',
    //     action: <SvgIconeye />
    // },
    // {
    //     id: "7",
    //     taxCode: "Tax1921",
    //     taxName: "Service Tax",
    //     taxRate: "25%",
    //     basis: "service",
    //     remarks: "service remarks",
    //     taxationDescription: "mno",
    //     effectiveFrom: '7/24/2023',
    //     effectiveTo: '7/23/2023',
    //     action: <SvgIconeye />
    // },
    // {
    //     id: "8",
    //     taxCode: "Tax2224",
    //     taxName: "Estate Tax",
    //     taxRate: "20%",
    //     basis: "estate",
    //     remarks: "estate remarks",
    //     taxationDescription: "pqr",
    //     effectiveFrom: '8/24/2023',
    //     effectiveTo: '8/23/2023',
    //     action: <SvgIconeye />
    // },
    // {
    //     id: "9",
    //     taxCode: "Tax2527",
    //     taxName: "Environmental Tax",
    //     taxRate: "3%",
    //     basis: "environmental",
    //     remarks: "environmental remarks",
    //     taxationDescription: "stu",
    //     effectiveFrom: '9/24/2023',
    //     effectiveTo: '9/23/2023',
    //     action: <SvgIconeye />
    // },
    // {
    //     id: "10",
    //     taxCode: "Tax2830",
    //     taxName: "Luxury Tax",
    //     taxRate: "10%",
    //     basis: "luxury",
    //     remarks: "luxury remarks",
    //     taxationDescription: "vwx",
    //     effectiveFrom: '10/24/2023',
    //     effectiveTo: '10/23/2023',
    //     action: <SvgIconeye />
    // }
  ],
};
// let nextId = 3
const taxationReducers = createSlice({
  name: "commission",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getTaxationData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getTaxationData.fulfilled, (state, action) => {
      state.loading = false;
      state.taxationList = [action.payload];
      console.log(state.taxationList, "taxt");
    });
    builder.addCase(getTaxationData.rejected, (state, action) => {
      state.loading = false;
      state.taxationList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //addCommission
    builder.addCase(postAddTaxationMiddileware.pending, (state) => {
      state.loading = true;
    });
    // builder.addCase(postAddTaxationMiddileware.fulfilled, (state, action) => {
    //     state.loading = false;
    //     const newItem2 = { ...action.payload, id: nextId++ };
    //     state.taxationList = [...state.taxationList, newItem2];
    //     console.log(state.taxationList, "taxationListtaxationList")
    // });
    builder.addCase(postAddTaxationMiddileware.fulfilled, (state, action) => {
      console.log(action.payload, "find action.payload");
      state.loading = false;
      state.taxationList = [...state.taxationList, action.payload];
    });

    builder.addCase(postAddTaxationMiddileware.rejected, (state, action) => {
      state.loading = false;
      state.addTaxation = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    //getTaxationSearchList

    builder.addCase(getTaxationSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getTaxationSearchList.fulfilled, (state, action) => {
      state.loading = false;
      state.taxationSearchList = action.payload;
    });
    builder.addCase(getTaxationSearchList.rejected, (state, action) => {
      state.loading = false;

      state.taxationSearchList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //patchTaxationEdit

    builder.addCase(patchTaxationEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(patchTaxationEdit.fulfilled, (state, action) => {
      state.loading = false;
      const updatedIndex = state.taxationList.findIndex(
        (item) => item.id === action.payload.id
      );
      if (updatedIndex !== -1) {
        const updatedCurrencyList = [...state.taxationList];
        updatedCurrencyList[updatedIndex] = action.payload;
        state.taxationList = updatedCurrencyList;
      } else {
        state.taxationList = [...state.taxationList, action.payload];
      }
    });
    builder.addCase(patchTaxationEdit.rejected, (state, action) => {
      state.loading = false;
      state.taxationEdit = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getpatchTaxationEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getpatchTaxationEdit.fulfilled, (state, action) => {
      state.loading = false;
      state.getTaxationEdit = action.payload;
    });
    builder.addCase(getpatchTaxationEdit.rejected, (state, action) => {
      state.loading = false;

      state.getTaxationEdit = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //getTaxationView

    builder.addCase(getTaxationView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getTaxationView.fulfilled, (state, action) => {
      state.loading = false;
      state.taxationView = action.payload;
    });
    builder.addCase(getTaxationView.rejected, (state, action) => {
      state.loading = false;

      state.taxationView = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default taxationReducers.reducer;
