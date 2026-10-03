import React from "react";
import { useTranslation } from "react-i18next";
import ReportScreen from "../../ReportScreen";

/** Reports > OperationalReports > Production: the production-register report of the catalogue (filters, preview, CSV / XLSX / PDF). */
const Production = () => {
  const { t } = useTranslation();
  return <ReportScreen code="production-register" group={t("reports.operationalReports")} />;
};

export default Production;
