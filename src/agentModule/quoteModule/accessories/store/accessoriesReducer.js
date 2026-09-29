import { createSlice } from "@reduxjs/toolkit";
import { postaccessoriesMiddleware } from ".//accessoriesMiddleware";

const initialState = {
  loading: false,
  error: "",
  accessories: {},
};
const AccessoriesReducer = createSlice({
  name: "AccessoriesReducer",
  initialState,
  reducers: {},
  extraReducers: (builder) => {

    //postPolicyDetailsMiddleware

    builder.addCase(postaccessoriesMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postaccessoriesMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.accessories = action.payload;
    });
    builder.addCase(postaccessoriesMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export default AccessoriesReducer.reducer;
