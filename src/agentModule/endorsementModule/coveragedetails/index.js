import React from "react";
import { useTranslation } from "react-i18next";

const CoverageDetails = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("endorsement.coverageDetails")}
    </div>
  );
};

export default CoverageDetails
