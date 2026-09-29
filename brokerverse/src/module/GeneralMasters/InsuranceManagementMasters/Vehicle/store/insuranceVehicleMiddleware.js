import { createAsyncThunk } from "@reduxjs/toolkit";
import { getRequest } from "../../../../../utility/commonServices";
import { APIROUTES } from "../../../../../routes/apiRoutes";
import {
  GET_INSURANCE_VEHICLE_SEARCH_LIST,
  GET_INSURANCE_VEHICLE_LIST,
  POST_INSURANCE_VEHICLE_DATA,
  PATCH_INSURANCE_VEHICLE_DATA,
} from "../../../../../redux/actionTypes";

export const getInsuranceVehicleMiddleWare = createAsyncThunk(
  GET_INSURANCE_VEHICLE_LIST,
  async (payload, { rejectWithValue, getState }) => {
    const { insuranceVehicleReducers } = getState();
    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);

export const postInsuranceVehicleMiddleWare = createAsyncThunk(
  POST_INSURANCE_VEHICLE_DATA,
  async (payload, { rejectWithValue, getState }) => {
    const bodyTableData = {
      id: payload?.id,
      Status: 0,
      vehicleCode: payload?.vehicleCode,
      vehicleName: payload?.vehicleName,
      vehicleVariant: payload?.vehicleVariant,
      vehicleModel: payload?.vehicleModel,
      vehicleBrand: payload?.vehicleBrand,
      seatingCapacity: payload?.seatingCapacity,
      action: 1,
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
export const patchInsuranceVehicleMiddleWare = createAsyncThunk(
  PATCH_INSURANCE_VEHICLE_DATA,
  async (payload, { rejectWithValue, getState }) => {
    console.log(payload, "find edit load");
    const { insuranceVehicleReducers } = getState();
    const { InsuranceVehicleList } = insuranceVehicleReducers;
    console.log(InsuranceVehicleList, "find original data");
    const updatedData = InsuranceVehicleList?.map((item) => {
      if (parseInt(item.id) === parseInt(payload?.id)) {
        console.log(item.id,"find id")
        return {
          ...item,
          vehicleCode: payload?.vehicleCode,
          vehicleName: payload?.vehicleName,
          vehicleVariant: payload?.vehicleVariant,
          vehicleModel: payload?.vehicleModel,
          vehicleBrand: payload?.vehicleBrand,
          seatingCapacity: payload?.seatingCapacity,
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
export const getSearchInsuranceVehicleMiddleware = createAsyncThunk(
  GET_INSURANCE_VEHICLE_SEARCH_LIST,
  async (payload, { rejectWithValue, getState }) => {
    const { textSearch } = payload;
    const { insuranceVehicleReducers } = getState();

    const { InsuranceVehicleList } = insuranceVehicleReducers;
    console.log(InsuranceVehicleList, "1234");

    try {
      if (textSearch.trim() !== "") {
        const searchResults = InsuranceVehicleList?.filter((item) => {
          return item.vehicleCode
            .toLowerCase()
            .includes(textSearch.toLowerCase());
        });
        console.log(searchResults, "searchResults");
        return searchResults;
      } else {
        return InsuranceVehicleList;
      }
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
