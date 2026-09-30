import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  POST_CREATELEAD_DATA,
  POST_FIRE_CREATELEAD_DATA,
  GET_LEADTABLE_DATA,
  PATCH_LEADEDIT_DATA,
  GET_PAYMENT_SEARCH,
  GET_LEAD_EDIT_DATA,
  GET_LEAD_LIST_DATA,
  GET_LEAD_COMPANY_DATA,
  DELETE_LEAD_DATA,
  GET_LEAD_STATS
} from "../../../redux/actionTypes";
import leadService from "../../../services/leadService";
import { toIsoDate } from "../../../utility/birthDate";
import logger from "../../../utility/logger";

export const getleadtableMiddleware = createAsyncThunk(
  GET_LEADTABLE_DATA,
  async (params = {}, { rejectWithValue }) => {
    try {
      const result = await leadService.getAllLeads(params);
      
      if (result.success) {
        return {
          data: result.data,
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
        };
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to fetch leads');
    }
  }
);
export const getLeadDataMiddleware = createAsyncThunk(
  GET_LEAD_LIST_DATA,
  async () => {
    try {
    } catch (error) { }
  }
);

export const postCreateleadMiddleware = createAsyncThunk(
  POST_CREATELEAD_DATA,
  async (payload, { rejectWithValue, getState }) => {
    try {
      // Transform the form data to match the API payload structure
      const apiPayload = {
        firstName: payload?.FirstName,
        lastName: payload?.LastName,
        preferredName: payload?.PreferredName,
        DOB: payload?.DateofBirth ? toIsoDate(payload.DateofBirth) : "",
        gender: payload?.gender || "Male",
        emailId: payload?.EmailID,
        contactNumber: payload?.ContactNumber,
        houseNo: payload?.HouseNo,
        barangay: payload?.Barangay,
        country: typeof payload?.Country === 'object' ? payload?.Country?.label : payload?.Country,
        province: typeof payload?.Province === 'object' ? payload?.Province?.label : payload?.Province,
        city: typeof payload?.City === 'object' ? payload?.City?.label : payload?.City,
        zipCode: payload?.ZIPCode,
        roadThanon: payload?.RoadThanon ?? undefined,
        soiAlley: payload?.SoiAlley ?? undefined,
        mooVillage: payload?.MooVillage ?? undefined,
        leadCategory: payload?.category || "Retail", // Map to the selected category
        companyName: payload?.CompanyName || null,
        taxInformationNumber: payload?.TaxNumber || null,
        ...(payload?.clientId ? { clientId: payload.clientId } : {}),
        createdBy: (() => {
          try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            return userData?.username || userData?.name || userData?.employeeCode || "admin";
          } catch (error) {
            logger.warn('Error getting user data from localStorage:', error);
            return "admin";
          }
        })() // Dynamic user from localStorage
      };

      // Call the actual API service
      const result = await leadService.createLead(apiPayload);
      
      if (result.success) {
        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to create lead");
    }
  }
);

export const postFireCreateleadMiddleware = createAsyncThunk(
  POST_FIRE_CREATELEAD_DATA,
  async (payload, { rejectWithValue }) => {
    try {
      const result = await leadService.createFireLead(payload);
      if (result.success) {
        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(error?.message || "Failed to create Fire lead");
    }
  }
);

export const patchLeadEditMiddleWare = createAsyncThunk(
  PATCH_LEADEDIT_DATA,
  async ({ leadId, payload }, { rejectWithValue, getState }) => {
    try {
      // Transform the form data to match the API payload structure
      const apiPayload = {
        firstName: payload?.FirstName,
        lastName: payload?.LastName,
        preferredName: payload?.PreferredName,
        DOB: payload?.DateofBirth ? toIsoDate(payload.DateofBirth) : "",
        gender: payload?.gender || "Male",
        emailId: payload?.EmailID,
        contactNumber: payload?.ContactNumber,
        houseNo: payload?.HouseNo,
        barangay: payload?.Barangay,
        country: typeof payload?.Country === 'object' ? payload?.Country?.label : payload?.Country,
        province: typeof payload?.Province === 'object' ? payload?.Province?.label : payload?.Province,
        city: typeof payload?.City === 'object' ? payload?.City?.label : payload?.City,
        zipCode: payload?.ZIPCode,
        roadThanon: payload?.RoadThanon ?? undefined,
        soiAlley: payload?.SoiAlley ?? undefined,
        mooVillage: payload?.MooVillage ?? undefined,
        leadCategory: payload?.category || "Retail",
        companyName: payload?.CompanyName || null,
        taxInformationNumber: payload?.TaxNumber || null,
        updatedBy: (() => {
          try {
            const userData = JSON.parse(localStorage.getItem('user') || '{}');
            return userData?.username || userData?.name || userData?.employeeCode || "admin";
          } catch (error) {
            logger.warn('Error getting user data from localStorage:', error);
            return "admin";
          }
        })() // Dynamic user from localStorage
      };

      // Call the actual API service
      const result = await leadService.updateLead(leadId, apiPayload);
      
      if (result.success) {
        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to update lead');
    }
  }
);
export const getPaymentSearchDataMiddleWare = createAsyncThunk(
  GET_PAYMENT_SEARCH,
  async ({ field, value }, { rejectWithValue, getState }) => {
    const { leadReducers } = getState();
    const { leadtabledata } = leadReducers;

    function filterPaymentsByField(data, field, value) {
      const lowercasedValue = value.toLowerCase();
      const outputData = data.filter((item) => {
        if (field === "Name") {
          return item.FirstName.toLowerCase().includes(lowercasedValue);
        } else if (field === "LeadID") {
          return item.LeadID.toLowerCase().includes(lowercasedValue);
        }
        return (
          item.FirstName.toLowerCase().includes(lowercasedValue) ||
          item.LeadID.toLowerCase().includes(lowercasedValue)
        );
      });
      return outputData;
    }
    try {
      const filteredPayments = filterPaymentsByField(
        leadtabledata,
        field,
        value
      );
      return filteredPayments;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

export const getLeadEditDataMiddleWare = createAsyncThunk(
  GET_LEAD_EDIT_DATA,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

export const getleadcompanydataMiddleware = createAsyncThunk(
  GET_LEAD_COMPANY_DATA,
  async (payload, { rejectWithValue }) => {
    try {
      return payload;
    } catch (error) {
      return rejectWithValue(error?.response?.data?.error?.message);
    }
  }
);

export const getLeadByIdMiddleware = createAsyncThunk(
  'GET_LEAD_BY_ID',
  async (leadId, { rejectWithValue }) => {
    try {
      const result = await leadService.getLeadById(leadId);
      
      if (result.success) {
        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to fetch lead');
    }
  }
);

export const deleteLeadMiddleware = createAsyncThunk(
  DELETE_LEAD_DATA,
  async (leadId, { rejectWithValue }) => {
    try {
      const result = await leadService.deleteLead(leadId);
      
      if (result.success) {
        return { leadId, ...result.data };
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to delete lead');
    }
  }
);

export const getLeadStatsMiddleware = createAsyncThunk(
  GET_LEAD_STATS,
  async (filters = {}, { rejectWithValue }) => {
    try {
      const result = await leadService.getLeadStats(filters);
      
      if (result.success) {
        return result.data;
      } else {
        return rejectWithValue(result.error);
      }
    } catch (error) {
      return rejectWithValue(error?.message || 'Failed to fetch lead statistics');
    }
  }
);  
