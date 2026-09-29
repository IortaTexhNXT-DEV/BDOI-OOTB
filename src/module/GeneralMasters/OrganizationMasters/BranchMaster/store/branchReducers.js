import { createSlice } from "@reduxjs/toolkit";
import { getBranchListMiddleware, getBranchListByIdMiddleware, postAddBranchMiddleware, patchBranchEditMiddleware, getSearchBranchMiddleware, getOrganizationBranchView, getDepartmentListMiddleware, postAddDepartment, getDepatmentView, getPatchBranchData, postPatchDepatmentEdit, getDepatmentEditData } from "./branchMiddleware";

const initialState = {
  loading: false,
  error: "",
  branchTableList: [
    {
      id: "1",
      BranchCode: "101",
      BranchName: "ALPHA INSURACE",
      CompanyName: "BRANCH 1",
      EmailID: "contactus@broker.com",
      Description: "TEST PURPOSE",
      AddressLine1: "",
      AddressLine2: "",
      AddressLine3: " ",
      City: "SANTA TERESITA",
      State: "QUEZON CITY",
      Country: "PHILIPPINES",
      PhoneNumber: "8296571254",
      Fax: "99",
    },
    {
      id: "2",
      BranchCode: "102",
      BranchName: "Nandanum",
      CompanyName: "BRANCH  2",
      EmailID: "contactus@broker.com",
      Description: "TEST PURPOSE",
      AddressLine1: "",
      AddressLine2: "",
      AddressLine3: " ",
      City: "SANTA TERESITA",
      State: "QUEZON CITY",
      Country: "PHILIPPINES",
      PhoneNumber: "8296571254",
      Fax: "99",
    },

  ],
  branchTabelSearchList: [],
  organizationBranchView: {},
  departmentList: [
    {
      id: "1",
      DepartmentCode: "001",
      DepartmentName: "Motor",
      Status: "CREDIT",
      Description: "TEST PURPOSE",
    },
    {
      id: "2",
      DepartmentCode: "002",
      DepartmentName: "Non-Life Retail (NLR)",
      Status: "CREDIT",
      Description: "TEST PURPOSE",
    },
    // {
    //   id: "3",
    //   DepartmentCode: "003",
    //   DepartmentName: "Accident and Health",
    //   Status: "CREDIT",
    //   Description: "TEST PURPOSE",
    // },
    // {
    //   id: "4",
    //   DepartmentCode: "004",
    //   DepartmentName: "NLR Operations",
    //   Status: "CREDIT",
    //   Description: "TEST PURPOSE",
    // },
    // {
    //   id: "5",
    //   DepartmentCode: "005",
    //   DepartmentName: "Finance",
    //   Status: "CREDIT",
    //   Description: "TEST PURPOSE",
    // }
  ],
  depatmentView: {},
  getBranchPatch: {},
  getDepartmentPatch: {},
  postAddDepartmentData: {}
};
let nextId = 3
let nextId2 = 3
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
      state.branchTableList = [action.payload];
    });
    builder.addCase(getBranchListMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.branchTableList = {};
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

        state.branchTabelSearchList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );



    builder.addCase(postAddBranchMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postAddBranchMiddleware.fulfilled, (state, action) => {
        state.loading = false;
        const newItem2 = { ...action.payload, id: nextId++ };
        state.branchTableList = [...state.branchTableList, newItem2];
        console.log(state.branchTableList, "branchTableList")
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
      state.departmentList = [action.payload];
    });
    builder.addCase(getDepartmentListMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.departmentList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });


    builder.addCase(postAddDepartment.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postAddDepartment.fulfilled, (state, action) => {
        state.loading = false;
        const newItem2 = { ...action.payload, id: nextId2++ };
        state.departmentList = [...state.departmentList, newItem2];
        console.log(state.departmentList, "departmentList")
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
        console.log(updatedIndex, "updatedIndex");
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
        console.log(updatedIndex, "updatedIndex");
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
