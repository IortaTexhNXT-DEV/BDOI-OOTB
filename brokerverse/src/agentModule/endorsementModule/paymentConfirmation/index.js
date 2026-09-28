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
import policyService from "../../../services/policyService";
import { receiptsService } from "../../../services/receiptsService";
import collectionService from "../../../services/collectionService";
import accountingService from "../../../services/accountingService";
import disbursementService from "../../../services/disbursementService";
import { getUserData } from "../../../utility/tokenManager";

const PaymentConfirmation = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const { endorsementId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const toast = useRef(null);

  const [endorsementData, setEndorsementData] = useState(
    state?.endorsementData || null
  );
  const [loading, setLoading] = useState(!state?.endorsementData);
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
            toast.current?.show({
              severity: "error",
              summary: t("endorsement.failedToLoadEndorsement"),
              detail: t("endorsement.paymentConfirmation.failedToLoadEndorsementWithError", { error: response.error }),
              life: 5000,
            });
          }
        } catch (error) {
          console.error("Error fetching endorsement:", error);
          toast.current?.show({
            severity: "error",
            summary: t("endorsement.failedToLoadEndorsement"),
            detail: t("endorsement.errorLoadingEndorsement"),
            life: 5000,
          });
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [endorsementId, endorsementData]);

  // Auto-payment logic
  useEffect(() => {
    const fromEndorsementDetail = state?.fromEndorsementDetail;
    const shouldAutoComplete = !autoPaymentProcessing && fromEndorsementDetail;

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
  }, []);

  const handleBack = () => {
    navigate(-1);
  };

  const handlePaymentConfirmation = async () => {
    setIsProcessing(true);
    let policyData = null;
    try {
      const targetPolicyId = policyId || endorsementData?.policyId;

      if (!targetPolicyId) {
        throw new Error("Policy ID missing");
      }

      // Update payment status
      const result = await policyService.updatePaymentStatus(targetPolicyId, {
        paymentStatus: isCancelled ? "Refunded" : "Completed",
        paymentMethod: "Direct Debit",
      });

      if (result.success) {
        const currentUser = getUserData();

        try {
          const policyResponse = await policyService.getPolicyById(
            targetPolicyId
          );
          policyData = policyResponse?.data || policyResponse;
        } catch (err) {
          console.warn("Could not fetch policy data for receipt:", err);
        }

        if (!isCancelled) {
          // Create receipt for endorsement payment
          try {
            const receiptData = {
              receiptType: "Payment",
              receiptDate: new Date().toISOString(),
              customerCode: clientNumber || "N/A",
              currencyCode: "PHP",
              transactionCode: "ENDORSEMENT_PAYMENT",
              remarks: `Endorsement payment receipt for policy ${policyData?.policyNumber || targetPolicyId
                }`,
              policyRefId: targetPolicyId,
              createdBy: currentUser?.id,
              receiptNumber:
                "RCP-" +
                new Date().getDate() +
                new Date().getMonth() +
                1 +
                "-" +
                endorsementData?.endorsementNumber,
              receiptStatus: "Converted",
              receiptsList: [
                {
                  policies: policyData?.policyNumber || "N/A",
                  netPremium: netPremium.toFixed(2),
                  paid: grossPremium.toFixed(2),
                  unPaid: "0.00",
                  discounts: discount.toFixed(2),
                  dst: dst.toFixed(2),
                  lgt: lgt.toFixed(2),
                  vat: vat.toFixed(2),
                  ewt: "0.00",
                  fcAmount: "0.00",
                  lcAmount: grossPremium.toFixed(2),
                  other: others.toFixed(2),
                  status: "Paid",
                },
              ],
            };

            const receiptResponse = await receiptsService.createReceipt(
              receiptData
            );

            // Sync collection from receipt (for tracking overdue payments)
            if (receiptResponse?.data?.id || receiptResponse?.data?.receiptId) {
              try {
                const receiptId =
                  receiptResponse.data.id || receiptResponse.data.receiptId;
                await collectionService.syncFromReceipt(receiptId);
              } catch (collectionError) {
                console.error(
                  "Collection sync failed (non-blocking):",
                  collectionError
                );
                // Don't fail endorsement payment if collection sync fails
              }
            }
          } catch (receiptError) {
            console.error("Failed to create receipt:", receiptError);
            // Note: Receipt creation is now non-blocking - continue with accounting
          }
        }

        // Create accounting entries for endorsement payment
        try {
          // Get the client's internal database ID from policy data
          // Priority: policyData.client.id (internal ID) > policyData.clientId (could be display ID) > clientId from state
          // Note: policyData.clientId might be display ID (CLIENT-xxx), so prefer policyData.client.id
          let internalClientId = null;

          // First try to get internal ID from nested client object
          if (policyData?.client?.id) {
            internalClientId = policyData.client.id;
          }
          // If policyData.clientId looks like an internal ID (UUID/cuid format), use it
          else if (
            policyData?.clientId &&
            policyData.clientId.length >= 20 &&
            !policyData.clientId.startsWith("CLIENT-")
          ) {
            internalClientId = policyData.clientId;
          }
          // Otherwise, try clientId from state (might be internal ID)
          else if (
            clientId &&
            clientId.length >= 20 &&
            !clientId.startsWith("CLIENT-")
          ) {
            internalClientId = clientId;
          }
          // Last resort: use policyData.clientId or clientId (backend will resolve display IDs)
          else {
            internalClientId = policyData?.clientId || clientId;
          }

          // Parse and validate amount
          const premiumAmount =
            parseFloat(String(grossPremium).replace(/[^0-9.-]/g, "")) || 0;

          if (!internalClientId) {
            console.warn(
              "⚠️ Client ID not found in policy data, skipping accounting entries"
            );
            toast.current?.show({
              severity: "warn",
              summary: t("endorsement.paymentConfirmation.accountingEntryWarning"),
              detail: t("endorsement.paymentConfirmation.accountingSkippedClientIdNotFound"),
              life: 4000,
            });
          } else if (
            !premiumAmount ||
            premiumAmount <= 0 ||
            isNaN(premiumAmount)
          ) {
            console.warn(
              "⚠️ Invalid premium amount, skipping accounting entries:",
              premiumAmount
            );
            toast.current?.show({
              severity: "warn",
              summary: t("endorsement.paymentConfirmation.accountingEntryWarning"),
              detail: t("endorsement.paymentConfirmation.accountingSkippedInvalidPremium"),
              life: 4000,
            });
          } else {
            // Validate accounting equation before creating entries
            const absGrossPremium = Math.abs(grossPremium);
            const absNetPremium = Math.abs(netPremium);
            const absVat = Math.abs(vat);
            const absDst = Math.abs(dst);
            const absLgt = Math.abs(lgt);
            const absOthers = Math.abs(others);
            const absDiscount = Math.abs(discount);

            // Correct accounting equation: grossPremium = netPremium + VAT + DST + LGT + Others - Discount
            const calculatedTotal =
              absNetPremium +
              absVat +
              absDst +
              absLgt +
              absOthers -
              absDiscount;
            const difference = Math.abs(absGrossPremium - calculatedTotal);

            if (difference > 0.01 && absGrossPremium > 0) {
              console.warn("⚠️ Accounting equation warning (Endorsement):", {
                grossPremium: absGrossPremium,
                netPremium: absNetPremium,
                valueAddedTax: absVat,
                documentaryStampTax: absDst,
                localGovernmentTax: absLgt,
                accountPremiumOthers: absOthers,
                discount: absDiscount,
                calculatedTotal,
                difference,
              });
            }

            const accountingData = {
              amount: Math.abs(premiumAmount), // Use absolute value for amount
              grossPremium: absGrossPremium, // Send grossPremium breakdown
              netPremium: absNetPremium, // Send netPremium breakdown
              valueAddedTax: absVat, // Send VAT breakdown
              documentaryStampTax: absDst, // Send DST breakdown
              localGovernmentTax: absLgt, // Send LGT breakdown
              accountPremiumOthers: absOthers, // Send Others breakdown
              discount: absDiscount, // Send Discount breakdown
              paymentDate: new Date().toISOString(),
              description: isCancelled
                ? `Cancellation refund for policy ${policyData?.policyNumber || targetPolicyId
                }`
                : `Endorsement payment for policy ${policyData?.policyNumber || targetPolicyId
                }`,
              referenceType: "Endorsement",
              referenceId: endorsementId,
              clientId: internalClientId, // Use internal database ID, not display ID
              policyId: targetPolicyId,
              policyNumber: policyData?.policyNumber,
              isDirectBilled: policyData?.isDirectBilled || false,
              cancellationType: isCancelled
                ? endorsementData?.coverageChanges?.cancellationType ||
                endorsementData?.cancellationType ||
                "PARTIAL"
                : undefined, // Pass cancellation type for cancellations
            };

            console.log("📊 Sending complete premium breakdown to accounting (Endorsement):", {
              grossPremium: accountingData.grossPremium,
              netPremium: accountingData.netPremium,
              valueAddedTax: accountingData.valueAddedTax,
              documentaryStampTax: accountingData.documentaryStampTax,
              localGovernmentTax: accountingData.localGovernmentTax,
              accountPremiumOthers: accountingData.accountPremiumOthers,
              discount: accountingData.discount,
            });

            console.log("Accounting Data to Send:", accountingData);
            await accountingService.createPaymentAccountingEntry(
              accountingData
            );
            console.log(
              "✅ Accounting entries created successfully for endorsement payment"
            );

            // For cancellations, also create invoice list entry
            if (isCancelled) {
              try {
                // Get client display ID (customerCode) from policy or state
                const customerCode =
                  policyData?.client?.clientId ||
                  clientNumber ||
                  policyData?.clientId;

                if (!customerCode) {
                  console.warn(
                    "⚠️ Customer code not found, skipping invoice list creation"
                  );
                  toast.current?.show({
                    severity: "warn",
                    summary: t("endorsement.paymentConfirmation.invoiceListWarning"),
                    detail: t("endorsement.paymentConfirmation.invoiceListSkippedCustomerCodeNotFound"),
                    life: 4000,
                  });
                } else {
                  // Map endorsement cancellation data to invoice list fields
                  const invoiceListData = {
                    customerCode: customerCode,
                    payables: grossPremium.toFixed(2), // Amount to be refunded
                    outstanding: "0.00", // Assuming full refund for cancellation
                    fcAmount: "0.00", // Foreign currency amount
                    lcAmount: grossPremium.toFixed(2), // Local currency amount
                    excess: "0.00",
                    balAmount: grossPremium.toFixed(2), // Balance amount
                    vat: vat.toFixed(2), // VAT amount
                    wht: "0.00", // Withholding tax (if applicable)
                    totalAmount: grossPremium.toFixed(2), // Total refund amount
                    bankCode: "BDO", // Default bank code, can be made configurable
                    bankAmount: grossPremium.toFixed(2), // Bank amount
                    isInvoicePaid: false, // Invoice not paid yet (refund pending)
                    createdBy: currentUser?.id,
                  };

                  console.log("Invoice List Data to Send:", invoiceListData);
                  const invoiceListResult =
                    await disbursementService.createInvoiceList(
                      invoiceListData
                    );

                  if (invoiceListResult.success) {
                    console.log(
                      "✅ Invoice list created successfully for cancellation"
                    );
                  } else {
                    throw new Error(
                      invoiceListResult.error || "Failed to create invoice list"
                    );
                  }
                }
              } catch (invoiceListError) {
                console.error(
                  "❌ Failed to create invoice list for cancellation:",
                  invoiceListError
                );
toast.current?.show({
                severity: "warn",
                summary: t("endorsement.paymentConfirmation.invoiceListWarning"),
                detail:
                  invoiceListError.message ||
                  t("endorsement.paymentConfirmation.invoiceListCreationFailed"),
                life: 5000,
              });
                // Don't fail cancellation flow if invoice list creation fails
              }
            }
          }
        } catch (accountingError) {
          console.error(
            "❌ Failed to create accounting entries:",
            accountingError
          );
          toast.current?.show({
            severity: "error",
            summary: "Accounting Entry Error",
            detail:
              accountingError.message ||
              "Payment processed but accounting entry creation failed",
            life: 5000,
          });
          // Don't fail payment flow
        }

        toast.current?.show({
          severity: "success",
          summary: "Payment Successful",
          detail: "Endorsement payment processed successfully!",
          life: 3000,
        });

        setTimeout(() => {
          navigate(`/agent/clientlisting`, {
            state: {
              paymentComplete: true,
              endorsementId,
              fromEndorsementPayment: true,
            },
          });
        }, 2000);
      } else {
        throw new Error(result.error || "Payment failed");
      }
    } catch (error) {
      console.error("Payment error:", error);
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
    return `${clientName} / Client ID : ${clientNumber}`;
  }, [clientName, clientNumber]);

  // Helper function to safely parse number from string with commas
  const parseAmount = (value) => {
    if (!value) return 0;
    if (typeof value === "number") return value;
    // Remove commas and parse
    const cleanValue = String(value).replace(/,/g, "");
    return parseFloat(cleanValue) || 0;
  };

  // Calculate premium breakdown from endorsementData
  // Try multiple possible data sources (API returns different structures)
  const coverageChanges =
    endorsementData?.coverageChanges ||
    endorsementData?.summary?.coverageChanges ||
    {};

  // For cancellations, premiumDelta is negative, but we need absolute value for calculations
  const premiumDelta = parseAmount(endorsementData?.premiumDelta || 0);
  const isNegativeDelta = premiumDelta < 0;

  // Get grossPremium from coverageChanges or calculate from premiumDelta
  let grossPremium = parseAmount(
    coverageChanges.Grosspremium ||
    coverageChanges.grossPremium ||
    (isNegativeDelta ? Math.abs(premiumDelta) : premiumDelta) ||
    0
  );

  // For cancellations, ensure we use absolute value
  if (isCancelled && isNegativeDelta && grossPremium === 0) {
    grossPremium = Math.abs(premiumDelta);
  }

  const netPremium = parseAmount(
    coverageChanges.NETpremium ||
    coverageChanges.netPremium ||
    (grossPremium > 0 ? grossPremium * 0.85 : 0)
  );

  const dst = parseAmount(
    coverageChanges.DocumentaryStampTax ||
    coverageChanges.documentaryStampTax ||
    (grossPremium > 0 ? grossPremium * 0.05 : 0)
  );

  const vat = parseAmount(
    coverageChanges.ValueAddedTax ||
    coverageChanges.valueAddedTax ||
    (grossPremium > 0 ? grossPremium * 0.05 : 0)
  );

  const lgt = parseAmount(
    coverageChanges.LocalGovtTax ||
    coverageChanges.localGovtTax ||
    coverageChanges.localGovernmentTax ||
    (grossPremium > 0 ? grossPremium * 0.03 : 0)
  );

  const others = parseAmount(
    coverageChanges.OthersPremium ||
    coverageChanges.others ||
    coverageChanges.accountPremiumOthers ||
    (grossPremium > 0 ? grossPremium * 0.02 : 0)
  );

  const discount = parseAmount(
    coverageChanges.Discount || coverageChanges.discount || 0
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
            className={`waiting__payment ${isCancelled ? "waiting__refund" : ""
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

export default PaymentConfirmation;
