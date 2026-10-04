import React from "react";
import { useTranslation } from "react-i18next";
import ReportScreen from "../../ReportScreen";

/** Reports > FinancialReports > TrailBalance: the trial-balance report of the catalogue (filters, preview, CSV / XLSX / PDF). */
const TrialBalance = () => {
  const { t } = useTranslation();
  return <ReportScreen code="trial-balance" group={t("reports.financialReports")} />;
};

export default TrialBalance;
