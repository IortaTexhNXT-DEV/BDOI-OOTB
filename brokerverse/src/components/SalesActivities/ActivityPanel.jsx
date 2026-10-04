import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Skeleton } from "primereact/skeleton";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import salesActivityService from "../../services/salesActivityService";
import { hasPermission } from "../../utils/canOpen";
import { formatDate } from "../../utility/dateFormat";
import ActivityForm from "./ActivityForm";
import "./activities.scss";

export const CHANNEL_ICON = { call: "pi pi-phone", meeting: "pi pi-users", email: "pi pi-envelope", visit: "pi pi-map-marker", other: "pi pi-comment" };
const TASK_SEVERITY = { open: "warning", done: "success", cancelled: "secondary" };

/**
 * Activities of a prospect (lead), a quotation (quote) or a client: the timeline of the calls, meetings, e-mails and
 * visits logged on it (newest first; a prospect and a client also show those of their quotations), the open next
 * step, and Log activity (write:sales-activities). The next step becomes a follow-up task in My Work.
 */
const ActivityPanel = ({ entity, recordId, onLogged }) => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [data, setData] = useState(null);
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [reason, setReason] = useState("");
  const canWrite = hasPermission("write:sales-activities");

  const load = useCallback(async () => {
    if (!entity || !recordId) return;
    setLoading(true);
    try {
      setData(await salesActivityService.timeline(entity, recordId));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [entity, recordId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { salesActivityService.options().then(setOptions).catch(() => setOptions({ types: [], outcomes: [] })); }, []);

  const notify = (severity, detail) => toast.current?.show({ severity, summary: severity === "error" ? t("salesActivities.error") : t("salesActivities.done"), detail, life: 5000 });
  const save = async (payload) => {
    try {
      if (form.activity) {
        await salesActivityService.update(form.activity.id, payload);
        notify("success", t("salesActivities.updated"));
      } else {
        const r = await salesActivityService.log({ entity, entityId: recordId, ...payload });
        notify("success", r.message || t("salesActivities.logged"));
      }
      setForm(null);
      load();
      if (onLogged) onLogged();
    } catch (e) {
      notify("error", e.message);
    }
  };
  const cancel = async () => {
    try {
      await salesActivityService.cancel(cancelling.id, reason);
      notify("success", t("salesActivities.cancelled"));
      setCancelling(null);
      setReason("");
      load();
    } catch (e) {
      notify("error", e.message);
    }
  };

  const activities = data?.activities || [];
  return (
    <div className="bv-activities">
      <Toast ref={toast} />
      <div className="bv-activities-head">
        <div>
          <h3 className="bv-activities-title">{t("salesActivities.title")}</h3>
          {data?.nextStep && (
            <div className="bv-activities-next">
              <i className="pi pi-flag" /> {t("salesActivities.openNextStep")}: <b>{data.nextStep.nextStep}</b> · {formatDate(data.nextStep.dueDate)}
            </div>
          )}
        </div>
        {canWrite && <Button icon="pi pi-plus" label={t("salesActivities.logActivity")} size="small" onClick={() => setForm({ activity: null })} />}
      </div>
      {loading && !data && <div aria-busy="true">{[0, 1].map((i) => <Skeleton key={i} height="3.5rem" className="mb-2" />)}</div>}
      {error && <div className="bv-activities-empty">{error}</div>}
      {!loading && !error && !activities.length && <div className="bv-activities-empty">{t("salesActivities.none")}</div>}
      <ol className="bv-activities-list">
        {activities.map((a) => (
          <li key={a.id} className="bv-activity">
            <span className="bv-activity-icon"><i className={CHANNEL_ICON[a.channel] || CHANNEL_ICON.other} /></span>
            <div className="bv-activity-body">
              <div className="bv-activity-line">
                <b>{a.activityTypeName}</b>
                <span>{formatDate(a.activityAt, { withTime: true })}</span>
                <span>{a.accountExecutiveName}</span>
                {a.entity !== entity && a.recordNumber && <Tag severity="info" value={a.recordNumber} />}
                {a.outcomeName && <Tag value={a.outcomeName} />}
              </div>
              <div className="bv-activity-subject">{a.subject}{a.contactPerson ? ` · ${a.contactPerson}` : ""}{a.location ? ` · ${a.location}` : ""}{a.durationMinutes ? ` · ${a.durationMinutes} min` : ""}</div>
              {a.notes && <div className="bv-activity-notes">{a.notes}</div>}
              {a.nextStep && (
                <div className="bv-activity-next">
                  <i className="pi pi-arrow-right" /> {a.nextStep}{a.nextStepDate ? ` · ${formatDate(a.nextStepDate)}` : ""}
                  {a.taskStatus && <Tag className="ml-2" severity={TASK_SEVERITY[a.taskStatus]} value={t(`salesActivities.task.${a.taskStatus}`)} />}
                </div>
              )}
            </div>
            {canWrite && a.status === "logged" && (
              <div className="bv-activity-actions">
                <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("salesActivities.edit")} tooltip={t("salesActivities.edit")} tooltipOptions={{ position: "top" }}
                  onClick={() => setForm({ activity: a })} />
                <Button icon="pi pi-times" text rounded size="small" severity="secondary" aria-label={t("salesActivities.cancelActivity")} tooltip={t("salesActivities.cancelActivity")}
                  tooltipOptions={{ position: "top" }} onClick={() => setCancelling(a)} />
              </div>
            )}
          </li>
        ))}
      </ol>
      <ActivityForm visible={!!form} options={options} activity={form?.activity || null} onSave={save} onHide={() => setForm(null)} />
      <Dialog className="pe-dialog" header={t("salesActivities.cancelActivity")} visible={!!cancelling} style={{ width: "min(520px, 96vw)" }} onHide={() => setCancelling(null)}
        footer={<div><Button label={t("salesActivities.back")} text onClick={() => setCancelling(null)} /><Button label={t("salesActivities.cancelActivity")} severity="danger" disabled={reason.trim().length < 3} onClick={cancel} /></div>}>
        <label htmlFor="sa-cancel-reason" className="block mb-1">{t("salesActivities.reason")}</label>
        <InputText id="sa-cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full" maxLength={500} />
      </Dialog>
    </div>
  );
};

ActivityPanel.propTypes = {
  entity: PropTypes.oneOf(["lead", "quote", "client"]).isRequired,
  recordId: PropTypes.string,
  onLogged: PropTypes.func,
};

export default ActivityPanel;
