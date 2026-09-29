import React from "react";
import { useTranslation } from "react-i18next";
import ReportScreen from "../../ReportScreen";

/** Reports > Financial Reports > Due to Insurers by Co-insurer: the due-to-insurers-by-coinsurer report of the catalogue. */
const DueToInsurers = () => {
  const { t } = useTranslation();
  return <ReportScreen code="due-to-insurers-by-coinsurer" group={t("reports.financialReports")} />;
};

export default DueToInsurers;
