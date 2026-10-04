import { createSlice } from "@reduxjs/toolkit";
import { getClientEditMiddleWare, getClientTableMiddleware, getClientTableSearchListMiddleware, getPaymentSearchDataMiddleWare, patchClientEditMiddleWare } from "./clientsMiddleware";


/** One client of GET /clients as a list row (the shape the client screens use). */
export const toClientRow = (client) => ({
    id: client.clientId,
    CompanyName: client.companyName || "",
    TaxNumber: client.taxNumber || "",
    FirstName: client.firstName,
    DisplayName: client.displayName || client.companyName
        || [client.firstName, client.lastName].filter(Boolean).join(" "),
    LastName: client.lastName,
    PreferredName: client.preferredName,
    EmailID: client.emailId,
    ContactNumber: client.contactNumber,
    HouseNo: client.houseNo,
    Barangay: client.barangay,
    Country: client.country,
    Province: client.province,
    City: client.city,
    ZIPCode: client.zipCode,
    DateofBirth: client.DOB,
    createdAt: client.createdAt || client.created_at || client.dateCreated || client.date_created,
    // Individual / Corporate from the client type; the lead category may still say Retail for a company
    category: String(client.clientType || "").toLowerCase() === "corporate" || (!client.clientType && client.companyName) ? "Corporate" : "Individual",
    gender: client.gender,
    Quotes: client.policies?.length?.toString() || "0",
    LeadID: client.generatedClientId,
    type: "motor",
    ProductDescription: client.policies?.[0]?.status || "N/A"
});

const initialState = {
    loading: false,
    error: "",
    clientListTable: [],
    page: 1,
    pageSize: 10,
    total: 0,
    leadtabledata: [],
    LeadEditdata: {},
    ClientTableSearchList: [],
    paymentSearchList: [],
    getClientEditData: {}
};
const clientReducer = createSlice({
    name: "clientReducer",
    initialState,
    reducers: {},
    extraReducers: (builder) => {

        //postCreateleadMiddleware

        builder.addCase(getClientTableMiddleware.pending, (state) => {
            state.loading = true;
            state.error = "";
        });
        builder.addCase(
            getClientTableMiddleware.fulfilled,
            (state, action) => {
                state.loading = false;
                state.error = "";
                // Handle API response structure: { data: { clients: [...], pagination: {...} } }
                if (action.payload?.data?.clients) {
                    // Transform API data to match component expectations
                    state.clientListTable = action.payload.data.clients.map(toClientRow);
                    state.page = action.payload.data.pagination?.page || state.page;
                    state.pageSize = action.payload.data.pagination?.pageSize || state.pageSize;
                    state.total = action.payload.data.pagination?.totalCount || 0;
                } else if (action.payload?.data) {
                    // Fallback: if data is directly an array
                    state.clientListTable = Array.isArray(action.payload.data) ? action.payload.data : [];
                } else {
                    // Last fallback: if payload is directly an array
                    state.clientListTable = Array.isArray(action.payload) ? action.payload : [];
                }
            }
        );
        builder.addCase(
            getClientTableMiddleware.rejected,
            (state, action) => {
                state.loading = false;
                state.error = typeof action.payload === "string" ? action.payload : "Failed to fetch clients";
            }
        );

        builder.addCase(getClientTableSearchListMiddleware.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(
            getClientTableSearchListMiddleware.fulfilled,
            (state, action) => {
                state.loading = false;
                state.ClientTableSearchList = action.payload

            }
        );
        builder.addCase(
            getClientTableSearchListMiddleware.rejected,
            (state, action) => {
                state.loading = false;
                state.ClientTableSearchList = {};
                state.error = typeof action.payload === "string" ? action.payload : "";
            }
        );
        builder.addCase(getPaymentSearchDataMiddleWare.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(getPaymentSearchDataMiddleWare.fulfilled, (state, action) => {
            state.loading = false;
            state.paymentSearchList = action.payload;
        });
        builder.addCase(getPaymentSearchDataMiddleWare.rejected, (state, action) => {
            state.loading = false;

            state.paymentSearchList = {};
            state.error = typeof action.payload === "string" ? action.payload : "";
        });


        builder.addCase(getClientEditMiddleWare.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(getClientEditMiddleWare.fulfilled, (state, action) => {
            state.loading = false;
            state.getClientEditData = action.payload;
        });
        builder.addCase(getClientEditMiddleWare.rejected, (state, action) => {
            state.loading = false;

            state.getClientEditData = {};
            state.error = typeof action.payload === "string" ? action.payload : "";
        });

        builder.addCase(patchClientEditMiddleWare.pending, (state) => {
            state.loading = true;
          });
          builder.addCase(
            patchClientEditMiddleWare.fulfilled,
            (state, action) => {
              state.loading = false;
              const updatedIndex = state.clientListTable.findIndex(
                (item) => item.id === action.payload.id
              );
              if (updatedIndex !== -1) {
                const updatedCurrencyList = [...state.clientListTable];
                updatedCurrencyList[updatedIndex] = action.payload;
                state.clientListTable = updatedCurrencyList;
              } else {
                state.clientListTable = [...state.clientListTable, action.payload];
              }
            }
          );
          builder.addCase(
            patchClientEditMiddleWare.rejected,
            (state, action) => {
              state.loading = false;
              state.error = typeof action.payload === "string" ? action.payload : "";
            }
          );
    }


});

export default clientReducer.reducer