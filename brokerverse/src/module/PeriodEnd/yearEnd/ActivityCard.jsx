import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { StatusTag, dateTime } from "../common";

/** Activity of the year-end close runs of a fiscal year: action, user and role, date and time, status change, remarks. */
const ActivityCard = ({ activity }) => {
  const { t } = useTranslation();
  if (!activity?.length) return null;
  const several = new Set(activity.map((a) => a.runNumber)).size > 1;
  return (
    <section className="pe-card" aria-labelledby="ye-activity-title">
      <h2 className="pe-card-title" id="ye-activity-title">{t("yearEndClose.activity.title")}</h2>
      <DataTable value={activity} dataKey="id" size="small" stripedRows paginator={activity.length > 10} rows={10}>
        <Column header={t("yearEndClose.activity.when")} body={(r) => dateTime(r.at)} style={{ width: "11rem" }} />
        {several && <Column field="runNumber" header={t("yearEndClose.activity.run")} />}
        <Column header={t("yearEndClose.activity.action")} body={(r) => t(`yearEndClose.action.${r.action}`, { defaultValue: r.action })} />
        <Column header={t("yearEndClose.activity.user")} body={(r) => r.byName || "-"} />
        <Column header={t("yearEndClose.activity.role")} body={(r) => (r.roles?.length ? r.roles.join(", ") : "-")} />
        <Column header={t("yearEndClose.activity.from")} body={(r) => <StatusTag status={r.fromStatus} />} />
        <Column header={t("yearEndClose.activity.to")} body={(r) => <StatusTag status={r.toStatus} />} />
        <Column header={t("yearEndClose.activity.remarks")} body={(r) => r.remarks || ""} />
      </DataTable>
    </section>
  );
};

ActivityCard.propTypes = {
  activity: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired, action: PropTypes.string.isRequired, byName: PropTypes.string, roles: PropTypes.arrayOf(PropTypes.string),
    at: PropTypes.string, fromStatus: PropTypes.string, toStatus: PropTypes.string, remarks: PropTypes.string, runNumber: PropTypes.string,
  })),
};

export default ActivityCard;
