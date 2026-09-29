import { createSlice } from "@reduxjs/toolkit";
import {
  getClaimTabelData,
  getClaimTabelSearchList,
} from "./getClaimTabelDataMiddleWare";
import SvgArrow from "../../../../../../assets/icons/SvgArrow";

const initialState = {
  loading: false,
  error: "",
  claimListData: [
    {
      id: "1",
      PolicyNumber: "Policy0123",
      ClaimID: "7000.00",
      claimNumber: "CL001",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",

      ProductDescription: "Motor Comprensive",
      Status: "Processing",
      Actions: <SvgArrow />,
    },
    {
      id: "2",
      PolicyNumber: "Policy0673",
      ClaimID: "6000.00",
      claimNumber: "CL002",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Processing",
      Actions: <SvgArrow />,
    },
    {
      id: "3",
      PolicyNumber: "Policy0123",
      ClaimID: "7000.00",
      claimNumber: "CL003",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      Actions: <SvgArrow />,
    },
    {
      id: "4",
      PolicyNumber: "Policy0123",
      ClaimID: "6000.00",
      claimNumber: "CL004",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Rejected",
      Actions: <SvgArrow />,
    },
  ],
  claimSearchListData: [],
};
const claimTabelDataReducers = createSlice({
  name: "claimTabelData",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getClaimTabelData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getClaimTabelData.fulfilled, (state, action) => {
      state.loading = false;
      state.claimListData = [action.payload];
    });
    builder.addCase(getClaimTabelData.rejected, (state, action) => {
      state.loading = false;

      state.claimListData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getClaimTabelSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getClaimTabelSearchList.fulfilled, (state, action) => {
      state.loading = false;
      state.claimSearchListData = action.payload;
    });
    builder.addCase(getClaimTabelSearchList.rejected, (state, action) => {
      state.loading = false;

      state.claimSearchListData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default claimTabelDataReducers.reducer;
