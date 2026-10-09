import React, { useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { Message } from "primereact/message";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import endorsementService from "../../../services/endorsementService";
import policyService from "../../../services/policyService";
import disbursementService from "../../../services/disbursementService";
import { getUserData } from "../../../utility/tokenManager";
import PolicyPaymentCapture from "../../../components/PolicyPaymentCapture";

/**
 * Endorsement payment (Endorsement > Payment).
 *
 * Replaces the former auto-proceed mock that marked the policy paid (PATCH /policies/:id/payment-status), raised an
 * official receipt and posted payment entries from the agent's browser. The additional premium of a completed
 * endorsement is billed (the endorsement's bill, receivableId); the client's payment is recorded against that bill as
 * pending with the same capture panel as the policy payment (POST /policies/:id/payments), and finance verifies it,
 * which raises the official receipt. A return premium (cancellation / negative change) is refunded by finance: this
 * screen only records the refund due for finance (Disbursements).
 */
const PaymentConfirmation = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const { endorsementId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const toast = useRef(null);

  const [endorsementData, setEndorsementData] = useState(state?.endorsementData || null);
  const [loading, setLoading] = useState(!state?.endorsementData);
  const [loaded, setLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refundRecorded, setRefundRecorded] = useState(false);

  const clientName = state?.clientName || state?.ClientName || t("endorsement.client");
  const clientNumber = state?.clientNumber;
  const policyId = endorsementData?.policyId || state?.policyId;

  const endorsementStatus = endorsementData?.status || endorsementData?.summary?.status;
  const endorsementTypeIds = endorsementData?.summary?.endorsementTypeIds || endorsementData?.endorsementTypeIds || [];
  const isCancelled =
    endorsementStatus === "Cancelled" ||
    endorsementStatus === "InitiateCancel" ||
    endorsementTypeIds.includes(5) ||
    endorsementData?.isCancelPolicy === true;

  // Always read the endorsement from the server: the bill (receivableId) exists only once it is completed.
  useEffect(() => {
    if (!endorsementId) {
      setLoading(false);
      return;
    }
    let active = true;
    endorsementService
      .getEndorsementById(endorsementId)
      .then((response) => {
        if (!active) return;
        if (response.success) {
          setEndorsementData(response.data?.data || response.data);
        } else {
          toast.current?.show({
            severity: "error",
            summary: t("endorsement.failedToLoadEndorsement"),
            detail: t("endorsement.paymentConfirmation.failedToLoadEndorsementWithError", { error: response.error }),
            life: 5000,
          });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endorsementId]);

  const handleBack = () => navigate(-1);
  const goToClients = () =>
    navigate(`/agent/clientlisting`, { state: { endorsementId, fromEndorsementPayment: true } });

  const parseAmount = (value) => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    return parseFloat(String(value).replace(/,/g, "")) || 0;
  };

  const coverageChanges = endorsementData?.coverageChanges || endorsementData?.summary?.coverageChanges || {};
  const premiumDelta = parseAmount(endorsementData?.premiumDelta || 0);
  const isRefund = isCancelled || premiumDelta < 0;
  const grossPremium = Math.abs(parseAmount(coverageChanges.Grosspremium || coverageChanges.grossPremium || premiumDelta || 0));
  const netPremium = parseAmount(coverageChanges.NETpremium || coverageChanges.netPremium || 0);
  const dst = parseAmount(coverageChanges.DocumentaryStampTax || coverageChanges.documentaryStampTax || 0);
  const vat = parseAmount(coverageChanges.ValueAddedTax || coverageChanges.valueAddedTax || 0);
  const lgt = parseAmount(coverageChanges.LocalGovtTax || coverageChanges.localGovtTax || coverageChanges.localGovernmentTax || 0);
  const others = parseAmount(coverageChanges.OthersPremium || coverageChanges.others || coverageChanges.accountPremiumOthers || 0);
  const discount = parseAmount(coverageChanges.Discount || coverageChanges.discount || 0);

  const receivableId = endorsementData?.receivableId || null;
  const isCompleted = ["Completed", "Cancelled"].includes(endorsementStatus);

  /** Return premium: record the refund due for finance (Disbursements); nothing is paid from this screen. */
  const handleRecordRefund = async () => {
    setIsProcessing(true);
    try {
      let policyData = null;
      try {
        const policyResponse = await policyService.getPolicyDetails(policyId);
        policyData = policyResponse?.data || policyResponse;
      } catch (err) {
        policyData = null;
      }
      const customerCode = policyData?.client?.clientId || policyData?.client?.clientCode || clientNumber || policyData?.clientId;
      if (!customerCode) throw new Error(t("endorsement.paymentConfirmation.invoiceListSkippedCustomerCodeNotFound"));
      const amount = Math.abs(premiumDelta) || grossPremium;
      const result = await disbursementService.createInvoiceList({
        customerCode,
        payables: amount.toFixed(2),
        outstanding: "0.00",
        fcAmount: "0.00",
        lcAmount: amount.toFixed(2),
        excess: "0.00",
        balAmount: amount.toFixed(2),
        vat: vat.toFixed(2),
        wht: "0.00",
        totalAmount: amount.toFixed(2),
        bankAmount: amount.toFixed(2),
        isInvoicePaid: false,
        createdBy: getUserData()?.id,
      });
      if (!result?.success) throw new Error(result?.error || t("endorsement.paymentConfirmation.invoiceListCreationFailed"));
      setRefundRecorded(true);
      toast.current?.show({
        severity: "success",
        summary: t("endorsement.paymentConfirmation.refundRecorded", "Refund recorded"),
        detail: t("endorsement.paymentConfirmation.refundRecordedDetail", "Finance will release the refund to the client."),
        life: 3000,
      });
      setTimeout(goToClients, 2000);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("endorsement.paymentConfirmation.paymentFailed"),
        detail: error.message || t("endorsement.paymentConfirmation.failedToProcessPayment"),
        life: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const headerTitle = useMemo(() => `${clientName} / Client ID : ${clientNumber || endorsementData?.clientCode || ""}`, [clientName, clientNumber, endorsementData]);

  if (loading) {
    return (
      <div className="overall__endorsement__payment__confirmation">
        <Card className="mt-4">
          <div className="p-4 text-center">{t("endorsement.paymentConfirmation.loadingPaymentDetails")}</div>
        </Card>
      </div>
    );
  }

  const row = (label, value) => (
    <div className="premium__header mt-3">
      <label className="net__premium">{label}</label>
      <label className="premium__id">{value}</label>
    </div>
  );

  return (
    <div className="overall__endorsement__payment__confirmation">
      <Toast ref={toast} />
      <div className="header__title">{t("endorsement.clients")}</div>
      <div className="left__arrow mt-3 cursor-pointer" onClick={handleBack}>
        <SvgLeftArrow />
        <div className="left__arrow__text">{headerTitle}</div>
      </div>
      <Card className="mt-4">
        <div className="table__header">
          {t("endorsement.endorsementTitle")}{" "}
          {isRefund
            ? t("endorsement.paymentConfirmation.refundPaymentConfirmation")
            : t("endorsement.paymentConfirmation.endorsementPaymentConfirmation")}
        </div>
        <div className="sub__title__header mt-3">
          <label className="sub__title">
            {isRefund ? t("endorsement.paymentConfirmation.refundDetails") : t("endorsement.paymentConfirmation.paymentDetails")}
          </label>
          <label className={`waiting__payment ${isRefund ? "waiting__refund" : ""}`}>
            {endorsementData?.endorsementNumber ? `${endorsementData.endorsementNumber} · ` : ""}
            {isRefund ? t("endorsement.paymentConfirmation.waitingForRefund") : t("endorsement.paymentConfirmation.waitingForPayment")}
          </label>
        </div>

        <div className="premium__summary">
          {row(t("endorsement.paymentConfirmation.netPremium"), formatCurrency(netPremium))}
          {row(t("endorsement.paymentConfirmation.dst"), formatCurrency(dst))}
          {row(t("endorsement.paymentConfirmation.vat"), formatCurrency(vat))}
          {row(t("endorsement.paymentConfirmation.lgt"), formatCurrency(lgt))}
          {row(t("endorsement.paymentConfirmation.others"), formatCurrency(others))}
          {row(t("endorsement.paymentConfirmation.discount"), `- ${formatCurrency(discount)}`)}
        </div>

        <hr className="one_line_divider mt-5" />

        <div className="premium__header mt-5">
          <label className="gross__premium">
            {isRefund
              ? t("endorsement.paymentConfirmation.returnPremium", "Return premium")
              : t("endorsement.paymentConfirmation.additionalPremium", "Additional premium")}
          </label>
          <label className="gross__id">{formatCurrency(Math.abs(premiumDelta) || grossPremium)}</label>
        </div>

        {isRefund && (
          <>
            <Message
              severity="info"
              className="w-full justify-content-start mt-4"
              text={t(
                "endorsement.paymentConfirmation.refundByFinance",
                "The return premium is refunded to the client by finance (Disbursements). Record the refund due; finance releases it after approval."
              )}
            />
            <div className="button_component">
              <Button label={t("endorsement.paymentConfirmation.cancel")} text className="download_button" onClick={handleBack} disabled={isProcessing} />
              <Button
                label={isProcessing ? t("endorsement.paymentConfirmation.processing") : t("endorsement.paymentConfirmation.confirmRefund")}
                className="policy__button"
                onClick={handleRecordRefund}
                disabled={isProcessing || refundRecorded || !policyId}
                loading={isProcessing}
              />
            </div>
          </>
        )}

        {!isRefund && loaded && !receivableId && (
          <Message
            severity="info"
            className="w-full justify-content-start mt-4"
            text={
              premiumDelta === 0
                ? t("endorsement.paymentConfirmation.noPremiumChange", "This endorsement has no premium change: there is nothing to pay.")
                : !isCompleted
                  ? t(
                      "endorsement.paymentConfirmation.billedOnCompletion",
                      "The additional premium is billed when the endorsement is completed (insurer endorsement uploaded). Record the client's payment after that."
                    )
                  : t(
                      "endorsement.paymentConfirmation.noBrokerBill",
                      "No premium bill was raised for this endorsement (direct bill: the client pays the insurer directly)."
                    )
            }
          />
        )}
      </Card>

      {!isRefund && receivableId && policyId && (
        <PolicyPaymentCapture policyId={policyId} receivableId={receivableId} onPayLater={goToClients} onCancel={handleBack} />
      )}
    </div>
  );
};

export default PaymentConfirmation;
