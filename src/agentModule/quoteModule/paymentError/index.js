import React from "react";
import { useTranslation } from "react-i18next";

const PaymentError = () => {
  const { t } = useTranslation();
  return (
    <div>
      {t("agent.paymentError")}
    </div>
  );
};

export default PaymentError;
