import { createSlice } from "@reduxjs/toolkit";
import {
  getRenewalTabelData,
  getRenewalTabelSearchList,
} from "./getRenewalTabelDataMiddleWare";
import SvgDot from "../../../../../../assets/agentIcon/SvgDot";
import SvgMotorTable from "../../../../../../assets/agentIcon/SvgMotorTable";

const initialState = {
  loading: false,
  error: "",
  renewalListData: [
    {
      id: "1",
      PolicyNumber: "Policy0123",
      IssueDate: "01 JAN 2024",
      GrossPremium: "7000.00",
      ExpiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Processing",
      Payment: "Pending",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "2",
      PolicyNumber: "Policy0233",
      IssueDate: "01 JAN 2024",
      GrossPremium: "5000.00",
      ExpiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      Payment: "Completed",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "3",
      PolicyNumber: "Policy0893",
      IssueDate: "01 JAN 2024",
      GrossPremium: "7000.00",
      ExpiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      Payment: "Reviewing",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "4",
      PolicyNumber: "Policy0738",
      IssueDate: "01 JAN 2024",
      GrossPremium: "2000.00",
      ExpiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      Payment: "Pending",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "5",
      PolicyNumber: "Policy0123",
      IssueDate: "01 JAN 2024",
      GrossPremium: "7000.00",
      ExpiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      Payment: "Completed",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "6",
      PolicyNumber: "Policy382",
      IssueDate: "01 JAN 2024",
      GrossPremium: "1000.00",
      ExpiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      Payment: "Completed",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "7",
      PolicyNumber: "Policy0123",
      IssueDate: "01 JAN 2024",
      GrossPremium: "8000.00",
      ExpiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      Payment: "Completed",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      PolicyNumber: "Policy3982",
      IssueDate: "01 JAN 2024",
      GrossPremium: "2000.00",
      ExpiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      Payment: "Pending",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "9",
      PolicyNumber: "Policy0123",
      IssueDate: "01 JAN 2024",
      GrossPremium: "7000.00",
      ExpiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      Payment: "Pending",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "10",
      PolicyNumber: "Policy0123",
      IssueDate: "01 JAN 2024",
      GrossPremium: "7000.00",
      ExpiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      Payment: "Pending",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "11",
      PolicyNumber: "Policy0123",
      IssueDate: "01 JAN 2024",
      GrossPremium: "7000.00",
      ExpiryDate: "01 JAN 2025",
      ProductDescription: "Motor Comprensive",
      Status: "Completed",
      Payment: "Pending",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
  ],
  renewalSearchListData: [],
};

const policyTabelDataReducers = createSlice({
  name: "endorsementTabelData",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getRenewalTabelData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getRenewalTabelData.fulfilled, (state, action) => {
      state.loading = false;
      state.renewalListData = [action.payload];
    });
    builder.addCase(getRenewalTabelData.rejected, (state, action) => {
      state.loading = false;

      state.renewalListData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getRenewalTabelSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getRenewalTabelSearchList.fulfilled, (state, action) => {
      state.loading = false;
      state.renewalSearchListData = action.payload;
    });
    builder.addCase(getRenewalTabelSearchList.rejected, (state, action) => {
      state.loading = false;

      state.renewalSearchListData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default policyTabelDataReducers.reducer;
