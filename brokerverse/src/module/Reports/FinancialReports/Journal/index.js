import React from "react";
import { useTranslation } from "react-i18next";
import ReportScreen from "../../ReportScreen";

/** Reports > FinancialReports > Journal: the journal-register report of the catalogue (filters, preview, CSV / XLSX / PDF). */
const Journal = () => {
  const { t } = useTranslation();
  return <ReportScreen code="journal-register" group={t("reports.financialReports")} />;
};

export default Journal;
