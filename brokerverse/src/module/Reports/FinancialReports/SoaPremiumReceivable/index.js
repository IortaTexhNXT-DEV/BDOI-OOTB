import React from "react";
import { useTranslation } from "react-i18next";
import ReportScreen from "../../ReportScreen";

/** Reports > FinancialReports > SoaPremiumReceivable: the premium-receivable-soa report of the catalogue (filters, preview, CSV / XLSX / PDF). */
const SoaPremiumReceivable = () => {
  const { t } = useTranslation();
  return <ReportScreen code="premium-receivable-soa" group={t("reports.financialReports")} />;
};

export default SoaPremiumReceivable;
