import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_CLAIM_DATA, GET_CLAIM_DATA_SEARCH_LIST } from "../../../../../../redux/actionTypes";

export const getClaimTabelData = createAsyncThunk(
    GET_CLAIM_DATA,
    async (payload, { rejectWithValue, getState }) => {
        const { correctionJVMainReducers } = getState();
        const { correctionJVList } = correctionJVMainReducers;
        const filteredData = correctionJVList.filter((item) => item.id === 1);

        try {
            // Simulate an API call if needed
            return filteredData[0];
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);

// export const getClaimTabelSearchList = createAsyncThunk(
//     GET_CLAIM_DATA_SEARCH_LIST,
//     async (payload, { rejectWithValue, getState }) => {
//         try {
//             const searchResults = claimListData.filter(item => {
//             });
//         } catch (error) {
//         }
//     },)
export const getClaimTabelSearchList = createAsyncThunk(
    GET_CLAIM_DATA_SEARCH_LIST,
    async ({ field, value }, { rejectWithValue, getState }) => {
        const { claimTabelMainReducers } = getState();
        const { claimListData } = claimTabelMainReducers;
        function filterClaimListByField(claimListData, field, value) {
            const lowercasedValue = value.toLowerCase();
            const outputData = claimListData.filter(item => {
                if (field === "Claim Number") {
                    return item.claimNumber.toLowerCase().includes(lowercasedValue);
                }
                if (field === 'policy Number') {
                    return item.PolicyNumber.toLowerCase().includes(lowercasedValue);
                } else if (field === 'ClientID') {
                    return item.ClaimID.toLowerCase().includes(lowercasedValue);
                }
                return (
                    (item.claimNumber.toLowerCase().includes(lowercasedValue) ||
                        item.PolicyNumber.toLowerCase().includes(lowercasedValue) ||
                        item.ClaimID.toLowerCase().includes(lowercasedValue))
                );
            });
            return outputData
        }
        try {
            const filteredClaimList = filterClaimListByField(claimListData, field, value);
            return filteredClaimList;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);

