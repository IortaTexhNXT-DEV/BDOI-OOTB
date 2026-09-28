import { createSlice } from "@reduxjs/toolkit";
import { getBranchListMiddleware, getBranchListByIdMiddleware, postAddBranchMiddleware, patchBranchEditMiddleware, getSearchBranchMiddleware, getOrganizationBranchView, getDepartmentListMiddleware, postAddDepartment, getDepatmentView, getPatchBranchData, postPatchDepatmentEdit, getDepatmentEditData } from "./branchMiddleware";

const initialState = {
  loading: false,
  error: "",
  branchTableList: [],
  branchTabelSearchList: [],
  organizationBranchView: {},
  departmentList: [],
  depatmentView: {},
  getBranchPatch: {},
  getDepartmentPatch: {},
  postAddDepartmentData: {}
};
const organizationBranchReducers = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getBranchListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getBranchListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.branchTableList = action.payload;
    });
    builder.addCase(getBranchListMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.branchTableList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });


    builder.addCase(getBranchListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getBranchListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.branchDetailList = action.payload;
    });
    builder.addCase(getBranchListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.branchDetailList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getSearchBranchMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getSearchBranchMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        state.branchTabelSearchList = action.payload;
      }
    );
    builder.addCase(
      getSearchBranchMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.branchTabelSearchList = [];
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );



    builder.addCase(postAddBranchMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postAddBranchMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        state.branchTableList = [...state.branchTableList, action.payload];
      }
    );
    builder.addCase(postAddBranchMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    //organizationBranchView

    builder.addCase(getOrganizationBranchView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getOrganizationBranchView.fulfilled,
      (state, action) => {
        state.loading = false;
        state.organizationBranchView = action.payload;
      }
    );
    builder.addCase(
      getOrganizationBranchView.rejected,
      (state, action) => {
        state.loading = false;
        state.organizationBranchView = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getDepartmentListMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getDepartmentListMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.departmentList = action.payload;
    });
    builder.addCase(getDepartmentListMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.departmentList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });


    builder.addCase(postAddDepartment.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postAddDepartment.fulfilled, (state, action) => {
        state.loading = false;
        state.departmentList = [...state.departmentList, action.payload];
      }
    );
    builder.addCase(postAddDepartment.rejected, (state, action) => {
      state.loading = false;
      state.postAddDepartmentData = {}
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getDepatmentView.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getDepatmentView.fulfilled,
      (state, action) => {
        state.loading = false;
        state.depatmentView = action.payload;
      }
    );
    builder.addCase(
      getDepatmentView.rejected,
      (state, action) => {
        state.loading = false;
        state.depatmentView = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );



    builder.addCase(patchBranchEditMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      patchBranchEditMiddleware.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.branchTableList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.branchTableList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.branchTableList = updatedCurrencyList;
        } else {
          state.branchTableList = [...state.branchTableList, action.payload];
        }
      }
    );
    builder.addCase(
      patchBranchEditMiddleware.rejected,
      (state, action) => {
        state.loading = false;

        state.branchList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );


    builder.addCase(getPatchBranchData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getPatchBranchData.fulfilled,
      (state, action) => {
        state.loading = false;
        state.getBranchPatch = action.payload;
      }
    );
    builder.addCase(
      getPatchBranchData.rejected,
      (state, action) => {
        state.loading = false;
        state.getBranchPatch = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );


    builder.addCase(getDepatmentEditData.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getDepatmentEditData.fulfilled,
      (state, action) => {
        state.loading = false;
        state.getDepartmentPatch = action.payload;
      }
    );
    builder.addCase(
      getDepatmentEditData.rejected,
      (state, action) => {
        state.loading = false;
        state.getDepartmentPatch = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );


    builder.addCase(postPatchDepatmentEdit.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postPatchDepatmentEdit.fulfilled,
      (state, action) => {
        state.loading = false;
        const updatedIndex = state.departmentList.findIndex(
          (item) => item.id === action.payload.id
        );
        if (updatedIndex !== -1) {
          const updatedCurrencyList = [...state.departmentList];
          updatedCurrencyList[updatedIndex] = action.payload;
          state.departmentList = updatedCurrencyList;
        } else {
          state.departmentList = [...state.departmentList, action.payload];
        }
      }
    );
    builder.addCase(
      postPatchDepatmentEdit.rejected,
      (state, action) => {
        state.loading = false;
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

  },
});

export default organizationBranchReducers.reducer;
