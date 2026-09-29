import { createSlice } from "@reduxjs/toolkit";
import {
  getPolicyTabelData,
  getPolicyTabelSearchList,
} from "./getPolicyTabelDataMiddleWare";
import SvgArrow from "../../../../../../assets/icons/SvgArrow";
import SvgDot from "../../../../../../assets/agentIcon/SvgDot";
import SvgMotorTable from "../../../../../../assets/agentIcon/SvgMotorTable";

const initialState = {
  loading: false,
  error: "",
  policyListData: [
    {
      id: "1",
      PolicyNumber: "Policy0123",
      GrossPremium: "7000.00",
      Date: "01 JAN 2024",
      ExpiryDate: "01 JAN 2025",
      Payment: "Pending",
      ProductDescription: "Motor Comprensive",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "2",
      PolicyNumber: "Policy0233",
      GrossPremium: "5000.00",
      Date: "01 JAN 2024",
      ExpiryDate: "01 JAN 2025",
      Payment: "Completed",
      ProductDescription: "Motor Comprensive",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "3",
      PolicyNumber: "Policy0893",
      GrossPremium: "7000.00",
      Date: "01 JAN 2024",
      ExpiryDate: "01 JAN 2025",
      Payment: "Reviewing",
      ProductDescription: "Motor Comprensive",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "4",
      PolicyNumber: "Policy0738",
      GrossPremium: "2000.00",
      Date: "01 JAN 2024",
      ExpiryDate: "01 JAN 2025",
      Payment: "Pending",
      ProductDescription: "Motor Comprensive",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "5",
      PolicyNumber: "Policy0123",
      GrossPremium: "7000.00",
      Date: "01 JAN 2024",
      ExpiryDate: "01 JAN 2025",
      Payment: "Completed",
      ProductDescription: "Motor Comprensive",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "6",
      PolicyNumber: "Policy382",
      GrossPremium: "1000.00",
      Date: "01 JAN 2024",
      ExpiryDate: "01 JAN 2025",
      Payment: "Completed",
      ProductDescription: "Motor Comprensive",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "7",
      PolicyNumber: "Policy0123",
      GrossPremium: "8000.00",
      Date: "01 JAN 2024",
      ExpiryDate: "01 JAN 2025",
      Payment: "Completed",
      ProductDescription: "Motor Comprensive",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      PolicyNumber: "Policy3982",
      GrossPremium: "2000.00",
      Date: "01 JAN 2024",
      ExpiryDate: "01 JAN 2025",

      Payment: "Pending",
      ProductDescription: "Motor Comprensive",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "9",
      PolicyNumber: "Policy0123",
      GrossPremium: "7000.00",
      Date: "01 JAN 2024",
      ExpiryDate: "01 JAN 2025",

      Payment: "Pending",
      ProductDescription: "Motor Comprensive",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "10",
      PolicyNumber: "Policy0123",
      GrossPremium: "7000.00",
      Date: "01 JAN 2024",
      ExpiryDate: "01 JAN 2025",

      Payment: "Pending",
      ProductDescription: "Motor Comprensive",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
    {
      id: "11",
      PolicyNumber: "Policy0123",
      GrossPremium: "7000.00",
      Date: "01 JAN 2024",
      ExpiryDate: "01 JAN 2025",
      Payment: "Pending",
      ProductDescription: "Motor Comprensive",
      Actions: <SvgDot />,
      Svg: <SvgMotorTable />,
    },
  ],
  policySearchListData: [],
};

let nextId = 2;
const policyTabelDataReducers = createSlice({
  name: "endorsementTabelData",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getPolicyTabelData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getPolicyTabelData.fulfilled, (state, action) => {
      state.loading = false;
      state.policyListData = [action.payload];
    });
    builder.addCase(getPolicyTabelData.rejected, (state, action) => {
      state.loading = false;

      state.policyListData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getPolicyTabelSearchList.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getPolicyTabelSearchList.fulfilled, (state, action) => {
      state.loading = false;
      state.policySearchListData = action.payload;
    });
    builder.addCase(getPolicyTabelSearchList.rejected, (state, action) => {
      state.loading = false;

      state.policySearchListData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default policyTabelDataReducers.reducer;
