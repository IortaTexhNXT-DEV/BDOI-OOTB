import React from "react";
import { useTranslation } from "react-i18next";
import ReportScreen from "../../ReportScreen";

/** Reports > Financial Reports > Co-insurance Register: the coinsurance-register report of the catalogue. */
const CoInsuranceRegister = () => {
  const { t } = useTranslation();
  return <ReportScreen code="coinsurance-register" group={t("reports.financialReports")} />;
};

export default CoInsuranceRegister;
