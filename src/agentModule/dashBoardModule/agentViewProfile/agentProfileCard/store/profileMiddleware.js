import { createAsyncThunk } from "@reduxjs/toolkit";
// import { getRequest } from "../../../utility/commonServices";
// import { APIROUTES } from "../../../routes/apiRoutes";
import {
  GET_PROFILE_DETAILS,
 
  PATCH_PROFILE_EDIT,
 
  GET_EDIT_PROFILE,
} from "../../../../../redux/actionTypes";

export const getProfileMiddleware = createAsyncThunk(
  GET_PROFILE_DETAILS,
  async (payload, { rejectWithValue }) => {
    console.log(payload,"action find")
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);


export const patchProfileEditMiddleware = createAsyncThunk(
  PATCH_PROFILE_EDIT,
  async (payload, { rejectWithValue,getState }) => {
    console.log(payload,"find payload")
    const data = {
      id:payload?.id,
      firstName:payload.firstName,
      lastName: payload.lastName,
      prefferedName: payload.prefferedName,
      lastName: payload.lastName,
      dateOfBirth:payload.dateOfBirth,
      gender: payload.gender,
      houseNoUnitNoStreet:payload.houseNoUnitNoStreet,
      emailId:payload.emailId,
      contactNumber:payload.contactNumber,
      barangaySubd:payload.barangaySubd,
      idNumber: payload.idNumber,
      
      zipCode: payload.zipCode,
      city: payload.city,
      province: payload.province,
      country: payload.country
     
    };
  
    try {
      console.log(data,"find data")
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return data;
      
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);






export const getProfileEditMiddleWare = createAsyncThunk(
  GET_EDIT_PROFILE,
  async (payload, { rejectWithValue }) => {
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);


