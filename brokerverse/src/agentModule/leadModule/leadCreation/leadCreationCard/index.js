import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import { RadioButton } from "primereact/radiobutton";
import InputTextField from "../../../component/inputText";
import { Button } from "primereact/button";
import DatepickerField from "../../../component/datePicker";
import CustomToast from "../../../../components/Toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  patchLeadEditMiddleWare,
  postCreateleadMiddleware,
  getLeadByIdMiddleware,
} from "../../Store/leadMiddleware";
import { useFormik } from "formik";
import PhAddressFields from "../../../component/PhAddressFields";
import { patchClientEditMiddleWare } from "../../../quoteModule/clientListing/store/clientsMiddleware";
import { isValidMobile, mobileHint, normalizeMobile } from "../../../../utility/phoneFormat";
import { birthDateError, birthDateRange, useAgeLimits } from "../../../../utility/birthDate";

const initialValue = {
  CompanyName: "",
  TaxNumber: "",
  FirstName: "",
  LastName: "",
  PreferredName: "",
  EmailID: "",
  ContactNumber: "",
  HouseNo: "",
  Barangay: "",
  Country: "Philippines",
  Province: "",
  City: "",
  ZIPCode: "",
  Street: "",
  Region: "",
  DateofBirth: "",
  category: "Retail",
  gender: "Male",
  Quotes: "01",
  LeadID: "877",
};

const LeadCreationCard = ({ flow, action }) => {
  const { t } = useTranslation();
  // Configured age range for the date of birth (System Settings leads.min_age_years / leads.max_age_years)
  const ageLimits = useAgeLimits();
  const { leadId } = useParams();
  const { leadtabledata, currentLeadDetails } = useSelector(
    ({ leadReducers }) => {
      return {
        leadtabledata: leadReducers?.leadtabledata,
        currentLeadDetails: leadReducers?.currentLeadDetails,
      };
    }
  );
  const [show, setShow] = useState(false);
  const toastRef = useRef(null);
  const toastErrorRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  // Fetch lead data when in edit mode
  useEffect(() => {
    if (action === "edit" && leadId) {
      dispatch(getLeadByIdMiddleware(leadId));
    }
  }, [action, leadId, dispatch]);

  const extractErrorMessage = (result, fallbackMessage) => {
    if (!result) return fallbackMessage;

    const { payload, error } = result;

    if (payload) {
      if (typeof payload === "string" && payload.trim()) {
        return payload;
      }

      if (typeof payload === "object") {
        if (typeof payload.error === "string" && payload.error.trim()) {
          return payload.error;
        }
        if (typeof payload.message === "string" && payload.message.trim()) {
          return payload.message;
        }
      }
    }

    if (error) {
      if (
        typeof error === "string" &&
        error.trim().toLowerCase() !== "rejected"
      ) {
        return error;
      }

      if (typeof error === "object") {
        const errorMessage =
          typeof error.message === "string" ? error.message.trim() : "";
        if (errorMessage && errorMessage.toLowerCase() !== "rejected") {
          return errorMessage;
        }
      }
    }

    return fallbackMessage;
  };

  const defaultErrorMessage =
    action === "edit"
      ? t("leadCreation.failedToUpdate")
      : t("leadCreation.failedToCreate");

  const showErrorToast = (message) => {
    const detail =
      message && typeof message === "string" ? message : defaultErrorMessage;

    toastErrorRef.current?.showToast({
      severity: "error",
      detail,
    });
  };

  const handleclick = async (values) => {
    if (action === "post") {
      const valueWithId = {
        ...values,
        id: leadtabledata?.length + 1,
      };

      try {
        const result = await dispatch(postCreateleadMiddleware(valueWithId));

        if (result.type.endsWith("/fulfilled")) {
          // Success case - use the leadId from the API response
          const createdLeadId = result.payload?.leadId || result.payload?.id;

          toastRef.current.showToast();
          setTimeout(() => {
            if (createdLeadId) {
              navigate(
                `/agent/createquote/policydetails/createquote/${createdLeadId}`,
                {
                  state: {
                    lead: result.payload,
                  },
                }
              );
            } else {
              showErrorToast(
                "Prospect created but its ID was not returned. Create the quote from the Prospects list."
              );
              setTimeout(() => {
                navigate("/agent/leadlisting");
              }, 2000);
            }
          }, 2000);
        } else if (result.type.endsWith("/rejected")) {
          const errorMsg = extractErrorMessage(
            result,
            "Failed to create lead. Please try again."
          );
          showErrorToast(errorMsg);
        }
      } catch (error) {
        const errorMsg =
          error?.response?.data?.error ||
          error?.message ||
          "An unexpected error occurred while creating the lead";
        showErrorToast(errorMsg);
      }
    }
    if (action === "edit") {
      if (flow === "client") {
        dispatch(patchClientEditMiddleWare(values));
        toastRef.current.showToast();
        setTimeout(() => {
          navigate(`/agent/clientlisting`);
        }, 2000);
      }
      if (flow === "lead") {
        // Update lead with leadId
        try {
          const result = await dispatch(
            patchLeadEditMiddleWare({ leadId, payload: values })
          );

          if (result.type.endsWith("/fulfilled")) {
            // Success case - refresh the current lead details to keep Redux in sync
            await dispatch(getLeadByIdMiddleware(leadId));
            toastRef.current.showToast();
            setTimeout(() => {
              navigate(`/agent/leadlisting`);
            }, 2000);
          } else if (result.type.endsWith("/rejected")) {
            // Error case
            const errorMsg = extractErrorMessage(
              result,
              "Failed to update lead. Please try again."
            );
            showErrorToast(errorMsg);
          }
        } catch (error) {
          const errorMsg =
            error?.response?.data?.error ||
            error?.message ||
            "An unexpected error occurred while updating the lead";
          showErrorToast(errorMsg);
        }
      }
    }
  };
  const customValidation = (values) => {
    const errors = {};
    if (values.category === "Corporate") {
      if (!values.CompanyName) {
        errors.CompanyName = "This field is required";
      }
      if (!values.TaxNumber) {
        errors.TaxNumber = "This field is required";
      }
    }
    if (!values.FirstName) {
      errors.FirstName = "This field is required";
    }
    if (!values.PreferredName) {
      errors.PreferredName = "This field is required";
    }
    if (!values.LastName) {
      errors.LastName = "This field is required";
    }
    if (!values.EmailID) {
      errors.EmailID = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.EmailID)) {
      errors.EmailID = "Invalid email address";
    }
    if (!values.ContactNumber) {
      errors.ContactNumber = "Phone Number is required";
    } else if (!isValidMobile(values.ContactNumber)) {
      errors.ContactNumber = `Invalid mobile number (e.g. ${mobileHint()})`;
    }
    if (!values.HouseNo) {
      errors.HouseNo = "This field is required";
    }

    if (!values.Barangay) {
      errors.Barangay = "This field is required";
    }
    if (!values.Country) {
      errors.Country = "This field is required";
    }
    if (!values.Province) {
      errors.Province = "This field is required";
    }
    if (!values.City) {
      errors.City = "This field is required";
    }
    if (!values.ZIPCode) {
      errors.ZIPCode = "This field is required";
    }
    if (!values.DateofBirth) {
      errors.DateofBirth = "This field is required";
    } else {
      const dobError = birthDateError(values.DateofBirth, ageLimits);
      if (dobError) errors.DateofBirth = dobError;
    }
    if (!values.category) {
      errors.category = "This field is required";
    }
    if (!values.gender) {
      errors.gender = "This field is required";
    }
    return errors;
  };


  // Transform API data to form values (must be before formik)
  const getFormValues = () => {
    if (
      action === "edit" &&
      currentLeadDetails &&
      Object.keys(currentLeadDetails).length > 0
    ) {
      const values = {
        id: currentLeadDetails.id || currentLeadDetails.leadId || "",
        CompanyName: currentLeadDetails.companyName || "",
        TaxNumber: currentLeadDetails.taxInformationNumber || "",
        FirstName: currentLeadDetails.firstName || "",
        LastName: currentLeadDetails.lastName || "",
        PreferredName: currentLeadDetails.preferredName || "",
        EmailID: currentLeadDetails.emailId || "",
        ContactNumber: currentLeadDetails.contactNumber || "",
        HouseNo: currentLeadDetails.houseNo || "",
        Barangay: currentLeadDetails.barangay || "",
        Country: currentLeadDetails.country || "",
        Province: currentLeadDetails.province || "",
        City: currentLeadDetails.city || "",
        ZIPCode: currentLeadDetails.zipCode || "",
        Street: currentLeadDetails.street || currentLeadDetails.roadThanon || "",
        Region: currentLeadDetails.region || "",
        DateofBirth: currentLeadDetails.DOB
          ? new Date(currentLeadDetails.DOB)
          : "",
        category: currentLeadDetails.leadCategory || "Retail",
        gender: currentLeadDetails.gender || "Male",
        Quotes: "01",
        LeadID:
          currentLeadDetails.generatedLeadId || currentLeadDetails.leadId || "",
      };

      // If it's a company lead, make sure company fields are populated
      if (values.category === "Corporate") {
        values.CompanyName = currentLeadDetails.companyName || "";
        values.TaxNumber = currentLeadDetails.taxInformationNumber || "";
      }

      return values;
    }
    // a prospect for an existing customer starts from the client's details and stays linked to the client
    const client = location.state?.existingClient;
    if (action !== "edit" && client) {
      return {
        ...initialValue,
        clientId: client.clientId || client.id,
        CompanyName: client.companyName || "",
        TaxNumber: client.taxNumber || "",
        FirstName: client.firstName || "",
        LastName: client.lastName || "",
        PreferredName: client.preferredName || "",
        EmailID: client.emailId || client.email || "",
        ContactNumber: client.contactNumber || client.phone || "",
        HouseNo: client.houseNo || "",
        Barangay: client.barangay || "",
        Country: client.country || initialValue.Country || "",
        Province: client.province || "",
        City: client.city || "",
        ZIPCode: client.zipCode || "",
        Street: client.street || client.roadThanon || "",
        Region: client.region || "",
        DateofBirth: client.DOB ? new Date(client.DOB) : "",
        category: client.leadCategory || initialValue.category || "Retail",
        gender: client.gender || initialValue.gender || "Male",
      };
    }
    return initialValue;
  };

  const formik = useFormik({
    initialValues: getFormValues(),
    enableReinitialize: true, // This allows formik to reinitialize when values change
    validate: customValidation,
    onSubmit: (values) => {
      handleclick({ ...values, ContactNumber: normalizeMobile(values.ContactNumber) });
    },
  });


  return (
    <div className="card_overall_container mt-4">
      <CustomToast
        ref={toastRef}
        message={
          action === "edit"
            ? "Prospect updated"
            : "Prospect created"
        }
      />
      <CustomToast
        ref={toastErrorRef}
        message={defaultErrorMessage}
        messageType="error"
      />
      {/* <form onSubmit={formik.handleSubmit}> */}
      <Card
        title={
          action === "post"
            ? t("leadCreation.createLead")
            : flow === "client"
            ? t("leadCreation.editClient")
            : t("leadCreation.editLead")
        }
      >
        {action === "post" ? (
          <div>
            <div className="subheadinglabel_txt mt-3">{t("leadCreation.selectCategory")}</div>
            <div className="flex flex-wrap gap-3 mt-3">
              <div className="flex align-items-center">
                <RadioButton
                  inputId="individual"
                  name="category"
                  value="Retail"
                  onChange={() => {
                    formik.setFieldValue("category", "Retail");
                    setShow(false);
                  }}
                  checked={formik.values.category === "Retail"}
                />
                <label htmlFor="individual" className="labeltxt_container">
                  {t("leadCreation.individual")}
                </label>
              </div>
              <div className="flex align-items-center">
                <RadioButton
                  inputId="company"
                  name="category"
                  value="Corporate"
                  onChange={() => {
                    formik.setFieldValue("category", "Corporate");
                    setShow(true);
                  }}
                  checked={formik.values.category === "Corporate"}
                />
                <label htmlFor="company" className="labeltxt_container">
                  {t("leadCreation.company")}
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="category__container mt-4">
              <div className="category__text">{t("leadCreation.categoryColon")}</div>
              <div className="category__id">
                {currentLeadDetails?.leadCategory ||
                  formik.values.category ||
                  "Retail"}
              </div>
            </div>
          </div>
        )}
        {show === true ||
        (action === "edit" && formik.values.category === "Corporate") ? (
          <div class="grid mt-2">
            <div class="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("leadCreation.companyName")}
                value={formik.values.CompanyName}
                onChange={formik.handleChange("CompanyName")}
              />
              {formik.touched.CompanyName && formik.errors.CompanyName && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                  {formik.errors.CompanyName}
                </div>
              )}
            </div>
            <div class="col-12 md:col-6 lg:col-6">
              <InputTextField
                label={t("leadCreation.taxInfoNumber")}
                value={formik.values.TaxNumber}
                onChange={formik.handleChange("TaxNumber")}
              />
              {formik.touched.TaxNumber && formik.errors.TaxNumber && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                  {formik.errors.TaxNumber}
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("leadCreation.firstName")}
              value={formik.values.FirstName}
              onChange={formik.handleChange("FirstName")}
            />
            {formik.touched.FirstName && formik.errors.FirstName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.FirstName}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("leadCreation.lastName")}
              value={formik.values.LastName}
              onChange={formik.handleChange("LastName")}
            />
            {formik.touched.LastName && formik.errors.LastName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.LastName}
              </div>
            )}
          </div>
        </div>

        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("leadCreation.preferredName")}
              value={formik.values.PreferredName}
              onChange={formik.handleChange("PreferredName")}
            />
            {formik.touched.PreferredName && formik.errors.PreferredName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.PreferredName}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <DatepickerField
              label={t("leadCreation.dateOfBirth")}
              value={formik.values.DateofBirth}
              {...birthDateRange(ageLimits)}
              onChange={(date) => {
                return formik.setFieldValue("DateofBirth", date.target.value);
              }}
            />

            {formik.touched.DateofBirth && formik.errors.DateofBirth && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.DateofBirth}
              </div>
            )}
          </div>
        </div>

            <div className="subheadinglabel_txt mt-3">{t("leadCreation.selectGender")}</div>
        <div className="flex flex-wrap gap-3  mt-3">
          <div className="flex align-items-center gap-2 checkbox_container">
            <RadioButton
              inputId="male"
              name="gender"
              value="Male"
              onChange={() => formik.setFieldValue("gender", "Male")}
              checked={formik.values.gender === "Male"}
            />
            <label htmlFor="male" className="labeltxt_container">
              {t("leadCreation.male")}
            </label>
          </div>
          <div className="flex align-items-center gap-2 checkbox_container">
            <RadioButton
              inputId="female"
              name="gender"
              value="Female"
              onChange={() => formik.setFieldValue("gender", "Female")}
              checked={formik.values.gender === "Female"}
            />
            <label htmlFor="female" className="labeltxt_container">
              {t("leadCreation.female")}
            </label>
          </div>
        </div>

        <div class="grid mt-2">
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("leadCreation.emailId")}
              value={formik.values.EmailID}
              onChange={formik.handleChange("EmailID")}
            />
            {formik.touched.EmailID && formik.errors.EmailID && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.EmailID}
              </div>
            )}
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("leadCreation.contactNumber")}
              value={formik.values.ContactNumber}
              onChange={formik.handleChange("ContactNumber")}
              inputMode="tel"
              hint={mobileHint()}
            />
            {formik.touched.ContactNumber && formik.errors.ContactNumber && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.ContactNumber}
              </div>
            )}
          </div>
        </div>
        {/* Philippine address: Region -> Province -> City / Municipality -> Barangay, House / Unit No., Street, ZIP code */}
        <PhAddressFields
          formik={formik}
          required={{ houseNo: true, barangay: true, city: true, province: true, zipCode: true, country: true }}
        />

        <div className="save_continue_conatiner">
          <div className="btn_lable_save_container flex justify-content-end mt-2">
            <Button
              onClick={() => {
                formik.handleSubmit();
              }}
              label={action === "post" ? t("leadCreation.saveAndContinue") : t("leadCreation.update")}
            />
          </div>
        </div>
      </Card>
      {/* </form> */}
    </div>
  );
};

export default LeadCreationCard;
