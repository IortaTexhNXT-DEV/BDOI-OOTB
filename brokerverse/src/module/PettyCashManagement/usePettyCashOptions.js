import { useEffect, useState } from "react";
import accountingService from "../../services/accountingService";
import mastersService from "../../services/mastersService";
import pettyCashService from "../../services/pettyCashService";
import userService from "../../services/userService";

const EMPTY = {
  masterCodes: [],
  funds: [],
  banks: [],
  bankAccounts: [],
  mainAccounts: [],
  subAccounts: [],
  expenseAccounts: [],
  accounts: [],
  currencies: [],
  branches: [],
  departments: [],
  transactionCodes: [],
  requesters: [],
};

const fromMasterOption = (o) => ({ code: o.code, label: o.label, description: o.label });
const fromAccount = (a) => ({
  code: a.code,
  label: `${a.code} - ${a.name}`,
  description: a.name,
  parentCode: a.parentCode,
  accountType: a.accountType,
});
const fromFund = (f) => ({ ...f, label: f.code, description: f.description || "" });
const fromMasterPettyCash = (p) => ({
  code: p.pettycashcode,
  label: p.pettycashcode,
  description: p.pettycashname,
  size: p.pettycashsize,
  availableCash: p.avilabelcash,
  maxLimit: p.transactionlimit,
  minimumCashbox: p.minicashbox,
  branchCode: p.branchCode,
});
const fromBankAccount = (a) => ({
  code: a.accountCode,
  label: a.accountNumber || a.accountCode,
  description: a.accountName,
  bankCode: a.bankCode,
});
const fromUser = (u) => {
  const name = u.displayName || u.username;
  return { code: u.userId, label: name, description: name };
};

const settle = (promise, fallback = []) => promise.catch(() => fallback);

/** Dropdown data for the petty cash screens, loaded from the masters and petty-cash APIs. */
const usePettyCashOptions = () => {
  const [options, setOptions] = useState(EMPTY);

  useEffect(() => {
    let active = true;
    Promise.all([
      settle(mastersService.list("petty-cash", { status: "Active" })),
      settle(pettyCashService.list("funds", { status: "active" }).then((r) => r.data || [])),
      settle(mastersService.options("bank")),
      settle(mastersService.list("bank-account", { status: "Active" })),
      accountingService.getAccounts({ status: "active" }).then((r) => r.data || []),
      settle(mastersService.options("currency")),
      settle(mastersService.options("branch")),
      settle(mastersService.options("department")),
      settle(mastersService.options("transaction-code")),
      settle(userService.getUsers({ limit: 200 }).then((r) => r?.data || []).catch(() => [])),
    ]).then(([masters, funds, banks, bankAccounts, accounts, currencies, branches, departments, codes, users]) => {
      if (!active) return;
      const glAccounts = accounts.map(fromAccount);
      setOptions({
        masterCodes: masters.map(fromMasterPettyCash),
        funds: funds.map(fromFund),
        banks: banks.map(fromMasterOption),
        bankAccounts: bankAccounts.map(fromBankAccount),
        accounts: glAccounts,
        mainAccounts: glAccounts.filter((a) => !a.parentCode),
        subAccounts: glAccounts.filter((a) => a.parentCode),
        expenseAccounts: glAccounts.filter((a) => a.accountType === "expense"),
        currencies: currencies.map(fromMasterOption),
        branches: branches.map(fromMasterOption),
        departments: departments.map(fromMasterOption),
        transactionCodes: codes.map(fromMasterOption),
        requesters: (Array.isArray(users) ? users : []).map(fromUser),
      });
    });
    return () => {
      active = false;
    };
  }, []);

  return options;
};

/** Description of the option whose code matches (empty when not found). */
export const describe = (rows, code) =>
  rows.find((row) => row.code === code)?.description || "";

export default usePettyCashOptions;
