import { createSlice } from "@reduxjs/toolkit";
import { fetchProductTemplateByIdMiddleware } from "./productConfiguratorMiddleware";

const initialState = {
  loading: false,
  error: null,
  template: null,
};

const productConfiguratorSlice = createSlice({
  name: "productConfigurator",
  initialState,
  reducers: {
    clearProductTemplate(state) {
      state.template = null;
      state.error = null;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductTemplateByIdMiddleware.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchProductTemplateByIdMiddleware.fulfilled,
        (state, action) => {
          state.loading = false;
          state.template = action.payload;
        }
      )
      .addCase(fetchProductTemplateByIdMiddleware.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload ||
          action.error?.message ||
          "Failed to load product template";
        state.template = null;
      });
  },
});

export const { clearProductTemplate } = productConfiguratorSlice.actions;
export default productConfiguratorSlice.reducer;
