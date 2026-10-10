import { formatDate, formatInstant } from "../../../utility/dateFormat";

/** Go-live opening balances: validated (POST .../validate, nothing saved), then loaded (POST .../import). */
export const OPENING_UPLOAD = [{
  label: "Opening balances", templatePath: "/period-end/opening-balances/template",
  validatePath: "/period-end/opening-balances/validate", uploadPath: "/period-end/opening-balances/import",
}];

/** Summary of a validation: fiscal year, balances date, rows, accounts, total debit and credit, difference. */
export const openingPreviewFacts = (t) => (r) => [
  { label: t("periodManagement.opening.fiscalYear"), value: r.fiscalYear },
  { label: t("periodManagement.opening.asAt"), value: r.asAt, type: "date" },
  { label: t("periodManagement.opening.rows"), value: r.rows, type: "number" },
  { label: t("periodManagement.opening.accounts"), value: r.accounts, type: "number" },
  { label: t("periodManagement.opening.noBalanceRows"), value: r.ignored?.length, type: "number", hidden: !r.ignored?.length },
  { label: t("periodManagement.opening.totalDebit"), value: r.totalDebit, type: "amount" },
  { label: t("periodManagement.opening.totalCredit"), value: r.totalCredit, type: "amount" },
  { label: t("periodManagement.opening.difference"), value: r.difference, type: "amount" },
];

/** The confirmation of the load: go-live date and totals, and the earlier load it replaces. */
export const openingConfirm = (t) => (r) => {
  const previous = r.previous;
  return {
    title: t("periodManagement.opening.confirmTitle"),
    message: t("periodManagement.opening.confirmMessage", { date: formatDate(r.goLiveDate), fiscalYear: r.fiscalYear }),
    facts: [
      { label: t("periodManagement.opening.goLiveDate"), value: r.goLiveDate, type: "date" },
      { label: t("periodManagement.opening.fiscalYear"), value: r.fiscalYear },
      { label: t("periodManagement.opening.accounts"), value: r.accounts, type: "number" },
      { label: t("periodManagement.opening.totalDebit"), value: r.totalDebit, type: "amount" },
      { label: t("periodManagement.opening.totalCredit"), value: r.totalCredit, type: "amount" },
    ],
    note: previous
      ? t("periodManagement.opening.replaces", {
        accounts: previous.accounts, by: previous.loadedBy || t("periodManagement.system"), at: previous.loadedAt ? formatInstant(previous.loadedAt) : "-",
      })
      : t("periodManagement.opening.replaceRule"),
    severity: previous ? "warning" : "neutral",
    confirmLabel: t("periodManagement.opening.load"),
  };
};
