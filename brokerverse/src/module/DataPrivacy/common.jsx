import React from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Tag } from "primereact/tag";
import { formatDate } from "../../utility/dateFormat";

/** Values the server accepts (backend/src/modules/privacy/service.js); their labels are in en.json "privacy". */
export const PURPOSES = ["processing", "marketing", "sharing"];
export const CHANNELS = ["Form", "E-mail", "Phone", "Portal", "In person"];
export const REQUEST_TYPES = ["access", "rectification", "erasure", "objection", "portability", "withdraw-consent"];
export const REQUEST_STATUSES = ["open", "in-progress", "completed", "rejected"];
export const OPEN_STATUSES = ["open", "in-progress"];

const CONSENT_SEVERITY = { granted: "success", withdrawn: "warning", refused: "danger", "not-recorded": "secondary" };
const REQUEST_SEVERITY = { open: "info", "in-progress": "warning", completed: "success", rejected: "secondary" };

/** Option lists with translated labels. */
export const useOptions = () => {
  const { t } = useTranslation();
  return {
    purposes: PURPOSES.map((value) => ({ value, label: t(`privacy.purpose.${value}`) })),
    channels: CHANNELS.map((value) => ({ value, label: t(`privacy.channel.${value}`) })),
    requestTypes: REQUEST_TYPES.map((value) => ({ value, label: t(`privacy.requestType.${value}`) })),
    requestStatuses: REQUEST_STATUSES.map((value) => ({ value, label: t(`privacy.requestStatus.${value}`) })),
    consentStatuses: ["granted", "withdrawn", "refused"].map((value) => ({ value, label: t(`privacy.consentStatus.${value}`) })),
    partyTypes: ["client", "lead"].map((value) => ({ value, label: t(`privacy.partyType.${value}`) })),
  };
};

export const ConsentStatusTag = ({ status }) => {
  const { t } = useTranslation();
  return <Tag value={t(`privacy.consentStatus.${status}`)} severity={CONSENT_SEVERITY[status] || "secondary"} />;
};

export const RequestStatusTag = ({ status }) => {
  const { t } = useTranslation();
  return <Tag value={t(`privacy.requestStatus.${status}`)} severity={REQUEST_SEVERITY[status] || "secondary"} />;
};

export const showDate = (v) => formatDate(v, { empty: "" });
export const showDateTime = (v) => formatDate(v, { withTime: true, empty: "" });

/** Local calendar date of a date picker value as YYYY-MM-DD. */
export const isoDay = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : undefined);
export const fromIsoDay = (s) => (s ? new Date(`${s}T00:00:00`) : null);

/** Page frame of the Data Privacy screens: breadcrumb, title, one-line purpose and the actions on the right. */
export const PageHeader = ({ title, intro, actions }) => {
  const { t } = useTranslation();
  return (
    <>
      <BreadCrumb
        model={[{ label: t("privacy.menu") }, { label: title }]}
        home={{ label: t("privacy.master") }}
        className="admin__breadcrumb"
      />
      <div className="admin__header">
        <div>
          <h2>{title}</h2>
          {intro ? <p>{intro}</p> : null}
        </div>
        {actions ? <div className="admin__actions">{actions}</div> : null}
      </div>
    </>
  );
};
