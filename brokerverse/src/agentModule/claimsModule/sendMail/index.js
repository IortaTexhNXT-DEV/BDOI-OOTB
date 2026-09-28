import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import { Card } from "primereact/card";
import InputTextField from "../../component/inputText";
import { FileUpload } from "primereact/fileupload";
import SvgImageUpload from "../../../assets/icons/SvgImageUpload";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";
import { InputTextarea } from "primereact/inputtextarea";
import "./index.scss";
import customHistory from "../../../routes/customHistory";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import { postSendData } from "./store/sendMailMiddleWare";
import SvgUploadClose from "../../../assets/agentIcon/SvgUploadClose";
import { setPolicyHolderData } from "../claimDetails/store/claimDetailsReducers";

const SendMail = () => {
  const { t } = useTranslation();
  const fileUploadRef = useRef(null);
  const [uploadImage, setuploadImage] = useState(null);
  const navigate = useNavigate();

  // Get loading, error states and claim response data from Redux
  const { loading, error, claimResponseData } = useSelector(
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
    console.log(name, src, "find handleUppendImg");
    setuploadImage(src?.objectURL);
    // const file = src.files[0];
    // console.log(file,"file");

    // if (file.size <= 200000) {
    // } else {
    //   console.log("File size exceeds 2 MB. Please select a smaller file.");
    // }
  };
  const handleCancelUplaoded = () => {
    setuploadImage(null);
    fileUploadRef.current.clear();
  };

  // Get policy number and policy holder name from claim details data
  const policyNumber = claimDetailsViewData?.policyNumber || "N/A";
  const policyHolderName = claimDetailsViewData?.PolicyHolderName || "N/A";

  // Console logs to verify data extraction
  console.log("=== SEND MAIL POLICY DATA ===");
  console.log("Claim Details View Data:", claimDetailsViewData);
  console.log("Extracted Policy Number:", policyNumber);
  console.log("Extracted Policy Holder Name:", policyHolderName);
  console.log("=== END SEND MAIL POLICY DATA ===");

  // Store policy holder data in Redux for future pages
  useEffect(() => {
    if (policyHolderName && policyNumber) {
      console.log("=== DISPATCHING POLICY HOLDER DATA TO REDUX ===");
      console.log("Storing in Redux:", { policyHolderName, policyNumber });
      dispatch(
        setPolicyHolderData({
          policyHolderName,
          policyNumber,
          claimNumber: "", // Will be updated when claim is created
        })
      );
      console.log("=== END DISPATCHING POLICY HOLDER DATA TO REDUX ===");
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
  //   const errors = {};

  //   if (!values.mailSubject) {
  //     errors.mailSubject = "This field is required";
  //   }
  //   if (!values.write) {
  //     errors.write = "This field is required";
  //   }

  //   if (!values.file) {
  //     errors.file = "Please select a file";
  //   }
  //   return errors;
  // };
  const handleSubmit = async (values) => {
    try {
      const result = await dispatch(postSendData(formik.values));

      console.log("=== REDUX ACTION RESULT DEBUG ===");
      console.log("Result Type:", result.type);
      console.log("Result Payload:", result.payload);
      console.log("Result Meta:", result.meta);
      console.log("=== END REDUX ACTION RESULT DEBUG ===");

      if (result.type === "sendmail/POST_SENT_MAIL_DATA/fulfilled") {
        // Success - navigate to next page with claim data
        console.log("=== NAVIGATING TO NEXT PAGE ===");
        console.log("API Response Result:", result.payload);
        console.log("Response Data:", result.payload.data);
        console.log("Claim Data:", result.payload.data?.claim);

        // Extract claim data from nested response structure
        const claimData =
          result.payload.data?.claim || result.payload.data || result.payload;
        const claimId =
          claimData.id || claimData.claimId || claimData.claim_id || "12234";
        const claimNumber =
          claimData.claimNumber || claimData.claim_number || claimData.id;

        console.log("Extracted Claim ID:", claimId);
        console.log("Extracted Claim Number:", claimNumber);
        console.log("=== END NAVIGATING TO NEXT PAGE ===");

        // Update Redux with claim number
        dispatch(
          setPolicyHolderData({
            policyHolderName,
            policyNumber,
            claimNumber: claimNumber || "",
          })
        );

        // Navigate to next page with claim ID in URL
        if (claimId && claimId !== "12234") {
          navigate(`/agent/claimrequest/requestapproval/${claimId}`, {
            state: {
              policyNumber: policyNumber, // Pass the actual policy number
              claimNumber: claimNumber,
              claimId: claimId,
              policyHolderName: policyHolderName, // Pass the policy holder name
              fullResponse: result.payload,
            },
          });
        } else {
          // Fallback navigation if no claim ID is available
          console.log("No claim ID found, using fallback navigation");
          navigate("/agent/claimrequest/requestapproval/12234", {
            state: {
              policyNumber: policyNumber, // Pass the actual policy number
              claimNumber: claimNumber,
              claimId: claimId,
              policyHolderName: policyHolderName, // Pass the policy holder name
              fullResponse: result.payload,
            },
          });
        }
      } else if (result.type === "sendmail/POST_SENT_MAIL_DATA/rejected") {
        // Handle error - you might want to show a toast or error message
        console.error(
          "Failed to create claim - Action Rejected:",
          result.payload
        );
      } else {
        // Handle other cases
        console.log("Unexpected result type:", result.type);
        console.log("Result payload:", result.payload);
      }
    } catch (error) {
      console.error("Error submitting claim:", error);
    }
  };
  const formik = useFormik({
    initialValues: formInitialValue,
    // validate: customValidation,
    onSubmit: handleSubmit,
  });
  // const handleSubmit = () => {
  //   navigate("/agent/claimrequest/requestapproval/122344");
  // };
  const handleBackNavigation = () => {
    customHistory.back();
  };
  return (
    <div className="claimrequest__details__container">
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
          {/* <InputTextField 
          style={{height:"200px"}}
            label="Write"
          /> */}
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
                // maxFileSize={2000000}
                uploadHandler={(e) => {
                  formik.setFieldValue("file", e.files[0]);
                  handleUppendImg(e.options.props.name, e.files[0], "the data");
                }}
                // disabled={pending === "Pending"}
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
          {/* <div className="upload__image__area mt-2">
                <img src={imageURL} alt="Image" className="image__view" />
              </div>
            ) */}
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
      {/* <ClaimDetailsCard /> */}
    </div>
  );
};

export default SendMail;
