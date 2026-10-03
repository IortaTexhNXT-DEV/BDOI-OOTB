import { createSlice } from "@reduxjs/toolkit";
import { getRoleListMiddleware, getRoleListByIdMiddleware, postAddRoleMiddleware, patchRoleEditMiddleware, getSearchRoleMiddleware, getViewRoleEditMiddleware, getPatchRoleEditMiddleware } from "./roleMiddleware";

const initialState = {
  loading: false,
  error: "",
  roleTableList: [],
  postRoleData: {},
  roleSearchList: [],
  roleViewData: {},
  roleEditData: {},
};
const receiptsReducer = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getRoleListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getRoleListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.roleTableList = action.payload;
    });
    builder.addCase(getRoleListMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.roleTableList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getRoleListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getRoleListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.roleTableList = action.payload;
    });
    builder.addCase(getRoleListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.roleTableList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getSearchRoleMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getSearchRoleMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.roleSearchList = action.payload;
    });
    builder.addCase(getSearchRoleMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.roleSearchList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });



    builder.addCase(postAddRoleMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postAddRoleMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        const newItem2 = action.payload;
        state.roleTableList = [...state.roleTableList, newItem2];
      }
    );
    builder.addCase(postAddRoleMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.postRoleData = {}
      state.error = typeof action.payload === "string" ? action.payload : "";
    });


    builder.addCase(patchRoleEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchRoleEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.roleTableList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedAddDisbursmentTable = [...state.roleTableList];
          updatedAddDisbursmentTable[updatedIndex] = action.payload;
          state.roleTableList = updatedAddDisbursmentTable;
        } else {
          state.roleTableList = [...state.roleTableList, action.payload];
        }
      }
    );
    builder.addCase(
      patchRoleEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.editList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );


    builder.addCase(getViewRoleEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getViewRoleEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;

        state.roleViewData = action.payload;
      }
    );
    builder.addCase(
      getViewRoleEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.roleViewData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getPatchRoleEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getPatchRoleEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;

        state.roleEditData = action.payload;
      }
    );
    builder.addCase(
      getPatchRoleEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.roleEditData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

  },
});

export default receiptsReducer.reducer;
