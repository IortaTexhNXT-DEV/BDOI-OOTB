import React from "react";
import { useTranslation } from "react-i18next";
import ReportScreen from "../../ReportScreen";

/** Reports > OperationalReports > Claims: the claims-position report of the catalogue (filters, preview, CSV / XLSX / PDF). */
const Claims = () => {
  const { t } = useTranslation();
  return <ReportScreen code="claims-position" group={t("reports.operationalReports")} />;
};

export default Claims;
