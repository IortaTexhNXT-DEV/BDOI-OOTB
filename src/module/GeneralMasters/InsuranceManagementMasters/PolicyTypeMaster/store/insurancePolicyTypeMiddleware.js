import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../../utility/commonServices";
import { APIROUTES } from "../../../../../routes/apiRoutes";
import {
  GET_INSURANCE_POLICY_TYPE_SEARCH_LIST,
  GET_INSURANCE_POLICY_TYPE_LIST,
  POST_INSURANCE_POLICY_TYPE_DATA,
  PATCH_INSURANCE_POLICY_TYPE_DATA,
} from "../../../../../redux/actionTypes";

export const getInsurancePolicyTypeMiddleWare = createAsyncThunk(
  GET_INSURANCE_POLICY_TYPE_LIST,
  async (payload, { rejectWithValue, getState }) => {
    const { insurancePolicyTypeReducers } = getState();
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postInsurancePolicyTypeMiddleWare = createAsyncThunk(
  POST_INSURANCE_POLICY_TYPE_DATA,
  async (payload, { rejectWithValue, getState }) => {
    const bodyTableData = {
      id: payload?.id,
      modifiedby: "Name",
      modifiedOn: "12/12/2023",
      Status: 0,
      policytypeCode: payload?.policyTypeCode,
      policyTypeName: payload?.policyTypeName,
      product: payload?.policyTypeDescription,
      policyTypeDescription: payload?.Product,
      action: payload?.id,
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
export const patchInsurancePolicyTypeMiddleWare = createAsyncThunk(
  PATCH_INSURANCE_POLICY_TYPE_DATA,
  async (payload, { rejectWithValue, getState }) => {
    console.log(payload, "find edit load");
    const { insurancePolicyTypeReducers } = getState();
    const { InsurancePolicyType } = insurancePolicyTypeReducers;
    console.log(InsurancePolicyType, "find original data");
    const updatedData = InsurancePolicyType?.map((item) => {
      if (parseInt(item.id) === parseInt(payload?.id)) {
        return {
          ...item,
          policytypeCode: payload?.policyTypeCode,
          policyTypeName: payload?.policyTypeName,
          product: payload?.policyTypeDescription,
          policyTypeDescription: payload?.Product,
        };
      }
      return item;
    });
    console.log(updatedData, "find updatedData");

    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return updatedData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);
export const getSearchInsurancePolicyTypeMiddleware = createAsyncThunk(
  GET_INSURANCE_POLICY_TYPE_SEARCH_LIST,
  async (payload, { rejectWithValue, getState }) => {
    const { textSearch } = payload;
    const { insurancePolicyTypeReducers } = getState();

    const { InsurancePolicyType } = insurancePolicyTypeReducers;
    console.log(InsurancePolicyType, "1234");

    try {
      if (textSearch.trim() !== "") {
        const searchResults = InsurancePolicyType?.filter((item) => {
          return item.policytypeCode
            .toLowerCase()
            .includes(textSearch.toLowerCase());
        });
        console.log(searchResults, "searchResults");
        return searchResults;
      } else {
        return InsurancePolicyType;
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
