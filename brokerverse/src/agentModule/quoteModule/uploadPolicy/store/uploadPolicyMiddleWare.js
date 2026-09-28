import { createAsyncThunk } from "@reduxjs/toolkit";
// import { getRequest } from "../../../../utility/commonServices";
// import { APIROUTES } from "../../../../../routes/apiRoutes";
import {
    POST_UPLOADPOLICY_DATA
} from "../../../../redux/actionTypes";


export const postUploadPolicyMiddleWare = createAsyncThunk(
    POST_UPLOADPOLICY_DATA,
    async (payload, { rejectWithValue, getState }) => {

        // const targetDate = "Tue Jan 23 2024";

        // const filteredData = payload.filter(entry => entry.Inception.includes(targetDate));
        
        // console.log("12111",filteredData,payload);


      const bodyTableData = {
        PolicyNumber:payload?.PolicyNumber,
  InsuranceCompany:payload?.InsuranceCompany,
  Production: payload?.Production,
  Inception: payload?.Inception,
  IssuedDate: payload?.IssuedDate,
  Expiry:payload?.Expiry
      };
      console.log(payload, "find add datas in midd");
  
      try {
        // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
        return bodyTableData;
        console.log(bodyTableData, "find add datas in midd1");
      } catch (error) {
        return rejectWithValue(error?.response.data.error.message);
      }
    }
  );