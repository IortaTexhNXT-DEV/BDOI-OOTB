import { createSlice } from "@reduxjs/toolkit";
import { getOpenItemsListMiddleware, postOpenItemsListMiddleware} from "./openItemsMiddleware.js";


const initialState = {
    loading: false,
    error: "",
    upcommingEventsList: [
        {
        date: "22/01/2024",
        description: 'Meeting With Dr.Justin',
        from: '17:00',
        to: '18:00', id: 1
    },
    {
        date: "22/01/2024",
        description: 'Meeting With Dr.Pathi',
        from: '17:00',
        to: '18:00', id: 1
    },
    {
        date: "22/01/2024",
        description: 'Meeting With Dr.Yuva',
        from: '17:00',
        to: '18:00', id: 1
    },
    {
        date: "22/01/2024",
        description: 'Meeting With Dr.Shanmu',
        from: '17:00',
        to: '18:00', id: 1
    },
    {
        date: "22/01/2024",
        description: 'Meeting With Dr.Leo',
        from: '17:00',
        to: '18:00', id: 1
    }
]
};

const openitemTabelMainReducers = createSlice({
    name: "openItems",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(getOpenItemsListMiddleware.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(
            getOpenItemsListMiddleware.fulfilled,
            (state, action) => {
                state.loading = false;
                // state.paymenttabledata = action.payload
            }
        );
        builder.addCase(
            getOpenItemsListMiddleware.rejected,
            (state, action) => {
                state.loading = false;
                state.error = typeof action.payload === "string" ? action.payload : "";
            }
        );


        builder.addCase(postOpenItemsListMiddleware.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(
            postOpenItemsListMiddleware.fulfilled,
            (state, action) => {
                state.loading = false;
                console.log(action?.payload, "open middleware")
                state.upcommingEventsList = [...state.upcommingEventsList, action.payload]
                // state.paymenttabledata = action.payload
            }
        );
        builder.addCase(
            postOpenItemsListMiddleware.rejected,
            (state, action) => {
                state.loading = false;
                state.error = typeof action.payload === "string" ? action.payload : "";
            }
        );

        // builder.addCase(getOpenitemTabelSearchList.pending, (state) => {
        //     state.loading = true;
        // });
        // builder.addCase(
        //     getOpenitemTabelSearchList.fulfilled, (state, action) => {
        //         state.loading = false;
        //         state.openitemSearchListData = action.payload;
        //     }
        // );
        // builder.addCase(
        //     getOpenitemTabelSearchList.rejected, (state, action) => {
        //         state.loading = false;

        //         state.openitemSearchListData = {};
        //         state.error = typeof action.payload === "string" ? action.payload : "";
        //     }
        // );

    }
})

export default openitemTabelMainReducers.reducer;