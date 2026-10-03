import React from "react";
import { useTranslation } from "react-i18next";
import ReportScreen from "../../ReportScreen";

/** Reports > FinancialReports > Payables: the disbursement-register report of the catalogue (filters, preview, CSV / XLSX / PDF). */
const Payables = () => {
  const { t } = useTranslation();
  return <ReportScreen code="disbursement-register" group={t("reports.financialReports")} />;
};

export default Payables;
