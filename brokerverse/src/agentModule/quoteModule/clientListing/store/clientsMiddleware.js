import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_CLIENTS_LIST, GET_CLIENTS_SEARCH_LIST, GET_CLIENT_EDIT_DATA, GET_PAYMENT_SEARCH, PATCH_CLIENTEDIT_DATA } from "../../../../redux/agentActionTypes";
import clientService from "../../../../services/clientService";

export const getClientTableMiddleware = createAsyncThunk(
    GET_CLIENTS_LIST,
    async (payload = {}, { rejectWithValue }) => {
        const { page = 1, pageSize = 10 } = payload;

        try {
            const response = await clientService.getClients(page, pageSize);
            
            if (response.success) {
                return response.data;
            } else {
                return rejectWithValue(response.error);
            }
        } catch (error) {
            return rejectWithValue(error?.message || 'Failed to fetch clients');
        }
    }
);

export const getClientTableSearchListMiddleware = createAsyncThunk(
    GET_CLIENTS_SEARCH_LIST,
    async (payload, { rejectWithValue, getState }) => {
        const textSearch = payload;
        const { clientsReducers } = getState();

        const { clientListTable } = clientsReducers;
        try {
            const searchResults = clientListTable.filter(item => {
                return item?.Category.toLowerCase().includes(textSearch.toLowerCase());
            });
            return searchResults;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },)
export const getPaymentSearchDataMiddleWare = createAsyncThunk(
    GET_PAYMENT_SEARCH,
    async ({ field, value, status }, { rejectWithValue, getState }) => {
        const { clientsReducers } = getState();
        const { clientListTable } = clientsReducers;

        function filterPaymentsByField(data, field, value) {
            const lowercasedValue = value.toLowerCase();
            const outputData = data.filter(item => {
                if (field === 'Name') {
                    return item.FirstName.toLowerCase().includes(lowercasedValue);
                } else if (field === 'ClientID') {
                    return item.LeadID.toLowerCase().includes(lowercasedValue);
                }
                return (
                    (item.FirstName.toLowerCase().includes(lowercasedValue) ||
                        item.LeadID.toLowerCase().includes(lowercasedValue))

                );
            });
            return outputData
        }
        try {
            const filteredPayments = filterPaymentsByField(clientListTable, field, value);
            return filteredPayments;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);

export const getClientEditMiddleWare = createAsyncThunk(
    GET_CLIENT_EDIT_DATA,
    async (payload, { rejectWithValue }) => {
        try {
            return payload
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    })

export const patchClientEditMiddleWare = createAsyncThunk(
    PATCH_CLIENTEDIT_DATA,
    async (payload, { rejectWithValue, getState }) => {
        const category = payload.category === 'Retail' ? 'Retail' : 'Corporate';
        const randomQuotesNumber = Math.floor(Math.random() * 10);
        const data = {
            id: payload?.id,
            CompanyName: payload?.CompanyName,
            TaxNumber: payload?.TaxNumber,
            FirstName: payload?.FirstName,
            LastName: payload?.LastName,
            PreferredName: payload?.PreferredName,
            EmailID: payload?.EmailID,
            ContactNumber: payload?.ContactNumber,
            HouseNo: payload?.HouseNo,
            Barangay: payload?.Barangay,
            Country: payload?.Country,
            Province: payload?.Province,
            City: payload?.City,
            Quotes: randomQuotesNumber,
            ZIPCode: payload?.ZIPCode,
            DateofBirth: payload?.DateofBirth.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            category: category,
            gender: "Male",
            ProductDescription: "Motor Comprensive"
        }

        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return data;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    }
);

