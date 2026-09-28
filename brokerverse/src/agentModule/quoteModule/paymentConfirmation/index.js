import React, { useMemo, useState, useRef, useEffect } from "react";
import "./index.scss";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import policyService from "../../../services/policyService";
import quotationService from "../../../services/quotationService";
import { receiptsService } from "../../../services/receiptsService";
import accountingService from "../../../services/accountingService";
import { getUserData } from "../../../utility/tokenManager";
import { buildPaymentCompletedReceiptData } from "../../../utility/receiptHelper";
import collectionService from "../../../services/collectionService";

const PaymentConfirmation = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { id: policyId } = useParams();
  const toast = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoPaymentProcessing, setAutoPaymentProcessing] = useState(false);

  const { policydetailedlist } = useSelector(
    ({ policyDetailedViewMainReducers }) => ({
      policydetailedlist: policyDetailedViewMainReducers?.policydetailedlist,
    })
  );

  const clientName =
    state?.clientName ||
    state?.ClientName ||
    state?.policy?.insuredName ||
    state?.policy?.ClientName ||
    state?.policyData?.insuredName ||
    policydetailedlist?.ClientName ||
    policydetailedlist?.clientName;

  const clientId =
    state?.clientId ||
    state?.ClientId ||
    state?.policy?.clientId ||
    state?.policyData?.clientId ||
    policydetailedlist?.ClientId ||
    policydetailedlist?.clientId;

  const policyNumber =
    state?.policyNumber ||
    state?.PolicyNumber ||
    state?.policy?.policyNumber ||
    state?.policyData?.policyNumber ||
    state?.policyDetails?.policyNumber ||
    policydetailedlist?.policyNumber ||
    state?.additionalPolicyData?.policyNumber;
  // DO NOT fallback to policyId!

  const grossPremium =
    state?.grossPremium ||
    state?.GrossPremium ||
    state?.policy?.grossPremium ||
    state?.policyData?.grossPremium ||
    policydetailedlist?.GrossPremium ||
    policydetailedlist?.grossPremium ||
    policydetailedlist?.quotation?.participantDetails
      ?.reduce((sum, participant) => {
        const premium = parseFloat(
          participant.premiumCurrency?.replace(/[^0-9.-]/g, "") || 0
        );
        return sum + premium;
      }, 0)
      .toFixed(2) ||
    "0.00";

  // Extract premium breakdown for display
  const netPremium =
    state?.policy?.netPremium ||
    state?.policyData?.netPremium ||
    policydetailedlist?.netPremium ||
    policydetailedlist?.quotation?.netPremium ||
    state?.netPremium ||
    "0.00";

  const documentaryStampTax =
    state?.policy?.documentaryStampTax ||
    state?.policyData?.documentaryStampTax ||
    policydetailedlist?.documentaryStampTax ||
    policydetailedlist?.quotation?.documentaryStampTax ||
    state?.documentaryStampTax ||
    "0.00";

  const valueAddedTax =
    state?.policy?.valueAddedTax ||
    state?.policyData?.valueAddedTax ||
    policydetailedlist?.valueAddedTax ||
    policydetailedlist?.quotation?.valueAddedTax ||
    state?.valueAddedTax ||
    "0.00";

  const localGovernmentTax =
    state?.policy?.localGovernmentTax ||
    state?.policyData?.localGovernmentTax ||
    policydetailedlist?.localGovernmentTax ||
    policydetailedlist?.quotation?.localGovernmentTax ||
    state?.localGovernmentTax ||
    "0.00";

  const accountPremiumOthers =
    state?.policy?.accountPremiumOthers ||
    state?.policyData?.accountPremiumOthers ||
    policydetailedlist?.accountPremiumOthers ||
    policydetailedlist?.quotation?.accountPremiumOthers ||
    state?.accountPremiumOthers ||
    "0.00";

  const discount =
    state?.policy?.discount ||
    state?.policyData?.discount ||
    policydetailedlist?.discount ||
    policydetailedlist?.quotation?.discount ||
    state?.quotation?.firePremiumDetails?.totalDiscount ||
    policydetailedlist?.quotation?.firePremiumDetails?.totalDiscount ||
    state?.discount ||
    "0.00";

  const displayTitle = useMemo(() => {
    const parts = [];

    if (clientName) {
      parts.push(clientName);
    }
    if (state?.leadNumber) {
      parts.push(`Lead ID : ${state?.leadNumber}`);
    }
    if (state?.clientNumber) {
      parts.push(`Client ID : ${state?.clientNumber}`);
    } else if (clientId) {
      parts.push(`Client ID : ${clientId}`);
    }
    return parts.join(" / ") || t("agent.paymentDetails");
  }, [clientName, clientId, state?.clientNumber]);

  // Auto-complete payment for testing/demo purposes
  useEffect(() => {
    // Auto-trigger for quote flow OR waiting page flow OR policy detail flow
    const fromWaitingPage = state?.fromWaitingPage;
    const fromPolicyDetail = state?.fromPolicyDetail;
    const shouldAutoComplete =
      !autoPaymentProcessing &&
      (state?.isQuoteFlow || fromWaitingPage || fromPolicyDetail);

    if (shouldAutoComplete) {
      setAutoPaymentProcessing(true);

      // Show initial message
      toast.current?.show({
        severity: "info",
        summary: t("agent.processingMockPayment"),
        detail: t("agent.simulatingPaymentProcessing"),
        life: 2000,
      });

      // Auto-trigger payment confirmation after 2.5 seconds
      setTimeout(() => {
        handlePaymentConfirmation();
      }, 2500);
    }
  }, []); // Empty dependency array to run only once

  const handleBack = () => {
    navigate(-1);
  };

  const handlePaymentConfirmation = async () => {
    const targetPolicyId = state?.policyId || policyId;
    const quotationId = state?.quotationId;

    const paymentMethod = state?.paymentMethod || "Direct Debit";
    const isQuoteFlow = state?.isQuoteFlow || !!quotationId;

    // Validation log

    // For quote-to-policy flow, we need quotation ID and all data
    if (isQuoteFlow && !quotationId) {
      toast.current?.show({
        severity: "error",
        summary: t("common.error"),
        detail: t("agent.quotationIdNotFound"),
        life: 3000,
      });
      return;
    }

    // For existing policy payment, we need policy ID AND policy number
    if (!isQuoteFlow && (!targetPolicyId || !policyNumber)) {
      const missingFields = [];
      if (!targetPolicyId) missingFields.push("Policy ID");
      if (!policyNumber) missingFields.push("Policy Number");

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: `Missing required data: ${missingFields.join(
          " and "
        )}. Cannot process payment.`,
        life: 3000,
      });
      return;
    }

    setIsProcessing(true);

    try {
      if (isQuoteFlow) {
        // QUOTE TO POLICY FLOW: Create client and policy after payment
        console.log("=== CREATING CLIENT AND POLICY AFTER PAYMENT ===");

        // Show payment success first
        toast.current?.show({
          severity: "success",
          summary: t("agent.paymentSuccessful"),
          detail: t("agent.paymentConfirmedCreatingPolicy"),
          life: 3000,
        });

        // Wait a moment for user to see the success message
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Prepare the complete policy data
        const additionalPolicyData = {
          ...state?.additionalPolicyData,
          paymentMethod: paymentMethod,
          paymentStatus: "Completed",
        };

        // Call the conversion API to create client and policy
        const result = await quotationService.convertQuotationToPolicy(
          quotationId,
          additionalPolicyData,
          localStorage.getItem("USERNAME") || "agent",
          state?.lob || null // Pass LOB for Fire API format (insuredName, inception, expiry)
        );

        if (result.success) {
          const policyData = result.data?.data?.policy || result.data?.policy;
          const clientData = result.data?.data?.client || result.data?.client;
          const createdPolicyId = policyData?.id || policyData?.policyId;

          // Create receipt for the new policy using standardized helper
          try {
            const currentUser = getUserData();

            // Ensure policyData includes all premium breakdown values for receipt
            const completePolicyDataForReceipt = {
              ...policyData,
              grossPremium: policyData?.grossPremium || grossPremium,
              netPremium: policyData?.netPremium || netPremium,
              valueAddedTax: policyData?.valueAddedTax || valueAddedTax,
              documentaryStampTax:
                policyData?.documentaryStampTax || documentaryStampTax,
              localGovernmentTax:
                policyData?.localGovernmentTax || localGovernmentTax,
              accountPremiumOthers:
                policyData?.accountPremiumOthers || accountPremiumOthers,
              discount: policyData?.discount || discount,
            };

            console.log(
              "📊 Building receipt with complete premium breakdown:",
              {
                grossPremium: completePolicyDataForReceipt.grossPremium,
                netPremium: completePolicyDataForReceipt.netPremium,
                valueAddedTax: completePolicyDataForReceipt.valueAddedTax,
              }
            );

            const receiptData = buildPaymentCompletedReceiptData(
              completePolicyDataForReceipt,
              {
                clientData: clientData,
                fallbackClientId: clientId,
                fallbackGrossPremium: grossPremium,
                currentUserId: currentUser?.id,
              }
            );

            const receiptResult = await receiptsService.createReceipt(
              receiptData
            );
            console.log("Receipt created successfully:", receiptResult);

            // Sync collection from receipt (for tracking overdue payments)
            if (receiptResult?.data?.id) {
              try {
                const collectionResult =
                  await collectionService.syncFromReceipt(
                    receiptResult.data.id
                  );
                console.log("Collection synced:", collectionResult);
              } catch (collectionError) {
                console.error(
                  "Collection sync failed (non-blocking):",
                  collectionError
                );
              }
            }
          } catch (receiptError) {
            console.error("Failed to create receipt:", receiptError);
            // Don't fail the entire flow if receipt creation fails
            toast.current?.show({
              severity: "warn",
              summary: t("agent.receiptCreationWarning"),
              detail: t("agent.policyCreatedReceiptFailed"),
              life: 4000,
            });
          }

          // Create accounting entries for payment
          try {
            // Resolve internal client ID - prioritize clientData.id (internal DB ID)
            const internalClientId =
              clientData?.id ||
              policyData?.clientId ||
              policyData?.client?.id ||
              clientId;

            // Parse and validate amount
            const premiumAmount =
              parseFloat(
                String(policyData?.grossPremium || grossPremium || 0).replace(
                  /[^0-9.-]/g,
                  ""
                )
              ) || 0;

            if (!internalClientId) {
              console.warn(
                "⚠️ Client ID not found, skipping accounting entries for quote payment"
              );
              toast.current?.show({
                severity: "warn",
                summary: t("agent.accountingEntryWarning"),
                detail: t("agent.clientIdNotFound"),
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
                summary: t("agent.accountingEntryWarning"),
                detail: t("agent.invalidPremiumAmount"),
                life: 4000,
              });
            } else {
              // Extract complete premium breakdown from policy data
              const policyGrossPremium =
                parseFloat(
                  String(policyData?.grossPremium || grossPremium || 0).replace(
                    /[^0-9.-]/g,
                    ""
                  )
                ) || 0;
              const policyNetPremium =
                parseFloat(
                  String(policyData?.netPremium || netPremium || 0).replace(
                    /[^0-9.-]/g,
                    ""
                  )
                ) || 0;
              const policyValueAddedTax =
                parseFloat(
                  String(
                    policyData?.valueAddedTax || valueAddedTax || 0
                  ).replace(/[^0-9.-]/g, "")
                ) || 0;
              const policyDocumentaryStampTax =
                parseFloat(
                  String(
                    policyData?.documentaryStampTax || documentaryStampTax || 0
                  ).replace(/[^0-9.-]/g, "")
                ) || 0;
              const policyLocalGovernmentTax =
                parseFloat(
                  String(
                    policyData?.localGovernmentTax || localGovernmentTax || 0
                  ).replace(/[^0-9.-]/g, "")
                ) || 0;
              const policyAccountPremiumOthers =
                parseFloat(
                  String(
                    policyData?.accountPremiumOthers ||
                    accountPremiumOthers ||
                    0
                  ).replace(/[^0-9.-]/g, "")
                ) || 0;
              const policyDiscount =
                parseFloat(
                  String(
                    policyData?.discount ||
                    policyData?.quotation?.discount ||
                    policyData?.quotation?.firePremiumDetails?.totalDiscount ||
                    state?.quotation?.firePremiumDetails?.totalDiscount ||
                    discount ||
                    0
                  ).replace(/[^0-9.-]/g, "")
                ) || 0;

              // Validate accounting equation: grossPremium = netPremium + VAT + DST + LGT + Others - Discount
              const calculatedTotal =
                policyNetPremium +
                policyValueAddedTax +
                policyDocumentaryStampTax +
                policyLocalGovernmentTax +
                policyAccountPremiumOthers -
                policyDiscount;
              const difference = Math.abs(policyGrossPremium - calculatedTotal);

              if (difference > 0.01 && policyGrossPremium > 0) {
                const commission = policyGrossPremium - policyNetPremium;
                console.warn("⚠️ Accounting equation warning (Quote Flow):", {
                  grossPremium: policyGrossPremium,
                  netPremium: policyNetPremium,
                  valueAddedTax: policyValueAddedTax,
                  documentaryStampTax: policyDocumentaryStampTax,
                  localGovernmentTax: policyLocalGovernmentTax,
                  accountPremiumOthers: policyAccountPremiumOthers,
                  discount: policyDiscount,
                  commission,
                  calculatedTotal,
                  difference,
                });
              }

              const accountingData = {
                amount: premiumAmount,
                grossPremium: policyGrossPremium,
                netPremium: policyNetPremium,
                valueAddedTax: policyValueAddedTax,
                documentaryStampTax: policyDocumentaryStampTax,
                localGovernmentTax: policyLocalGovernmentTax,
                accountPremiumOthers: policyAccountPremiumOthers,
                discount: policyDiscount,
                paymentDate: new Date().toISOString(),
                description: `Quote payment for policy ${policyData?.policyNumber || createdPolicyId
                  }`,
                referenceType: "Policy",
                referenceId: createdPolicyId,
                clientId: internalClientId, // Use internal database ID
                policyId: createdPolicyId,
                policyNumber: policyData?.policyNumber,
                isDirectBilled: policyData?.isDirectBilled || false,
              };

              await accountingService.createPaymentAccountingEntry(
                accountingData
              );
              console.log("✅ Accounting entries created for quote payment");
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
                "Policy created but accounting entry creation failed",
              life: 5000,
            });
            // Don't fail payment flow
          }

          toast.current?.show({
            severity: "success",
            summary: t("agent.policyCreated"),
            detail: t("agent.clientAndPolicyCreatedSuccess"),
            life: 3000,
          });

          // Navigate to the created policy detail view
          setTimeout(() => {
            if (createdPolicyId) {
              navigate(`/agent/policydetail/${createdPolicyId}`);
            } else {
              // Fallback to client listing if policy ID not found
              navigate("/agent/clientlisting");
            }
          }, 2000);
        } else {
          throw new Error(result.error || "Failed to create policy");
        }
      } else {
        // EXISTING POLICY PAYMENT FLOW: Update payment status
        const result = await policyService.updatePaymentStatus(targetPolicyId, {
          paymentStatus: "Completed",
          paymentMethod: paymentMethod,
        });

        if (result.success) {
          const responseData = result.data?.data || result.data || {};
          const updatedPolicyData = {
            ...(state?.policy || policydetailedlist || {}),
            ...responseData,
            id: targetPolicyId,
            policyId: targetPolicyId,
            paymentStatus: "Completed",
          };

          // Create receipt for the existing policy payment using standardized helper
          try {
            const currentUser = getUserData();

            // FIX: Build complete policy data for receipt with all premium breakdown values
            const completePolicyData = {
              ...(state?.policy ||
                state?.policyData ||
                policydetailedlist ||
                {}),
              ...responseData,
              id: targetPolicyId,
              policyId: targetPolicyId,
              policyNumber: policyNumber, // Ensure policy number is included
              grossPremium: updatedPolicyData?.grossPremium || grossPremium,
              netPremium: updatedPolicyData?.netPremium || netPremium,
              valueAddedTax: updatedPolicyData?.valueAddedTax || valueAddedTax,
              documentaryStampTax:
                updatedPolicyData?.documentaryStampTax || documentaryStampTax,
              localGovernmentTax:
                updatedPolicyData?.localGovernmentTax || localGovernmentTax,
              accountPremiumOthers:
                updatedPolicyData?.accountPremiumOthers || accountPremiumOthers,
              discount: updatedPolicyData?.discount || discount,
              clientId: clientId,
              paymentStatus: "Completed",
            };

            const clientData =
              result.data?.data?.client ||
              result.data?.client ||
              result.data.policy.client;

            console.log(" receiptHelper: clientData:", clientData, result.data);
            const receiptData = buildPaymentCompletedReceiptData(
              completePolicyData,
              {
                clientData: clientData || {
                  id: clientData.id || clientId,
                  clientId: clientData.clientId || clientId,
                },
                fallbackClientId: clientId,
                fallbackGrossPremium: grossPremium,
                currentUserId: currentUser?.id || "system",
              }
            );

            console.log(
              "receiptHelper: Receipt data:",
              receiptData,
              clientData
            );
            const receiptResult = await receiptsService.createReceipt(
              receiptData
            );
            console.log("Receipt created successfully:", receiptResult);

            // Sync collection from receipt (for tracking overdue payments)
            if (receiptResult?.data?.id) {
              try {
                const collectionResult =
                  await collectionService.syncFromReceipt(
                    receiptResult.data.id
                  );
                console.log("Collection synced:", collectionResult);
              } catch (collectionError) {
                console.error(
                  "Collection sync failed (non-blocking):",
                  collectionError
                );
              }
            }
          } catch (receiptError) {
            console.error("Failed to create receipt:", receiptError);
            // Don't fail the entire flow if receipt creation fails
            toast.current?.show({
              severity: "warn",
              summary: "Receipt Creation Warning",
              detail:
                "Payment processed but receipt generation failed. Please create receipt manually.",
              life: 4000,
            });
          }

          // Create accounting entries for payment
          try {
            // Get the client's internal database ID - check multiple sources
            const internalClientId =
              updatedPolicyData?.clientId ||
              updatedPolicyData?.client?.id ||
              policydetailedlist?.client?.id ||
              responseData?.clientId ||
              responseData?.client?.id ||
              clientId;

            // Parse and validate amount - grossPremium might be a string
            const premiumAmount =
              parseFloat(String(grossPremium).replace(/[^0-9.-]/g, "")) || 0;

            if (!internalClientId) {
              console.warn(
                "⚠️ Client ID not found in policy data, skipping accounting entries"
              );
              toast.current?.show({
                severity: "warn",
                summary: t("agent.accountingEntryWarning"),
                detail:
                  "Payment processed but accounting entry skipped: Client ID not found",
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
                summary: t("agent.accountingEntryWarning"),
                detail:
                  "Payment processed but accounting entry skipped: Invalid premium amount",
                life: 4000,
              });
            } else {
              // Extract complete premium breakdown from updated policy data
              const policyGrossPremium =
                parseFloat(
                  String(
                    updatedPolicyData?.grossPremium || grossPremium || 0
                  ).replace(/[^0-9.-]/g, "")
                ) || 0;
              const policyNetPremium =
                parseFloat(
                  String(
                    updatedPolicyData?.netPremium || netPremium || 0
                  ).replace(/[^0-9.-]/g, "")
                ) || 0;
              const policyValueAddedTax =
                parseFloat(
                  String(
                    updatedPolicyData?.valueAddedTax || valueAddedTax || 0
                  ).replace(/[^0-9.-]/g, "")
                ) || 0;
              const policyDocumentaryStampTax =
                parseFloat(
                  String(
                    updatedPolicyData?.documentaryStampTax ||
                    documentaryStampTax ||
                    0
                  ).replace(/[^0-9.-]/g, "")
                ) || 0;
              const policyLocalGovernmentTax =
                parseFloat(
                  String(
                    updatedPolicyData?.localGovernmentTax ||
                    localGovernmentTax ||
                    0
                  ).replace(/[^0-9.-]/g, "")
                ) || 0;
              const policyAccountPremiumOthers =
                parseFloat(
                  String(
                    updatedPolicyData?.accountPremiumOthers ||
                    accountPremiumOthers ||
                    0
                  ).replace(/[^0-9.-]/g, "")
                ) || 0;
              const policyDiscount =
                parseFloat(
                  String(
                    updatedPolicyData?.discount ||
                    updatedPolicyData?.quotation?.discount ||
                    updatedPolicyData?.quotation?.firePremiumDetails?.totalDiscount ||
                    state?.quotation?.firePremiumDetails?.totalDiscount ||
                    discount ||
                    0
                  ).replace(/[^0-9.-]/g, "")
                ) || 0;

              // Validate accounting equation: grossPremium = netPremium + VAT + DST + LGT + Others - Discount
              const calculatedTotal =
                policyNetPremium +
                policyValueAddedTax +
                policyDocumentaryStampTax +
                policyLocalGovernmentTax +
                policyAccountPremiumOthers -
                policyDiscount;
              const difference = Math.abs(policyGrossPremium - calculatedTotal);

              if (difference > 0.01 && policyGrossPremium > 0) {
                const commission = policyGrossPremium - policyNetPremium;
              }

              const accountingData = {
                amount: premiumAmount,
                grossPremium: policyGrossPremium,
                netPremium: policyNetPremium,
                valueAddedTax: policyValueAddedTax,
                documentaryStampTax: policyDocumentaryStampTax,
                localGovernmentTax: policyLocalGovernmentTax,
                accountPremiumOthers: policyAccountPremiumOthers,
                discount: policyDiscount,
                paymentDate: new Date().toISOString(),
                description: `Payment for policy ${policyNumber || targetPolicyId
                  }`,
                referenceType: "Policy",
                referenceId: targetPolicyId,
                clientId: internalClientId, // Use internal database ID
                policyId: targetPolicyId,
                policyNumber: policyNumber,
                isDirectBilled: updatedPolicyData?.isDirectBilled || false,
              };

              await accountingService.createPaymentAccountingEntry(
                accountingData
              );
              console.log(
                "✅ Accounting entries created successfully for policy payment"
              );
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
            summary: t("agent.paymentSuccessful"),
            detail: t("agent.paymentProcessedSuccess"),
            life: 3000,
          });

          // Navigate to policy detail view after 2 seconds
          setTimeout(() => {
            navigate(`/agent/policydetail/${targetPolicyId}`);
          }, 2000);
        } else {
          throw new Error(result.error || "Payment failed");
        }
      }
    } catch (error) {
      console.error("Payment confirmation error:", error);
      toast.current?.show({
        severity: "error",
        summary: isQuoteFlow ? t("agent.policyCreationFailed") : t("agent.paymentFailed"),
        detail: error.message || t("agent.failedToProcessTryAgain"),
        life: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="overall__payment__confirmation">
      <Toast ref={toast} />
      <div className="header__title">{t("agent.clientsLabel")}</div>
      <div className="left__arrow mt-3" onClick={handleBack}>
        <SvgLeftArrow />
        <label className="left__arrow__text">{displayTitle}</label>
      </div>
      <Card className="mt-3">
        {autoPaymentProcessing &&
          (state?.isQuoteFlow ||
            state?.fromWaitingPage ||
            state?.fromPolicyDetail) && (
            <div
              style={{
                padding: "20px",
                backgroundColor: "#e3f2fd",
                borderRadius: "8px",
                marginBottom: "20px",
                textAlign: "center",
              }}
            >
              <i
                className="pi pi-spin pi-spinner"
                style={{ fontSize: "2em", color: "#1976d2" }}
              ></i>
              <p style={{ marginTop: "10px", fontWeight: "600" }}>
                {t("agent.processingMockPayment")}
              </p>
              <p style={{ fontSize: "14px", color: "#666" }}>
                {state?.isQuoteFlow
                  ? t("agent.autoCompletingPaymentCreatingPolicy")
                  : t("agent.autoCompletingPaymentActivatingPolicy")}
              </p>
            </div>
          )}
        <div className="table__header">{t("agent.paymentConfirmation")}</div>
        <div className="sub__title__header mt-3">
          <label className="sub__title">{t("agent.paymentDetailsLabel")}</label>
          <label className="waiting__payment">{t("agent.confirmingPayment")}</label>
        </div>

        {/* Premium breakdown with actual data */}
        <div className="premium__header mt-3">
          <label className="net__premium">{t("agent.netPremium")}</label>
          <label className="premium__id">{formatCurrency(netPremium)}</label>
        </div>
        <div className="premium__header mt-3">
          <label className="net__premium">{t("agent.dst")}</label>
          <label className="premium__id">
            {formatCurrency(documentaryStampTax)}
          </label>
        </div>
        <div className="premium__header mt-3">
          <label className="net__premium">{t("agent.vat")}</label>
          <label className="premium__id">
            {formatCurrency(valueAddedTax)}
          </label>
        </div>
        <div className="premium__header mt-3">
          <label className="net__premium">{t("agent.lgt")}</label>
          <label className="premium__id">
            {formatCurrency(localGovernmentTax)}
          </label>
        </div>
        <div className="premium__header mt-3">
          <label className="net__premium">{t("agent.others")}</label>
          <label className="premium__id">
            {formatCurrency(accountPremiumOthers)}
          </label>
        </div>
        <div className="premium__header mt-3">
          <label className="net__premium">{t("agent.discount")}</label>
          <label className="premium__id">- {formatCurrency(discount)}</label>
        </div>
        <div className="premium__header mt-5">
          <label className="gross__premium">{t("agent.grossPremium")}</label>
          <label className="gross__id">{formatCurrency(grossPremium)}</label>
        </div>
        <div className="button_component">
          <Button
            label={t("common.cancel")}
            severity="help"
            text
            className="download_button"
            onClick={handleBack}
            disabled={isProcessing || autoPaymentProcessing}
          />
          <Button
            label={
              isProcessing
                ? t("agent.creatingPolicy")
                : state?.isQuoteFlow
                  ? t("agent.confirmPaymentCreatePolicy")
                  : t("agent.confirmPayment")
            }
            className="policy_button"
            onClick={handlePaymentConfirmation}
            disabled={isProcessing || autoPaymentProcessing}
            loading={isProcessing}
          />
        </div>
      </Card>
    </div>
  );
};

export default PaymentConfirmation;
