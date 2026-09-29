import { useRef, useState, useEffect } from "react";
import { Toast } from "primereact/toast";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import InputTextField from "../../component/inputText";
import { FileUpload } from "primereact/fileupload";
import SvgImageUpload from "../../../assets/icons/SvgImageUpload";
import { Button } from "primereact/button";
import { useNavigate, useLocation } from "react-router-dom";
import { InputTextarea } from "primereact/inputtextarea";
import "./index.scss";
import customHistory from "../../../routes/customHistory";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import { postSendData } from "./store/sendMailMiddleWare";
import SvgUploadClose from "../../../assets/agentIcon/SvgUploadClose";
import { setPolicyHolderData } from "../claimDetails/store/claimDetailsReducers";
import logger from "../../../utility/logger";

const SendMail = () => {
  const { t } = useTranslation();
  const fileUploadRef = useRef(null);
  const errorToast = useRef(null);
  const [uploadImage, setuploadImage] = useState(null);
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
  const handleUppendImg = (name, src) => {
    setuploadImage(src?.objectURL);
  };
  const handleCancelUplaoded = () => {
    setuploadImage(null);
    fileUploadRef.current.clear();
  };

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
    mailSubject: `Claim Request for Policy Number ${policyNumber}`,
    write: `Hello,
    I hope this email finds you well.
    I am writing regarding a claim request for a client ${policyHolderName} with policy number ${policyNumber}`,
    file: null,
  };
  // const customValidation = (values) => {
  //   if (!values.file) {
  //   }
  // };
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

        // Navigate to next page with claim ID in URL
        if (claimId) {
          navigate(`/agent/claimrequest/requestapproval/${claimId}`, {
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
    // validate: customValidation,
    onSubmit: handleSubmit,
  });
  const handleBackNavigation = () => {
    customHistory.back();
  };
  return (
    <div className="claimrequest__details__container">
      <Toast ref={errorToast} />
      <div className="claim__details__container__titles">{t("agent.clients")}</div>
      <div 
        className="claim__details__container__back__btn mt-3 cursor-pointer"
        onClick={handleBackNavigation}
      >
        <SvgLeftArrow />
        <div className="claim__details__container__back__btn__title">
          {(() => {
            const policyHolderName =
              claimDetailsViewData?.PolicyHolderName || t("agent.loading");
            const policyNumber = claimDetailsViewData?.policyNumber;
            return `${policyHolderName} / ${
              policyNumber ? `${t("agent.policyLabel")}: ${policyNumber}` : t("agent.loading")
            }`;
          })()}
        </div>
      </div>
      <Card>
        <div className="claim__details__container__titles">{t("agent.claimRequest")}</div>
        <div className="mt-4">
          <InputTextField
            label={t("agent.mailSubject")}
            value={formik.values.mailSubject}
            onChange={formik.handleChange("mailSubject")}
          />
          {formik.touched.mailSubject && formik.errors.mailSubject && (
            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
              {formik.errors.mailSubject}
            </div>
          )}
        </div>
        <div className="mt-4">
          <InputTextarea
            label={t("agent.write")}
            rows={5}
            cols={30}
            placeholder={t("agent.write")}
            className="claim__write__field"
            value={formik.values.write}
            onChange={formik.handleChange("write")}
          />
          {formik.touched.write && formik.errors.write && (
            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
              {formik.errors.write}
            </div>
          )}
        </div>

        <div className="col-12 mt-4 p-0">
          <div className="claim__request__upload__subtitle  mb-2">
            {t("agent.documents")}
          </div>
          {/* {!imageURL ? ( */}
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
                  formik.setFieldValue("file", e.files[0]);
                  handleUppendImg(e.options.props.name, e.files[0], "the data");
                }}
              />
              <div className="icon_click_option">
                <SvgImageUpload />
              </div>
              <div className="upload__caption text-center">{t("agent.upload")}</div>
              <div className="upload__caption text-center">
                {t("agent.maxFileSizePdf")}
              </div>
            </div>
          </div>
          {formik.touched.file && formik.errors.file && (
            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
              {formik.errors.file}
            </div>
          )}

          {uploadImage && (
            <div className="col-12 mt-2 ">
              <span onClick={handleCancelUplaoded}>
                <SvgUploadClose />
              </span>
            </div>
          )}
          {/* ) : ( */}
          {/* } */}
        </div>

        {error && (
          <div className="mt-3" style={{ color: "red", fontSize: "14px" }}>
            {error}
          </div>
        )}

        <div className="claimrequest__back__but">
          <Button
            onClick={handleBackNavigation}
            link
            className="claim__back__but"
            disabled={loading}
          >
            {t("agent.back")}
          </Button>
          <Button
            onClick={formik.handleSubmit}
            className="claim__snd__but"
            loading={loading}
            disabled={loading}
          >
            {loading ? t("agent.sending") : t("agent.send")}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SendMail;
