import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import InputTextField from "../../component/inputText";
import { Button } from "primereact/button";
import SvgImageUpload from "../../../assets/icons/SvgImageUpload";
import { FileUpload } from "primereact/fileupload";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import customHistory from "../../../routes/customHistory";
import { useFormik } from "formik";
import { useDispatch } from "react-redux";
import { getQuotationByIdMiddleware } from "../Store/quotationMiddleware";
import { Toast } from "primereact/toast";
import leadService from "../../../services/leadService";
import quotationService from "../../../services/quotationService";
import placementService from "../../../services/placementService";

import { numberLocale } from "../../../utility/currencyConverter";
const CustomerInfoFire = ({ action }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const SMI_LABELS = {
    Building: t("agent.building"),
    PlantAndMachinery: t("agent.plantAndMachinery"),
    OtherContents: t("agent.otherContents"),
    GrossProfit: t("agent.grossProfit"),
    Wages: t("agent.wages"),
    LossOfRent: t("agent.lossOfRent"),
  };
  const [imageURL, setImageURL] = useState("");
  const navigate = useNavigate();
  const { state } = useLocation();
  const { quotationId } = useParams();
  const dispatch = useDispatch();
  const toast = React.useRef(null);

  const [quotationDetails, setQuotationDetails] = useState(null);
  const [isLoadingQuotation, setIsLoadingQuotation] = useState(false);
  const [quotationLoadError, setQuotationLoadError] = useState(null);
  const [leadData, setLeadData] = useState(null);
  const [isConvertingToPolicy, setIsConvertingToPolicy] = useState(false);

  useEffect(() => {
    const loadQuotation = async () => {
      if (!quotationId) return;
      setIsLoadingQuotation(true);
      setQuotationLoadError(null);
      try {
        const result = await dispatch(getQuotationByIdMiddleware(quotationId));
        if (result.type.endsWith("/fulfilled")) {
          setQuotationDetails(result.payload);
        } else {
          setQuotationLoadError(t("agent.failedToLoadQuotation", { id: quotationId }));
        }
      } catch (error) {
        setQuotationLoadError(t("agent.errorLoadingQuotation"));
      } finally {
        setIsLoadingQuotation(false);
      }
    };
    loadQuotation();
  }, [quotationId, dispatch]);

  useEffect(() => {
    const fetchLeadData = async () => {
      if (!quotationDetails?.leadRefId) return;
      try {
        const response = await leadService.getLeadById(quotationDetails.leadRefId);
        if (response.success) setLeadData(response.data);
      } catch (error) {
        console.error("Error fetching lead data:", error);
      }
    };
    fetchLeadData();
  }, [quotationDetails?.leadRefId]);

  const fireRiskDetails = quotationDetails?.fireRiskDetails || quotationDetails?.fireRisk || {};
  const firePremiumDetails = quotationDetails?.firePremiumDetails || quotationDetails?.firePremium || {};
  const sumInsured = firePremiumDetails?.sumInsured || {};
  const coverBreakup = firePremiumDetails?.coverBreakup || [];

  const formik = useFormik({
    initialValues: {
      IdCardNumber: quotationDetails?.idCardNumber || "",
    },
    enableReinitialize: true,
    onSubmit: handleSubmit,
  });

  async function handleSubmit(values) {
    if (!quotationId) {
      toast.current?.show({
        severity: "error",
        summary: t("common.error"),
        detail: t("agent.quotationIdMissing"),
        life: 3000,
      });
      return;
    }

    const insuredName =
      quotationDetails?.lead
        ? `${quotationDetails.lead.firstName || ""} ${quotationDetails.lead.lastName || ""}`.trim()
        : leadData
        ? `${leadData.firstName || ""} ${leadData.lastName || ""}`.trim()
        : t("claimAuditTrail.nA");

    const customerInfo = {
      IdCardNumber: values.IdCardNumber,
      insuredName,
      InsuredName: insuredName,
    };

    setIsConvertingToPolicy(true);
    toast.current?.show({
      severity: "info",
      summary: t("agent.creatingPolicy"),
      detail: t("agent.convertingQuotationToPolicy"),
      life: 2000,
    });

    try {
      const inception = new Date().toISOString().split("T")[0];
      const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const additionalPolicyData = {
        insuredName,
        idCardNumber: values.IdCardNumber,
        paymentStatus: "Pending",
        inception,
        expiry,
      };

      const result = await quotationService.convertQuotationToPolicy(
        quotationId,
        additionalPolicyData,
        "agent",
        "FIRE"
      );

      if (!result.success && result.code === "PLACEMENT_JOURNEY") {
        // the line's placement journey requires a Placement Slip: place the risk with the insurer(s) first
        const placement = await placementService.placeQuotation(quotationId, { inceptionDate: inception, expiryDate: expiry, insuredName });
        toast.current?.show({ severity: "info", summary: t("placement.quoteJourney.created", { number: placement.placementNumber }), detail: t("placement.quoteJourney.createdDetail"), life: 2500 });
        navigate(`/placement/placement-slips/${placement.id}`);
        return;
      }
      if (!result.success) {
        throw new Error(result.error || "Failed to convert quotation to policy");
      }

      const policyData = result.data?.data?.policy || result.data?.policy;
      const createdPolicyId = policyData?.id || policyData?.policyId;

      if (!createdPolicyId) {
        throw new Error("Policy was created but no policy ID was returned");
      }

      toast.current?.show({
        severity: "success",
        summary: t("common.success"),
        detail: t("agent.policyCreatedProceeding"),
        life: 1500,
      });

      setTimeout(() => {
        navigate(`/agent/convertpolicy/uploadpolicy/${quotationId}`, {
          state: {
            ...state,
            quotation: quotationDetails,
            customerInfo,
            lob: "FIRE",
            policyData: policyData || { policyId: createdPolicyId, id: createdPolicyId },
            policyId: createdPolicyId,
            inception,
            expiry,
            insuredName,
            production: inception,
            issuedDate: inception,
          },
        });
      }, 500);
    } catch (error) {
      console.error("Failed to convert quotation to policy:", error);
      toast.current?.show({
        severity: "error",
        summary: t("common.error"),
        detail: error.message || t("agent.pleaseFillRequired"),
        life: 5000,
      });
    } finally {
      setIsConvertingToPolicy(false);
    }
  }

  const handleUppendImg = (file) => {
    if (file) {
      const url = file.objectURL || URL.createObjectURL(file);
      setImageURL(url);
      formik.setFieldValue("file", file);
    }
  };

  const handleBackNavigation = () => {
    customHistory.back();
  };

  const handleLeadNavigation = () => {
    navigate("/agent/leadlisting");
  };

  const insuredName = quotationDetails?.lead
    ? `${quotationDetails.lead.firstName || ""} ${quotationDetails.lead.lastName || ""}`.trim()
    : leadData
    ? `${leadData.firstName || ""} ${leadData.lastName || ""}`.trim()
    : t("agent.loading");

  if (isLoadingQuotation) {
    return (
      <div className="customer__info__container">
        <Toast ref={toast} />
        <div className="customer__info__main__title">{t("agent.leads")}</div>
        <Card className="mt-4">
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <i className="pi pi-spin pi-spinner" style={{ fontSize: "2rem" }}></i>
            <p style={{ marginTop: "1rem" }}>{t("agent.loadingQuotationDetails")}</p>
          </div>
        </Card>
      </div>
    );
  }

  if (quotationLoadError) {
    return (
      <div className="customer__info__container">
        <Toast ref={toast} />
        <div className="customer__info__main__title">{t("agent.leads")}</div>
        <Card className="mt-4">
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <i className="pi pi-times-circle" style={{ fontSize: "2rem", color: "#f44336" }}></i>
            <p style={{ marginTop: "1rem", color: "#f44336" }}>{quotationLoadError}</p>
            <Button label={t("agent.returnToQuoteListing")} onClick={() => navigate("/agent/quotelisting")} className="mt-3" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="customer__info__container">
      <Toast ref={toast} />
      <div className="customer__info__main__title">{t("agent.leads")}</div>
      <div className="customer__info__back__btn mt-3">
        <div className="customer__info__back__btn__title">
          <div onClick={handleLeadNavigation} className="cursor-pointer arrow__outer">
            <span className="icon__container">
              <SvgLeftArrow />
            </span>
            {leadData
              ? `${leadData.firstName || ""} ${leadData.lastName || ""} / ${t("agent.leadIdLabel")} ${leadData.generatedLeadId || ""}`
              : quotationDetails?.leadRefId
              ? `${t("agent.leadIdLabel")} ${quotationDetails.leadRefId}`
              : t("agent.loadingLeadData")}
          </div>
        </div>
        <div className="customer__info__quote__title">
          {t("agent.quoteIdFireAllied", { quoteId: quotationDetails?.quotationNumber || "N/A" })}
        </div>
      </div>
      <form onSubmit={formik.handleSubmit}>
        <Card className="mt-4">
          <div className="customer__info__title">{t("agent.convertPolicyFireAllied")}</div>

          <div className="customer__info__subtitle mt-2 mb-2">{t("agent.customerInformation")}</div>
          <div className="grid m-0">
            <div className="col-12 mt-2">
              <InputTextField label={t("agent.insuredName")} value={insuredName} disabled />
            </div>
            <div className="col-12 mt-2">
              <div className="upload__label">{t("agent.idCard")}</div>
              {!imageURL ? (
                <div className="upload__card__container mt-2">
                  <div className="file_icon_selector">
                    <FileUpload
                      url="./upload"
                      auto
                      customUpload
                      mode="basic"
                      name="demo"
                      accept=".png,.jpg,.jpeg"
                      uploadHandler={(e) => {
                        const file = e.files[0];
                        formik.setFieldValue("file", file);
                        handleUppendImg(file);
                      }}
                    />
                    <div className="icon_click_option">
                      <SvgImageUpload />
                    </div>
                    <div className="upload__caption text-center">{t("common.upload")}</div>
                    <div className="upload__caption text-center">{t("agent.uploadMaxSize")}</div>
                  </div>
                </div>
              ) : (
                <div className="upload__image__area mt-2">
                  <img src={imageURL} alt="ID Card" className="image__view" />
                </div>
              )}
            </div>
            <div className="col-12 mt-2">
              <InputTextField
                label={t("agent.idCardNumber")}
                value={formik.values.IdCardNumber}
                onChange={formik.handleChange("IdCardNumber")}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
              <InputTextField
                label={t("common.email", "Email")}
                value={quotationDetails?.lead?.emailId || leadData?.emailId || ""}
                disabled
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
              <InputTextField
                label={t("agent.contactNumber")}
                value={quotationDetails?.lead?.contactNumber || leadData?.contactNumber || ""}
                disabled
              />
            </div>
          </div>

          <div className="customer__info__subtitle mt-4 mb-2">{t("agent.riskDetailsReadOnly")}</div>
          <div className="grid m-0">
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
              <InputTextField label={t("agent.constructionType", "Construction Type")} value={fireRiskDetails.constructionType || t("claimAuditTrail.nA")} disabled />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
              <InputTextField label={t("agent.buildingType", "Building Type")} value={fireRiskDetails.buildingType || t("claimAuditTrail.nA")} disabled />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
              <InputTextField label={t("agent.locationCode", "Location Code")} value={fireRiskDetails.locationCodeDescription || t("claimAuditTrail.nA")} disabled />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
              <InputTextField label={t("agent.locationAddress", "Location Address")} value={fireRiskDetails.locationAddress || t("claimAuditTrail.nA")} disabled />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
              <InputTextField label={t("agent.occupancyType", "Occupancy Type")} value={fireRiskDetails.occupancyType || t("claimAuditTrail.nA")} disabled />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
              <InputTextField label={t("agent.natureOfBusiness", "Nature of Business")} value={fireRiskDetails.natureOfBusiness || t("claimAuditTrail.nA")} disabled />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
              <InputTextField label={t("agent.earthquakeZone", "Earthquake Zone")} value={fireRiskDetails.earthquakeZone || t("claimAuditTrail.nA")} disabled />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
              <InputTextField label={t("agent.noOfFloors", "No of Floors")} value={fireRiskDetails.noOfFloors ?? t("claimAuditTrail.nA")} disabled />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
              <InputTextField label={t("agent.sectionType", "Section Type")} value={fireRiskDetails.sectionType || t("claimAuditTrail.nA")} disabled />
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
              <InputTextField label={t("agent.fireProtection", "Fire Protection")} value={fireRiskDetails.fireProtection || t("claimAuditTrail.nA")} disabled />
            </div>
          </div>

          <div className="customer__info__subtitle mt-4 mb-2">{t("agent.sumInsuredPremiumReadOnly")}</div>
          <div className="grid m-0">
            {Object.entries(SMI_LABELS).map(([key, label]) => (
              <div key={key} className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
                <InputTextField
                  label={label}
                  value={sumInsured[key] != null ? Number(sumInsured[key]).toLocaleString(numberLocale()) : "0"}
                  disabled
                />
              </div>
            ))}
          </div>
          {coverBreakup.length > 0 && (
            <>
              <div className="customer__info__subtitle mt-3 mb-2">{t("agent.coverageBreakup")}</div>
              <div className="grid m-0">
                {coverBreakup.map((cover, i) => (
                  <div key={cover.coverDesc ? `${cover.coverDesc}-${i}` : `cover-${i}`} className="col-12 mt-2">
                    <InputTextField
                      label={cover.coverDesc || t("agent.coverLabel", { index: i + 1 })}
                      value={formatCurrency(cover.premium ?? 0)}
                      disabled
                    />
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="col-12 mt-3">
            <InputTextField
              label={t("agent.totalPremium")}
              value={firePremiumDetails.totalPremium != null ? formatCurrency(firePremiumDetails.totalPremium) : t("claimAuditTrail.nA")}
              disabled
            />
          </div>

          <div className="col-12 mt-4">
            <div className="back__next__btn__container">
              <div className="back__btn__container">
                <Button type="button" className="back__btn" onClick={handleBackNavigation}>
                  {t("common.back", "Back")}
                </Button>
              </div>
              <div className="next__btn__container">
                <Button
                  type="submit"
                  className="next__btn"
                  disabled={isConvertingToPolicy}
                  loading={isConvertingToPolicy}
                >
                  {t("agent.next", "Next")}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </form>
    </div>
  );
};

export default CustomerInfoFire;
