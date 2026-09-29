import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_POLICY_DATA, GET_POLICY_DATA_SEARCH_LIST } from "../../../../../../redux/actionTypes";




export const getPolicyTabelData = createAsyncThunk(
    GET_POLICY_DATA,
    async (payload, { rejectWithValue, getState }) => {
        const { correctionJVMainReducers } = getState();
        console.log(correctionJVMainReducers, "data");
        const { correctionJVList } = correctionJVMainReducers;
        const filteredData = correctionJVList.filter((item) => item.id === 1);

        try {
            // Simulate an API call if needed
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return filteredData[0];
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);

// export const getClaimTabelSearchList = createAsyncThunk(
//     GET_CLAIM_DATA_SEARCH_LIST,
//     async (payload, { rejectWithValue, getState }) => {
//         const textSearch = payload;
//         console.log(textSearch, "textSearch")
//         const { claimTabelMainReducers } = getState();

//         const { claimListData } = claimTabelMainReducers;
//         console.log(claimListData, "1234")
//         try {
//             const searchResults = claimListData.filter(item => {
//                 return item.ClaimID.toLowerCase().includes(textSearch.toLowerCase());
//             });
//             console.log(searchResults, "searchResults")
//             return searchResults;
//         } catch (error) {
//             return rejectWithValue(error?.response.data.error.message);
//         }
//     },)
export const getPolicyTabelSearchList = createAsyncThunk(
    GET_POLICY_DATA_SEARCH_LIST,
    async ({ field, value }, { rejectWithValue, getState }) => {
        console.log(field, value, "kkkk");
        const { policyTabelMainReducers } = getState();
        const { policyListData } = policyTabelMainReducers;
        function filterEndorsementListByField(endorsementListData, field, value) {
            const lowercasedValue = value.toLowerCase();
            const outputData = policyListData.filter(item => {
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
            const filteredEndorsementList = filterEndorsementListByField(policyListData, field, value);
            console.log(filteredEndorsementList, "filteredEndorsementList");
            return filteredEndorsementList;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);





