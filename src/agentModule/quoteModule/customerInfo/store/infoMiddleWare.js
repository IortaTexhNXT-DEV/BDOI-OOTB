import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../utility/commonServices";
import { APIROUTES } from "../../../../routes/apiRoutes";
import {
    POST_INFORMATION_DATA,PATCH_INFORMATION_DATA
} from "../../../../redux/actionTypes";


export const postinformationMiddleWare = createAsyncThunk(
    POST_INFORMATION_DATA,
    async (payload, { rejectWithValue, getState }) => {
      const bodyTableData = {
        id:1,
        MotorNumber: payload?.MotorNumber,
        ChassisNumber: payload?.ChassisNumber,
        Mortgage: payload?.Mortgage,
        CertNumber: payload?.CertNumber,
        PlateNumber: payload?.PlateNumber,
        MVFileNumber: payload?.MVFileNumber,
        AuthenCode: payload?.AuthenCode,
        Aluminium: payload?.Aluminium,
        AirBag: payload?.AirBag,
        TNVS: payload?.TNVS,
        TruckType:payload?.TruckType
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



  export const patchinformationMiddleWare = createAsyncThunk(
    PATCH_INFORMATION_DATA,
    async (payload, { rejectWithValue, getState }) => {
      
      console.log(payload, "find patch midd");
  
      try {
        // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
        return payload;
      
      } catch (error) {
        return rejectWithValue(error?.response.data.error.message);
      }
    }
  );
 