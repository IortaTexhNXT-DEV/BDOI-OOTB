import { createAsyncThunk } from "@reduxjs/toolkit";
import { GET_UPCOMMING_OPEN_ITEMS_LIST, POST_UPCOMMING_OPEN_ITEMS_LIST} from "../../../redux/agentActionTypes";

import moment from "moment";




export const getOpenItemsListMiddleware = createAsyncThunk(
    GET_UPCOMMING_OPEN_ITEMS_LIST,
    async (_a, { rejectWithValue }) => {

        try {
            // Simulate an API call if needed
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            // return filteredData[0];
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);


export const postOpenItemsListMiddleware = createAsyncThunk(
    POST_UPCOMMING_OPEN_ITEMS_LIST,
    async (payload, { rejectWithValue, getState }) => {
        const { openitemsReducers } = getState();
        const { upcommingEventsList } = openitemsReducers;

        const bodyTableData = {
            // id: payload?.id,
            date: moment(payload?.date).format('DD/MM/YYYY'),
            description: payload?.notes,
            from: payload?.startTime,
            to: payload?.endTime,
            id: upcommingEventsList?.length
        };
        console.log(payload, "find add datas in midd");

        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return bodyTableData;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    }
);

// export const getOpenitemTabelSearchList = createAsyncThunk(
//     GET_OPENITEM_DATA_SEARCH_LIST ,
//     async ({ field, value }, { rejectWithValue, getState }) => {
//         console.log(field, value, "kkkk");
//         const { openitemTabelMainReducers } = getState();
//         const { endorsementListData } = openitemTabelMainReducers;
//         function filterEndorsementListByField(endorsementListData, field, value) {
//             const lowercasedValue = value.toLowerCase();
//             const outputData = endorsementListData.filter(item => {
//                 if (field === 'policy Number') {
//                     return item.PolicyNumber.toLowerCase().includes(lowercasedValue);
//                 } else if (field === 'EndorsementID') {
//                     return item.EndorsementID.toLowerCase().includes(lowercasedValue);
//                 }
//                 return (
//                     (item.PolicyNumber.toLowerCase().includes(lowercasedValue) ||
//                         item.EndorsementID.toLowerCase().includes(lowercasedValue))
//                 );
//             });
//             return outputData
//         }
//         try {
//             const filteredEndorsementList = filterEndorsementListByField(endorsementListData, field, value);
//             console.log(filteredEndorsementList, "filteredEndorsementList");
//             return filteredEndorsementList;
//         } catch (error) {
//             return rejectWithValue(error?.response?.data?.error?.message);
//         }
//     }
// );