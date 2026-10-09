import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import CustomToast from "../../../components/Toast";
import InputTextField from "../../component/inputText";
import DatepickerField from "../../component/datePicker";
import { useFormik } from "formik";
import endorsementService from "../../../services/endorsementService";
import S3FileUpload from "../../../components/S3FileUpload";
import { notifyError, notifyWarn } from "../../../utility/dialogs";
import LoadState from "../../../components/LoadState";
import { toIsoDate } from "../../../utility/dateFormat";

const UploadEndorsement = () => {
  const { t } = useTranslation();
  const { endorsementId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const toastRef = useRef(null);

  const [endorsementData, setEndorsementData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [documentUrl, setDocumentUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The insurer's endorsement: its own number, effective from the endorsement's date to the policy's expiry
  const initialValues = useMemo(
    () => ({
      policyNumber: endorsementData?.policyNumber || "",
      endrosementNumber: "",
      production: new Date(),
      inception: endorsementData?.effectiveDate ? new Date(`${String(endorsementData.effectiveDate).slice(0, 10)}T00:00:00`) : new Date(),
      issuedDate: new Date(),
      expiry: endorsementData?.policyExpiry ? new Date(`${String(endorsementData.policyExpiry).slice(0, 10)}T00:00:00`) : null,
      file: null,
    }),
    [endorsementData]
  );

  // Fetch endorsement details on mount
  useEffect(() => {
    if (!endorsementId) {
      notifyWarn(t("endorsement.endorsementIdMissing"));
      navigate(-1);
      return;
    }

    const fetchEndorsement = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await endorsementService.getEndorsementById(
          endorsementId
        );
        if (response.success) {
          setEndorsementData(response.data);
        } else {
          setLoadError(response.error || t("endorsement.errorLoadingEndorsement"));
        }
      } catch (error) {
        setLoadError(t("endorsement.errorLoadingEndorsement"));
      } finally {
        setLoading(false);
      }
    };

    fetchEndorsement();
  }, [endorsementId, navigate]);

  const customValidation = (values) => {
    const errors = {};
    if (!values.policyNumber) {
      errors.policyNumber = t("endorsement.thisFieldRequired");
    }
    if (!values.endrosementNumber) {
      errors.endrosementNumber = t("endorsement.thisFieldRequired");
    }
    if (!values.production) {
      errors.production = t("endorsement.thisFieldRequired");
    }
    if (!values.inception) {
      errors.inception = t("endorsement.thisFieldRequired");
    }
    if (!values.issuedDate) {
      errors.issuedDate = t("endorsement.thisFieldRequired");
    }
    if (!values.expiry) {
      errors.expiry = t("endorsement.thisFieldRequired");
    }
    if (!documentUrl) {
      errors.document = t("endorsement.pleaseUploadDocument");
    }
    return errors;
  };

  const handleSubmit = async (values) => {
    if (!documentUrl) {
      notifyWarn(t("endorsement.pleaseUploadDocument"));
      return;
    }

    setIsSubmitting(true);

    try {
      // Complete endorsement with S3 document URL
      const completePayload = {
        endorsementId,
        policyNumber: values.policyNumber,
        endorsementNumber: values.endrosementNumber,
        // the dates as picked (YYYY-MM-DD): an ISO timestamp of local midnight is the day before in UTC
        productionDate: toIsoDate(values.production),
        inceptionDate: toIsoDate(values.inception),
        issuedDate: toIsoDate(values.issuedDate),
        expiryDate: toIsoDate(values.expiry),
        documentKey: documentUrl,
        notes: "",
      };

      const completeResponse = await endorsementService.completeEndorsement(
        completePayload
      );

      if (completeResponse.success) {
        toastRef.current?.showToast();
        setTimeout(() => {
          navigate(`/agent/endorsementdetailedview/${endorsementId}`, {
            state: {
              endorsementId,
              policyId: endorsementData?.policyId || state?.policyId,
              clientId: state?.clientId,
              clientNumber: state?.clientNumber,
              clientName: state?.clientName,
              endorsementData: completeResponse.data,
            },
          });
        }, 2000);
      } else {
        throw new Error(
          completeResponse.error || "Failed to complete endorsement"
        );
      }
    } catch (error) {
      notifyError(t("endorsement.submitFailed") + ": " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formik = useFormik({
    initialValues,
    validate: customValidation,
    onSubmit: handleSubmit,
    enableReinitialize: true,
  });

  const handleIssuedDateChange = (e) => {
    formik.setFieldValue("issuedDate", e.target.value || e.value);
  };

  const handleBackNavigation = () => {
    navigate(-1);
  };

  if (loading || !endorsementData) {
    return (
      <div className="upload__endorsement__container">
        <LoadState loading={loading} error={loadError} notFound={!endorsementData} onBack={handleBackNavigation} />
      </div>
    );
  }

  return (
    <div className="upload__endorsement__container">
      <div className="upload__endorsement__container__title">Clients</div>
      <div className="mt-3">
        <div
          className="upload__endorsement__container__back__btn__container cursor-pointer"
          onClick={handleBackNavigation}
        >
          <SvgLeftArrow />
          <div className="upload__endorsement__container__back__btn__title">
            {state?.clientName || "Client"}
            {state?.clientNumber && <> / Client ID : {state.clientNumber}</>}
          </div>
        </div>
      </div>
      <div className="upload__endorsement__card__container mt-4">
        <CustomToast ref={toastRef} message="Endorsement Completed" />
        <Card className="card__container">
          <div className="upload__endorsement__card__container__title">
            {t("endorsement.uploadEndorsement")}
          </div>
          <div className="grid mt-2">
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.policyNumber")}
                value={formik.values.policyNumber}
                onChange={formik.handleChange("policyNumber")}
                disabled={!!endorsementData?.policyNumber}
              />
              {formik.touched.policyNumber && formik.errors.policyNumber && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                  {formik.errors.policyNumber}
                </div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("endorsement.endorsementNumberRequired")}
                value={formik.values.endrosementNumber}
                onChange={formik.handleChange("endrosementNumber")}
              />
              {formik.touched.endrosementNumber &&
                formik.errors.endrosementNumber && (
                  <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                    {formik.errors.endrosementNumber}
                  </div>
                )}
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DatepickerField
                label={t("endorsement.production")}
                value={
                  formik.values.production
                    ? new Date(formik.values.production)
                    : null
                }
                onChange={(e) => {
                  formik.setFieldValue("production", e.value || e.target.value);
                }}
                dateFormat="yy-mm-dd"
              />
              {formik.touched.production && formik.errors.production && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                  {formik.errors.production}
                </div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DatepickerField
                label={t("endorsement.inception")}
                value={
                  formik.values.inception
                    ? new Date(formik.values.inception)
                    : null
                }
                onChange={(e) => {
                  formik.setFieldValue("inception", e.value || e.target.value);
                }}
                dateFormat="yy-mm-dd"
              />
              {formik.touched.inception && formik.errors.inception && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                  {formik.errors.inception}
                </div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DatepickerField
                label={t("endorsement.issuedDate")}
                value={
                  formik.values.issuedDate
                    ? new Date(formik.values.issuedDate)
                    : null
                }
                onChange={handleIssuedDateChange}
                dateFormat="yy-mm-dd"
              />
              {formik.touched.issuedDate && formik.errors.issuedDate && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                  {formik.errors.issuedDate}
                </div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <DatepickerField
                label={t("endorsement.expiry")}
                value={
                  formik.values.expiry ? new Date(formik.values.expiry) : null
                }
                onChange={(e) => {
                  formik.setFieldValue("expiry", e.value || e.target.value);
                }}
                dateFormat="yy-mm-dd"
              />
              {formik.touched.expiry && formik.errors.expiry && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                  {formik.errors.expiry}
                </div>
              )}
            </div>
          </div>

          <div className="upload__endorsement__card__sub__title mt-2 mb-2">
            {t("endorsement.documentRequired")}
          </div>

          <S3FileUpload
            accept=".pdf,.png,.jpg,.jpeg"
            maxFileSize={10 * 1024 * 1024}
            multiple={false}
            showPreview={false}
            uploadPath="endorsement-documents"
            onUploadSuccess={(url, file) => {
              // Extract URL from various possible formats
              let uploadedUrl = null;

              if (typeof url === "string" && url) {
                uploadedUrl = url;
              } else if (url && typeof url === "object") {
                uploadedUrl =
                  url.url || url.data?.url || url.key || url.data?.key;
              }

              if (!uploadedUrl) {
                notifyWarn(
                  "File uploaded but URL could not be retrieved. Please refresh and try again."
                );
                return;
              }

              setDocumentUrl(uploadedUrl);
              formik.setFieldValue("file", uploadedUrl);
            }}
            onUploadError={(error) => {
              notifyError(t("endorsement.failedToUploadDocument") + ": " + error.message);
            }}
          />

          {documentUrl && (
            <div
              className="text-sm mt-2"
              style={{ color: "var(--color-success)", fontWeight: 500 }}
            >
              <i className="pi pi-check-circle mr-1" aria-hidden="true" />{t("endorsement.documentUploadedSuccess")}
            </div>
          )}

          {formik.errors.document && !documentUrl && (
            <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
              {formik.errors.document}
            </div>
          )}

          <div className="grid m-0 mt-4">
            <div className="col-12 md:col-12 lg:col-12 p-0 back__complete__btn__container ">
              <div className="complete__btn__container">
                <Button
                  className="complete__btn"
                  onClick={formik.handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t("endorsement.uploading") : t("endorsement.complete")}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default UploadEndorsement;
