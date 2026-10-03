import React from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";

/** Keep only filled values, so the request carries what was actually entered. */
const filled = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== ""));

/**
 * Opens a new Request for Quotation (broker slip) for a risk captured on another screen (the Fire and IAR quote
 * cards), so the same prospect and risk go to the insurers instead of being priced from the tariff.
 * prefill: { leadRefId, leadName, productType, riskDetails, requestedCovers: [{ cover, sumInsured }] }
 */
const RequestForQuotationButton = ({ prefill, disabled, className }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = () =>
    navigate("/placement/broker-slips/new", {
      state: {
        prefill: {
          ...prefill,
          riskDetails: filled(prefill?.riskDetails),
          requestedCovers: (prefill?.requestedCovers || []).filter((c) => c.cover && Number(c.sumInsured) > 0),
        },
      },
    });
  return (
    <Button
      label={t("salesMarketing.requestQuotes")}
      tooltip={t("salesMarketing.requestQuotesHint")}
      tooltipOptions={{ position: "top" }}
      icon="pi pi-send"
      outlined
      className={className}
      disabled={disabled}
      onClick={open}
    />
  );
};

export default RequestForQuotationButton;
