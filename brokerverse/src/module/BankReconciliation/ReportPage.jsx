import React from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import ReportScreen from "../Reports/ReportScreen";

/**
 * Bank reconciliation reports from the catalogue (Bank Reconciliation Statement, Outstanding Cheques, Deposits in
 * Transit, Unmatched Bank Lines, Bank Book) on the generic report screen (filters, preview, CSV / Excel / PDF).
 */
const ReportPage = () => {
  const { t } = useTranslation();
  const { code } = useParams();
  return <ReportScreen code={code} group={t("bankReconciliation.menu")} />;
};

export default ReportPage;
