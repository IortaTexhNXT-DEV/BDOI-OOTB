import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_RENEWAL_DATA, GET_RENEWAL_DATA_SEARCH_LIST } from "../../../../../../redux/actionTypes";

export const getRenewalTabelData = createAsyncThunk(
    GET_RENEWAL_DATA,
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
export const getRenewalTabelSearchList = createAsyncThunk(
    GET_RENEWAL_DATA_SEARCH_LIST,
    async ({ field, value }, { rejectWithValue, getState }) => {
        const { renewalTabelMainReducers } = getState();
        const { renewalListData } = renewalTabelMainReducers;
        function filterEndorsementListByField(endorsementListData, field, value) {
            const lowercasedValue = value.toLowerCase();
            const outputData = renewalListData.filter(item => {
                if (field === 'policy Number') {
                    return item.PolicyNumber.toLowerCase().includes(lowercasedValue);
                } else if (field === 'EndorsementID') {
                    return item.PolicyID.toLowerCase().includes(lowercasedValue);
                }
                return (
                    (item.PolicyNumber.toLowerCase().includes(lowercasedValue) ||
                        item.PolicyID.toLowerCase().includes(lowercasedValue))
                );
            });
            return outputData
        }
        try {
            const filteredEndorsementList = filterEndorsementListByField(renewalListData, field, value);
            return filteredEndorsementList;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);

