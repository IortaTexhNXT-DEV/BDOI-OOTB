import React from "react";
import { useTranslation } from "react-i18next";
import ReportScreen from "../../ReportScreen";

/** Reports > OperationalReports > BrokerCommission: the commission-statement report of the catalogue (filters, preview, CSV / XLSX / PDF). */
const BrokerCommission = () => {
  const { t } = useTranslation();
  return <ReportScreen code="commission-statement" group={t("reports.operationalReports")} />;
};

export default BrokerCommission;
