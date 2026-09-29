import { createSlice } from "@reduxjs/toolkit";
import { getReversalTabelData, postReversalJVData } from "./reversalMiddleWare";

const initialState = {
    loading: false,
    error: "",
    reversalJVList: [
        // {
        //     id: 1,
        //     transactionCode: "Tc123",
        //     transactionNumber: "5678",
        //     reversalJVTransactionCode: "99",
        //     name: "Name",
        //     customerCode: "CC0102",
        //     date: "11/12/2023",
        //     amount: "500.37",
        //     action: "Action",
        // },
    ],
    reversalJVGetDataList: [
        {
            id: 1,
            mainAccount: "main0123",
            subAccount: "sub0123",
            branchCode: "branch012",
            remarks: "500",
            currency:"666",
            entryType: "credit"
        },
        {
            id: 1,
            mainAccount: "main0123",
            subAccount: "sub0123",
            branchCode: "branch012",
            remarks: "cu123",
            currency:"666",
            entryType: "credit"
        }
    ]
};

let nextId = 2;

const reversalJVReducers = createSlice({
    name: "receipts",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(getReversalTabelData.pending, (state) => {
                state.loading = true;
            })
            .addCase(getReversalTabelData.fulfilled, (state, action) => {
                state.loading = false;
                state.reversalJVList = [action.payload];
            })
            .addCase(getReversalTabelData.rejected, (state, action) => {
                state.loading = false;
                state.reversalJVList = {};
                state.error = typeof action.payload === "string" ? action.payload : "";
            })
            .addCase(postReversalJVData.pending, (state) => {
                state.loading = true;
            })
            .addCase(postReversalJVData.fulfilled, (state, action) => {
                state.loading = false;
                const newItem = { ...action.payload, id: nextId++ };
                state.reversalJVList = [...state.reversalJVList, newItem];
            })
            .addCase(postReversalJVData.rejected, (state, action) => {
                state.loading = false;
                state.error = typeof action.payload === "string" ? action.payload : "";
            });
    },
});

export default reversalJVReducers.reducer;
