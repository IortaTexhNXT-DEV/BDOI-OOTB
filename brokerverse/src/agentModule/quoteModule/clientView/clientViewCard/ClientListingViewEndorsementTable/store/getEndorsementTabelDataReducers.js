import { createSlice } from "@reduxjs/toolkit";
import {
  getEndorsementTabelData,
  getEndoresementTabelSearchList,
} from "./getEndorsementTabelDataMiddleWare";
import SvgArrow from "../../../../../../assets/icons/SvgArrow";

const initialState = {
  loading: false,
  error: "",
  endorsementListData: [
    {
      id: "1",
      PolicyNumber: "Policy0123",
      EndorsementID: "END001",
      Type: "Personal Details",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Processing",
      payment: "N/A",
      Actions: <SvgArrow />,
    },
    {
      id: "2",
      PolicyNumber: "Policy0223",
      EndorsementID: "END002",
      Type: "Coverage",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      payment: "Completed",
      Actions: <SvgArrow />,
    },
    {
      id: "3",
      PolicyNumber: "Policy0123",
      EndorsementID: "END003",
      Type: "Motor Details",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      payment: "Pending",
      Actions: <SvgArrow />,
    },
    {
      id: "4",
      PolicyNumber: "Policy0123",
      EndorsementID: "END004",
      Type: "Personal Details",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Rejected",
      payment: "N/A",
      Actions: <SvgArrow />,
    },
    {
      id: "5",
      PolicyNumber: "Policy0123",
      EndorsementID: "END005",
      Type: "Coverage",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      payment: "Reviewing",
      Actions: <SvgArrow />,
    },
    {
      id: "6",
      PolicyNumber: "Policy0123",
      EndorsementID: "END006",
      Type: "Personal Details",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Rejected",
      payment: "N/A",
      Actions: <SvgArrow />,
    },
    {
      id: "7",
      PolicyNumber: "Policy0123",
      EndorsementID: "END007",
      Type: "Coverage",
      Date: "01 JAN 2024",
      ProductDescription: "Motor Comprensive",
      Status: "Processing",
      payment: "N/A",
      Actions: <SvgArrow />,
    },
    {
      id: "8",
      PolicyNumber: "Policy0123",
      EndorsementID: "END008",
      Type: "Motor Details",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Rejected",
      payment: "N/A",
      Actions: <SvgArrow />,
    },
    {
      id: "9",
      PolicyNumber: "Policy0123",
      EndorsementID: "END009",
      Type: "Personal Details",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Processing",
      payment: "N/A",
      Actions: <SvgArrow />,
    },
    {
      id: "10",
      PolicyNumber: "Policy0123",
      EndorsementID: "END010",
      Type: "Coverage",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      payment: "Reviewing",
      Actions: <SvgArrow />,
    },
    {
      id: "11",
      PolicyNumber: "Policy0123",
      EndorsementID: "END011",
      Type: "Coverage",
      Date: "01 JAN 2024",
      expiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Processing",
      payment: "N/A",
      Actions: <SvgArrow />,
    },
  ],
  endorsementSearchListData: [],
};
let nextId = 2;
const endorsementTabelDataReducers = createSlice({
  name: "endorsementTabelData",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getEndorsementTabelData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getEndorsementTabelData.fulfilled, (state, action) => {
      state.loading = false;
      state.endorsementListData = [action.payload];
    });
    builder.addCase(getEndorsementTabelData.rejected, (state, action) => {
      state.loading = false;

      state.endorsementListData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getEndoresementTabelSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getEndoresementTabelSearchList.fulfilled,
      (state, action) => {
        state.loading = false;
        state.endorsementSearchListData = action.payload;
      }
    );
    builder.addCase(
      getEndoresementTabelSearchList.rejected,
      (state, action) => {
        state.loading = false;

        state.endorsementSearchListData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default endorsementTabelDataReducers.reducer;
