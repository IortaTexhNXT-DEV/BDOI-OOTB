import React, { useEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import endorsementService from "../../../services/endorsementService";

const PaymentConfirmationEmployeeBenefit = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const { endorsementId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const toast = useRef(null);

  const [endorsementData, setEndorsementData] = useState(
    state?.endorsementData || null
  );
  // For employee-benefit flow (no endorsementId), we don't need to load endorsement data
  const [loading, setLoading] = useState(
    !state?.endorsementData && !!endorsementId
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoPaymentProcessing, setAutoPaymentProcessing] = useState(false);

  const clientName = state?.clientName || state?.ClientName || t("endorsement.client");
  const clientId = state?.clientId;
  const clientNumber = state?.clientNumber;

  const policyId = state?.policyId || endorsementData?.policyId;

  // Check multiple conditions for cancellation detection
  const endorsementStatus =
    endorsementData?.status || endorsementData?.summary?.status;
  const endorsementTypeIds =
    endorsementData?.summary?.endorsementTypeIds ||
    endorsementData?.endorsementTypeIds ||
    [];
  const isCancelled =
    endorsementStatus === "Cancelled" ||
    endorsementStatus === "InitiateCancel" ||
    endorsementTypeIds.includes(5) ||
    endorsementData?.isCancelPolicy === true;

  // Fetch endorsement data if not in state
  useEffect(() => {
    // If no endorsementId, this is employee-benefit flow - no need to load
    if (!endorsementId) {
      setLoading(false);
      return;
    }

    // Only fetch if we have endorsementId and no endorsementData
    if (!endorsementData && endorsementId) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const response = await endorsementService.getEndorsementById(
            endorsementId
          );
          if (response.success) {
            setEndorsementData(response.data);
          } else {
            alert(t("endorsement.failedToLoadEndorsement") + ": " + response.error);
          }
        } catch (error) {
          console.error("Error fetching endorsement:", error);
          alert("Error loading endorsement data");
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    } else if (endorsementData) {
      // If we already have endorsementData, no need to load
      setLoading(false);
    }
  }, [endorsementId, endorsementData]);

  // Auto-payment logic - Auto-trigger for employee-benefit flow
  useEffect(() => {
    const fromEndorsementDetail = state?.fromEndorsementDetail;
    const fromPolicyDetail = state?.fromPolicyDetail;
    const shouldAutoComplete =
      !autoPaymentProcessing &&
      (fromEndorsementDetail || fromPolicyDetail || !endorsementId);

    if (shouldAutoComplete) {
      setAutoPaymentProcessing(true);

      toast.current?.show({
        severity: "info",
        summary: t("endorsement.paymentConfirmation.processingMockPayment"),
        detail: t("endorsement.paymentConfirmation.simulatingPayment"),
        life: 2000,
      });

      setTimeout(() => {
        handlePaymentConfirmation();
      }, 2500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = () => {
    navigate(-1);
  };

  // Mock payment simulation helper
  const simulateDelay = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  const handlePaymentConfirmation = async () => {
    setIsProcessing(true);

    try {
      // Simulate payment processing delay
      await simulateDelay(1500);

      const targetPolicyId =
        policyId ||
        endorsementData?.policyId ||
        state?.policyId ||
        "MOCK-POLICY-001";

      console.log("🎭 Mock Payment Processing:", {
        policyId: targetPolicyId,
        grossPremium: grossPremium,
        isCancelled: isCancelled,
      });

      // Mock payment status update - simulate success
      const mockPaymentResult = {
        success: true,
        message: "Payment processed successfully",
        paymentStatus: isCancelled ? "Refunded" : "Completed",
        paymentMethod: "Direct Debit",
      };

      if (mockPaymentResult.success) {
        // Mock receipt creation (non-blocking)
        if (!isCancelled) {
          console.log("🎭 Mock Receipt Creation:", {
            receiptNumber: `RCP-${new Date().getDate()}${
              new Date().getMonth() + 1
            }-${endorsementData?.endorsementNumber || "EMP-001"}`,
            amount: grossPremium,
          });
          // Simulate receipt creation delay
          await simulateDelay(500);
        }

        // Mock accounting entries creation
        const absGrossPremium = Math.abs(grossPremium);
        const absNetPremium = Math.abs(netPremium);
        const absVat = Math.abs(vat);
        const absDst = Math.abs(dst);
        const absLgt = Math.abs(lgt);
        const absOthers = Math.abs(others);
        const absDiscount = Math.abs(discount);

        console.log("🎭 Mock Accounting Entry Creation:", {
          grossPremium: absGrossPremium,
          netPremium: absNetPremium,
          valueAddedTax: absVat,
          documentaryStampTax: absDst,
          localGovernmentTax: absLgt,
          accountPremiumOthers: absOthers,
          discount: absDiscount,
        });

        // Simulate accounting entry creation delay
        await simulateDelay(500);

        // Mock invoice list creation for cancellations
        if (isCancelled) {
          console.log("🎭 Mock Invoice List Creation for Cancellation:", {
            customerCode: clientNumber || state?.clientNumber || "CLIENT-001",
            refundAmount: grossPremium,
          });
          await simulateDelay(300);
        }

        toast.current?.show({
          severity: "success",
          summary: t("endorsement.paymentConfirmation.paymentSuccessful"),
          detail: isCancelled
            ? t("endorsement.paymentConfirmation.refundProcessedSuccess")
            : t("endorsement.paymentConfirmation.endorsementPaymentProcessedSuccess"),
          life: 3000,
        });

        // Navigate after success
        setTimeout(() => {
          navigate(`/agent/clientlisting`, {
            state: {
              paymentComplete: true,
              endorsementId: endorsementId || undefined,
              fromEndorsementPayment: !!endorsementId,
              fromEmployeeBenefit: true,
            },
          });
        }, 2000);
      } else {
        throw new Error(mockPaymentResult.error || "Payment failed");
      }
    } catch (error) {
      console.error("Mock Payment error:", error);
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

  const handleProceedToPaymentOptions = () => {
    handlePaymentConfirmation();
  };

  const headerTitle = useMemo(() => {
    return `${clientName} / ${t("endorsement.clientId")} : ${clientNumber}`;
  }, [clientName, clientNumber, t]);

  // Helper function to safely parse number from string with commas
  const parseAmount = (value) => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    // Remove commas and parse
    const cleanValue = String(value).replace(/,/g, "");
    return parseFloat(cleanValue) || 0;
  };

  // Calculate premium breakdown from endorsementData or state
  // Try multiple possible data sources (API returns different structures)
  const coverageChanges =
    endorsementData?.coverageChanges ||
    endorsementData?.summary?.coverageChanges ||
    {};

  // For cancellations, premiumDelta is negative, but we need absolute value for calculations
  const premiumDelta = parseAmount(endorsementData?.premiumDelta || 0);
  const isNegativeDelta = premiumDelta < 0;

  // Get grossPremium from state (employee-benefit flow) or coverageChanges or calculate from premiumDelta
  let grossPremium = parseAmount(
    state?.grossPremium ||
      coverageChanges.Grosspremium ||
      coverageChanges.grossPremium ||
      (isNegativeDelta ? Math.abs(premiumDelta) : premiumDelta) ||
      0
  );

  // For cancellations, ensure we use absolute value
  if (isCancelled && isNegativeDelta && grossPremium === 0) {
    grossPremium = Math.abs(premiumDelta);
  }

  // Use state values if available (employee-benefit flow), otherwise calculate from coverageChanges
  const netPremium = parseAmount(
    state?.netPremium ||
      coverageChanges.NETpremium ||
      coverageChanges.netPremium ||
      (grossPremium > 0 ? grossPremium * 0.85 : 0)
  );

  const dst = parseAmount(
    state?.documentaryStampTax ||
      coverageChanges.DocumentaryStampTax ||
      coverageChanges.documentaryStampTax ||
      (grossPremium > 0 ? grossPremium * 0.05 : 0)
  );

  const vat = parseAmount(
    state?.valueAddedTax ||
      coverageChanges.ValueAddedTax ||
      coverageChanges.valueAddedTax ||
      (grossPremium > 0 ? grossPremium * 0.05 : 0)
  );

  const lgt = parseAmount(
    state?.localGovernmentTax ||
      coverageChanges.LocalGovtTax ||
      coverageChanges.localGovtTax ||
      coverageChanges.localGovernmentTax ||
      (grossPremium > 0 ? grossPremium * 0.03 : 0)
  );

  const others = parseAmount(
    state?.accountPremiumOthers ||
      coverageChanges.OthersPremium ||
      coverageChanges.others ||
      coverageChanges.accountPremiumOthers ||
      (grossPremium > 0 ? grossPremium * 0.02 : 0)
  );

  const discount = parseAmount(
    state?.discount || coverageChanges.Discount || coverageChanges.discount || 0
  );

  if (loading) {
    return (
      <div className="overall__endorsement__payment__confirmation">
        <Card className="mt-4">
          <div className="p-4 text-center">{t("endorsement.paymentConfirmation.loadingPaymentDetails")}</div>
        </Card>
      </div>
    );
  }

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
          {isCancelled
            ? t("endorsement.paymentConfirmation.refundPaymentConfirmation")
            : t("endorsement.paymentConfirmation.endorsementPaymentConfirmation")}
        </div>
        <div className="sub__title__header mt-3">
          <label className="sub__title">
            {isCancelled ? t("endorsement.paymentConfirmation.refundDetails") : t("endorsement.paymentConfirmation.paymentDetails")}
          </label>
          <label
            className={`waiting__payment ${
              isCancelled ? "waiting__refund" : ""
            }`}
          >
            {isCancelled ? t("endorsement.paymentConfirmation.waitingForRefund") : t("endorsement.paymentConfirmation.waitingForPayment")}
          </label>
        </div>
        {isCancelled && (
          <div className="refund__info mt-4">
            <div className="refund__badge">{t("endorsement.paymentConfirmation.refundInProgress")}</div>
            <p className="refund__message mt-2">
              {t("endorsement.paymentConfirmation.refundMessage")}
            </p>
            <ul className="refund__list mt-3">
              <li>{t("endorsement.paymentConfirmation.refundNotify")}</li>
              <li>{t("endorsement.paymentConfirmation.refundContactSupport")}</li>
            </ul>
          </div>
        )}

        <div className="premium__summary">
          <div className="premium__header mt-3">
            <label className="net__premium">{t("endorsement.paymentConfirmation.netPremium")}</label>
            <label className="premium__id">
              {formatCurrency(netPremium)}
            </label>
          </div>
          <div className="premium__header mt-3">
            <label className="net__premium">{t("endorsement.paymentConfirmation.dst")}</label>
            <label className="premium__id">{formatCurrency(dst)}</label>
          </div>
          <div className="premium__header mt-3">
            <label className="net__premium">{t("endorsement.paymentConfirmation.vat")}</label>
            <label className="premium__id">{formatCurrency(vat)}</label>
          </div>
          <div className="premium__header mt-3">
            <label className="net__premium">{t("endorsement.paymentConfirmation.lgt")}</label>
            <label className="premium__id">{formatCurrency(lgt)}</label>
          </div>
          <div className="premium__header mt-3">
            <label className="net__premium">{t("endorsement.paymentConfirmation.others")}</label>
            <label className="premium__id">{formatCurrency(others)}</label>
          </div>
          <div className="premium__header mt-3">
            <label className="net__premium">{t("endorsement.paymentConfirmation.discount")}</label>
            <label className="premium__id">
              - {formatCurrency(discount)}
            </label>
          </div>
        </div>

        <hr className="one_line_divider mt-5" />

        <div className="premium__header mt-5">
          <label className="gross__premium">{t("endorsement.paymentConfirmation.grossPremium")}</label>
          <label className="gross__id">{formatCurrency(grossPremium)}</label>
        </div>

        <div className="button_component">
          <Button
            label={t("endorsement.paymentConfirmation.cancel")}
            severity="help"
            text
            className="download_button"
            onClick={handleBack}
            disabled={isProcessing}
          />
          <Button
            label={
              isProcessing
                ? t("endorsement.paymentConfirmation.processing")
                : isCancelled
                ? t("endorsement.paymentConfirmation.confirmRefund")
                : t("endorsement.paymentConfirmation.proceedToPayment")
            }
            className="policy__button"
            onClick={handleProceedToPaymentOptions}
            disabled={isProcessing}
            loading={isProcessing}
          />
        </div>
      </Card>
    </div>
  );
};

export default PaymentConfirmationEmployeeBenefit;
