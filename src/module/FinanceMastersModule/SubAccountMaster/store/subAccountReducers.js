import { createSlice } from "@reduxjs/toolkit";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import { getSubAccount, getSubAccountEdit, getSubAccountSearchList, getSubAccountView, patchSubAccountEdit, postSubAccount } from "./subAccountMiddleWare";
const initialState = {
    loading: false,
    error: "",
    addSubAccount: {},
    subAccountSearchList: [],
    subAccountView: {},
    subAccountEdit: {},
    subAccountList: [
        {
            id: 1,
            subAccountCode: "1101001001",
            description: "ORIGINAL COST",
            subAccountName: "ayesha",
            mainAccount: "m123",
            currencyCode: "cd123",
            status: true,
        },
        {
            id: 2,
            subAccountCode: "1101001002",
            description: "REVALUED COST",
            subAccountName: "john",
            mainAccount: "m456",
            currencyCode: "cd456",
            status: false,
        },
        //   {
        //     id: 3,
        //     subAccountCode: "sub789",
        //     description: "YetAnotherSubAccount",
        //     subAccountName: "emma",
        //     mainAccount: "m789",
        //     currencyCode: "cd789",
        //     status: true,
        //   },
        //   {
        //     id: 4,
        //     subAccountCode: "sub101",
        //     description: "SubAccount4",
        //     subAccountName: "alex",
        //     mainAccount: "m101",
        //     currencyCode: "cd101",
        //     status: false,
        //   },
        //   {
        //     id: 5,
        //     subAccountCode: "sub202",
        //     description: "SubAccount5",
        //     subAccountName: "olivia",
        //     mainAccount: "m202",
        //     currencyCode: "cd202",
        //     status: true,
        //   },
        //   {
        //     id: 6,
        //     subAccountCode: "sub303",
        //     description: "SubAccount6",
        //     subAccountName: "liam",
        //     mainAccount: "m303",
        //     currencyCode: "cd303",
        //     status: false,
        //   },
        //   {
        //     id: 7,
        //     subAccountCode: "sub404",
        //     description: "SubAccount7",
        //     subAccountName: "sophia",
        //     mainAccount: "m404",
        //     currencyCode: "cd404",
        //     status: true,
        //   },
        //   {
        //     id: 8,
        //     subAccountCode: "sub505",
        //     description: "SubAccount8",
        //     subAccountName: "mason",
        //     mainAccount: "m505",
        //     currencyCode: "cd505",
        //     status: false,
        //   },
        //   {
        //     id: 9,
        //     subAccountCode: "sub606",
        //     description: "SubAccount9",
        //     subAccountName: "ava",
        //     mainAccount: "m606",
        //     currencyCode: "cd606",
        //     status: true,
        //   },
        //   {
        //     id: 10,
        //     subAccountCode: "sub707",
        //     description: "SubAccount10",
        //     subAccountName: "noah",
        //     mainAccount: "m707",
        //     currencyCode: "cd707",
        //     status: false,
        //   }


    ],
    getSubDetailEdit: {}


};
let nextId = 2
const subAccaountReducers = createSlice({
    name: "subAccount",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(getSubAccount.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(getSubAccount.fulfilled, (state, action) => {
            state.loading = false;
            state.subAccountList = [action.payload];

        });
        builder.addCase(getSubAccount.rejected, (state, action) => {
            state.loading = false;

            state.subAccountList = {};
            state.error = typeof action.payload === "string" ? action.payload : "";
        });


        //addCommission
        builder.addCase(postSubAccount.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(postSubAccount.fulfilled, (state, action) => {
            console.log(action.payload, 'find action.payload')
            state.loading = false;
            state.subAccountList = [...state.subAccountList, action.payload];
        });
        builder.addCase(
            postSubAccount.rejected, (state, action) => {
                state.loading = false;

                state.subAccountList = {};
                state.error = typeof action.payload === "string" ? action.payload : "";
            }
        );
        // //subAccountSearchList

        builder.addCase(getSubAccountSearchList.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(
            getSubAccountSearchList.fulfilled, (state, action) => {
                state.loading = false;
                state.subAccountSearchList = action.payload;
            }
        );
        builder.addCase(
            getSubAccountSearchList.rejected, (state, action) => {
                state.loading = false;

                state.subAccountSearchList = {};
                state.error = typeof action.payload === "string" ? action.payload : "";
            }
        );



        builder.addCase(patchSubAccountEdit.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(
            patchSubAccountEdit.fulfilled,
            (state, action) => {
                console.log("qwertty", action.payload)
                state.loading = false;
                // const updatedCurrencyList = [...state.subAccountList];
                // updatedCurrencyList[updatedIndex] = action.payload;
                state.subAccountList = action.payload;
                // const updatedIndex = state.subAccountList.findIndex(
                //     (item) => item.id === action.payload.id
                // );
                // if (updatedIndex !== -1) {
                //     const updatedCurrencyList = [...state.subAccountList];
                //     updatedCurrencyList[updatedIndex] = action.payload;
                //     state.subAccountList = updatedCurrencyList;
                //     console.log(state.subAccountList, "state.subAccountList")
                // } else {
                //     state.subAccountList = [...state.subAccountList, action.payload];
                // }
            }
        );

        builder.addCase(
            patchSubAccountEdit.rejected,
            (state, action) => {
                state.loading = false;

                state.subAccountEdit = {};
                state.error = typeof action.payload === "string" ? action.payload : "";
            }
        );

        //getCurrecyDetailEdit
        builder.addCase(getSubAccountEdit.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(
            getSubAccountEdit.fulfilled,
            (state, action) => {
                state.loading = false;
                state.getSubDetailEdit = action.payload;
            }
        );
        builder.addCase(
            getSubAccountEdit.rejected,
            (state, action) => {
                state.loading = false;

                state.getSubDetailEdit = {};
                state.error = typeof action.payload === "string" ? action.payload : "";
            }
        );

        builder.addCase(getSubAccountView.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(
            getSubAccountView.fulfilled, (state, action) => {
                state.loading = false;
                state.subAccountView = action.payload;
            }
        );
        builder.addCase(
            getSubAccountView.rejected, (state, action) => {
                state.loading = false;

                state.subAccountView = {};
                state.error = typeof action.payload === "string" ? action.payload : "";
            }
        );

    },
});

export default subAccaountReducers.reducer;
