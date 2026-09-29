import { createAsyncThunk } from "@reduxjs/toolkit";
import { POST_PAYMENT_DATA, GET_PAYMENTTABLE_DATA, GET_PAYMENT_SEARCH, GET_PAYMENT_PAID_SEARCH, GET_PAYMENT_PENDING_SEARCH, GET_PAYMENTTABLE_PENDING_DATA, GET_PAYMENTTABLE_REWING_DATA } from "../../../redux/actionTypes";




export const getpaymenttableMiddleware = createAsyncThunk(
  GET_PAYMENTTABLE_DATA,
  async (payload, { rejectWithValue }) => {

    try {
      // Simulate an API call if needed
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      // return filteredData[0];
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);
export const getpaymentPendingtableMiddleware = createAsyncThunk(
  GET_PAYMENTTABLE_PENDING_DATA,
  async (payload, { rejectWithValue }) => {

    try {
      // Simulate an API call if needed
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      // return filteredData[0];
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

export const getpaymentRewivingtableMiddleware = createAsyncThunk(
  GET_PAYMENTTABLE_REWING_DATA,
  async (payload, { rejectWithValue }) => {

    try {
      // Simulate an API call if needed
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      // return filteredData[0];
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);


export const postpaymentdataMiddleWare = createAsyncThunk(
  POST_PAYMENT_DATA,
  async (payload, { rejectWithValue, getState }) => {
    const bodyTableData = {
      // id: payload?.id,
      policyNumber: 'Policy0123',
      production: '12/12/2013',
      issuedDate: '12/12/2012',
      inception: '12/12/2023',
      expiry: '12/12/2023',
      action: 1,
      action: payload?.id,
    };
    console.log(bodyTableData, "find add datas in midd");

    try {
      // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
      // return bodyTableData;
    } catch (error) {
      return rejectWithValue(error?.response.data.error.message);
    }
  }
);




export const getPaymentSearchDataMiddleWare = createAsyncThunk(
  GET_PAYMENT_SEARCH,
  async ({ field, value }, { rejectWithValue, getState }) => {
    console.log(field, value, "kkkk");
    const { agentPaymentMainReducers } = getState();
    const { paymenttabledata } = agentPaymentMainReducers;
    function filterPaymentsByField(data, field, value) {
      const lowercasedValue = value.toLowerCase();
      const outputData = data.filter(item => {
        if (field === "PolicyNumber") {

          return item?.policyNo.toLowerCase().includes(lowercasedValue);
        }
        if (field === "ClientId") {
          return item.clintid.toLowerCase().includes(lowercasedValue);
        }
        return (
          (item?.policyNo.toLowerCase().includes(lowercasedValue)
            ||
            item.clintid.toLowerCase().includes(lowercasedValue))
        );


      });
      return outputData
    }
    try {
      const filteredPayments = filterPaymentsByField(paymenttabledata, field, value);
      console.log(filteredPayments, "filteredPayments");
      return filteredPayments;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);


export const getPaymentPaidSearchDataMiddleWare = createAsyncThunk(
  GET_PAYMENT_PAID_SEARCH,
  async ({ field, value }, { rejectWithValue, getState }) => {
    console.log(field, value, "pppp");
    const { agentPaymentMainReducers } = getState();
    const { paymenttabledata } = agentPaymentMainReducers;
    console.log(paymenttabledata, "paymenttabledata");
    function filterPaymentsByField(data, field, value) {
      const lowercasedValue = value.toLowerCase();
      const outputData = data.filter(item => {
        if (field === "PolicyNumber") {
          return item?.policyNo.toLowerCase().includes(lowercasedValue);
        }
        if (field === "ClientId") {
          return item.clintid.toLowerCase().includes(lowercasedValue);
        }
        return (
          (item?.policyNo.toLowerCase().includes(lowercasedValue)
            ||
            item.clintid.toLowerCase().includes(lowercasedValue)
          )
        );
      });
      return outputData
    }
    try {
      const filteredPayments = filterPaymentsByField(paymenttabledata, field, value);
      console.log(filteredPayments, "filteredPayments");
      return filteredPayments;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);


export const getPaymentPendingSearchDataMiddleWare = createAsyncThunk(
  GET_PAYMENT_PENDING_SEARCH,
  async ({ field, value }, { rejectWithValue, getState }) => {
    console.log(field, value, "lll");
    const { agentPaymentMainReducers } = getState();
    const { paymentPendingtabledata } = agentPaymentMainReducers;
    console.log(paymentPendingtabledata, "paymentPendingtabledata");
    function filterPaymentsByField(data, field, value) {
      const lowercasedValue = value.toLowerCase();
      const outputData = data.filter(item => {
        if (field === "PolicyNumber") {
          return item?.policyNo.toLowerCase().includes(lowercasedValue);
        }
        if (field === "ClientId") {
          return item.clintid.toLowerCase().includes(lowercasedValue);
        }
        return (
          (item?.policyNo.toLowerCase().includes(lowercasedValue)
            ||
            item.clintid.toLowerCase().includes(lowercasedValue)
          )
        );
      });
      return outputData
    }
    try {
      const filteredPayments = filterPaymentsByField(paymentPendingtabledata, field, value);
      console.log(filteredPayments, "filteredPayments");
      return filteredPayments;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);





