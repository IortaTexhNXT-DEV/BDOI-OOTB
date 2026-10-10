import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { useParams, useNavigate } from "react-router-dom";
import { AuditTimeline } from "../../../components/AuditTrail";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "primereact/button";
import { Skeleton } from "primereact/skeleton";
import { BreadCrumb } from "primereact/breadcrumb";
import { Galleria } from "primereact/galleria";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import StatusBadge from "../../../components/StatusBadge";
import { policyDetailsDataMiddleWare } from "../store/policyMiddleWare";
import SvgDot from "../../../assets/agentIcon/SvgDots";
import { isFireLob, isOtherLob } from "../../endorsementModule/constants/endorsementCategories";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import s3Service, { browserFileUrl } from "../../../services/s3Service";
import billingService from "../../../services/billingService";
import BatchRenewalService from "../../../services/batchRenewalService";
import documentTemplateService from "../../../services/documentTemplateService";
import authService from "../../../services/authService";
import { BASE_URL } from "../../../utility/constant";
import useTaxRates from "../../quoteModule/utils/useTaxRates";
import "./index.scss";

import { formatDate as formatConfiguredDate } from "../../../utility/dateFormat";
import logger from "../../../utility/logger";
import NextStep from "../../../components/NextStep";
import { hasPermission } from "../../../utils/canOpen";
import { printPdf } from "../../../components/Print";

/**
 * Open a PDF that still has to be fetched in a new tab. The tab is opened at the click, before the fetch, so that the
 * browser does not block it as a pop-up; it is closed again when the document cannot be loaded.
 * @param {function(): Promise<Blob>} load
 */
const openPdfInTab = async (load) => {
  const tab = window.open("", "_blank");
  try {
    const blob = await load();
    const url = window.URL.createObjectURL(blob);
    if (tab && !tab.closed) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = "document.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setTimeout(() => window.URL.revokeObjectURL(url), 60000);
  } catch (e) {
    if (tab) tab.close();
    throw e;
  }
};

const ENDORSEMENT_TYPE_KEYS = {
  1: "policyDetail.endorsementTypePersonalDetails",
  2: "policyDetail.endorsementTypeMotorDetails",
  3: "policyDetail.endorsementTypeCoverageChange",
  4: "policyDetail.endorsementTypePolicyExtend",
  5: "policyDetail.endorsementTypePolicyCancel",
  fire_regular: "policyDetail.endorsementTypeFireRegular",
  fire_cancel: "policyDetail.endorsementTypeFireCancel",
};

// Map API coverDesc (Fire LOB) to i18n keys for translated labels
const COVER_DESC_TO_I18N_KEY = {
  "Fire And Allied Peril": "fireLead.opt.cover.fireAndAlliedPeril",
  "SRCC": "fireLead.opt.cover.srcc",
  "Business Interruption": "fireLead.opt.cover.businessInterruption",
  "Storm, Typhoon": "fireLead.opt.cover.stormTyphoon",
  "Storm": "fireLead.opt.cover.stormTyphoon",
  "Typhoon": "fireLead.opt.cover.stormTyphoon",
  "Hail": "fireLead.opt.cover.hail",
  "Earthquake": "fireLead.opt.cover.earthquake",
  "Loss of Rent/ Alternate Accomodation": "fireLead.opt.cover.lossOfRent",
};

const normalizeDocumentUrl = (url) => {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmed = url.trim();

  if (!trimmed) {
    return null;
  }

  const protocolIndex = trimmed.lastIndexOf("http");

  if (protocolIndex > 0) {
    return trimmed.substring(protocolIndex);
  }

  return trimmed;
};

const formatEndorsementTypes = (typeIds, t) => {
  if (!typeIds) {
    return t("policyDetail.nA");
  }

  let idsArray = [];

  if (Array.isArray(typeIds)) {
    idsArray = typeIds;
  } else if (typeof typeIds === "string") {
    idsArray = typeIds
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  } else {
    idsArray = [typeIds];
  }

  const labels = idsArray
    .map((value) => {
      const numericValue = Number(value);

      if (
        !Number.isNaN(numericValue) &&
        ENDORSEMENT_TYPE_KEYS[numericValue]
      ) {
        return t(ENDORSEMENT_TYPE_KEYS[numericValue]);
      }

      if (ENDORSEMENT_TYPE_KEYS[value]) {
        return t(ENDORSEMENT_TYPE_KEYS[value]);
      }

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }

      return null;
    })
    .filter(Boolean);

  return labels.length > 0 ? labels.join(", ") : t("policyDetail.nA");
};

const resolveEndorsementDocument = (endorsement) => {
  if (!endorsement) {
    return null;
  }

  const candidates = [
    endorsement.documentUrl,
    endorsement.documentKey,
    endorsement.documentLink,
    endorsement.document,
    endorsement.premiumAccountEntriesDocument,
  ].filter((value) => typeof value === "string" && value.trim());

  if (candidates.length === 0) {
    return null;
  }

  const preferredCandidate =
    candidates.find((candidate) => {
      const occurrences = (candidate.match(/https?:\/\//g) || []).length;
      return occurrences <= 1;
    }) || candidates[0];

  const originalUrl = preferredCandidate.trim();

  return {
    originalUrl,
    displayUrl: normalizeDocumentUrl(originalUrl) || originalUrl,
  };
};

const SectionCard = ({ title, subtitle, actions, children, className, badge }) => (
  <div className={`policy-section ${className || ""}`}>
    <div className="section-header">
      <div className="section-heading">
        {badge ? (
          <span className="co-insurance-ratios-badge">{badge}</span>
        ) : null}
        <h3>{title}</h3>
        {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </div>
    <div className="section-content">{children}</div>
  </div>
);

const SidebarSection = ({ title, icon, actions, children, className }) => (
  <div className={`sidebar-section ${className || ""}`}>
    <div className="section-header">
      <div className="section-heading">
        {icon ? (
          <i className={`section-icon ${icon}`} aria-hidden="true" />
        ) : null}
        <h4>{title}</h4>
      </div>
      {actions ? <div className="section-actions">{actions}</div> : null}
    </div>
    <div className="section-content">{children}</div>
  </div>
);

// a field with no value (blank, N/A or a zero amount) is left out of a detail grid rather than shown as a long list
// of N/A; an item marked `always` (a total) is kept
const isBlankValue = (v, empty) =>
  v === null || v === undefined || v === "" || v === "N/A" || v === empty || /^[^\d-]*0(\.0+)?$/.test(String(v).replace(/,/g, "").trim());
const recordedItems = (items, empty) => (items || []).filter((item) => item.always || !isBlankValue(item.value, empty));

const InfoGrid = ({ items, layout = "auto" }) => {
  if (!items || items.length === 0) {
    return <div className="info-empty">N/A</div>;
  }

  return (
    <div
      className={`info-grid${layout === "single" ? " info-grid--single" : ""}`}
    >
      {items.map((item) => {
        const key = item.key || item.label;
        const valueContent =
          item.value === null || item.value === undefined || item.value === ""
            ? "N/A"
            : item.value;

        return (
          <div className="info-item" key={key}>
            <span className="info-label">{item.label}</span>
            <span
              className={`info-value${
                item.emphasis ? " info-value--emphasis" : ""
              }`}
            >
              {valueContent}
            </span>
            {item.helper ? (
              <span className="info-helper">{item.helper}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

const HighlightCard = ({ label, value, helper, tone }) => {
  const toneClass = tone ? ` highlight-card--${tone}` : "";
  return (
    <div className={`highlight-card${toneClass}`}>
      <span className="highlight-label">{label}</span>
      <span className="highlight-value">{value}</span>
      {helper ? <span className="highlight-helper">{helper}</span> : null}
    </div>
  );
};

SectionCard.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  actions: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
};

SectionCard.defaultProps = {
  subtitle: null,
  actions: null,
  children: null,
  className: "",
};

SidebarSection.propTypes = {
  title: PropTypes.node.isRequired,
  icon: PropTypes.string,
  actions: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
};

SidebarSection.defaultProps = {
  icon: undefined,
  actions: null,
  children: null,
  className: "",
};

InfoGrid.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      label: PropTypes.node.isRequired,
      value: PropTypes.node,
      helper: PropTypes.node,
      emphasis: PropTypes.bool,
    })
  ),
  layout: PropTypes.oneOf(["auto", "single"]),
};

InfoGrid.defaultProps = {
  items: [],
  layout: "auto",
};

HighlightCard.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node.isRequired,
  helper: PropTypes.node,
  tone: PropTypes.string,
};

HighlightCard.defaultProps = {
  helper: null,
  tone: undefined,
};


/** Vehicle photo; a photo that cannot be loaded (missing file, expired link) shows a placeholder, not the alt text. */
const VehiclePhoto = ({ src, alt, className }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (failed) {
    return (
      <div className={`${className} vehicle-photo-placeholder`} role="img" aria-label={alt}>
        <i className="pi pi-image" aria-hidden="true" />
        <span>{alt}</span>
      </div>
    );
  }
  return <img className={className} src={src} alt={alt} onError={() => setFailed(true)} />;
};
VehiclePhoto.propTypes = { src: PropTypes.string.isRequired, alt: PropTypes.string, className: PropTypes.string };

const PolicyDetailView = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const taxRates = useTaxRates();
  const { policyId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const toast = React.useRef(null);

  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState(null);
  const [vehiclePhotoUrls, setVehiclePhotoUrls] = useState({});
  const [invoiceLoading, setInvoiceLoading] = useState({
    policy: false,
    endorsement: false,
    renewal: false,
  });
  const [insurancePlacingSlipLoading, setInsurancePlacingSlipLoading] =
    useState(false);
  const [policyScheduleLoading, setPolicyScheduleLoading] = useState(false);
  const [renewalWindow, setRenewalWindow] = useState(null);

  const { policyDetails, rawPolicyData, loading, error } = useSelector(
    ({ policyMainReducers }) => ({
      policyDetails: policyMainReducers?.policyDetails,
      rawPolicyData: policyMainReducers?.rawPolicyData,
      loading: policyMainReducers?.detailLoading,
      error: policyMainReducers?.error,
    })
  );

  const premiumBreakdown = useMemo(() => {
    const quotation = rawPolicyData?.quotation || {};
    const firePremium =
      rawPolicyData?.firePremiumDetails ||
      quotation?.firePremiumDetails ||
      quotation?.firePremium;
    const productType =
      quotation?.productType || rawPolicyData?.product;

    if (isFireLob(productType) && firePremium?.totalPremium != null) {
      const gross = Number(firePremium.totalPremium);
      const net =
        firePremium.totalCoverPremium != null
          ? Number(firePremium.totalCoverPremium)
          : gross / 1.265;
      return {
        netPremium: net,
        documentaryStampTax: rawPolicyData?.documentaryStampTax ?? 0,
        valueAddedTax: rawPolicyData?.valueAddedTax ?? 0,
        localGovernmentTax: rawPolicyData?.localGovernmentTax ?? 0,
        accountPremiumOthers: rawPolicyData?.accountPremiumOthers ?? 0,
        grossPremium: gross,
        _calculated: false,
      };
    }

    if (rawPolicyData?.netPremium) {
      return {
        netPremium: rawPolicyData.netPremium,
        documentaryStampTax: rawPolicyData.documentaryStampTax,
        valueAddedTax: rawPolicyData.valueAddedTax,
        localGovernmentTax: rawPolicyData.localGovernmentTax,
        accountPremiumOthers: rawPolicyData.accountPremiumOthers,
        grossPremium: rawPolicyData.grossPremium,
        _calculated: false,
      };
    }

    if (rawPolicyData?.grossPremium) {
      const gross = rawPolicyData.grossPremium;
      const totalRate =
        taxRates.documentaryStampTax + taxRates.valueAddedTax + taxRates.localGovernmentTax;
      const net = gross / (1 + totalRate);

      return {
        netPremium: net,
        documentaryStampTax: net * taxRates.documentaryStampTax,
        valueAddedTax: net * taxRates.valueAddedTax,
        localGovernmentTax: net * taxRates.localGovernmentTax,
        accountPremiumOthers: 0,
        grossPremium: gross,
        _calculated: true,
      };
    }

    return null;
  }, [rawPolicyData, taxRates]);

  useEffect(() => {
    if (policyId) {
      dispatch(policyDetailsDataMiddleWare({ policyId }));
    }
  }, [policyId, dispatch]);

  useEffect(() => {
    if (!hasPermission("write:renewals") && !hasPermission("write:quotations")) return;
    BatchRenewalService.getRenewalOptions()
      .then((o) => setRenewalWindow({ pipelineDays: Number(o.pipelineDays) || 0, graceDays: Number(o.graceDays) || 0, lapsedRenewalDays: Number(o.lapsedRenewalDays) || 0 }))
      .catch((e) => logger.warn("Renewal window not loaded", e));
  }, []);

  useEffect(() => {
    if (!rawPolicyData) {
      return;
    }
    const quotation = rawPolicyData?.quotation || {};
    const productType =
      quotation?.productType || rawPolicyData?.product;
    if (isFireLob(productType)) {
      return;
    }

    const fetchVehiclePhotoUrls = async () => {
      const photoUrls = [
        rawPolicyData.vehicleLeftSidePhoto,
        rawPolicyData.vehicleRightSidePhoto,
        rawPolicyData.vehicleFrontSidePhoto,
        rawPolicyData.vehicleRearSidePhoto,
        rawPolicyData.vehicleInteriorDashboardPhoto,
      ].filter(Boolean);

      if (photoUrls.length === 0) {
        return;
      }

      try {
        const result = await s3Service.getPresignedDownloadUrls(photoUrls);

        if (result.success && result.data) {
          setVehiclePhotoUrls(result.data);
        } else {
          const fallbackMap = {};
          for (const url of photoUrls) {
            fallbackMap[url] = url;
          }
          setVehiclePhotoUrls(fallbackMap);
        }
      } catch (fetchError) {
        logger.error(
          "Error fetching vehicle photo presigned URLs:",
          fetchError
        );
        const fallbackMap = {};
        for (const url of photoUrls) {
          fallbackMap[url] = url;
        }
        setVehiclePhotoUrls(fallbackMap);
      }
    };

    fetchVehiclePhotoUrls();
  }, [rawPolicyData]);

  // Dates in the configured format (System Settings general.date_format)
  const formatDate = (dateString) => formatConfiguredDate(dateString, { empty: "N/A" });
  const formatDateTime = (dateString) => formatConfiguredDate(dateString, { withTime: true, empty: "N/A" });

  // days to expiry (negative once expired), null without an expiry date
  const daysUntilExpiry = () => {
    const expiryDate = policyDetails?.PolicyExpiry || rawPolicyData?.expiry;
    if (!expiryDate) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Renew is offered while the policy is in the renewal window of the renewal settings: from renewals.pipeline_days
  // before expiry, through the grace period and the lapsed-renewal days after it
  const isRenewable = () => {
    const days = daysUntilExpiry();
    if (!renewalWindow || days === null || rawPolicyData?.renewedTo) return false;
    if (["Cancelled", "Renewed"].includes(rawPolicyData?.status)) return false;
    return days <= renewalWindow.pipelineDays && -days <= renewalWindow.graceDays + renewalWindow.lapsedRenewalDays;
  };

  const expiryHelper = () => {
    const days = daysUntilExpiry();
    if (days === null || !isRenewable()) return `${t("policyDetail.issued")} ${formatDate(policyDetails.PolicyIssued)}`;
    return days >= 0 ? t("policyDetail.expiresInDays", { count: days }) : t("policyDetail.expiredDaysAgo", { count: -days });
  };

  // back to where the policy was opened from (the list reopens with its search and page), or to the list itself
  const handleBack = () => {
    if ((window.history.state?.idx || 0) > 0) navigate(-1);
    else navigate("/agent/policy");
  };

  const handleRenew = () => {
    navigate(`/agent/renewalquote/coveragedetails/coveragedetail/${policyId}`);
  };

  const handleClaim = () => {
    navigate("/agent/claimrequest/claimdetails/new", {
      state: {
        policyId,
        leadRefId: rawPolicyData?.leadId,
        quoteRefId: rawPolicyData?.quoteRefId,
        policyRefId: policyId,
        clientId: rawPolicyData?.clientId || policyDetails?.clientId,
      },
    });
  };

  const handleDownload = async (documentUrl, documentName) => {
    try {
      if (!documentUrl) {
        toast.current?.show({
          severity: "warn",
          summary: t("policyDetail.noDocument"),
          detail: t("policyDetail.noPolicyDocumentAvailable"),
          life: 3000,
        });
        return;
      }

      toast.current?.show({
        severity: "info",
        summary: t("policyDetail.openingDocument"),
        detail: t("policyDetail.pleaseWaitPreparingDocument"),
        life: 2000,
      });

      let downloadUrl = documentUrl;
      if (
        documentUrl.includes("s3.") ||
        documentUrl.includes("amazonaws.com")
      ) {
        const urlMap = await s3Service.getPresignedDownloadUrls([documentUrl]);
        if (urlMap?.success && urlMap?.data?.[documentUrl]) {
          downloadUrl = urlMap.data[documentUrl];
        }
      }

      window.open(downloadUrl, "_blank", "noopener,noreferrer");

      toast.current?.show({
        severity: "success",
        summary: t("policyDetail.documentOpened"),
        detail: t("policyDetail.documentOpenedInNewTab"),
        life: 3000,
      });
    } catch (downloadError) {
      logger.error("Document open error:", downloadError);
      toast.current?.show({
        severity: "error",
        summary: t("policyDetail.failedToOpenDocument"),
        detail:
          downloadError.message || t("policyDetail.failedToOpenDocumentDetail"),
        life: 3000,
      });
    }
  };

  const handleInsurancePlacingSlipOpen = async () => {
    if (!policyId) {
      toast.current?.show({
        severity: "error",
        summary: t("accounting.error"),
        detail: t("policyDetail.policyIdRequired"),
        life: 3000,
      });
      return;
    }
    setInsurancePlacingSlipLoading(true);
    try {
      await openPdfInTab(async () => {
        const response = await fetch(`${BASE_URL}${placingSlipPath()}`, { method: "GET", headers: { ...authService.getAuthHeader() } });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || t("policyDetail.failedToLoadPlacingSlip"));
        }
        return response.blob();
      });
    } catch (err) {
      logger.error("Insurance Placing Slip fetch error:", err);
      toast.current?.show({
        severity: "error",
        summary: t("policyDetail.failedToOpenDocument"),
        detail: err?.message || t("policyDetail.failedToLoadPlacingSlip"),
        life: 3000,
      });
    } finally {
      setInsurancePlacingSlipLoading(false);
    }
  };

  const closeDocumentPreview = () => {
    if (documentPreviewUrl?.startsWith?.("blob:")) {
      window.URL.revokeObjectURL(documentPreviewUrl);
    }
    setDocumentPreviewUrl(null);
    setShowDocumentDialog(false);
  };

  const handlePolicyDocumentPreview = async () => {
    if (!policyId) {
      toast.current?.show({
        severity: "error",
        summary: t("accounting.error"),
        detail: t("policyDetail.policyIdRequired"),
        life: 3000,
      });
      return;
    }
    setPolicyScheduleLoading(true);
    try {
      const result = await documentTemplateService.fetchPolicyScheduleBlob(
        policyId,
        { isFire: isFireLOB }
      );
      if (result.success && result.blob) {
        const url = window.URL.createObjectURL(result.blob);
        setDocumentPreviewUrl(url);
        setShowDocumentDialog(true);
        toast.current?.show({
          severity: "success",
          summary: t("policyDetail.documentLoaded"),
          detail: t("policyDetail.policyDocumentReady"),
          life: 3000,
        });
      } else {
        toast.current?.show({
          severity: "error",
          summary: t("policyDetail.failedToLoad"),
          detail: result.error || t("policyDetail.failedToLoadPolicyDocument"),
          life: 3000,
        });
      }
    } catch (err) {
      logger.error("Policy document preview error:", err);
      toast.current?.show({
        severity: "error",
        summary: t("policyDetail.failedToLoad"),
        detail: err?.message || t("policyDetail.failedToLoadPolicyDocument"),
        life: 3000,
      });
    } finally {
      setPolicyScheduleLoading(false);
    }
  };

  const policySchedulePath = () => `/document-templates/${isFireLOB ? "policy-schedule-fire" : "policy-schedule"}/${encodeURIComponent(policyId)}`;
  const placingSlipPath = () => `/policies/${encodeURIComponent(policyId)}/documents/insurance-placing-slip-fire`;
  const printDocument = (path, fileName) => printPdf(path, { fileName }).catch((err) => toast.current?.show({
    severity: "error",
    summary: t("policyDetail.failedToLoad"),
    detail: err?.message || t("policyDetail.failedToLoadPolicyDocument"),
    life: 5000,
  }));
  const printPolicyDocument = () => printDocument(policySchedulePath(), `policy-${policyDetails?.policyNumber || policyId}.pdf`);

  const handlePolicyDocumentOpen = async () => {
    if (!policyId) {
      toast.current?.show({
        severity: "error",
        summary: t("accounting.error"),
        detail: t("policyDetail.policyIdRequired"),
        life: 3000,
      });
      return;
    }
    setPolicyScheduleLoading(true);
    try {
      await openPdfInTab(async () => {
        const result = await documentTemplateService.fetchPolicyScheduleBlob(policyId, { isFire: isFireLOB });
        if (!result.success || !result.blob) throw new Error(result.error || t("policyDetail.failedToLoadPolicyDocument"));
        return result.blob;
      });
    } catch (err) {
      logger.error("Policy document open error:", err);
      toast.current?.show({
        severity: "error",
        summary: t("policyDetail.failedToOpenDocument"),
        detail: err?.message || t("policyDetail.failedToOpenDocumentDetail"),
        life: 3000,
      });
    } finally {
      setPolicyScheduleLoading(false);
    }
  };

  const handleGenerateInvoice = async (type) => {
    if (!policyId) {
      toast.current?.show({
        severity: "error",
        summary: t("accounting.error"),
        detail: t("policyDetail.policyIdRequired"),
        life: 3000,
      });
      return;
    }

    setInvoiceLoading((prev) => ({ ...prev, [type]: true }));

    try {
      let result;
      switch (type) {
        case "policy":
          result = await billingService.generatePolicyBillingStatement(
            policyId
          );
          break;
        case "endorsement":
          result = await billingService.generateEndorsementBillingStatement(
            policyId
          );
          break;
        case "renewal":
          result = await billingService.generateRenewalBillingStatement(
            policyId
          );
          break;
        default:
          throw new Error("Invalid invoice type");
      }

      if (result.success) {
        toast.current?.show({
          severity: "success",
          summary: t("policyDetail.invoiceGenerated"),
          detail: t("policyDetail.invoiceGeneratedDownloaded", {
            type: type.charAt(0).toUpperCase() + type.slice(1),
          }),
          life: 3000,
        });
      } else {
        throw new Error(result.error || "Failed to generate invoice");
      }
    } catch (invoiceError) {
      logger.error(`Generate ${type} invoice error:`, invoiceError);
      toast.current?.show({
        severity: "error",
        summary: t("policyDetail.invoiceGenerationFailed"),
        detail: invoiceError.message || t("policyDetail.failedToGenerateInvoice", {
          type: type.charAt(0).toUpperCase() + type.slice(1),
        }),
        life: 3000,
      });
    } finally {
      setInvoiceLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handlePremiumAccountingEntries = () => {
    if (!policyId) {
      toast.current?.show({
        severity: "error",
        summary: t("accounting.error"),
        detail: t("policyDetail.policyIdRequired"),
        life: 3000,
      });
      return;
    }

    const policyNumber =
      rawPolicyData?.policyNumber ||
      policyDetails?.policyNumber ||
      policyDetails?.PolicyNumber;

    navigate(`/agent/premium-accounting-entries/${policyId}`, {
      state: {
        policyId,
        policyNumber,
      },
    });
  };

  const handleViewEndorsement = (endorsement) => {
    if (!endorsement) {
      return;
    }

    const endorsementRef =
      endorsement.endorsementId ||
      endorsement.endorsementNumber ||
      endorsement.id;

    if (!endorsementRef) {
      toast.current?.show({
        severity: "warn",
        summary: t("policyDetail.endorsementUnavailable"),
        detail: t("policyDetail.endorsementRefMissing"),
        life: 3000,
      });
      return;
    }

    const policyRef =
      endorsement.policyId ||
      rawPolicyData?.policyId ||
      policyDetails?.policyId ||
      policyId;

    if (!policyRef) {
      toast.current?.show({
        severity: "warn",
        summary: t("policyDetail.policyRefMissing"),
        detail: t("policyDetail.cannotOpenEndorsementWithoutPolicy"),
        life: 3000,
      });
      return;
    }

    const clientRef =
      endorsement.clientId ||
      rawPolicyData?.clientId ||
      policyDetails?.clientId;

    const statusUpper = (
      endorsement.status ||
      endorsement.endorsementStatus ||
      ""
    )
      .toString()
      .toUpperCase();

    let paymentValue =
      endorsement.paymentStatus ||
      endorsement.payment ||
      endorsement.coverageChanges?.paymentStatus ||
      rawPolicyData?.paymentStatus;

    if (!paymentValue && statusUpper === "COMPLETED") {
      paymentValue = "Completed";
    }

    const paymentUpper = paymentValue
      ? paymentValue.toString().toUpperCase()
      : "";

    const navigationState = {
      endorsementNumber: endorsementRef,
      policyId: policyRef,
      clientId: clientRef,
    };

    if (statusUpper === "REJECTED") {
      navigate(`/agent/endorsement/rejected/${endorsementRef}`, {
        state: navigationState,
      });
      return;
    }

    if (statusUpper === "PROCESSING") {
      navigate(`/agent/endorsement/paymenterror/${endorsementRef}`, {
        state: navigationState,
      });
      return;
    }

    if (statusUpper === "COMPLETED" && paymentUpper === "REVIEWING") {
      navigate(`/agent/policy/paymentapproval`, {
        state: navigationState,
      });
      return;
    }

    if (statusUpper === "COMPLETED" && paymentUpper === "PENDING") {
      navigate(`/agent/endorsementdetailedview/${endorsementRef}`, {
        state: navigationState,
      });
      return;
    }

    navigate(`/agent/endorsementdetailedviewonly/${endorsementRef}`, {
      state: navigationState,
    });
  };

  const breadcrumbItems = [
    { label: t("policyDetail.breadcrumbPolicy"), command: () => navigate("/agent/clientlisting") },
    { label: t("policyDetail.breadcrumbDetailView") },
  ];
  const breadcrumbHome = { label: t("policyDetail.breadcrumbHome") };

  // A stored photo is shown through its signed URL; a bare storage key cannot be opened by the browser.
  const photoSrc = (key) => {
    if (!key) return null;
    const signed = vehiclePhotoUrls[key];
    if (signed) return signed;
    return /^(https?:)?\/\//.test(key) || key.startsWith("/") ? browserFileUrl(key) : null;
  };
  const vehicleImages = [
    [rawPolicyData?.vehicleLeftSidePhoto, t("policyDetail.vehiclePhotoLeftSide")],
    [rawPolicyData?.vehicleRightSidePhoto, t("policyDetail.vehiclePhotoRightSide")],
    [rawPolicyData?.vehicleFrontSidePhoto, t("policyDetail.vehiclePhotoFrontSide")],
    [rawPolicyData?.vehicleRearSidePhoto, t("policyDetail.vehiclePhotoRearSide")],
    [rawPolicyData?.vehicleInteriorDashboardPhoto, t("policyDetail.vehiclePhotoInterior")],
  ]
    .map(([key, alt]) => ({ itemImageSrc: photoSrc(key), alt }))
    .filter((image) => image.itemImageSrc);

  const galleryItemTemplate = (item) => (
    <VehiclePhoto className="vehicle-gallery-image" src={item.itemImageSrc} alt={item.alt} />
  );

  const galleryThumbnailTemplate = (item) => (
    <VehiclePhoto className="vehicle-gallery-thumbnail" src={item.itemImageSrc} alt={item.alt} />
  );

  if (loading) {
    return (
      <div className="policy-detail-container">
        <div className="policy-state policy-state--loading">
          <Skeleton width="40%" height="2.5rem" />
          <Skeleton width="100%" height="12rem" />
          <Skeleton width="100%" height="20rem" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="policy-detail-container">
        <div className="policy-state policy-state--error">
          <h3>{t("policyDetail.unableToLoad")}</h3>
          <p>{error}</p>
          <Button label={t("policyDetail.goBack")} onClick={handleBack} />
        </div>
      </div>
    );
  }

  if (!policyDetails) {
    return (
      <div className="policy-detail-container">
        <div className="policy-state policy-state--empty">
          <h3>{t("policyDetail.noPolicyDetails")}</h3>
          <p>{t("policyDetail.tryRefreshing")}</p>
          <Button label={t("policyDetail.goBack")} onClick={handleBack} />
        </div>
      </div>
    );
  }

  const quotation = rawPolicyData?.quotation || {};
  const lead = rawPolicyData?.lead || {};
  const vehicleDetails = quotation?.insuranceVehicleDetails?.[0] || {};
  const productType =
    quotation?.productType ||
    rawPolicyData?.product ||
    policyDetails?.ProductDescription;
  const isFireLOB = isFireLob(productType);
  // vehicle details, photos and the motor coverage only for motor and CTPL (not Credit Life, Personal Accident ...)
  const isMotorLOB = !isFireLOB && !isOtherLob(rawPolicyData?.lob || quotation?.lob || productType);
  // Co-insurance participants: risk_participants from the API (lead first, amounts split by share), else the quotation document
  const apiParticipants = Array.isArray(rawPolicyData?.participants) ? rawPolicyData.participants : [];
  const participantDetails = apiParticipants.length
    ? apiParticipants.map((p) => ({
        insuranceCompanyName: p.insuranceCompanyName,
        participantName: p.insurerReference ? `${p.insuranceCompanyName} (${p.insurerReference})` : p.insuranceCompanyName,
        sharePercentage: String(p.sharePercent),
        premiumAmount: p.premiumTotal,
      }))
    : quotation?.participantDetails || rawPolicyData?.participantDetails || [];
  const hasCoInsuranceParticipants = participantDetails.some(
    (participant) => {
      const name =
        participant.insuranceCompanyName || participant.participantName;
      const share = String(participant.sharePercentage ?? "").trim();
      return Boolean(name) && share !== "";
    }
  );
  const showCoInsuranceSection =
    (apiParticipants.length > 1 || Boolean(rawPolicyData?.isCoInsurance || quotation?.isCoInsurance)) &&
    hasCoInsuranceParticipants;
  const fireRiskDetails =
    rawPolicyData?.fireRiskDetails ||
    quotation?.fireRiskDetails ||
    quotation?.fireRisk ||
    {};
  const firePremiumDetails =
    rawPolicyData?.firePremiumDetails ||
    quotation?.firePremiumDetails ||
    quotation?.firePremium ||
    {};
  const recorded = (items) => recordedItems(items, t("policyDetail.nA"));
  const fireSumInsured = Object.keys(firePremiumDetails?.sumInsured || {}).length
    ? firePremiumDetails.sumInsured
    : fireRiskDetails?.sumInsured || {};
  const fireCoverBreakup = firePremiumDetails?.coverBreakup || [];
  const endorsements = Array.isArray(rawPolicyData?.endorsements)
    ? rawPolicyData.endorsements.filter(Boolean)
    : [];
  const clientAddress = [lead.city, lead.province, lead.country]
    .filter(Boolean)
    .join(", ");

  const headerMetaItems = [
    {
      key: "policy-number",
      icon: "pi pi-hashtag",
      text: policyDetails.policyNumber || "N/A",
    },
    {
      key: "client-name",
      icon: "pi pi-user",
      text: policyDetails.ClientName || "N/A",
    },
    {
      key: "policy-expiry",
      icon: "pi pi-calendar",
      text: formatDate(policyDetails.PolicyExpiry),
    },
    {
      key: "payment-status",
      content: (
        <StatusBadge
          status={policyDetails.Payment || "Pending"}
          type="payment"
        />
      ),
    },
  ];

  const parseAmount = (value) => {
    const n = parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const effectiveGrossPremium = (() => {
    const fromStored = parseAmount(
      premiumBreakdown?.grossPremium ||
        policyDetails.GrossPremium ||
        rawPolicyData?.grossPremium ||
        (isFireLOB && firePremiumDetails?.totalPremium != null
          ? firePremiumDetails.totalPremium
          : null) ||
        quotation.grossPremium
    );
    if (fromStored > 0) {
      return fromStored;
    }
    // Derive from premium components when grossPremium is null on older policies
    const net = parseAmount(rawPolicyData?.netPremium || quotation.netPremium);
    if (net <= 0) {
      return 0;
    }
    const dst = parseAmount(
      rawPolicyData?.documentaryStampTax || quotation.documentaryStampTax
    );
    const vat = parseAmount(
      rawPolicyData?.valueAddedTax || quotation.valueAddedTax
    );
    const lgt = parseAmount(
      rawPolicyData?.localGovernmentTax || quotation.localGovernmentTax
    );
    const others = parseAmount(
      rawPolicyData?.accountPremiumOthers || quotation.accountPremiumOthers
    );
    const discount = parseAmount(
      rawPolicyData?.discount || quotation.discount
    );
    const derived = net + dst + vat + lgt + others - discount;
    return derived > 0 ? derived : net;
  })();

  const coInsuranceTableRows = showCoInsuranceSection
    ? (() => {
        const rows = participantDetails.map((participant) => {
          const share = parseAmount(participant.sharePercentage);
          const apiPremium = parseAmount(participant.premiumAmount);
          const premiumAmount =
            apiPremium > 0
              ? apiPremium
              : (effectiveGrossPremium * share) / 100;
          return {
            ...participant,
            sharePercentage: share,
            premiumAmount,
            status:
              participant.status ||
              rawPolicyData?.status ||
              t("policyDetail.nA"),
            isTotal: false,
          };
        });
        const totals = rows.reduce(
          (acc, row) => ({
            share: acc.share + row.sharePercentage,
            premium: acc.premium + row.premiumAmount,
          }),
          { share: 0, premium: 0 }
        );
        return [
          ...rows,
          {
            isTotal: true,
            insuranceCompanyName: t("policyDetail.total"),
            participantName: t("policyDetail.total"),
            sharePercentage: totals.share,
            premiumAmount: totals.premium,
            status: "",
          },
        ];
      })()
    : [];

  const highlightCards = [
    {
      key: "gross-premium",
      label: t("policyDetail.grossPremium"),
      value: formatCurrency(
        premiumBreakdown?.grossPremium ||
          policyDetails.GrossPremium ||
          (isFireLOB && firePremiumDetails?.totalPremium != null
            ? firePremiumDetails.totalPremium
            : quotation.grossPremium)
      ),
      tone: "success",
    },
    {
      key: "expiry",
      label: t("policyDetail.expiryDate"),
      value: formatDate(policyDetails.PolicyExpiry),
      helper: expiryHelper(),
      tone: isRenewable() ? "warning" : undefined,
    },
    {
      key: "client",
      label: t("policyDetail.clientId"),
      value: policyDetails.ClientCode || rawPolicyData?.client?.clientCode || t("policyDetail.nA"),
      helper:
        policyDetails.ClientName ||
        rawPolicyData?.client?.fullName ||
        rawPolicyData?.insuredName ||
        undefined,
    },
  ];

  const policySnapshotItems = [
    {
      key: "policyNumber",
      label: t("policyDetail.policyNumber"),
      value: policyDetails.policyNumber || t("policyDetail.nA"),
    },
    {
      key: "paymentStatus",
      label: t("policyDetail.paymentStatus"),
      value: (
        <StatusBadge
          status={policyDetails.Payment || "Pending"}
          type="payment"
        />
      ),
    },
    {
      key: "productType",
      label: t("policyDetail.productType"),
      value: policyDetails.ProductDescription === "Fire and Allied Perils"
        ? t("dashboard.Fire and Allied Perils")
        : (policyDetails.ProductDescription || t("policyDetail.nA")),
    },
    {
      key: "policyIssued",
      label: t("policyDetail.policyIssued"),
      value: formatDate(policyDetails.PolicyIssued),
    },
    {
      key: "policyExpiry",
      label: t("policyDetail.policyExpiry"),
      value: formatDate(policyDetails.PolicyExpiry),
    },
    {
      key: "productionDate",
      label: t("policyDetail.productionDate"),
      value: formatDate(rawPolicyData?.production),
    },
    {
      key: "inceptionDate",
      label: t("policyDetail.inceptionDate"),
      value: formatDate(rawPolicyData?.inception),
    },
  ];

  const insuredItems = [
    {
      key: "clientName",
      label: t("policyDetail.clientName"),
      value: policyDetails.ClientName || t("policyDetail.nA"),
    },
    {
      key: "clientId",
      label: t("policyDetail.clientId"),
      value: policyDetails.ClientCode || rawPolicyData?.client?.clientCode || t("policyDetail.nA"),
    },
    {
      key: "idCard",
      label: t("policyDetail.idCard"),
      value: policyDetails.idCard || t("policyDetail.nA"),
    },
    {
      key: "idCardNumber",
      label: t("policyDetail.idCardNumber"),
      value: policyDetails.idCardNumber || t("policyDetail.nA"),
    },
    {
      key: "email",
      label: t("policyDetail.email"),
      value: lead.emailId || t("policyDetail.nA"),
    },
    {
      key: "contactNumber",
      label: t("policyDetail.contactNumber"),
      value: lead.contactNumber || t("policyDetail.nA"),
    },
    {
      key: "address",
      label: t("policyDetail.address"),
      value: clientAddress || t("policyDetail.nA"),
    },
  ];

  const vehiclePrimaryItems = [
    {
      key: "vehicleBrand",
      label: t("policyDetail.vehicleBrand"),
      value:
        rawPolicyData?.vehicleBrand || vehicleDetails?.vehicleBrand || t("policyDetail.nA"),
    },
    {
      key: "vehicleModel",
      label: t("policyDetail.vehicleModel"),
      value:
        rawPolicyData?.vehicleModel || vehicleDetails?.vehicleModel || t("policyDetail.nA"),
    },
    {
      key: "modelVariant",
      label: t("policyDetail.modelVariant"),
      value:
        rawPolicyData?.modelVariant || vehicleDetails?.modelVariant || t("policyDetail.nA"),
    },
    {
      key: "modelYear",
      label: t("policyDetail.modelYear"),
      value: rawPolicyData?.modelYear || vehicleDetails?.modelYear || t("policyDetail.nA"),
    },
    {
      key: "vehicleColor",
      label: t("policyDetail.vehicleColor"),
      value:
        rawPolicyData?.vehicleColor || vehicleDetails?.vehicleColor || t("policyDetail.nA"),
    },
    {
      key: "seatingCapacity",
      label: t("policyDetail.seatingCapacity"),
      value:
        rawPolicyData?.seatingCapacity ||
        vehicleDetails?.seatingCapacity ||
        t("policyDetail.nA"),
    },
  ];

  const vehicleIdentifierItems = [
    {
      key: "motorNumber",
      label: t("policyDetail.motorNumber"),
      value: policyDetails.motorNumber || t("policyDetail.nA"),
    },
    {
      key: "chassisNumber",
      label: t("policyDetail.chassisNumber"),
      value: policyDetails.chassisNumber || t("policyDetail.nA"),
    },
    {
      key: "plateNumber",
      label: t("policyDetail.plateNumber"),
      value: policyDetails.plateNumber || t("policyDetail.nA"),
    },
    {
      key: "certificateNumber",
      label: t("policyDetail.certificateNumber"),
      value: policyDetails.certNumber || t("policyDetail.nA"),
    },
    {
      key: "mvFileNumber",
      label: t("policyDetail.mvFileNumber"),
      value: policyDetails.mvFileNumber || t("policyDetail.nA"),
    },
    {
      key: "mortgage",
      label: t("policyDetail.mortgage"),
      value: policyDetails.mortgage || t("policyDetail.nA"),
    },
    {
      key: "truckType",
      label: t("policyDetail.truckType"),
      value: policyDetails.truckType || t("policyDetail.nA"),
    },
    {
      key: "aluminum",
      label: t("policyDetail.aluminum"),
      value: policyDetails.aluminum || t("policyDetail.nA"),
    },
    {
      key: "airBag",
      label: t("policyDetail.airBag"),
      value: policyDetails.airBag || t("policyDetail.nA"),
    },
    {
      key: "tnvs",
      label: t("policyDetail.tnvs"),
      value: policyDetails.tnvs || t("policyDetail.nA"),
    },
  ];

  const accessoryItems = [
    {
      key: "aircon",
      label: t("policyDetail.aircon"),
      rawValue: rawPolicyData?.aircon ?? quotation.aircon,
      value: formatCurrency(rawPolicyData?.aircon || quotation.aircon),
    },
    {
      key: "stereo",
      label: t("policyDetail.stereo"),
      rawValue: rawPolicyData?.stereo ?? quotation.stereo,
      value: formatCurrency(rawPolicyData?.stereo || quotation.stereo),
    },
    {
      key: "magWheels",
      label: t("policyDetail.magWheels"),
      rawValue: rawPolicyData?.magWheels ?? quotation.magWheels,
      value: formatCurrency(rawPolicyData?.magWheels || quotation.magWheels),
    },
    {
      key: "others",
      label: t("policyDetail.others"),
      rawValue: rawPolicyData?.others ?? quotation.others,
      value: formatCurrency(rawPolicyData?.others || quotation.others),
    },
  ];

  const accessoryHasValues = accessoryItems.some((item) => {
    if (
      item.rawValue === "" ||
      item.rawValue === null ||
      item.rawValue === undefined
    ) {
      return false;
    }
    const numericValue = Number(item.rawValue);
    if (Number.isNaN(numericValue)) {
      return Boolean(item.rawValue);
    }
    return numericValue > 0;
  });

  const coverageItems = [
    {
      key: "lossDamageCoverage",
      label: t("policyDetail.lossDamageCoverage"),
      value: formatCurrency(
        rawPolicyData?.lossAndDamageCoverage || quotation.lossAndDamageCoverage
      ),
    },
    {
      key: "lossDamagePremium",
      label: t("policyDetail.ldPremium"),
      value: formatCurrency(
        rawPolicyData?.lossAndDamageCoveragePremium ||
          quotation.lossAndDamageCoveragePremium
      ),
    },
    {
      key: "actsOfNaturePremium",
      label: t("policyDetail.actsOfNaturePremium"),
      value: formatCurrency(
        rawPolicyData?.actsOfNaturePremium || quotation.actsOfNaturePremium
      ),
    },
    {
      key: "bodilyInjury",
      label: t("policyDetail.bodilyInjury"),
      value: formatCurrency(
        rawPolicyData?.bodilyInjury || quotation.bodilyInjury
      ),
    },
    {
      key: "bodilyInjuryPremium",
      label: t("policyDetail.biPremium"),
      value: formatCurrency(
        rawPolicyData?.bodilyInjuryCoveragePremium ||
          quotation.bodilyInjuryCoveragePremium
      ),
    },
    {
      key: "propertyDamage",
      label: t("policyDetail.propertyDamage"),
      value: formatCurrency(
        rawPolicyData?.propertyDamage || quotation.propertyDamage
      ),
    },
    {
      key: "propertyDamagePremium",
      label: t("policyDetail.pdPremium"),
      value: formatCurrency(
        rawPolicyData?.propertyDamageCoveragePremium ||
          quotation.propertyDamageCoveragePremium
      ),
    },
    {
      key: "appaCoverage",
      label: t("policyDetail.appaCoverage"),
      value: formatCurrency(
        rawPolicyData?.autoPassengerPersonalAccident ||
          quotation.autoPassengerPersonalAccident
      ),
    },
    {
      key: "appaPremium",
      label: t("policyDetail.appaPremium"),
      value: formatCurrency(
        rawPolicyData?.APPAcoveragePremium || quotation.APPAcoveragePremium
      ),
    },
    {
      key: "totalSumInsured",
      label: t("policyDetail.totalSumInsured"),
      value: formatCurrency(
        rawPolicyData?.totalCoverage ||
          quotation.totalSumInsured ||
          rawPolicyData?.totalSumInsured ||
          rawPolicyData?.sumInsured
      ),
      emphasis: true,
      always: true,
    },
  ];

  const discountPercent = rawPolicyData?.discount ?? quotation.discount ?? 0;
  const discountDisplay =
    discountPercent === null ||
    discountPercent === undefined ||
    discountPercent === ""
      ? "0%"
      : `${discountPercent}%`;

  // Tax labels show the rate actually priced on this policy (tax / net premium), else the configured rate (tax.*
  // settings); the labels used to be fixed text (e.g. LGT 2% while 0.75% was applied).
  const pricedNet = parseAmount(premiumBreakdown?.netPremium || quotation.netPremium);
  const taxRateLabel = (amount, configuredRate) => {
    const value = parseAmount(amount);
    const pct = pricedNet > 0 && value > 0 ? (value / pricedNet) * 100 : Number(configuredRate || 0) * 100;
    return `${Number(pct.toFixed(2))}%`;
  };

  const premiumLineItems = [
    {
      key: "netPremium",
      label: t("policyDetail.netPremium"),
      amount: formatCurrency(
        premiumBreakdown?.netPremium || quotation.netPremium
      ),
    },
    {
      key: "dst",
      label: t("policyDetail.documentaryStampTaxRate", { rate: taxRateLabel(premiumBreakdown?.documentaryStampTax || quotation.documentaryStampTax, taxRates.documentaryStampTax) }),
      amount: formatCurrency(
        premiumBreakdown?.documentaryStampTax || quotation.documentaryStampTax
      ),
    },
    {
      key: "vat",
      label: t("policyDetail.valueAddedTaxRate", { rate: taxRateLabel(premiumBreakdown?.valueAddedTax || quotation.valueAddedTax, taxRates.valueAddedTax) }),
      amount: formatCurrency(
        premiumBreakdown?.valueAddedTax || quotation.valueAddedTax
      ),
    },
    {
      key: "lgt",
      label: t("policyDetail.localGovernmentTaxRate", { rate: taxRateLabel(premiumBreakdown?.localGovernmentTax || quotation.localGovernmentTax, taxRates.localGovernmentTax) }),
      amount: formatCurrency(
        premiumBreakdown?.localGovernmentTax || quotation.localGovernmentTax
      ),
    },
    {
      key: "others",
      label: t("policyDetail.otherPremium"),
      amount: formatCurrency(
        premiumBreakdown?.accountPremiumOthers || quotation.accountPremiumOthers
      ),
    },
    {
      key: "discount",
      label: t("policyDetail.discount"),
      amount: discountDisplay,
    },
    {
      key: "gross",
      label: t("policyDetail.grossPremium"),
      amount: formatCurrency(
        premiumBreakdown?.grossPremium ||
          policyDetails.GrossPremium ||
          quotation.grossPremium
      ),
      isTotal: true,
    },
  ];

  const invoiceContext = (() => {
    const isRenewal =
      rawPolicyData?.policyType === "renewal" ||
      rawPolicyData?.isRenewal === true ||
      policyDetails?.policyType === "renewal";
    const isEndorsement =
      rawPolicyData?.policyType === "endorsement" ||
      rawPolicyData?.isEndorsement === true ||
      policyDetails?.policyType === "endorsement";

    let type = "policy";
    if (isRenewal) {
      type = "renewal";
    } else if (isEndorsement) {
      type = "endorsement";
    }
    const labels = {
      policy: t("policyDetail.generatePolicyInvoice"),
      endorsement: t("policyDetail.generateEndorsementInvoice"),
      renewal: t("policyDetail.generateRenewalInvoice"),
    };

    return {
      type,
      label: labels[type],
      isLoading: invoiceLoading[type],
      isBusy:
        invoiceLoading.policy ||
        invoiceLoading.endorsement ||
        invoiceLoading.renewal,
    };
  })();

  const quotationReferenceValue = rawPolicyData?.quoteRefId ? (
    <Button
      label={
        quotation.quotationNumber ||
        rawPolicyData?.quoteRefId ||
        t("policyDetail.viewQuotation")
      }
      className="p-button-link p-button-sm"
      onClick={() =>
        navigate(`/agent/quotedetailview/${rawPolicyData?.quoteRefId}`)
      }
    />
  ) : (
    "N/A"
  );

  const relatedRecordItems = [
    {
      key: "quotationReference",
      label: t("policyDetail.quotationReference"),
      value: quotationReferenceValue,
    },
    {
      key: "insuranceCompany",
      label: t("policyDetail.insuranceCompany"),
      value: quotation.participantDetails?.[0]?.participantName || participantDetails[0]?.insuranceCompanyName || rawPolicyData?.insuranceCompanyName || t("policyDetail.nA"),
    },
    {
      key: "accountCode",
      label: t("policyDetail.accountCode"),
      value: quotation.accountCode || t("policyDetail.nA"),
    },
  ];

  // Direct bill: the client pays the premium to the insurer; the broker only collects its commission from the insurer
  const isDirectBill = rawPolicyData?.billingMode === "direct" || rawPolicyData?.isDirectBilled === true;
  const paymentStatusIsPending = rawPolicyData?.paymentStatus === "Pending" && !isDirectBill;

  return (
    <div className="policy-detail-container">
      <Toast ref={toast} />
      <div className="policy-detail-view">
        <div className="policy-header">
          <div className="header-left">
            <button type="button" className="header-back" onClick={handleBack}>
              <SvgLeftArrow />
              <span>{t("policyDetail.backToPolicies")}</span>
            </button>
            <div className="header-title">
              <h1>{t("policyDetail.title")}</h1>
              <p>{t("policyDetail.policyLabel")} {policyDetails.policyNumber || t("policyDetail.nA")}</p>
            </div>
            <div className="header-meta">
              {headerMetaItems.map((item) => (
                <div
                  className={`meta-item${
                    item.content ? " meta-item--status" : ""
                  }`}
                  key={item.key}
                >
                  {item.icon ? (
                    <i
                      className={`meta-icon ${item.icon}`}
                      aria-hidden="true"
                    />
                  ) : null}
                  {item.content ? (
                    item.content
                  ) : (
                    <span className="meta-text">{item.text}</span>
                  )}
                </div>
              ))}
            </div>
            <BreadCrumb
              model={breadcrumbItems}
              home={breadcrumbHome}
              className="breadcrumb"
              separatorIcon={<SvgDot color="#000" />}
            />
          </div>
          <div className="header-actions">
            {isRenewable() && (
              <Button
                label={t("policyDetail.renew")}
                icon="pi pi-refresh"
                onClick={handleRenew}
                className="p-button-outlined"
              />
            )}

            {hasPermission("write:claims") && (
              <Button
                label={t("policyDetail.claim")}
                icon="pi pi-file"
                onClick={handleClaim}
                className="p-button-outlined"
              />
            )}
            <Button
              label={t("policyDetail.viewPolicy")}
              icon="pi pi-external-link"
              onClick={handlePolicyDocumentOpen}
              loading={policyScheduleLoading}
              disabled={policyScheduleLoading}
            />
            {policyDetails.Payment == "Completed" && (
              <Button
                label={t("policyDetail.endorsement")}
                icon="pi pi-credit-card"
                onClick={() =>
                  navigate(`/agent/policy`, {
                    state: {
                      policyId: policyId,
                      showEndorsementDialog: true,
                      productType:
                        rawPolicyData?.quotation?.productType ||
                        rawPolicyData?.product ||
                        policyDetails?.ProductDescription ||
                        null,
                      lob:
                        rawPolicyData?.quotation?.productType ||
                        rawPolicyData?.product ||
                        policyDetails?.ProductDescription ||
                        null,
                    },
                  })
                }
                className="p-button-outlined"
              />
            )}
          </div>
        </div>
        {rawPolicyData?.renewedTo && (
          <NextStep title={t("policyDetail.renewedTitle")} text={t("policyDetail.renewedText")}
            actions={[{ key: "renewal", label: t("policyDetail.openRenewalTerm"), to: `/agent/policydetail/${rawPolicyData.renewedTo}` }]} />
        )}
        {rawPolicyData?.renewedFrom && (
          <NextStep title={t("policyDetail.renewalOfTitle")} text={t("policyDetail.renewalOfText")}
            actions={[{ key: "expiring", label: t("policyDetail.openExpiringTerm"), to: `/agent/policydetail/${rawPolicyData.renewedFrom}` }]} />
        )}
        {paymentStatusIsPending && hasPermission("write:receipts") && (
          <NextStep title={t("policyDetail.nextStepCollect")} text={t("policyDetail.nextStepCollectText", { bill: rawPolicyData?.billNumber || "" })}
            actions={[{ key: "receipt", label: t("policyDetail.recordReceipt"),
              to: `/accounts/receipts/addreceipts?client=${encodeURIComponent(rawPolicyData?.client?.clientCode || "")}&policy=${encodeURIComponent(policyDetails.policyNumber || "")}` }]} />
        )}

        <div className="policy-highlights">
          {highlightCards.map((card) => (
            <HighlightCard
              key={card.key}
              label={card.label}
              value={card.value}
              helper={card.helper}
              tone={card.tone}
            />
          ))}
        </div>

        <div className="policy-content">
          <div className="policy-main">
            <div className="policy-sections">
              <SectionCard title={t("policyDetail.policyDetails")}>
                <InfoGrid items={policySnapshotItems} />
              </SectionCard>

              {showCoInsuranceSection && (
                <SectionCard
                  className="co-insurance-ratios-section"
                  title={t("policyDetail.coInsuranceDetails")}
                  actions={
                    <span className="co-insurance-policy-pill">
                      {t("policyDetail.coInsurancePolicyYes")}
                    </span>
                  }
                >
                  <DataTable
                    value={coInsuranceTableRows}
                    className="co-insurance-ratios-table"
                    size="small"
                    rowClassName={(rowData) =>
                      rowData.isTotal ? "co-insurance-total-row" : ""
                    }
                  >
                    <Column
                      field="insuranceCompanyName"
                      header={t("policyDetail.insurer")}
                      body={(rowData) =>
                        rowData.isTotal
                          ? t("policyDetail.total")
                          : rowData.insuranceCompanyName ||
                            rowData.participantName ||
                            t("policyDetail.nA")
                      }
                    />
                    <Column
                      field="sharePercentage"
                      header={t("policyDetail.insurerSharePercent")}
                      body={(rowData) =>
                        `${rowData.sharePercentage || 0}%`
                      }
                    />
                    <Column
                      field="premiumAmount"
                      header={t("policyDetail.premiumAllocationLc")}
                      body={(rowData) =>
                        formatCurrency(rowData.premiumAmount ?? 0)
                      }
                    />
                    <Column
                      field="status"
                      header={t("policyDetail.status")}
                      body={(rowData) => {
                        if (rowData.isTotal) {
                          return null;
                        }
                        const status = rowData.status || t("policyDetail.nA");
                        const isActive =
                          String(status).toLowerCase() === "active";
                        return (
                          <span
                            className={`co-insurance-status${
                              isActive ? " co-insurance-status--active" : ""
                            }`}
                          >
                            {status}
                          </span>
                        );
                      }}
                    />
                  </DataTable>
                </SectionCard>
              )}

              <SectionCard title={t("policyDetail.insuredDetails")}>
                <InfoGrid items={insuredItems} />
              </SectionCard>

              {isMotorLOB && (
                <SectionCard title={t("policyDetail.vehicleDetails")}>
                  {recorded([...vehiclePrimaryItems, ...vehicleIdentifierItems]).length ? (
                    <InfoGrid items={recorded([...vehiclePrimaryItems, ...vehicleIdentifierItems])} />
                  ) : (
                    <div className="info-empty">{t("policyDetail.noVehicleDetails")}</div>
                  )}
                  {vehicleImages.length > 0 && (
                    <div className="media-block">
                      <div className="media-block-header">
                        <h4>{t("policyDetail.vehiclePhotos")}</h4>
                        <span>{t("policyDetail.photosCount", { count: vehicleImages.length })}</span>
                      </div>
                      <Galleria
                        className="vehicle-gallery"
                        value={vehicleImages}
                        numVisible={5}
                        item={galleryItemTemplate}
                        thumbnail={galleryThumbnailTemplate}
                      />
                    </div>
                  )}
                  {accessoryHasValues && (
                    <div className="accessory-block">
                      <h4>{t("policyDetail.accessories")}</h4>
                      <InfoGrid items={accessoryItems} />
                    </div>
                  )}
                </SectionCard>
              )}

              {isFireLOB && (
                <>
                  <SectionCard title={t("policyDetail.riskDetails")}>
                    <InfoGrid
                      items={[
                        {
                          key: "constructionType",
                          label: t("policyDetail.constructionType"),
                          value: fireRiskDetails.constructionType || t("policyDetail.nA"),
                        },
                        {
                          key: "buildingType",
                          label: t("policyDetail.buildingType"),
                          value: fireRiskDetails.buildingType || t("policyDetail.nA"),
                        },
                        {
                          key: "locationCode",
                          label: t("policyDetail.locationCode"),
                          value: fireRiskDetails.locationCodeDescription || t("policyDetail.nA"),
                        },
                        {
                          key: "locationAddress",
                          label: t("policyDetail.locationAddress"),
                          value: fireRiskDetails.locationAddress || t("policyDetail.nA"),
                        },
                        {
                          key: "occupancyType",
                          label: t("policyDetail.occupancyType"),
                          value: fireRiskDetails.occupancyType || t("policyDetail.nA"),
                        },
                        {
                          key: "natureOfBusiness",
                          label: t("policyDetail.natureOfBusiness"),
                          value: fireRiskDetails.natureOfBusiness || t("policyDetail.nA"),
                        },
                        {
                          key: "earthquakeZone",
                          label: t("policyDetail.earthquakeZone"),
                          value: fireRiskDetails.earthquakeZone || t("policyDetail.nA"),
                        },
                        {
                          key: "noOfFloors",
                          label: t("policyDetail.noOfFloors"),
                          value: fireRiskDetails.noOfFloors ?? t("policyDetail.nA"),
                        },
                        {
                          key: "sectionType",
                          label: t("policyDetail.sectionType"),
                          value: fireRiskDetails.sectionType || t("policyDetail.nA"),
                        },
                        {
                          key: "fireProtection",
                          label: t("policyDetail.fireProtection"),
                          value: fireRiskDetails.fireProtection || t("policyDetail.nA"),
                        },
                      ]}
                    />
                  </SectionCard>
                  <SectionCard title={t("policyDetail.sumInsuredAndCoverage")}>
                    <InfoGrid
                      items={[
                        ["building", "Building"],
                        ["plantAndMachinery", "PlantAndMachinery"],
                        ["otherContents", "OtherContents"],
                        ["grossProfit", "GrossProfit"],
                        ["wages", "Wages"],
                        ["lossOfRent", "LossOfRent"],
                      ]
                        .filter(([, field]) => Number(fireSumInsured[field]) > 0)
                        .map(([key, field]) => ({ key, label: t(`policyDetail.${key}`), value: formatCurrency(fireSumInsured[field]) }))}
                    />
                    {fireCoverBreakup.length > 0 && (
                      <div className="accessory-block">
                        <h4>{t("policyDetail.coverageBreakup")}</h4>
                        <InfoGrid
                          items={fireCoverBreakup.map((cover, i) => {
                            const descKey = cover.coverDesc && COVER_DESC_TO_I18N_KEY[cover.coverDesc];
                            const label = descKey ? t(descKey) : (cover.coverDesc || t("policyDetail.coverNumber", { number: i + 1 }));
                            return {
                              key: `cover-${i}`,
                              label,
                              value: formatCurrency(cover.premium ?? 0),
                            };
                          })}
                        />
                      </div>
                    )}
                  </SectionCard>
                </>
              )}

              {isMotorLOB && (
                <SectionCard title={t("policyDetail.coverageDetails")}>
                  <InfoGrid items={recorded(coverageItems)} />
                </SectionCard>
              )}

              <SectionCard
                title={t("policyDetail.premiumBreakdown")}
                subtitle={
                  premiumBreakdown?._calculated
                    ? t("policyDetail.calculatedFromGross")
                    : undefined
                }
              >
                <div className="premium-breakdown">
                  <div className="breakdown-list">
                    {premiumLineItems.map((item) => (
                      <div
                        className={`breakdown-item${
                          item.isTotal ? " is-total" : ""
                        }`}
                        key={item.key}
                      >
                        <span className="breakdown-label">{item.label}</span>
                        <span
                          className={`breakdown-amount${
                            item.isTotal ? " is-total" : ""
                          }`}
                        >
                          {item.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title={t("policyDetail.endorsements")}
                className="endorsement-section"
              >
                {endorsements.length === 0 ? (
                  <div className="endorsement-empty-state">
                    {t("policyDetail.noEndorsementsRecorded")}
                  </div>
                ) : (
                  <div className="endorsement-list">
                    {endorsements.map((endorsement, index) => {
                      const endorsementRef =
                        endorsement.endorsementId ||
                        endorsement.endorsementNumber ||
                        endorsement.id ||
                        `endorsement-${index}`;
                      const typeText = formatEndorsementTypes(
                        endorsement.endorsementTypeIds ||
                          endorsement.endorsementTypeId,
                        t
                      );
                      const hasTypeInfo = Boolean(
                        typeText && typeText !== t("policyDetail.nA")
                      );
                      const typeLabel = hasTypeInfo
                        ? `${typeText.includes(",") ? t("policyDetail.typesLabel") : t("policyDetail.typeLabel")}: ${typeText}`
                        : `${t("policyDetail.typesLabel")}: ${t("policyDetail.nA")}`;
                      const documentData =
                        resolveEndorsementDocument(endorsement);
                      const statusValue =
                        endorsement.status || endorsement.endorsementStatus;
                      let paymentStatusValue =
                        endorsement.paymentStatus ||
                        endorsement.payment ||
                        endorsement.coverageChanges?.paymentStatus;

                      if (
                        !paymentStatusValue &&
                        statusValue &&
                        statusValue.toString().toUpperCase() === "COMPLETED"
                      ) {
                        paymentStatusValue = "Completed";
                      }

                      const effectiveDate =
                        endorsement.completionDetails?.inceptionDate ||
                        endorsement.effectiveDate;
                      const issuedDate =
                        endorsement.completionDetails?.issuedDate ||
                        endorsement.issuedDate;
                      const expiryDate =
                        endorsement.completionDetails?.expiryDate ||
                        endorsement.expiryDate;

                      const endorsementInfo = [
                        {
                          key: "endorsementId",
                          label: t("policyDetail.endorsementId"),
                          value: endorsement.endorsementId || t("policyDetail.nA"),
                        },
                        {
                          key: "policyId",
                          label: t("policyDetail.policyId"),
                          value:
                            endorsement.policyId ||
                            rawPolicyData?.policyId ||
                            t("policyDetail.nA"),
                        },
                        {
                          key: "effectiveDate",
                          label: t("policyDetail.effectiveDate"),
                          value: formatDate(effectiveDate),
                        },
                        {
                          key: "issuedDate",
                          label: t("policyDetail.policyIssued"),
                          value: formatDate(issuedDate),
                        },
                        {
                          key: "expiryDate",
                          label: t("policyDetail.policyExpiry"),
                          value: formatDate(expiryDate),
                        },
                        {
                          key: "submittedOn",
                          label: t("policyDetail.submittedOn"),
                          value: formatDateTime(endorsement.submittedOn),
                        },
                        {
                          key: "completedAt",
                          label: t("policyDetail.completedAt"),
                          value: formatDateTime(endorsement.completedAt),
                        },
                        {
                          key: "paymentStatus",
                          label: t("policyDetail.paymentStatus"),
                          value: paymentStatusValue ? (
                            <StatusBadge
                              status={paymentStatusValue}
                              type="payment"
                              size="sm"
                              showTooltip={false}
                            />
                          ) : (
                            t("policyDetail.nA")
                          ),
                        },
                        {
                          key: "document",
                          label: t("policyDetail.document"),
                          value: documentData ? t("policyDetail.available") : t("policyDetail.nA"),
                        },
                      ];

                      return (
                        <div className="endorsement-item" key={endorsementRef}>
                          <div className="endorsement-item-header">
                            <div>
                              <div className="endorsement-title">
                                {endorsement.endorsementNumber ||
                                  endorsement.endorsementId ||
                                  t("policyDetail.endorsementLabel")}
                              </div>
                              <div className="endorsement-subtitle">
                                {typeLabel}
                              </div>
                            </div>
                            {statusValue && (
                              <StatusBadge
                                status={statusValue}
                                type="payment"
                                size="sm"
                                showTooltip={false}
                              />
                            )}
                          </div>
                          <InfoGrid items={endorsementInfo} />
                          <div className="endorsement-actions">
                            <Button
                              label={t("policyDetail.viewDetails")}
                              icon="pi pi-external-link"
                              className="p-button-text p-button-sm"
                              onClick={() => handleViewEndorsement(endorsement)}
                            />
                            <Button
                              label={t("policyDetail.viewDocument")}
                              icon="pi pi-file"
                              className="p-button-outlined p-button-secondary p-button-sm"
                              onClick={() =>
                                handleDownload(
                                  documentData?.originalUrl,
                                  `Endorsement_${endorsement.endorsementNumber || endorsementRef}.pdf`
                                )
                              }
                              disabled={!documentData?.originalUrl}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>

              <SectionCard title={t("policyDetail.history", { defaultValue: "History" })} className="policy-history-section">
                <AuditTimeline entity="policy" recordId={rawPolicyData?.id || policyId} limit={10} />
              </SectionCard>
            </div>
          </div>

          <div className="policy-sidebar">
            <div className="sidebar-sections">
              {paymentStatusIsPending && (
                <SidebarSection
                  title={t("policyDetail.paymentRequired")}
                  icon="pi pi-credit-card"
                >
                  <div className="payment-actions">
                    <Button
                      label={t("policyDetail.proceedToPayment")}
                      icon="pi pi-credit-card"
                      onClick={() =>
                        navigate(`/agent/policy/paymentoptions/${policyId}`, {
                          state: {
                            policy: rawPolicyData,
                            policyDetails,
                            policyId: policyId,
                            clientId: rawPolicyData?.clientId,
                            clientName:
                              rawPolicyData?.client?.fullName ||
                              policyDetails.ClientName ||
                              rawPolicyData?.insuredName,
                            fromPolicyDetail: true,
                          },
                        })
                      }
                    />
                  </div>
                </SidebarSection>
              )}

              {isDirectBill && (
                <SidebarSection title={t("policyDetail.directBill")} icon="pi pi-building">
                  <p className="payment-description">{t("policyDetail.directBillDescription")}</p>
                </SidebarSection>
              )}

              <SidebarSection
                title={t("policyDetail.documentsAndBilling")}
                icon="pi pi-folder-open"
              >
                <div className="document-actions">
                  <Button
                    label={invoiceContext.label}
                    icon="pi pi-file-pdf"
                    className="p-button-outlined p-button-primary"
                    onClick={() => handleGenerateInvoice(invoiceContext.type)}
                    loading={invoiceContext.isLoading}
                    disabled={invoiceContext.isBusy}
                  />
                  <Button
                    label={t("policyDetail.premiumAccountingEntries")}
                    icon="pi pi-calculator"
                    className="p-button-outlined"
                    onClick={handlePremiumAccountingEntries}
                  />
                </div>
                <div className="document-list ">
                  <div className="document-item">
                    <div className="document-text">
                      <span className="document-title">{t("policyDetail.policyDocument")}</span>
                      <span className="document-meta">
                        {t("policyDetail.generatedFromPolicyData")}
                      </span>
                    </div>
                    <div className="document-item-actions">
                      <Button
                        label={t("policyDetail.preview")}
                        icon="pi pi-eye"
                        className="p-button-text"
                        onClick={handlePolicyDocumentPreview}
                        loading={policyScheduleLoading}
                        disabled={policyScheduleLoading}
                      />
                      <Button
                        label={t("policyDetail.open")}
                        icon="pi pi-external-link"
                        className="p-button-text"
                        onClick={handlePolicyDocumentOpen}
                        loading={policyScheduleLoading}
                        disabled={policyScheduleLoading}
                      />
                      <Button
                        label={t("policyDetail.print")}
                        icon="pi pi-print"
                        className="p-button-text"
                        onClick={printPolicyDocument}
                      />
                    </div>
                  </div>
                  {isFireLOB && (
                    <div className="document-item">
                      <div className="document-text">
                        <span className="document-title">
                          {t("policyDetail.insurancePlacingSlip")}
                        </span>
                        <span className="document-meta">
                          {t("policyDetail.availableOnRequest")}
                        </span>
                      </div>
                      <div className="document-item-actions">
                        <Button
                          label={t("policyDetail.open")}
                          icon="pi pi-external-link"
                          className="p-button-text"
                          onClick={handleInsurancePlacingSlipOpen}
                          loading={insurancePlacingSlipLoading}
                          disabled={insurancePlacingSlipLoading}
                        />
                        <Button
                          label={t("policyDetail.print")}
                          icon="pi pi-print"
                          className="p-button-text"
                          onClick={() => printDocument(placingSlipPath(), `placing-slip-${policyDetails?.policyNumber || policyId}.pdf`)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </SidebarSection>

              <SidebarSection title={t("policyDetail.relatedRecords")} icon="pi pi-link">
                <InfoGrid items={relatedRecordItems} layout="single" />
              </SidebarSection>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        header={t("policyDetail.documentPreview")}
        visible={showDocumentDialog}
        className="document-preview-dialog bv-centered"
        onHide={closeDocumentPreview}
        footer={(
          <div className="document-preview-actions">
            <Button label={t("policyDetail.close")} text onClick={closeDocumentPreview} />
            {documentPreviewUrl && (
              <a className="p-button p-component p-button-outlined" href={documentPreviewUrl} download={`policy-${policyDetails?.policyNumber || policyId}.pdf`}>
                <i className="pi pi-download mr-2" aria-hidden="true" />{t("policyDetail.download")}
              </a>
            )}
            <Button label={t("policyDetail.print")} icon="pi pi-print" onClick={printPolicyDocument} />
          </div>
        )}
      >
        {documentPreviewUrl ? (
          <iframe
            src={documentPreviewUrl}
            title={t("policyDetail.documentPreview")}
            className="document-preview-frame"
          />
        ) : (
          <div className="document-preview-empty">{t("policyDetail.noDocumentToPreview")}</div>
        )}
      </Dialog>
    </div>
  );
};

export default PolicyDetailView;
