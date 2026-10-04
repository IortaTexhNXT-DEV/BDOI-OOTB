import useMasterOptions, { useFieldOptions } from "../../GeneralMasters/common/useMasterOptions";

const byCode = { valueKey: "code", labelKey: "code" };

/** Dropdown options of the Transaction Code add / edit forms (values are master codes). */
const useTransactionCodeOptions = () => ({
  basis: useFieldOptions("transaction-code", "TransactionBasis"),
  mainAccounts: useMasterOptions("main-account", byCode),
  subAccounts: useMasterOptions("sub-account", byCode),
  branches: useMasterOptions("branch", byCode),
  departments: useMasterOptions("department", byCode),
});

export default useTransactionCodeOptions;
