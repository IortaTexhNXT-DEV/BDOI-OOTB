import { createAsyncThunk } from "@reduxjs/toolkit";
import {
  GET_PETTY_CASH_VOUCHER_INITIAT_TABLE,
  GET_PETTY_CASH_VOUCHER_INITIAT_SEARCH,
  POST_PETTY_CASH_VOUCHER_INITIAT,
  GET_PETTY_CASH_VOUCHER_INITIAT_VIEW,
} from "../../../../redux/actionTypes";
import pettyCashService from "../../../../services/pettyCashService";
import { formatDisplayDate, optionCode } from "../../pettyCashFormat";

/** A petty cash fund as a row of the Initiate screens. */
export const toFundRow = (fund) => ({
  id: fund.id,
  Pettycashcode: fund.code,
  PettyCashdescription: fund.description || "",
  Pettycashsize: String(fund.fundSize ?? ""),
  TransactionNumber: fund.transactionNumber,
  TransactionCode: fund.transactionCode || "",
  TransactionDate: formatDisplayDate(fund.transactionDate),
  BankCode: fund.bankCode || "",
  BankAccountCode: fund.bankAccountCode || "",
  MainAccountCode: fund.mainAccountCode || "",
  SubAccountCode: fund.subAccountCode || "",
  Currency: fund.currency || "",
  Branchcode: fund.branchCode || "",
  Departmentcode: fund.departmentCode || "",
  AvailableCash: fund.availableCash,
  MaxLimit: fund.maxLimit,
  MinimumCashbox: fund.minimumCashbox,
  status: fund.status,
  createdBy: fund.createdBy,
});

const errorMessage = (error) => error?.message || "Something went wrong";

export const getInitiateListMiddleware = createAsyncThunk(
  GET_PETTY_CASH_VOUCHER_INITIAT_TABLE,
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await pettyCashService.list("funds", params || {});
      return (data || []).map(toFundRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const getInitiateListSearchMiddleware = createAsyncThunk(
  GET_PETTY_CASH_VOUCHER_INITIAT_SEARCH,
  async ({ value }, { rejectWithValue }) => {
    try {
      const { data } = await pettyCashService.list("funds", { search: value });
      return (data || []).map(toFundRow);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

/** Establishes a petty cash fund (posts Dr Petty Cash / Cr Cash in Bank). */
export const postInitiateMiddleware = createAsyncThunk(
  POST_PETTY_CASH_VOUCHER_INITIAT,
  async (values, { rejectWithValue }) => {
    try {
      const fund = await pettyCashService.create("funds", {
        code: optionCode(values.PettyCashCodes),
        description: values.PettyCashdescription || undefined,
        fundSize: values.PettyCashSize,
        maxLimit: values.MaxLimit || undefined,
        minimumCashbox: values.MinimumCashbox || undefined,
        bankCode: optionCode(values.BankCode),
        bankAccountCode: optionCode(values.BankAccountCode),
        mainAccountCode: optionCode(values.MainAccountCode),
        subAccountCode: optionCode(values.SubAccountCode),
        currency: optionCode(values.Currency),
        branchCode: optionCode(values.BranchCode),
        departmentCode: optionCode(values.DepartmentCode),
      });
      return toFundRow(fund);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const getInitiateDetailsMiddleware = createAsyncThunk(
  GET_PETTY_CASH_VOUCHER_INITIAT_VIEW,
  async (row) => row
);
