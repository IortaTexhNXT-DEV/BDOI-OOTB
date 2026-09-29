import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import DropdownField from "../../../component/DropdownField";
import { useFormik } from "formik";

const FireCancellation = ({
  index,
  disabled,
  shouldSubmit,
  onSectionSubmitted,
}) => {
  const { t } = useTranslation();
  const formik = useFormik({
    initialValues: {
      cancellationType: "FULL",
    },
    onSubmit: (values) => {
      onSectionSubmitted?.(index, {
        isCancelPolicy: true,
        cancellationType: values.cancellationType || "FULL",
      });
    },
  });

  useEffect(() => {
    if (!shouldSubmit) return;
    formik.submitForm();
  }, [formik, shouldSubmit]);

  const cancellationOptions = [
    { label: t("fireEndorsement.fullCancellation"), value: "FULL" },
    { label: t("fireEndorsement.partialCancellation"), value: "PARTIAL" },
    { label: t("fireEndorsement.proRataRefund"), value: "PRO_RATA" },
    { label: t("fireEndorsement.proRataPartialRefund"), value: "PRO_RATA_PARTIAL" },
  ];

  return (
    <div>
      <div className="customer__info__subtitle mt-2 mb-2">
        {t("fireEndorsement.firePolicyCancellationSubtitle")}
      </div>
      <div className="grid">
        <div className="col-12 md:col-6 lg:col-6 mt-2">
          <DropdownField
            label={t("fireEndorsement.cancellationType")}
            disabled={disabled}
            value={formik.values.cancellationType}
            options={cancellationOptions}
            onChange={(e) => formik.setFieldValue("cancellationType", e.value)}
            optionLabel="label"
            optionValue="value"
          />
        </div>
      </div>
    </div>
  );
};

export default FireCancellation;
