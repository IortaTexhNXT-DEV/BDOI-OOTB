import { createSlice } from "@reduxjs/toolkit";
import { postPolicyDetailsMiddleware, postModleDetailsMiddleware, getModleDetailsMiddleware } from "./policyDetailsMiddleware";

const initialState = {
  loading: false,
  error: "",
  PolicyDetails: {},
  TableList: [
    //   {
    //   id: 1,
    //   ParticipantName: "Alpha insurance",
    //   SumInsuredcurrency: "Peso",
    //   Premiumcurrencys: "Peso",
    //   Sharepercentage: "50%",
    // },
  ]
};
const PolicyDetailsReducer = createSlice({
  name: "PolicyDetailsReducer",
  initialState,
  reducers: {
    deleteCoInsurer: (state, action) => {
      state.TableList = state.TableList.filter(item => item.id !== action.payload);
    },
    clearTableList: (state) => {
      state.TableList = [];
    }
  },
  extraReducers: (builder) => {
    //postPolicyDetailsMiddleware

    builder.addCase(postPolicyDetailsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postPolicyDetailsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.PolicyDetails = action.payload;
    });
    builder.addCase(postPolicyDetailsMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(getModleDetailsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(getModleDetailsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.TableList = action.payload;
    });
    builder.addCase(getModleDetailsMiddleware.rejected, (state, action) => {
      state.loading = false;
      state.TableList = {};
      state.error = typeof action.payload === "string" ? action.payload : "";
    });

    builder.addCase(postModleDetailsMiddleware.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(postModleDetailsMiddleware.fulfilled, (state, action) => {
      state.loading = false;
      state.TableList = [...state.TableList, action.payload];
    });
    builder.addCase(postModleDetailsMiddleware.rejected, (state, action) => {
      state.loading = false;
      //   state.paymentVocherList = state.paymentVocherList;
      state.error = typeof action.payload === "string" ? action.payload : "";
    });
  },
});

export const { deleteCoInsurer, clearTableList } = PolicyDetailsReducer.actions;
export default PolicyDetailsReducer.reducer;
