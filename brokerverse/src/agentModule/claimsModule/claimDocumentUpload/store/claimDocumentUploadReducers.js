import { createSlice } from "@reduxjs/toolkit";
import { getClaimDocumentUploadData } from "./claimDocumentUploadMiddleWare";

const initialState = {
    loading: false,
    error: "",
    claimDocumentUploadData:
    {
        id: 1,
        adjusterName: "Raj",
        claimNumber: "345",
        dateOfReported: "01/28/2023",
        dateOfLoss: "01/29/2023",
        placeOfAccident: "Channai",
        driversName: "Jhon",
        houseNumber: "23",
        barangay: "Channai",
        country: "Philippines",
        province: "Tamil Nadu",
        city: "Channai",
        zipCode: "66753",
    },

};

const claimDocumentUploadReducers = createSlice({
    name: "claimDocumentUpload",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(getClaimDocumentUploadData.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(
            getClaimDocumentUploadData.fulfilled,
            (state, action) => {
                state.loading = false;
                state.claimSettleViewData = action.payload
            }
        );
        builder.addCase(
            getClaimDocumentUploadData.rejected,
            (state, action) => {
                state.loading = false;
                state.claimSettleViewData = {};
                state.error = typeof action.payload === "string" ? action.payload : "";
            }
        );

    },
});

export default claimDocumentUploadReducers.reducer;