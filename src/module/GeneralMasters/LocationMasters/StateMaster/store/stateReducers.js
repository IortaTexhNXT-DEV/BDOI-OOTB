import { createSlice } from "@reduxjs/toolkit";
import { getStateMiddleware, getStateListByIdMiddleware, postAddStateMiddleware, patchStateEditMiddleware, getSearchStateMiddleware } from "./stateMiddleware";

const initialState = {
  loading: false,
  error: "",
  stateTableList: [
    {
      id: "1",
      StateCode: "PHR11DVO",
      StateName: "DAVAO ORIENTAL",
      Country: "PHILIPPINES",
      Modifiedby: "JOHN",
      ModifiedOn: "2024-01-11",
      Description:"TEST PURPOSE",
    },
    {
      id: "2",
      StateCode: "PHR06NEO",
      StateName: "NEGROS OCCIDENTAL",
      Country: "PHILIPPINES",
      Modifiedby: "JOHN",
      ModifiedOn: "2024-01-12",
      Description:"TEST PURPOSE",
    },
    {
      id: "3",
      StateCode: "PHNCRQZN",
      StateName: "QUEZON CITY",
      Country: "PHILIPPINES",
      Modifiedby: "SMITH",
      ModifiedOn: "2024-01-13",
      Description:"TEST PURPOSE",
    },
    {
      id: "4",
      StateCode: "PHNCRQZN",
      StateName: "LA UNION",
      Country: "PHILIPPINES",
      Modifiedby: "SMITH",
      ModifiedOn: "2024-01-14",
      Description:"TEST PURPOSE",
    },
    {
      id: "5",
      StateCode: "PHR4AQUP",
      StateName: "LEYTE",
      Country: "PHILIPPINES",
      Modifiedby: "JOHN",
      ModifiedOn: "2024-01-15",
    },
    {
      id: "6",
      StateCode: "PHR01PAN",
      StateName: "MAKATI CITY",
      Country: "PHILIPPINES",
      Modifiedby: "SMITH",
      ModifiedOn: "2024-01-16",
      Description:"TEST PURPOSE",
    },
    {
      id: "7",
      StateCode: "PHNCRMAK",
      StateName: "CAPIZ",
      Country: "PHILIPPINES",
      Modifiedby: "SMITH",
      ModifiedOn: "2024-01-17",
    },
    {
      id: "8",
      StateCode: "PHR4AQUP",
      StateName: "CATANDUANES",
      Country: "PHILIPPINES",
      Modifiedby: "SMITH",
      ModifiedOn: "2024-01-18",
      Description:"TEST PURPOSE",
    },
    {
      id: "9",
      StateCode: "PHCARABR",
      StateName: "ILOCOS SUR",
      Country: "Brazil",
      Modifiedby: "SMITH",
      ModifiedOn: "2024-01-19",
    },
    {
      id: "10",
      StateCode: "PHR06AKL",
      StateName: "PANGASINAN",
      Country: "PHILIPPINES",
      Modifiedby: "SMITH",
      ModifiedOn: "2024-01-20",
      Description:"TEST PURPOSE",
    }
  ],
  getStateListById: [],
  getSearchState: [],
  postAddState: "",
  patchStateEdit: {}

};
const stateReducer = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getStateMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getStateMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.stateTableList = action.payload;
    });
    builder.addCase(getStateMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.stateTableList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getStateListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getStateListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.getStateListById = action.payload;
    });
    builder.addCase(getStateListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.getStateListById = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getSearchStateMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getSearchStateMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.getSearchState = action.payload;
    });
    builder.addCase(getSearchStateMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.getSearchState = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });



    builder.addCase(postAddStateMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddStateMiddleware.fulfilled, (state, action) => {
      console.log(action.payload, 'find action.payload')
      state.loading = false;
      state.stateTableList = [...state.stateTableList, action.payload];
    });
    builder.addCase(postAddStateMiddleware.rejected, (state, action) => {
      state.loading = false;

      //   state.paymentVocherList = state.paymentVocherList;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });


    builder.addCase(patchStateEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchStateEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        console.log(state.stateTableList, "state.countryTableList");
        const updatedIndex = state.stateTableList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedAddDisbursmentTable = [...state.stateTableList];
          updatedAddDisbursmentTable[updatedIndex] = action.payload;
          state.stateTableList = updatedAddDisbursmentTable;
        } else {
          state.stateTableList = [...state.stateTableList, action.payload];
        }
      }
    );
    builder.addCase(
      patchStateEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );




  },
});

export default stateReducer.reducer;
