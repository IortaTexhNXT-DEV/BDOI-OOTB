import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import InputTextField from "../../../component/inputText";
import { useFormik } from "formik";
import PhAddressFields from "../../../component/PhAddressFields";
import { normalizeCountryName } from "../../../../utility/addressHelpers";

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
  Country: "",
  Province: "",
  City: "",
  ZIPCode: "",
  Region: "",
  Street: "",
  DateofBirth: "",
};

const mapPersonalDetailsToInitialValues = (details) => ({
  ...initialValue,
  CompanyName: details?.CompanyName ?? "",
  TaxNumber: details?.TaxNumber ?? "",
  FirstName: details?.FirstName ?? "",
  LastName: details?.LastName ?? "",
  PreferredName: details?.PreferredName ?? "",
  EmailID: details?.EmailID ?? "",
  ContactNumber: details?.ContactNumber ?? "",
  HouseNo: details?.HouseNo ?? "",
  Barangay: details?.Barangay ?? "",
  Country: normalizeCountryName(details?.Country ?? ""),
  Province: details?.Province ?? "",
  City: details?.City ?? "",
  ZIPCode: details?.ZIPCode ?? "",
  Region: details?.Region ?? "",
  Street: details?.Street ?? "",
  DateofBirth: details?.DateofBirth ?? "",
});

const PersonalDetailsChange = ({
  index,
  disabled,
  shouldSubmit,
  onSectionSubmitted,
  onSectionInvalid,
  personalDetails,
}) => {
  const { t } = useTranslation();
  const formikInitialValues = useMemo(
    () => mapPersonalDetailsToInitialValues(personalDetails),
    [personalDetails]
  );


  const formik = useFormik({
    initialValues: formikInitialValues,
    enableReinitialize: true,
    validate: (v) => {
      const e = {};
      const need = (k) => { if (!String(v[k] ?? "").trim()) e[k] = t("common.required", "Required"); };
      ["LastName", "ContactNumber", "HouseNo", "Country", "Province", "City"].forEach(need);
      if (!v.CompanyName) need("FirstName");
      const digits = String(v.ContactNumber || "").replace(/\D/g, "");
      if (v.ContactNumber && !(digits.length >= 10 && digits.length <= 12)) e.ContactNumber = t("endorsement.invalidContact", "Enter a valid mobile number");
      if (v.ZIPCode && !/^\d{4}$/.test(String(v.ZIPCode).trim())) e.ZIPCode = t("endorsement.invalidZip", "ZIP code is 4 digits");
      return e;
    },
    onSubmit: (values) => {
      onSectionSubmitted?.(index, values);
    },
  });

  // Submit once per request; an invalid section shows its errors and hands control back to the page
  useEffect(() => {
    if (!shouldSubmit) {
      return;
    }
    formik.validateForm().then((errors) => {
      if (Object.keys(errors).length) {
        formik.setTouched(Object.fromEntries(Object.keys(errors).map((k) => [k, true])), false);
        onSectionInvalid?.(index);
        return;
      }
      formik.submitForm();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldSubmit]);

  return (
    <div>
      <div className="customer__info__subtitle mt-2 mb-2">
        {t("endorsement.personalDetailsChange")}
      </div>
      <div className="grid">
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            label={t("endorsement.firstName")}
            disabled={disabled}
            value={formik.values.FirstName}
            onChange={formik.handleChange("FirstName")}
            error={formik.touched.FirstName && formik.errors.FirstName}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            label={t("endorsement.lastName")}
            disabled={disabled}
            value={formik.values.LastName}
            onChange={formik.handleChange("LastName")}
            error={formik.touched.LastName && formik.errors.LastName}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            label={t("endorsement.preferredName")}
            disabled={disabled}
            value={formik.values.PreferredName}
            onChange={formik.handleChange("PreferredName")}
            error={formik.touched.PreferredName && formik.errors.PreferredName}
          />
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 mt-2">
          <InputTextField
            label={t("endorsement.contactNumber")}
            disabled={disabled}
            value={formik.values.ContactNumber}
            onChange={formik.handleChange("ContactNumber")}
            error={formik.touched.ContactNumber && formik.errors.ContactNumber}
          />
        </div>
      </div>
      {/* Philippine address: Region -> Province -> City / Municipality -> Barangay, House / Unit No., Street, ZIP code */}
      <PhAddressFields
        formik={formik}
        disabled={disabled}
        required={{ houseNo: true, country: true, province: true, city: true }}
      />
    </div>
  );
};

export default PersonalDetailsChange;
