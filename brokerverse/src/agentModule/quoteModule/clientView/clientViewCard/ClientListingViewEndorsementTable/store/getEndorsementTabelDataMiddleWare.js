import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_ENDORSEMENT_DATA, GET_ENDORSEMENT_DATA_SEARCH_LIST } from "../../../../../../redux/actionTypes";

export const getEndorsementTabelData = createAsyncThunk(
    GET_ENDORSEMENT_DATA,
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

export const getEndoresementTabelSearchList = createAsyncThunk(
    GET_ENDORSEMENT_DATA_SEARCH_LIST,
    async ({ field, value }, { rejectWithValue, getState }) => {
        const { endorsementTabelMainReducers } = getState();
        const { endorsementListData } = endorsementTabelMainReducers;
        function filterEndorsementListByField(endorsementListData, field, value) {
            const lowercasedValue = value.toLowerCase();
            const outputData = endorsementListData.filter(item => {
                if (field === "EndorsementID") {
                    return item.EndorsementID.toLowerCase().includes(lowercasedValue);
                }
                if (field === 'policy Number') {
                    return item.PolicyNumber.toLowerCase().includes(lowercasedValue);
                } else if (field === 'EndorsementID') {
                    return item.EndorsementID.toLowerCase().includes(lowercasedValue);
                }
                return (
                    (item.EndorsementID.toLowerCase().includes(lowercasedValue) ||
                        item.PolicyNumber.toLowerCase().includes(lowercasedValue) ||
                        item.EndorsementID.toLowerCase().includes(lowercasedValue))
                );
            });
            return outputData
        }
        try {
            const filteredEndorsementList = filterEndorsementListByField(endorsementListData, field, value);
            return filteredEndorsementList;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);

