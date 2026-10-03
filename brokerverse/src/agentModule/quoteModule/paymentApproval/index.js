import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import "./index.scss";
import { Button } from "primereact/button";
import StatusIllustration from "../../component/StatusIllustration";

const PaymentApproval = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id: policyId } = useParams();

  const { policydetailedlist } = useSelector(
    ({ policyDetailedViewMainReducers }) => ({
      policydetailedlist: policyDetailedViewMainReducers?.policydetailedlist,
    })
  );

  const clientName =
    state?.ClientName ||
    state?.clientName ||
    policydetailedlist?.ClientName ||
    policydetailedlist?.clientName;
  const clientId =
    state?.ClientId ||
    state?.clientId ||
    policydetailedlist?.ClientId ||
    policydetailedlist?.clientId;
  const policyNumber =
    state?.policyNumber ||
    state?.PolicyNumber ||
    policydetailedlist?.policyNumber ||
    policyId;
  const grossPremium =
    state?.GrossPremium ||
    policydetailedlist?.GrossPremium ||
    policydetailedlist?.quotation?.participantDetails
      ?.reduce((sum, participant) => {
        const premium = parseFloat(
          participant.premiumCurrency?.replace(/[^0-9.-]/g, "") || 0
        );
        return sum + premium;
      }, 0)
      .toFixed(2) ||
    "0.00";

  const displayTitle = useMemo(() => {
    const parts = [];

    if (clientName) {
      parts.push(clientName);
    }
    if (clientId) {
      parts.push(`${t("agent.clientIdLabel")} ${clientId}`);
    }

    return parts.join(" / ") || t("agent.paymentApproval");
  }, [clientName, clientId, t]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleNavigateToPolicyList = () => {
    navigate("/agent/policy/policytable");
  };

  return (
    <div className="paymentapproval__status__container">
      <div className="claim__request__upload__main__title">{t("agent.clients")}</div>
      <div
        onClick={handleBack}
        className="claim__request__upload__back__btn mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="claim__request__upload__back__btn__title">
          {displayTitle}
        </div>
      </div>
      <Card className="mt-4 paymentapproval__status__main__content">
        <div className="grid m-0 overall__container">
          <div>
            <div className="flex justify-content-center">
              <StatusIllustration variant="search" />
            </div>
            <div className="col-12 p-0 paymentapproval__status__main__content__text">
              {t("agent.paymentProcessedForPolicy", { policyNumber: policyNumber || "-" })}
              <br /> {t("agent.waitForPaymentConfirmation")}
              <br /> {t("agent.grossPremiumLabel")} {grossPremium}
            </div>
          </div>

          <div className="back__next__btn__container">
            <div className="next__btn__container">
              <Button
                className="next__btn"
                onClick={handleNavigateToPolicyList}
              >
                {t("agent.goToPolicyList")}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PaymentApproval;
