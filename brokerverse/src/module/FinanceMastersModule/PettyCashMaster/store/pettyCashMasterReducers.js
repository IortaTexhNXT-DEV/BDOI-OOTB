import { createSlice } from "@reduxjs/toolkit";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import {
  getPatchPettyCashEdit,
  getPettyCashSearchList,
  getPettyCashView,
  patchPettyCashEdit,
  pettyCashMaster,
  postAddPettyCash,
} from "./pettyCashMasterMiddleWare";
const initialState = {
  loading: false,
  error: "",
  addPettyCash: {},
  pettyCashSearchList: [],
  pettyCashView: {},
  pettyCashEdit: {},
  getPettyCashEdit: {},
  pettyCashList: [
    {
      id: 1,
      pettycashcode: "PC001",
      pettycashname: "PettyCash1",
      pettycashsize: "20,000",
      minicashbox: "2,000",
      transactionlimit: "500.00",
      availabelCash: "777",
      status: true,
      action: <SvgIconeye />,
    },
    {
      id: 2,
      pettycashcode: "PC002",
      pettycashname: "PettyCash2",
      pettycashsize: "30,000",
      minicashbox: "7,000",
      transactionlimit: "1000.00",
      availabelCash: "888",
      status: false,
      action: <SvgIconeye />,
    },
    {
      id: 3,
      pettycashcode: "PC003",
      pettycashname: "PettyCash3",
      pettycashsize: "40,000",
      minicashbox: "3,000",
      transactionlimit: "750.00",
      availabelCash: "999",
      status: true,
      action: <SvgIconeye />,
    },
    {
      id: 4,
      pettycashcode: "PC004",
      pettycashname: "PettyCash4",
      pettycashsize: "50,000",
      minicashbox: "8,000",
      transactionlimit: "1200.00",
      availabelCash: "1111",
      status: false,
      action: <SvgIconeye />,
    },
    {
      id: 5,
      pettycashcode: "PC005",
      pettycashname: "PettyCash5",
      pettycashsize: "60,000",
      minicashbox: "5,000",
      transactionlimit: "900.00",
      availabelCash: "1234",
      status: true,
      action: <SvgIconeye />,
    },
    {
      id: 6,
      pettycashcode: "PC007",
      pettycashname: "PettyCash6",
      pettycashsize: "70,000",
      minicashbox: "1,000",
      transactionlimit: "1500.00",
      availabelCash: "5678",
      status: false,
      action: <SvgIconeye />,
    },
    {
      id: 7,
      pettycashcode: "PC008",
      pettycashname: "PettyCash7",
      pettycashsize: "20,000",
      minicashbox: "2,000",
      transactionlimit: "1100.00",
      availabelCash: "9876",
      status: true,
      action: <SvgIconeye />,
    },
    {
      id: 8,
      pettycashcode: "PC009",
      pettycashname: "PettyCash8",
      pettycashsize: "16",
      minicashbox: "3,000",
      transactionlimit: "1800.00",
      availabelCash: "5432",
      status: false,
      action: <SvgIconeye />,
    },
    {
      id: 9,
      pettycashcode: "PC010",
      pettycashname: "PettyCash9",
      pettycashsize: "90,000",
      minicashbox: "4,000",
      transactionlimit: "1300.00",
      availabelCash: "8765",
      status: true,
      action: <SvgIconeye />,
    },
    {
      id: 10,
      pettycashcode: "PC011",
      pettycashname: "PettyCash10",
      pettycashsize: "10,000",
      minicashbox: "5,000",
      transactionlimit: "1600.00",
      availabelCash: "4321",
      status: false,
      action: <SvgIconeye />,
    },
  ],
  postPettyCash: {},
};

const pettyCashMasterReducers = createSlice({
  name: "pettyCashMaster",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(pettyCashMaster.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(pettyCashMaster.fulfilled, (state, action) => {
      state.loading = false;
      state.pettyCashList = action.payload;
    });
    builder.addCase(pettyCashMaster.rejected, (state, action) => {
      state.loading = false;
      state.pettyCashList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //postAddPettyCash
    builder.addCase(postAddPettyCash.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddPettyCash.fulfilled, (state, action) => {
      console.log(action.payload, "find action.payload");
      state.loading = false;
      state.pettyCashList = [...state.pettyCashList, action.payload];
    });
    builder.addCase(postAddPettyCash.rejected, (state, action) => {
      state.loading = false;
      state.postPettyCash = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //getPettyCashSearchList

    builder.addCase(getPettyCashSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getPettyCashSearchList.fulfilled, (state, action) => {
      state.loading = false;
      state.pettyCashSearchList = action.payload;
    });
    builder.addCase(getPettyCashSearchList.rejected, (state, action) => {
      state.loading = false;
      state.pettyCashSearchList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    // patchPettyCashEdit

    builder.addCase(patchPettyCashEdit.pending, (state) => {
      state.loading = true;
    });

    builder.addCase(patchPettyCashEdit.fulfilled, (state, action) => {
      state.loading = false;
      const updatedIndex = state.pettyCashList.findIndex(
        (item) => item.id === action.payload.id
      );
      console.log(updatedIndex, "updatedIndex");
      if (updatedIndex !== -1) {
        const updatedCurrencyList = [...state.pettyCashList];
        updatedCurrencyList[updatedIndex] = action.payload;
        state.pettyCashList = updatedCurrencyList;
      } else {
        state.pettyCashList = [...state.pettyCashList, action.payload];
      }
    });
    builder.addCase(patchPettyCashEdit.rejected, (state, action) => {
      state.loading = false;
      state.pettyCashEdit = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getPatchPettyCashEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getPatchPettyCashEdit.fulfilled, (state, action) => {
      state.loading = false;
      state.getPettyCashEdit = action.payload;
    });
    builder.addCase(getPatchPettyCashEdit.rejected, (state, action) => {
      state.loading = false;
      state.getPettyCashEdit = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //getPettyCashView

    builder.addCase(getPettyCashView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getPettyCashView.fulfilled, (state, action) => {
      state.loading = false;
      state.pettyCashView = action.payload;
    });
    builder.addCase(getPettyCashView.rejected, (state, action) => {
      state.loading = false;
      state.pettyCashView = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default pettyCashMasterReducers.reducer;
