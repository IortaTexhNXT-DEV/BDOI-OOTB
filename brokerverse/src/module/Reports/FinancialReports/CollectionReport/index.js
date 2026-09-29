import React from "react";
import { useTranslation } from "react-i18next";
import ReportScreen from "../../ReportScreen";

/** Reports > FinancialReports > CollectionReport: the collections-summary report of the catalogue (filters, preview, CSV / XLSX / PDF). */
const CollectionReport = () => {
  const { t } = useTranslation();
  return <ReportScreen code="collections-summary" group={t("reports.financialReports")} />;
};

export default CollectionReport;
