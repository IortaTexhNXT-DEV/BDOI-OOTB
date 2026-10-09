import { useEffect, useState } from "react";
import accountingService from "../../services/accountingService";
import mastersService from "../../services/mastersService";

const EMPTY = {
  mainAccountsData: [],
  subAccountsData: [],
  branchCodesData: [],
  departmentCodesData: [],
  costCentresData: [],
  defaultCostCentre: null,
  currencyCodesData: [],
  transactionCodesData: [],
  exchangeRates: {},
  rateRows: [],
  baseCurrency: null,
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

const isoDay = (d) => {
  if (!d) return new Date().toISOString().slice(0, 10);
  if (d instanceof Date) {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  return String(d).slice(0, 10);
};

/**
 * Rate of a currency into the base currency on a date, from the dated Exchange Rate master: the record in force on
 * that date (Effective From on or before it, Effective To empty or on or after it), latest first; the inverse of
 * an opposite record otherwise. The server converts the voucher with the same rule; null when no rate is in force.
 */
export const rateOnDate = (rows, base, code, date) => {
  if (!code) return null;
  if (base && code === base) return 1;
  const day = isoDay(date);
  const inForce = (r) => String(r.EffectiveFrom || "").slice(0, 10) <= day && (!r.EffectiveTo || String(r.EffectiveTo).slice(0, 10) >= day) && Number(r.ExchangeRate) > 0;
  const latest = (list) => list.filter(inForce).sort((a, b) => String(b.EffectiveFrom).localeCompare(String(a.EffectiveFrom)))[0];
  const direct = latest(rows.filter((r) => r.CurrencyCode === code && (!base || r.ToCurrencyCode === base)));
  if (direct) return Number(direct.ExchangeRate);
  const inverse = latest(rows.filter((r) => r.ToCurrencyCode === code && (!base || r.CurrencyCode === base)));
  return inverse ? 1 / Number(inverse.ExchangeRate) : null;
};

const settle = (promise) => promise.catch(() => []);

/** Chart of accounts, cost centres and code masters for the Journal Voucher screens. */
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
      settle(mastersService.list("currency", { status: "Active", isBase: "true" })),
      settle(mastersService.list("cost-centre", { status: "Active" })),
    ]).then(([accounts, branches, departments, currencies, codes, rates, bases, centres]) => {
      if (!active) return;
      const manual = accounts.filter((a) => a.allowManual !== false);
      // the accounting base currency (Currency master); the display currency never decides it
      const baseCurrency = (bases.find((c) => c.isBase === true) || {}).CurrencyCode || null;
      const today = isoDay(new Date());
      const exchangeRates = Object.fromEntries(
        currencies.map((c) => [c.code, rateOnDate(rates, baseCurrency, c.code, today)]).filter(([, r]) => r !== null)
      );
      setData({
        mainAccountsData: manual.filter((a) => !a.parentCode).map(toMainAccount),
        subAccountsData: manual.filter((a) => a.parentCode).map(toSubAccount),
        branchCodesData: branches.map(fromOption),
        departmentCodesData: departments.map(fromOption),
        // cost centres of the journal lines; the one marked Default is proposed (and used by the server when none is chosen)
        costCentresData: centres.map((c) => ({ code: c.code, name: c.name, description: c.name })),
        defaultCostCentre: (centres.find((c) => c.isDefault === true || c.isDefault === "true") || {}).code || null,
        currencyCodesData: currencies.map(fromOption),
        transactionCodesData: codes.map(fromOption),
        exchangeRates,
        rateRows: rates,
        baseCurrency,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  /** Rate of a currency into the base currency on the voucher date (null: none in force). */
  const rateOn = (code, date) => rateOnDate(data.rateRows, data.baseCurrency, code, date);
  return { ...data, rateOn };
};

export default useJvMasterData;
