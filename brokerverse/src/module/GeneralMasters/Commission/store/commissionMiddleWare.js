import { createAsyncThunk } from "@reduxjs/toolkit";
// import { getRequest } from "../../../utility/commonServices";
// import { APIROUTES } from "../../../routes/apiRoutes";
import { ADD_LEVEL_PATCH_COMMISSION_EDIT_POPUP, GET_COMMISSION, GET_COMMISSION_BY_ID, GET_COMMISSION_POPUP_VIEW, GET_COMMISSION_SEARCH_LIST, GET_COMMISSION_SHARING, GET_COMMISSION_VIEW, GET_PATCH_COMMISSION_EDIT, GET_PATCH_COMMISSION_EDIT_POPUP, PATCH_COMMISSION_EDIT, POST_ADD_SHARINGRATE_COMMISSION, POST_COMMISSION } from "../../../../redux/actionTypes";




export const CommissionData = createAsyncThunk(
    GET_COMMISSION,
    async (payload, { rejectWithValue }) => {
        try {

            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);
export const getCommission = createAsyncThunk(
    GET_COMMISSION_BY_ID,
    async (payload, { rejectWithValue, getState }) => {
        const { commissionMianReducers } = getState();
        const { commissionList } = commissionMianReducers
        const filteredData = commissionList.filter(item => item.id === 1);


        try {

            return filteredData[0];
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);


// export const postAddCommission = createAsyncThunk(
//     POST_COMMISSION,
//     async (payload, { rejectWithValue }) => {
//         try {
//             // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
//             return payload;
//         } catch (error) {
//             return rejectWithValue(error?.response.data.error.message);
//         }
//     },
// )
export const postAddCommission = createAsyncThunk(
    POST_COMMISSION,
    async (payload, { rejectWithValue, getState }) => {
        console.log(payload, "payload");

        let bodyTableData = {
            id: payload?.id,
            commissionCode: payload?.commissionCode,
            product: payload?.product,
            desc: payload?.desc,
            selectCover: payload?.selectCover,
            maxRate: payload?.maxRate,
            effectiveFrom: payload?.effectiveFrom.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            effectiveTo: payload?.effectiveTo.toLocaleDateString("en-US", {
                month: "numeric",
                day: "2-digit",
                year: "numeric",
            }),
            selectAgent: payload?.selectAgent,
            status: payload?.status,

        };
        try {
            console.log(bodyTableData, "find middleware");

            return bodyTableData;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);

export const getCommissionSearchList = createAsyncThunk(
    GET_COMMISSION_SEARCH_LIST,
    async (payload, { rejectWithValue, getState }) => {
        const { textSearch } = payload;
        const { commissionMianReducers } = getState();

        const { commissionList } = commissionMianReducers;
        console.log(commissionList, "1234")

        try {
            if (textSearch.trim() !== "") {
                const searchResults = commissionList.filter(item => {
                    return item.commissionCode.toLowerCase().includes(textSearch.toLowerCase());
                });
                console.log(searchResults, "searchResults")
                return searchResults;
            } else {
                return commissionList;
            }
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    },
);


export const getCommissionView = createAsyncThunk(
    GET_COMMISSION_VIEW,
    async (payload, { rejectWithValue }) => {
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
)
export const patchCommissionEdit = createAsyncThunk(
    PATCH_COMMISSION_EDIT,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "payload");
        let data = {
            id: payload?.id,
            commissionCode: payload?.commissionCode,
            product: payload?.product,
            desc: payload?.desc,
            selectCover: payload?.selectCover,
            effectiveFrom: payload?.effectiveFrom,
            effectiveTo: payload?.effectiveTo,
            // effectiveFrom: payload?.effectiveFrom.toLocaleDateString("en-US", {
            //     month: "numeric",
            //     day: "2-digit",
            //     year: "numeric",
            // }),
            // effectiveTo: payload?.effectiveTo.toLocaleDateString("en-US", {
            //     month: "numeric",
            //     day: "2-digit",
            //     year: "numeric",
            // }),
            selectAgent: payload?.selectAgent,
            maxRate: payload?.maxRate
        }

        try {
            console.log(data, "allahData");
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return data;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
)

export const getPatchCommissionEditMiddleware = createAsyncThunk(
    GET_PATCH_COMMISSION_EDIT,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "columnData");
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
)
export const getLevelCommissionSharing = createAsyncThunk(
    GET_COMMISSION_SHARING,
    async (payload, { rejectWithValue, getState }) => {
        const { commissionMianReducers } = getState();
        const { addLevelCommissionSharing } = commissionMianReducers
        const filteredData = addLevelCommissionSharing.filter(item => item.id === 1);
        try {
            return filteredData[0];
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
);
export const postAddLevelShareRatingCommission = createAsyncThunk(
    POST_ADD_SHARINGRATE_COMMISSION,
    async (payload, { rejectWithValue, getState }) => {
        console.log(payload, "payload");
        const generateRandomTransaction = () => {
            const commissionCode = ['cc11', 'cc12', 'cc13'];
            const randomIndex = Math.floor(Math.random() * commissionCode.length);
            return { name: commissionCode[randomIndex] };
        };
        let bodyTableData = {
            id: payload?.id,
            level: payload?.level,
            commissionCode: payload?.commissionCode,
            sharingRate: payload?.sharingRate,
            commissionCode: generateRandomTransaction().name,

        };
        try {
            console.log(bodyTableData, "find middleware");

            return bodyTableData;
        } catch (error) {
            return rejectWithValue(error?.response?.data?.error?.message);
        }
    }
);

export const getEditCommissionPopup = createAsyncThunk(
    GET_PATCH_COMMISSION_EDIT_POPUP,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "columnData");
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
)


export const addLevelPatchEditPopup = createAsyncThunk(
    ADD_LEVEL_PATCH_COMMISSION_EDIT_POPUP,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "data");
        const generateRandomTransaction = () => {
            const commissionCode = ['cc11', 'cc12', 'cc13'];
            const randomIndex = Math.floor(Math.random() * commissionCode.length);
            return { name: commissionCode[randomIndex] };
        };
        const data = {
            id: payload?.id,
            level: payload?.level,
            commissionCode: payload?.commissionCode,
            sharingRate: payload?.sharingRate,
        }
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return data;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
)


export const getCommissionPopupView = createAsyncThunk(
    GET_COMMISSION_POPUP_VIEW,
    async (payload, { rejectWithValue }) => {
        console.log(payload, "columnData");
        try {
            // const { data } = await getRequest(APIROUTES.DASHBOARD.GET_DETAILS);
            return payload;
        } catch (error) {
            return rejectWithValue(error?.response.data.error.message);
        }
    },
)



