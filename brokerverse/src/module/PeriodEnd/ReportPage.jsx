import React from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import ReportScreen from "../Reports/ReportScreen";

/**
 * Catalogue report opened from the Accounts > Tax menu (VAT summary, SAWT, QAP, SLSP) or Reports > Financial Reports
 * (income statement, balance sheet, trial balance with opening / movement / closing, GL detail, aged payables,
 * month-end close status): the generic report screen (filters, preview, CSV / Excel / PDF).
 */
const ReportPage = ({ area = "financial" }) => {
  const { t } = useTranslation();
  const { code } = useParams();
  return <ReportScreen code={code} group={area === "tax" ? t("periodEnd.tax") : t("reports.financialReports")} />;
};

export default ReportPage;
