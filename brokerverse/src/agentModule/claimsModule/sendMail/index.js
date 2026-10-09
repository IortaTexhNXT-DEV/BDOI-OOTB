import { useRef, useEffect } from "react";
import { Toast } from "primereact/toast";
import { useTranslation } from "react-i18next";
import { InputText } from "primereact/inputtext";
import { FileUpload } from "primereact/fileupload";
import { Button } from "primereact/button";
import { useNavigate, useLocation } from "react-router-dom";
import { InputTextarea } from "primereact/inputtextarea";
import ClaimJourneyLayout, { ClaimActions, ClaimSection } from "../shared/ClaimJourneyLayout";
import FormErrorSummary from "../shared/FormErrorSummary";
import customHistory from "../../../routes/customHistory";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import { postSendData } from "./store/sendMailMiddleWare";
import { setPolicyHolderData } from "../claimDetails/store/claimDetailsReducers";
import logger from "../../../utility/logger";

const SendMail = () => {
  const { t } = useTranslation();
  const fileUploadRef = useRef(null);
  const errorToast = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const clientIdFromState =
    location.state?.clientId ||
    null;

  // Get loading, error states and claim response data from Redux
  const { loading, error } = useSelector(
    ({ sendMailReducers }) => ({
      loading: sendMailReducers?.loading || false,
      error: sendMailReducers?.error || "",
      claimResponseData: sendMailReducers?.claimResponseData || {},
    })
  );

  // Get claim details data to access policy number
  const { claimDetailsViewData } = useSelector(
    ({ claimDetailsMainReducers }) => ({
      claimDetailsViewData:
        claimDetailsMainReducers?.claimDetailsViewData || {},
    })
  );

  // Get dispatch for Redux actions
  const dispatch = useDispatch();

  // Get policy number and policy holder name from claim details data
  const policyNumber = claimDetailsViewData?.policyNumber || "N/A";
  const policyHolderName = claimDetailsViewData?.PolicyHolderName || "N/A";

  // Store policy holder data in Redux for future pages
  useEffect(() => {
    if (policyHolderName && policyNumber) {
      dispatch(
        setPolicyHolderData({
          policyHolderName,
          policyNumber,
          claimNumber: "", // Will be updated when claim is created
        })
      );
    }
  }, [dispatch, policyHolderName, policyNumber]);

  const formInitialValue = {
    mailSubject: t("claimFlow.adviceSubject", { policy: policyNumber }),
    write: t("claimFlow.adviceBody", { insured: policyHolderName, policy: policyNumber }),
    file: null,
  };
  const handleSubmit = async (values) => {
    try {
      const result = await dispatch(postSendData(formik.values));

      if (result.type === "sendmail/POST_SENT_MAIL_DATA/fulfilled") {
        // Success - navigate to next page with claim data

        // Extract claim data from nested response structure
        const claimData =
          result.payload.data?.claim || result.payload.data || result.payload;
        const claimId =
          claimData.id || claimData.claimId || claimData.claim_id || null;
        const claimNumber =
          claimData.claimNumber || claimData.claim_number || claimData.id;

        // Update Redux with claim number
        dispatch(
          setPolicyHolderData({
            policyHolderName,
            policyNumber,
            claimNumber: claimNumber || "",
          })
        );

        const resolvedClientId =
          clientIdFromState ||
          claimDetailsViewData?.clientId ||
          claimData?.policy?.clientId ||
          claimData?.clientId ||
          result.payload?.data?.policy?.clientId ||
          result.payload?.data?.clientId;

        const approvalState = {
          policyNumber: policyNumber,
          claimNumber: claimNumber,
          claimId: claimId,
          policyHolderName: policyHolderName,
          clientId: resolvedClientId,
          fullResponse: result.payload,
        };

        // the claim is registered: on to its documents
        if (claimId) {
          navigate(`/agent/claimrequest/documents/${claimId}`, {
            state: approvalState,
          });
        } else {
          errorToast.current?.show({ severity: "error", summary: "Claim not registered", detail: "The server did not return a claim id", life: 8000 });
        }
      } else if (result.type === "sendmail/POST_SENT_MAIL_DATA/rejected") {
        errorToast.current?.show({
          severity: "error",
          summary: t("common.error", "Claim not registered"),
          detail: String(result.payload || "Failed to create claim"),
          life: 8000,
        });
      } else {
        // Handle other cases
      }
    } catch (error) {
      logger.error("Error submitting claim:", error);
    }
  };
  const formik = useFormik({
    initialValues: formInitialValue,
    onSubmit: handleSubmit,
  });
  const handleBackNavigation = () => {
    customHistory.back();
  };
  return (
    <ClaimJourneyLayout
      step="insurerAdvice"
      holderName={claimDetailsViewData?.PolicyHolderName || ""}
      reference={claimDetailsViewData?.policyNumber ? t("claimFlow.policyRef", { number: claimDetailsViewData.policyNumber }) : ""}
      onBack={handleBackNavigation}
      title={t("claimFlow.adviceTitle")}
    >
      <Toast ref={errorToast} />
      <ClaimSection title={t("claimFlow.adviceMessage")} hint={t("claimFlow.adviceHint")}>
        <div className="grid">
          <div className="col-12">
            <label htmlFor="advice-subject" className="claim-journey__label">{t("agent.mailSubject")}</label>
            <InputText id="advice-subject" value={formik.values.mailSubject} onChange={formik.handleChange("mailSubject")} className="w-full" />
          </div>
          <div className="col-12">
            <label htmlFor="advice-body" className="claim-journey__label">{t("claimFlow.adviceBodyLabel")}</label>
            <InputTextarea id="advice-body" rows={7} autoResize value={formik.values.write} onChange={formik.handleChange("write")} className="w-full" />
          </div>
        </div>
      </ClaimSection>
      <ClaimSection title={t("claimJourney.proofOfDocuments")} hint={t("claimJourney.optional")}>
        <div className="claim-journey__upload">
          {formik.values.file ? (
            <span className="claim-journey__file">
              <i className="pi pi-file" aria-hidden="true" />
              {formik.values.file.name}
              <Button type="button" icon="pi pi-times" text rounded aria-label={t("claimJourney.removeFile")} tooltip={t("claimJourney.removeFile")}
                tooltipOptions={{ position: "top" }} onClick={() => { formik.setFieldValue("file", null); fileUploadRef.current?.clear(); }} />
            </span>
          ) : (
            <FileUpload ref={fileUploadRef} mode="basic" auto customUpload name="file" accept=".png,.jpg,.jpeg,.pdf" maxFileSize={2000000}
              chooseLabel={t("claimJourney.chooseFile")} invalidFileSizeMessageSummary={t("claimJourney.fileTooLarge")} invalidFileSizeMessageDetail=""
              uploadHandler={(e) => { formik.setFieldValue("file", e.files[0]); e.options.clear(); }} />
          )}
          <small>{t("claimJourney.fileRule")}</small>
        </div>
      </ClaimSection>
      {error ? <FormErrorSummary serverError={error} /> : null}
      <ClaimActions next={t("claimFlow.next.insurerAdvice")}>
        <Button type="button" label={t("claimJourney.back")} outlined onClick={handleBackNavigation} disabled={loading} />
        <Button type="button" label={t("claimFlow.registerAndSend")} icon="pi pi-send" onClick={formik.handleSubmit} loading={loading} disabled={loading} />
      </ClaimActions>
    </ClaimJourneyLayout>
  );
};

export default SendMail;
