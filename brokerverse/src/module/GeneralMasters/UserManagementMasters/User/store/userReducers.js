import { createSlice } from "@reduxjs/toolkit";
import { formatDate as formatConfiguredDate } from "../../../../../utility/dateFormat";
import {
  getAdditionalRoleTabelMiddleWare,
  getAdditionalRoleViewMiddleWare,
  getMainBranchAccessMiddleWare,
  getSearchUserMiddleware,
  getUserEditDataMiddleWare,
  getUserListByIdMiddleware,
  getUserMiddleware,
  getUserViewDataMiddleWare,
  getViewMainBranchUser,
  patchUserEditMiddleware,
  postAddUserMiddleware,
  postAdditionalRoleViewMiddleWare,
  postViewMainBranchUser,
} from "./userMiddleware";

// Helper function to map API user data to frontend format
const mapUserData = (user) => {
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return formatConfiguredDate(date, { empty: "" });
  };

  return {
    ...user,
    id: user.userId ?? user.id,
    userName: user.username || "",
    employeeCode: user.employeeCode || user.agentProfile?.employeeCode || "N/A",
    // Role names (as set up in Role master); the code only when a name is missing
    assignedRole:
      Array.isArray(user.roleNames) && user.roleNames.length > 0
        ? user.roleNames.join(", ")
        : Array.isArray(user.roles) && user.roles.length > 0
        ? user.roles.join(", ")
        : "No Role",
    email: user.email || "",
    phoneNumber: user.agentProfile?.mobile || "",
    modifiedBy: user.updatedBy || "System",
    modifiedOn: formatDate(user.updatedAt || user.createdAt),
    status: user.status || "",
    action: "",
    // Store full user data for view/edit
    fullUserData: { ...user, temporaryPassword: undefined },
    // shown once in its dialog, never kept in the store
    temporaryPassword: undefined,
  };
};

const initialState = {
  loading: false,
  error: "",
  userList: [],
  userSearchList: [],
  userDetailList: {},
  userViewData: {},
  userEditData: {},
  lastAddUserError: null,
  mainBranchAccessTableList: [
    {
      id: 1,
      branchCode: "branchCode",
      branchName: "branchName",
      TransactionNofrom: "TransactionNofrom",
      departmentCode: "departmentCode",
      departmentName: "departmentName",
      action: "",
    },
  ],
  mainUserViewData: {},
  postUserViewData: {},
  mainAdditionalTableList: [
    {
      id: 1,
      RoleCode: "RoleCode",
      RoleName: "RoleName",
      ActiveHours: "ActiveHours",
      Action: "Action",
    },
  ],
  postAdditionalViewData: {},
  mainAdditionalViewData: {},
};
let nextId2 = 2;
let nextId3 = 2;
const usersReducer = createSlice({
  name: "user",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(getUserMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getUserMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      // Map API response to frontend format
      if (Array.isArray(action.payload)) {
        state.userList = action.payload.map(mapUserData);
      }
    });
    builder.addCase(getUserMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
    builder.addCase(getUserListByIdMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getUserListByIdMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.userDetailList = action.payload;
    });
    builder.addCase(getUserListByIdMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.userDetailList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getSearchUserMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getSearchUserMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      // Map API response to frontend format
      if (Array.isArray(action.payload)) {
        state.userSearchList = action.payload.map(mapUserData);
      } else {
        state.userSearchList = [];
      }
    });
    builder.addCase(getSearchUserMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.userSearchList = [];
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postAddUserMiddleware.pending, (state) => {
      state.loading = true;
      state.lastAddUserError = null;
    });
    builder.addCase(postAddUserMiddleware.fulfilled, (state, action) => {
      console.log(action.payload, "find action.payload");
      state.loading = false;
      state.lastAddUserError = null;
      // Map and add new user to list
      const mappedUser = mapUserData(action.payload);
      state.userList = [...state.userList, mappedUser];
      // Refresh user list to get updated data from backend
      if (typeof window !== "undefined") {
        setTimeout(() => {
          // Trigger reload of user list
        }, 100);
      }
    });
    builder.addCase(postAddUserMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
      state.lastAddUserError = action.payload || null;
    });

    builder.addCase(patchUserEditMiddleware.pending, (state) => {
      state.loading = true;
    });

    builder.addCase(patchUserEditMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      console.log(state.userList, "state.countryTableList");
      // Map the updated user data
      const mappedUser = mapUserData(action.payload);
      const updatedIndex = state.userList.findIndex(
        (item) => item.id === action.payload.id
      );
      if (updatedIndex !== -1) {
        const updatedAddDisbursmentTable = [...state.userList];
        updatedAddDisbursmentTable[updatedIndex] = mappedUser;
        state.userList = updatedAddDisbursmentTable;
      } else {
        state.userList = [...state.userList, mappedUser];
      }
    });
    builder.addCase(patchUserEditMiddleware.rejected, (state, action) => {
      state.loading = false;

      state.editList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getUserViewDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getUserViewDataMiddleWare.fulfilled, (state, action) => {
      state.loading = false;

      state.userViewData = action.payload;
    });
    builder.addCase(getUserViewDataMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.userViewData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getUserEditDataMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getUserEditDataMiddleWare.fulfilled, (state, action) => {
      state.loading = false;

      state.userEditData = action.payload;
    });
    builder.addCase(getUserEditDataMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.userEditData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getMainBranchAccessMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getMainBranchAccessMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.mainBranchAccessTableList = action.payload;
      }
    );
    builder.addCase(getMainBranchAccessMiddleWare.rejected, (state, action) => {
      state.loading = false;

      state.mainBranchAccessTableList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getViewMainBranchUser.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getViewMainBranchUser.fulfilled, (state, action) => {
      state.loading = false;
      state.mainUserViewData = action.payload;
    });
    builder.addCase(getViewMainBranchUser.rejected, (state, action) => {
      state.loading = false;

      state.mainUserViewData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postViewMainBranchUser.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postViewMainBranchUser.fulfilled, (state, action) => {
      state.loading = false;
      const newItem2 = { ...action.payload, id: nextId2++ };
      state.mainBranchAccessTableList = [
        ...state.mainBranchAccessTableList,
        newItem2,
      ];
      console.log(state.mainBranchAccessTableList, "mainBranchAccessTableList");
    });
    builder.addCase(postViewMainBranchUser.rejected, (state, action) => {
      state.loading = false;

      state.postUserViewData = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getAdditionalRoleTabelMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getAdditionalRoleTabelMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.mainAdditionalTableList = action.payload;
      }
    );
    builder.addCase(
      getAdditionalRoleTabelMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.mainAdditionalTableList = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(getAdditionalRoleViewMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      getAdditionalRoleViewMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        state.mainAdditionalViewData = action.payload;
      }
    );
    builder.addCase(
      getAdditionalRoleViewMiddleWare.rejected,
      (state, action) => {
        state.loading = false;

        state.mainAdditionalViewData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );

    builder.addCase(postAdditionalRoleViewMiddleWare.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(
      postAdditionalRoleViewMiddleWare.fulfilled,
      (state, action) => {
        state.loading = false;
        const newItem2 = { ...action.payload, id: nextId3++ };
        state.mainAdditionalTableList = [
          ...state.mainAdditionalTableList,
          newItem2,
        ];
        console.log(state.mainAdditionalTableList, "mainAdditionalTableList");
      }
    );
    builder.addCase(
      postAdditionalRoleViewMiddleWare.rejected,
      (state, action) => {
        state.loading = false;
        state.postAdditionalViewData = {};
        state.error = typeof action.payload === "string" ? action.payload : "";
      }
    );
  },
});

export default usersReducer.reducer;
