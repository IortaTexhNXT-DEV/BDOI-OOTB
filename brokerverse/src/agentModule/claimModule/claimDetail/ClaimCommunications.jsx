import React, { useCallback, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import DateField from "../../../components/DateField";
import FieldError from "../../../components/FieldError";
import { RowActions, StatusChip } from "../../../components/RecordPage";
import { useStableLoad } from "../../../hooks/useStableLoad";
import claimHandlingService from "../../../services/claimHandlingService";
import { formatDate, toIsoDate } from "../../../utility/dateFormat";

const EMPTY_ENTRY = { party: "insurer", direction: "out", method: "Phone", subject: "", message: "", followUpDate: "" };

/**
 * Communication log of a claim (TIS-BRD-CLAIM-06, FGA CM-10): exchanges with the insurer, the client, the adjuster or the
 * repair shop, newest first, with their follow-up date (overdue in red until marked done). Log communication records
 * one; Follow up insurer e-mails the insurer and logs it (write:claims).
 */
const ClaimCommunications = ({ claimId, parties, methods, canEdit, notify }) => {
  const { t } = useTranslation();
  const loader = useCallback(() => claimHandlingService.communications(claimId), [claimId]);
  const { data, loading, reload } = useStableLoad(loader, { initialData: [] });
  const [entry, setEntry] = useState(null);
  const [followUp, setFollowUp] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const today = toIsoDate(new Date());

  const run = async (action, done) => {
    setBusy(true);
    setErrors({});
    try {
      await action();
      notify("success", done);
      setEntry(null);
      setFollowUp(null);
      reload();
    } catch (e) {
      setErrors(Object.fromEntries((e.errors || []).map((x) => [x.path, x.message])));
      notify("error", e.message);
    } finally {
      setBusy(false);
    }
  };
  const saveEntry = () => {
    if (!entry.message.trim()) {
      setErrors({ message: t("claimComms.messageRequired") });
      return;
    }
    run(() => claimHandlingService.addCommunication(claimId, { ...entry, subject: entry.subject || undefined, followUpDate: entry.followUpDate || undefined }), t("claimComms.logged"));
  };
  const sendFollowUp = () => {
    if (!followUp.message.trim()) {
      setErrors({ message: t("claimComms.messageRequired") });
      return;
    }
    run(() => claimHandlingService.followUpInsurer(claimId, { message: followUp.message, followUpDate: followUp.followUpDate || undefined }), t("claimComms.followUpSent"));
  };
  const markDone = (row) => run(() => claimHandlingService.completeFollowUp(claimId, row.id), t("claimComms.followUpDone"));

  const followBody = (r) => {
    if (!r.followUpDate) return <span className="bv-muted">—</span>;
    if (r.followUpDone) return <StatusChip label={t("claimComms.done")} severity="success" />;
    return <span className={r.overdue ? "bv-text-alert" : undefined}>{formatDate(r.followUpDate)}{r.overdue ? ` · ${t("claimComms.overdue")}` : ""}</span>;
  };

  return (
    <>
      {canEdit ? (
        <div className="flex gap-2 mb-2 flex-wrap">
          <Button type="button" icon="pi pi-plus" outlined size="small" label={t("claimComms.log")} onClick={() => { setErrors({}); setEntry({ ...EMPTY_ENTRY }); }} />
          <Button type="button" icon="pi pi-send" outlined size="small" label={t("claimComms.followUpInsurer")} onClick={() => { setErrors({}); setFollowUp({ message: "", followUpDate: "" }); }} />
        </div>
      ) : null}
      <DataTable value={data || []} dataKey="id" loading={loading} size="small" emptyMessage={t("claimComms.empty")}>
        <Column header={t("claimComms.when")} body={(r) => formatDate(r.at, { withTime: true })} />
        <Column header={t("claimComms.party")} body={(r) => `${r.partyLabel} · ${r.direction === "in" ? t("claimComms.in") : t("claimComms.out")}`} />
        <Column field="method" header={t("claimComms.method")} />
        <Column header={t("claimComms.message")} body={(r) => <span className="bv-cell-stack">{r.subject ? <strong>{r.subject}</strong> : null}<span>{r.message}</span></span>} />
        <Column header={t("claimComms.followUp")} body={followBody} />
        <Column field="by" header={t("claimComms.by")} />
        {canEdit ? (
          <Column header={t("claimComms.actions")} className="bv-actions" headerClassName="bv-actions"
            body={(r) => <RowActions actions={[{ icon: "pi pi-check", label: t("claimComms.markDone"), onClick: () => markDone(r), disabled: !r.followUpDate || r.followUpDone || busy }]} />} />
        ) : null}
      </DataTable>

      <Dialog header={t("claimComms.log")} visible={!!entry} onHide={() => setEntry(null)} style={{ width: "40rem" }} breakpoints={{ "768px": "95vw" }}
        footer={(
          <>
            <Button type="button" label={t("claimJourney.cancel")} text onClick={() => setEntry(null)} disabled={busy} />
            <Button type="button" label={t("claimComms.save")} icon="pi pi-check" onClick={saveEntry} loading={busy} />
          </>
        )}>
        {entry ? (
          <div className="grid">
            <div className="col-12 md:col-4">
              <label htmlFor="cm-party">{t("claimComms.party")}</label>
              <Dropdown inputId="cm-party" value={entry.party} options={parties} onChange={(e) => setEntry({ ...entry, party: e.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-4">
              <label htmlFor="cm-direction">{t("claimComms.direction")}</label>
              <Dropdown inputId="cm-direction" value={entry.direction} onChange={(e) => setEntry({ ...entry, direction: e.value })} className="w-full"
                options={[{ label: t("claimComms.out"), value: "out" }, { label: t("claimComms.in"), value: "in" }]} />
            </div>
            <div className="col-12 md:col-4">
              <label htmlFor="cm-method">{t("claimComms.method")}</label>
              <Dropdown inputId="cm-method" value={entry.method} options={methods.map((m) => ({ label: t(`claimComms.methods.${m}`, m), value: m }))}
                onChange={(e) => setEntry({ ...entry, method: e.value })} className="w-full" />
            </div>
            <div className="col-12">
              <label htmlFor="cm-subject">{t("claimComms.subject")}</label>
              <InputText id="cm-subject" value={entry.subject} onChange={(e) => setEntry({ ...entry, subject: e.target.value })} maxLength={200} className="w-full" />
            </div>
            <div className="col-12">
              <label htmlFor="cm-message">{t("claimComms.message")}</label>
              <InputTextarea id="cm-message" value={entry.message} onChange={(e) => setEntry({ ...entry, message: e.target.value })} rows={3} autoResize maxLength={4000}
                className={errors.message ? "w-full p-invalid" : "w-full"} aria-invalid={errors.message ? true : undefined} />
              <FieldError error={errors.message} />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="cm-follow">{t("claimComms.followUpDate")}</label>
              <DateField id="cm-follow" value={entry.followUpDate} min={today} onChange={(e) => setEntry({ ...entry, followUpDate: e.target.value })} invalid={!!errors.followUpDate} />
              <FieldError error={errors.followUpDate} />
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("claimComms.followUpInsurer")} visible={!!followUp} onHide={() => setFollowUp(null)} style={{ width: "36rem" }} breakpoints={{ "768px": "95vw" }}
        footer={(
          <>
            <Button type="button" label={t("claimJourney.cancel")} text onClick={() => setFollowUp(null)} disabled={busy} />
            <Button type="button" label={t("claimComms.sendFollowUp")} icon="pi pi-send" onClick={sendFollowUp} loading={busy} />
          </>
        )}>
        {followUp ? (
          <div className="grid">
            <div className="col-12">
              <label htmlFor="fu-message">{t("claimComms.message")}</label>
              <InputTextarea id="fu-message" value={followUp.message} onChange={(e) => setFollowUp({ ...followUp, message: e.target.value })} rows={4} autoResize maxLength={4000}
                className={errors.message ? "w-full p-invalid" : "w-full"} aria-invalid={errors.message ? true : undefined} />
              <FieldError error={errors.message} />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="fu-date">{t("claimComms.followUpDate")}</label>
              <DateField id="fu-date" value={followUp.followUpDate} min={today} onChange={(e) => setFollowUp({ ...followUp, followUpDate: e.target.value })} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
};

ClaimCommunications.propTypes = {
  claimId: PropTypes.string.isRequired,
  parties: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.string, label: PropTypes.string })),
  methods: PropTypes.arrayOf(PropTypes.string),
  canEdit: PropTypes.bool,
  notify: PropTypes.func.isRequired,
};
ClaimCommunications.defaultProps = { parties: [], methods: ["Email", "Phone", "Letter", "Meeting", "SMS"], canEdit: false };

export default ClaimCommunications;
