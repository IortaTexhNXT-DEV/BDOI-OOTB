import { useEffect, useState } from "react";
import accountingService from "../../services/accountingService";
import mastersService from "../../services/mastersService";

const EMPTY = {
  mainAccountsData: [],
  subAccountsData: [],
  branchCodesData: [],
  departmentCodesData: [],
  currencyCodesData: [],
  transactionCodesData: [],
  exchangeRates: {},
};

const fromOption = (option) => ({
  code: option.code,
  name: option.label,
  description: option.label,
});

const toMainAccount = (account) => ({
  code: account.code,
  name: account.name,
  description: account.name,
});

const toSubAccount = (account) => ({
  ...toMainAccount(account),
  mainAccount: account.parentCode,
});

/** Latest active rate per currency, to the base currency (base currency itself is 1). */
const toExchangeRates = (rates) =>
  rates.reduce((acc, rate) => {
    acc[rate.CurrencyCode] = Number(rate.ExchangeRate) || 0;
    acc[rate.ToCurrencyCode] = 1;
    return acc;
  }, {});

const settle = (promise) => promise.catch(() => []);

/** Chart of accounts and code masters for the Journal Voucher screens. */
const useJvMasterData = () => {
  const [data, setData] = useState(EMPTY);

  useEffect(() => {
    let active = true;
    Promise.all([
      accountingService.getAccounts({ status: "active" }).then((r) => r.data || []),
      settle(mastersService.options("branch")),
      settle(mastersService.options("department")),
      settle(mastersService.options("currency")),
      settle(mastersService.options("transaction-code")),
      settle(mastersService.list("exchange-rate", { status: "Active" })),
    ]).then(([accounts, branches, departments, currencies, codes, rates]) => {
      if (!active) return;
      const manual = accounts.filter((a) => a.allowManual !== false);
      setData({
        mainAccountsData: manual.filter((a) => !a.parentCode).map(toMainAccount),
        subAccountsData: manual.filter((a) => a.parentCode).map(toSubAccount),
        branchCodesData: branches.map(fromOption),
        departmentCodesData: departments.map(fromOption),
        currencyCodesData: currencies.map(fromOption),
        transactionCodesData: codes.map(fromOption),
        exchangeRates: toExchangeRates(rates),
      });
    });
    return () => {
      active = false;
    };
  }, []);

  return data;
};

export default useJvMasterData;
