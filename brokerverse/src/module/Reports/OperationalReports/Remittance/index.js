import React from "react";
import { useTranslation } from "react-i18next";
import ReportScreen from "../../ReportScreen";

/** Reports > OperationalReports > Remittance: the remittance-summary report of the catalogue (filters, preview, CSV / XLSX / PDF). */
const Remittance = () => {
  const { t } = useTranslation();
  return <ReportScreen code="remittance-summary" group={t("reports.operationalReports")} />;
};

export default Remittance;
