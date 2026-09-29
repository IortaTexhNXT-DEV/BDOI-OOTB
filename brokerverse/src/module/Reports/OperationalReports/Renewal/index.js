import React from "react";
import { useTranslation } from "react-i18next";
import ReportScreen from "../../ReportScreen";

/** Reports > OperationalReports > Renewal: the renewal-retention report of the catalogue (filters, preview, CSV / XLSX / PDF). */
const Renewal = () => {
  const { t } = useTranslation();
  return <ReportScreen code="renewal-retention" group={t("reports.operationalReports")} />;
};

export default Renewal;
