import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { MultiSelect } from "primereact/multiselect";
import "./index.scss";
import SvgWhatsAppIcon from "../../../../assets/agentIcon/SvgWhatsAppIcon";
import SvgDownloadIcon from "../../../../assets/agentIcon/SvgDownloadIcon";
import SvgEmailIcon from "../../../../assets/agentIcon/SvgEmailIcon";
import SvgSendToInsurerIcon from "../../../../assets/agentIcon/SvgSendToInsurerIcon";
import emailService from "../../../../services/emailService";
import documentTemplateService from "../../../../services/documentTemplateService";
import useInsuranceCompanyOptions from "../../../component/useInsuranceCompanyOptions";
import { notifyError, notifySuccess, notifyWarn } from "../../../../utility/dialogs";
import { notifyEmailOutcome } from "../../../../utility/emailNotice";
import { copyText } from "../../../../utility/clipboard";

const ShareOption = ({ modalVisible, setModalVisible, quotationData }) => {
  const { t } = useTranslation();
  const InsuranceCompanyOptions = useInsuranceCompanyOptions();
  const { formatCurrency } = useFormatCurrency();
  // Detect Fire and Allied Perils LOB
  const isFireLOB = useMemo(
    () =>
      quotationData?.productType === "Fire and Allied Perils" ||
      quotationData?.productType?.toLowerCase?.().includes("fire"),
    [quotationData?.productType]
  );

  const fireRiskDetails = quotationData?.fireRiskDetails || quotationData?.fireRisk || {};
  const firePremiumDetails = quotationData?.firePremiumDetails || quotationData?.firePremium || {};
  const fireSumInsured = firePremiumDetails?.sumInsured || {};

  // Get display premium number for formatting
  const premiumValue = useMemo(() => {
    if (!quotationData) return 0;
    if (isFireLOB && firePremiumDetails?.totalPremium != null) {
      return parseFloat(firePremiumDetails.totalPremium);
    }
    return quotationData.grossPremium ? parseFloat(quotationData.grossPremium) : 0;
  }, [quotationData, isFireLOB, firePremiumDetails]);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showInsurerForm, setShowInsurerForm] = useState(false);
  const [selectedInsurers, setSelectedInsurers] = useState([]);
  const [isSendingToInsurers, setIsSendingToInsurers] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [useSuggestedContent, setUseSuggestedContent] = useState(false);
  const [isPreparingSuggestion, setIsPreparingSuggestion] = useState(false);
  const [suggestedContent, setSuggestedContent] = useState(null);
  const [suggestedSubject, setSuggestedSubject] = useState("");
  const [suggestedHtml, setSuggestedHtml] = useState("");
  const [quotePdfLoading, setQuotePdfLoading] = useState(false);

  const clearSuggestedContent = () => {
    setUseSuggestedContent(false);
    setSuggestedContent(null);
    setSuggestedSubject("");
    setSuggestedHtml("");
  };

  const resetInsurerForm = () => {
    setShowInsurerForm(false);
    setSelectedInsurers([]);
    setIsSendingToInsurers(false);
  };

  const handleCopyToClipboard = async () => {
    const quoteUrl = `${window.location.origin}/agent/quotedetailview/${quotationData?.quotationId}`;
    if (await copyText(quoteUrl)) notifySuccess(t("shareOption.linkCopied"));
    else notifyError(t("shareOption.copyFailed"));
  };

  const handleDownload = async () => {
    const quotationId = quotationData?.quotationId;
    if (!quotationId) {
      notifyError("Quotation ID is missing. Cannot download quote PDF.");
      return;
    }
    setQuotePdfLoading(true);
    try {
      const fileName = `quote-${quotationData?.quotationNumber || quotationId}.pdf`;
      const result = await documentTemplateService.getQuoteTemplatePdf(
        quotationId,
        { isFire: isFireLOB, fileName }
      );
      if (!result.success) {
        notifyError(result.error || "Failed to download quote PDF.");
      }
    } catch (err) {
      notifyError(err?.message || "Failed to download quote PDF.");
    } finally {
      setQuotePdfLoading(false);
    }
  };

  const handleEmailClick = () => {
    setShowEmailForm(true);
  };

  const handleInsurerClick = () => {
    setShowInsurerForm(true);
  };

  const handleSendToInsurers = async () => {
    if (!selectedInsurers || selectedInsurers.length === 0) {
      notifyWarn(t("shareOption.selectAtLeastOneCompany"));
      return;
    }

    const quotationId = quotationData?.quotationId;
    if (!quotationId) {
      notifyError("Quotation ID is missing. Cannot send quote.");
      return;
    }

    setIsSendingToInsurers(true);
    try {
      const result = await emailService.shareQuoteToInsurers({
        quotationId,
        insuranceCompanies: selectedInsurers,
        productType: quotationData?.productType,
        quotationNumber: quotationData?.quotationNumber,
      });

      if (result.success) {
        if (result.partial) notifyWarn(t("shareOption.sentToInsurersPartial"));
        else notifyEmailOutcome(t("shareOption.sentToInsurersSuccess"));
        resetInsurerForm();
        setModalVisible(false);
      } else {
        notifyError(result.error || t("shareOption.sentToInsurersError"));
      }
    } catch (error) {
      notifyError(t("shareOption.sentToInsurersError"));
    } finally {
      setIsSendingToInsurers(false);
    }
  };

  const handleUseSuggestedContent = async () => {
    if (!quotationData) {
      notifyError("Quote data is not available");
      return;
    }

    setIsPreparingSuggestion(true);

    try {
      const grossPremium = isFireLOB
        ? firePremiumDetails?.totalPremium ?? quotationData.grossPremium
        : quotationData.grossPremium;
      const netPremium = isFireLOB
        ? firePremiumDetails?.totalCoverPremium ?? firePremiumDetails?.totalPremium ?? quotationData.netPremium
        : quotationData.netPremium;

      const context = {
        type: "insurance_quote",
        quotationNumber: quotationData.quotationNumber,
        productType: quotationData.productType,
        grossPremium,
        netPremium,
        inceptionDate: quotationData.inceptionDate,
        expiryDate: quotationData.expiryDate,
        customMessage:
          customMessage || t("shareOption.reviewQuoteDetails"),
      };

      if (isFireLOB) {
        context.riskInfo = {
          constructionType: fireRiskDetails.constructionType,
          buildingType: fireRiskDetails.buildingType,
          locationAddress: fireRiskDetails.locationAddress,
          occupancyType: fireRiskDetails.occupancyType,
          natureOfBusiness: fireRiskDetails.natureOfBusiness,
          earthquakeZone: fireRiskDetails.earthquakeZone,
          sumInsured: {
            Building: fireSumInsured.Building,
            PlantAndMachinery: fireSumInsured.PlantAndMachinery,
            OtherContents: fireSumInsured.OtherContents,
          },
        };
      } else {
        context.insuranceCompany =
          quotationData.participantDetails?.[0]?.insuranceCompanyName;
        context.policyType = quotationData.insurancePolicyType;
        context.vehicleInfo = `${quotationData.make || ""} ${
          quotationData.model || ""
        } ${quotationData.year || ""}`.trim();
      }

      const lead = quotationData.lead || {};
      const customerName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.companyName;
      const result = await emailService.generateEmailContent({
        template: "custom",
        context,
        recipient: { email: emailAddress, name: customerName || undefined },
      });

      if (result.success) {
        setSuggestedContent(result.data);
        setSuggestedSubject(result.data.subject);
        setSuggestedHtml(result.data.html);
        setUseSuggestedContent(true);
        notifySuccess(t("shareOption.suggestedContentReady"));
      } else {
        notifyError(`${t("shareOption.suggestedContentError")}: ${result.error}`);
      }
    } catch {
      notifyError(t("shareOption.suggestedContentError"));
    } finally {
      setIsPreparingSuggestion(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress) {
      notifyWarn("Please enter an email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailAddress)) {
      notifyWarn("Please enter a valid email address");
      return;
    }

    if (!quotationData) {
      notifyError("Quote data is not available");
      return;
    }

    setIsSending(true);

    try {
      let result;

      if (useSuggestedContent && suggestedContent) {
        // The subject and body as edited in the dialog; quotationId records the e-mail against the quote.
        result = await emailService.sendEmail({
          to: emailAddress,
          subject: suggestedSubject,
          html: suggestedHtml,
          quotationId: quotationData.quotationId,
        });
      } else {
        result = await emailService.shareQuote(
          emailAddress,
          quotationData,
          customMessage
        );
      }

      if (result.success) {
        notifyEmailOutcome(t("shareOption.sentToRecipient", { to: emailAddress }));
        setEmailAddress("");
        setCustomMessage("");
        setShowEmailForm(false);
        clearSuggestedContent();
        setModalVisible(false);
      } else {
        notifyError(`Failed to send email: ${result.error}`);
      }
    } catch (error) {
      notifyError("An error occurred while sending the email");
    } finally {
      setIsSending(false);
    }
  };

  const handleWhatsAppShare = () => {
    let quoteText;
    if (isFireLOB) {
      const totalSI =
        (Number(fireSumInsured.Building) || 0) +
        (Number(fireSumInsured.PlantAndMachinery) || 0) +
        (Number(fireSumInsured.OtherContents) || 0) +
        (Number(fireSumInsured.GrossProfit) || 0) +
        (Number(fireSumInsured.Wages) || 0) +
        (Number(fireSumInsured.LossOfRent) || 0);
      quoteText = `${t("shareOption.productFireAndAlliedPerils")} Quote - ${
        quotationData?.quotationNumber || "N/A"
      }%0A%0A${t("shareOption.locationLabel")}: ${fireRiskDetails.locationAddress || "N/A"}%0A${t("shareOption.buildingTypeLabel")}: ${
        fireRiskDetails.buildingType || "N/A"
      }%0ATotal Sum Insured: ${formatCurrency(totalSI)}%0ATotal Premium: ${formatCurrency(premiumValue)}%0A%0AFor full details, please contact your agent.`;
    } else {
      quoteText = `Insurance Quote - ${
        quotationData?.quotationNumber || "N/A"
      }%0A%0ATotal Premium: ${formatCurrency(premiumValue)}%0A%0AFor full details, please contact your agent.`;
    }
    const whatsappUrl = `https://wa.me/?text=${quoteText}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const dialogHeader = showInsurerForm
    ? t("shareOption.sendToInsurerTitle")
    : showEmailForm
      ? "Send via Email"
      : "Share Quote";

  return (
    <Dialog
      visible={modalVisible}
      header={dialogHeader}
      className={`modal__dialog__container share-modal ${
        showEmailForm ? "email-form-modal" : ""
      } ${showInsurerForm ? "insurer-form-modal" : ""}`}
      onHide={() => {
        if (isSendingToInsurers) return;
        setModalVisible(false);
        setShowEmailForm(false);
        setEmailAddress("");
        setCustomMessage("");
        resetInsurerForm();
      }}
      dismissableMask={!isSendingToInsurers}
      modal={true}
      style={
        showInsurerForm
          ? { width: "480px", maxWidth: "min(480px, 95vw)" }
          : undefined
      }
    >
      {showInsurerForm ? (
        <div className="grid m-0">
          <div className="col-12 mb-3">
            <label htmlFor="insurer-multiselect" className="block mb-2 font-semibold">
              {t("shareOption.selectInsuranceCompanies")} *
            </label>
            <MultiSelect
              inputId="insurer-multiselect"
              value={selectedInsurers}
              options={InsuranceCompanyOptions}
              onChange={(e) => setSelectedInsurers(e.value || [])}
              optionLabel="label"
              optionValue="value"
              placeholder={t("shareOption.selectInsuranceCompaniesPlaceholder")}
              display="chip"
              className="w-full insurer-multiselect"
              disabled={isSendingToInsurers}
            />
          </div>
          <div className="col-12 flex justify-content-end gap-2">
            <Button
              label={t("common.cancel")}
              className="p-button-text"
              onClick={resetInsurerForm}
              disabled={isSendingToInsurers}
            />
            <Button
              label={
                isSendingToInsurers
                  ? t("shareOption.sendingToInsurers")
                  : t("shareOption.send")
              }
              icon="pi pi-send"
              onClick={handleSendToInsurers}
              loading={isSendingToInsurers}
              disabled={
                isSendingToInsurers ||
                !selectedInsurers ||
                selectedInsurers.length === 0
              }
            />
          </div>
        </div>
      ) : !showEmailForm ? (
        <div className="grid m-0">
          <div
            onClick={quotePdfLoading ? undefined : handleDownload}
            className={`col-2 p-0 ${quotePdfLoading ? "opacity-60" : ""}`}
            style={quotePdfLoading ? { pointerEvents: "none" } : {}}
          >
            <div className="common__div mb-2 cursor-pointer">
              {quotePdfLoading ? (
                <i className="pi pi-spin pi-spinner" style={{ fontSize: "1.5rem" }} />
              ) : (
                <SvgDownloadIcon />
              )}
            </div>
            <div className="share__option_caption">
              {quotePdfLoading ? t("shareOption.downloading") : t("shareOption.download")}
            </div>
          </div>
          <div onClick={handleEmailClick} className="col-2 p-0">
            <div className="common__div mb-2 cursor-pointer">
              <SvgEmailIcon />
            </div>
            <div className="share__option_caption">{t("shareOption.email")}</div>
          </div>
          <div onClick={handleWhatsAppShare} className="col-2 p-0">
            <div className="common__div mb-2 cursor-pointer">
              <SvgWhatsAppIcon />
            </div>
            <div className="share__option_caption">{t("shareOption.whatsApp")}</div>
          </div>
          <div onClick={handleInsurerClick} className="col-2 p-0">
            <div className="common__div mb-2 cursor-pointer">
              <SvgSendToInsurerIcon />
            </div>
            <div className="share__option_caption">{t("shareOption.sendToInsurer")}</div>
          </div>

          <div className="col-12 submit__container">
            <div style={{ fontSize: "12px", wordBreak: "break-all" }}>
              {`${window.location.origin}/agent/quotedetailview/${quotationData?.quotationId}`}
            </div>
            <Button onClick={handleCopyToClipboard}>{t("shareOption.copyLink")}</Button>
          </div>
        </div>
      ) : (
        <div className="grid m-0">
          <div className="col-12 mb-3">
            <label htmlFor="email" className="block mb-2 font-semibold">
              Recipient Email *
            </label>
            <InputText
              id="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder={t("shareOption.emailPlaceholder")}
              className="w-full"
              disabled={isSending || isPreparingSuggestion}
            />
          </div>

          {!useSuggestedContent ? (
            <>
              <div className="col-12 mb-3">
                <label htmlFor="message" className="block mb-2 font-semibold">
                  Custom Message (Optional)
                </label>
                <InputTextarea
                  id="message"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder={t("shareOption.messagePlaceholder")}
                  rows={4}
                  className="w-full"
                  disabled={isSending || isPreparingSuggestion}
                />
              </div>

              <div className="col-12 mb-3">
                <Button
                  label={
                    isPreparingSuggestion
                      ? t("shareOption.preparingSuggestedContent")
                      : t("shareOption.useSuggestedContent")
                  }
                  icon={isPreparingSuggestion ? "pi pi-spin pi-spinner" : "pi pi-file-edit"}
                  onClick={handleUseSuggestedContent}
                  className="w-full"
                  loading={isPreparingSuggestion}
                  disabled={isSending || isPreparingSuggestion}
                />
                <small className="block mt-2 text-500">
                  {t("shareOption.suggestedContentHint")}
                </small>
              </div>
            </>
          ) : (
            <>
              <div className="col-12 mb-3">
                <label htmlFor="suggested-subject" className="block mb-2 font-semibold">
                  {t("shareOption.emailSubject")}
                </label>
                <InputText
                  id="suggested-subject"
                  value={suggestedSubject}
                  onChange={(e) => setSuggestedSubject(e.target.value)}
                  className="w-full"
                  disabled={isSending}
                />
              </div>

              <div className="col-12 mb-3">
                <label htmlFor="suggested-content" className="block mb-2 font-semibold">
                  {t("shareOption.emailContentHtml")}
                </label>
                <InputTextarea
                  id="suggested-content"
                  value={suggestedHtml}
                  onChange={(e) => setSuggestedHtml(e.target.value)}
                  rows={8}
                  className="w-full"
                  disabled={isSending}
                  style={{ fontFamily: "monospace", fontSize: "12px" }}
                />
                <small className="block mt-2 text-500">
                  {t("shareOption.suggestedContentEditHint")}
                </small>
              </div>

              <div className="col-12 mb-3">
                <Button
                  label={t("shareOption.useStandardTemplate")}
                  icon="pi pi-times"
                  onClick={clearSuggestedContent}
                  className="w-full p-button-text"
                  disabled={isSending}
                />
              </div>
            </>
          )}

          <div className="col-12 mb-2">
            <div
              style={{
                background: "#f8f9fa",
                padding: "15px",
                borderRadius: "8px",
                fontSize: "13px",
                color: "#666",
              }}
            >
              <strong>Quote Summary:</strong>
              <div className="mt-2">
                Quote ID: {quotationData?.quotationNumber || "N/A"}
                {isFireLOB ? (
                  <>
                    <br />Product: {t("shareOption.productFireAndAlliedPerils")}
                    <br />{t("shareOption.locationLabel")}: {fireRiskDetails.locationAddress || "N/A"}
                    <br />{t("shareOption.buildingTypeLabel")}: {fireRiskDetails.buildingType || "N/A"}
                    <br />{t("shareOption.sumInsuredBuildingLabel")}: {formatCurrency(fireSumInsured.Building ?? 0)}
                    <br />Total Premium: {formatCurrency(premiumValue)}
                  </>
                ) : (
                  <>
                    <br />Insurance Company:{" "}
                    {quotationData?.participantDetails?.[0]?.insuranceCompanyName ||
                      "N/A"}
                    <br />Total Premium: {formatCurrency(premiumValue)}
                  </>
                )}
                {useSuggestedContent && (
                  <div className="mt-2 text-success">{t("shareOption.usingSuggestedContent")}</div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 flex justify-content-end gap-2">
            <Button
              label={t("common.cancel")}
              className="p-button-text"
              onClick={() => {
                setShowEmailForm(false);
                setEmailAddress("");
                setCustomMessage("");
                clearSuggestedContent();
              }}
              disabled={isSending || isPreparingSuggestion}
            />
            <Button
              label={isSending ? "Sending..." : "Send Email"}
              icon="pi pi-send"
              onClick={handleSendEmail}
              loading={isSending}
              disabled={isSending || isPreparingSuggestion || !emailAddress}
            />
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default ShareOption;
