import { createSlice } from "@reduxjs/toolkit";
import { getStateMiddleware, getStateListByIdMiddleware, postAddStateMiddleware, patchStateEditMiddleware, getSearchStateMiddleware } from "./stateMiddleware";

const initialState = {
  loading: false,
  error: "",
  stateTableList: [],
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

      state.stateTableList = [];
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

      state.getStateListById = [];
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

      state.getSearchState = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postAddStateMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postAddStateMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.stateTableList = [...state.stateTableList, action.payload];
    });
    builder.addCase(postAddStateMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(patchStateEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchStateEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
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
