import { createSlice } from "@reduxjs/toolkit";
import { getCorrectionJVTabelData, getCorrectionJVView, getPatchCorrectionJVEdit, patchCorrectionJVEdit, postCorrectionJVData } from "./correctionJVMiddleWare";

const initialState = {
    loading: false,
    error: "",
    addCorrectionJV: {},
    correctionJVView: {},
    correctionEdit: {},
    correctionTabelList: [
        {
            correctionJVTransactionCode: "PRM",
            id: "1",
            transactionCode: "PRM",
            transactionNumber: "00"
        }
    ],
    correctionJVList: [
        {
            id: 1,
            branchCode: "THB001",
            branchCodeDescription: "branchCodeDescription",
            remarks: "-",
            currencyCode: "THB",
            currencyDescription: "currencyDescription",
            departmentCode: "SLS",
            departmentDescription: "departmentDescription",
            entryType: "Credit",
            foreignAmount: "66",
            localAmount:"00",
            mainAccount: "MAC001",
            mainAccountDescription: "mainAccountDescription",
            subAccount: "SAC001",
            subAccountDescription: "subAccountDescription",

        },
        {
            id: 2,
            branchCode: "THB001",
            branchCodeDescription: "branchCodeDescription",
            remarks: "-",
            currencyCode: "THB",
            currencyDescription: "currencyDescription",
            departmentCode: "SLS",
            departmentDescription: "departmentDescription",
            entryType: "Debit",
            foreignAmount: "66",
            localAmount:"00",
            mainAccount: "MAC001",
            mainAccountDescription: "mainAccountDescription",
            subAccount: "SAC001",
            subAccountDescription: "subAccountDescription",
        }
    ],
    getCorrectionJVEdit: []
};
let nextId = 2
const correctioneversalJVReducers = createSlice({
    name: "reversalJV",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(getCorrectionJVTabelData.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(getCorrectionJVTabelData.fulfilled, (state, action) => {
            state.loading = false;
            state.correctionJVList = [action.payload];
        });
        builder.addCase(getCorrectionJVTabelData.rejected, (state, action) => {
            state.loading = false;

            state.correctionJVList = {};
            state.error = typeof action.payload === "string" ? action.payload : "";
        });

        //post


        builder.addCase(postCorrectionJVData.pending, (state) => {
            state.loading = true;
        })
        builder.addCase(postCorrectionJVData.fulfilled, (state, action) => {
            state.loading = false;
            const newItem = { ...action.payload, id: nextId++ };
            state.correctionTabelList = [...state.correctionTabelList, newItem];
        })
        builder.addCase(postCorrectionJVData.rejected, (state, action) => {
            state.loading = false;
            state.error = typeof action.payload === "string" ? action.payload : "";
        });


        //view
        builder.addCase(getCorrectionJVView.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(getCorrectionJVView.fulfilled, (state, action) => {
            state.loading = false;
            state.correctionJVView = action.payload.data;
        });
        builder.addCase(getCorrectionJVView.rejected, (state, action) => {
            state.loading = false;

            state.correctionJVView = {};
            state.error = typeof action.payload === "string" ? action.payload : "";
        });



        builder.addCase(getPatchCorrectionJVEdit.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(getPatchCorrectionJVEdit.fulfilled, (state, action) => {
            state.loading = false;
            state.getCorrectionJVEdit = action.payload;
            console.log(state.getCorrectionJVEdit, " state.getCorrectionJVEdit ");
        });
        builder.addCase(getPatchCorrectionJVEdit.rejected, (state, action) => {
            state.loading = false;
            state.getCorrectionJVEdit = {};
            state.error = typeof action.payload === "string" ? action.payload : "";
        });


        builder.addCase(patchCorrectionJVEdit.pending,
            (state) => {
                state.loading = true;
            }
        );
        builder.addCase(
            patchCorrectionJVEdit.fulfilled,
            
            (state, action) => {
                state.loading = false;
                const updatedIndex = state.correctionJVList.findIndex(
                    (item) => item.id === action.payload.id
                );
                if (updatedIndex !== -1) {
                    const updatedCurrencyList = [...state.correctionJVList];
                    updatedCurrencyList[updatedIndex] = action.payload;
                    state.correctionJVList = updatedCurrencyList;
                } else {
                    state.correctionJVList = [...state.correctionJVList, action.payload];
                }
            }
        );
        builder.addCase(patchCorrectionJVEdit.rejected, (state, action) => {
            state.loading = false;
            state.error = typeof action.payload === "string" ? action.payload : "";
        }
        );
    },
});

export default correctioneversalJVReducers.reducer;
