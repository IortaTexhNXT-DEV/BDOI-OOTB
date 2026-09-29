import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../../utility/commonServices";
import { APIROUTES } from "../../../../../routes/apiRoutes";
import {
  GET_INSURANCE_COMPANY_SEARCH_LIST,
  GET_INSURANCE_COMPANY_LIST,
  POST_INSURANCE_COMPANY_DATA,
  PATCH_INSURANCE_COMPANY_DATA,
  GET_INSURANCE_VIEW,
  GET_INSURANCE_PATCH_DATA,
} from "../../../../../redux/actionTypes";

export const getInsuranceCompanyListMiddleWare = createAsyncThunk(
  GET_INSURANCE_COMPANY_LIST,
  async (payload, { rejectWithValue, getState }) => {
    const { insuranceCompanyReducers } = getState();
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const postInsuranceCompanyMiddleWare = createAsyncThunk(
  POST_INSURANCE_COMPANY_DATA,
  async (payload, { rejectWithValue, getState }) => {
    const bodyTableData = {
      id: payload?.id,
      modifiedby: "John",
      modifiedOn: "12/12/2023",
      insuranceCompanyCode: payload?.insuranceCompanyCode,
      insuranceCompanyName: payload?.insuranceCompanyName,
      insuranceCompanyDescription:payload?.insuranceCompanyDescription,
      email: payload?.email,
      phoneNumber: payload?.phoneNumber,
      addressLine1: payload?.addressLine1,
      addressLine2: payload?.addressLine2,
      addressLine3: payload?.addressLine3,
      city: payload?.city,
      state: payload?.state,
      country: payload?.country,
    };
    console.log(bodyTableData, "find add datas in midd");

    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return bodyTableData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const patchInsuranceCompanyMiddleWare = createAsyncThunk(
  PATCH_INSURANCE_COMPANY_DATA,
  async (payload, { rejectWithValue, getState }) => {
    const { insuranceCompanyReducers } = getState();
    const { InsuranceCompanyList } = insuranceCompanyReducers;
    const data={
      id: payload?.id,
      modifiedby: "John",
      modifiedOn: "12/12/2023",
      insuranceCompanyCode: payload?.insuranceCompanyCode,
      insuranceCompanyName: payload?.insuranceCompanyName,
      insuranceCompanyDescription:payload?.insuranceCompanyDescription,
      email: payload?.email,
      phoneNumber: payload?.phoneNumber,
      addressLine1: payload?.addressLine1,
      addressLine2: payload?.addressLine2,
      addressLine3: payload?.addressLine3,
      city: payload?.city,
      state: payload?.state,
      country: payload?.country,
    }
    // const updatedData = InsuranceCompanyList?.map((item) => {
    //   if (parseInt(item.id) === parseInt(payload?.id)) {
    //     return {
    //       id: payload?.id,
    //       insuranceCompanyCode: payload?.insuranceCompanyCode,
    //       insuranceCompanyName: payload?.insuranceCompanyName,
    //       email: payload?.email,
    //       phoneNumber: payload?.phoneNumber,
    //       addressLine1: payload?.addressLine1,
    //       addressLine2: payload?.addressLine2,
    //       addressLine3: payload?.addressLine3,
    //       city: payload?.city,
    //       state: payload?.state,
    //       country: payload?.country,
    //     };
    //   }
    //   return item;
    // });
    // console.log(updatedData, "find updatedData");

    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return data;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getSearchInsuranceCompanyMiddleware = createAsyncThunk(
  GET_INSURANCE_COMPANY_SEARCH_LIST,
  async (payload, { rejectWithValue, getState }) => {
    const { textSearch } = payload;
    const { insuranceCompanyReducers } = getState();

    const { InsuranceCompanyList } = insuranceCompanyReducers;
    console.log(InsuranceCompanyList, "1234");

    try {
      if (textSearch.trim() !== "") {
        const searchResults = InsuranceCompanyList?.filter((item) => {
          return item.insuranceCompanyCode
            .toLowerCase()
            .includes(textSearch.toLowerCase());
        });
        console.log(searchResults, "searchResults");
        return searchResults;
      } else {
        return InsuranceCompanyList;
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
export const getInsuranceViewMiddleWare = createAsyncThunk(
  GET_INSURANCE_VIEW,
  async (payload, { rejectWithValue, getState }) => {
    const { insuranceCompanyReducers } = getState();
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const getInsurancePatchData = createAsyncThunk(
  GET_INSURANCE_PATCH_DATA,
  async (payload, { rejectWithValue, getState }) => {
    const { insuranceCompanyReducers } = getState();
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
