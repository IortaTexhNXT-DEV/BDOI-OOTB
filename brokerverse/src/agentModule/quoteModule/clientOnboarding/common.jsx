import React from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Tag } from "primereact/tag";
import { formatDate } from "../../../utility/dateFormat";

/** Values the server accepts (backend/src/modules/clients); their labels are in en.json "onboarding". */
export const DOC_TYPES = ["government-id", "proof-of-address", "tin", "sec-registration", "dti-registration", "cda-registration", "articles-by-laws", "gis",
  "board-resolution", "secretary-certificate", "beneficial-owner-declaration", "source-of-funds", "other"];
export const AUTHORITY_DOCUMENTS = ["board-resolution", "secretary-certificate", "partnership-resolution", "special-power-of-attorney", "other"];
export const CONTROL_TYPES = ["ownership", "control", "senior-management"];

/** KYC status of the client: complete, or pending while identification is missing. */
export const KycStatusTag = ({ value }) => {
  const { t } = useTranslation();
  if (!value) return "-";
  return <Tag value={t(`onboarding.kycStatus.${value}`, { defaultValue: value })} severity={value === "complete" ? "success" : "warning"} />;
};

export const showDate = (v) => formatDate(v, { empty: "" });
export const showDateTime = (v) => formatDate(v, { withTime: true, empty: "" });
export const isoDay = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : undefined);

/** Page frame of the onboarding screen: breadcrumb, title, one-line purpose and the actions on the right. */
export const PageHeader = ({ title, intro, actions, home }) => (
  <>
    <BreadCrumb model={[{ label: title }]} home={{ label: home }} className="admin__breadcrumb" />
    <div className="admin__header">
      <div>
        <h2>{title}</h2>
        {intro ? <p>{intro}</p> : null}
      </div>
      {actions ? <div className="admin__actions">{actions}</div> : null}
    </div>
  </>
);
