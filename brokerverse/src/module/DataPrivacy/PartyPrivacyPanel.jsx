import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { SelectButton } from "primereact/selectbutton";
import { Toast } from "primereact/toast";
import privacyService, { errorMessage } from "../../services/privacyService";
import { ConsentStatusTag, showDateTime, useOptions } from "./common";
import "../Administration/index.scss";
import "./index.scss";

/**
 * Data privacy of one client or prospect (client view tab, prospect view card): consent per purpose with the date and
 * channel, the history, and Record consent / Withdraw in a side panel. Writing needs the party's write permission.
 */
const PartyPrivacyPanel = ({ partyType, partyId }) => {
  const { t } = useTranslation();
  const options = useOptions();
  const toast = useRef(null);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!partyId) return;
    setLoading(true);
    try {
      setState(await privacyService.consents(partyType, partyId));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("privacy.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [partyType, partyId, t]);

  useEffect(() => { load(); }, [load]);

  const purposeLabel = (p) => t(`privacy.purpose.${p}`);
  const decisions = [{ value: true, label: t("privacy.given") }, { value: false, label: t("privacy.refused") }];

  const openRecord = (purpose) => setForm({ purpose: purpose || "processing", granted: true, channel: "Form", noticeVersion: state?.noticeVersion || "", evidence: "" });

  const save = async () => {
    setSaving(true);
    try {
      const r = await privacyService.recordConsent({
        partyType, partyId: state.partyId, purpose: form.purpose, granted: form.granted, channel: form.channel,
        noticeVersion: form.noticeVersion || undefined, evidence: form.evidence || undefined,
      });
      toast.current?.show({ severity: "success", summary: r.message });
      setForm(null);
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("privacy.saveFailed")) });
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async () => {
    setSaving(true);
    try {
      const r = await privacyService.withdrawConsent(withdrawing.id, withdrawing.reason);
      toast.current?.show({ severity: "success", summary: r.message });
      setWithdrawing(null);
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("privacy.saveFailed")) });
    } finally {
      setSaving(false);
    }
  };

  const anonymised = !!state?.anonymisedAt;
  const actions = (row) => (anonymised ? null : (
    <div className="privacy__row-actions">
      <Button label={t("privacy.record")} text size="small" onClick={() => openRecord(row.purpose)} />
      {row.status === "granted" ? (
        <Button label={t("privacy.withdraw")} text size="small" severity="danger" onClick={() => setWithdrawing({ id: row.id, purpose: row.purpose, reason: "" })} />
      ) : null}
    </div>
  ));

  return (
    <div className="privacy__panel">
      <Toast ref={toast} />
      <div className="privacy__panel-head">
        <div>
          <h3>{t("privacy.cardTitle")}</h3>
          <p>{t("privacy.cardIntro", { version: state?.noticeVersion || "" })}</p>
        </div>
        <div className="admin__actions">
          <Button label={showHistory ? t("privacy.hideHistory") : t("privacy.showHistory")} text size="small" onClick={() => setShowHistory((v) => !v)} />
          {anonymised ? null : <Button label={t("privacy.recordConsent")} icon="pi pi-plus" size="small" onClick={() => openRecord()} disabled={!state} />}
        </div>
      </div>
      {anonymised ? <Message severity="info" className="w-full mb-3" text={t("privacy.anonymisedNotice", { date: showDateTime(state.anonymisedAt) })} /> : null}
      <DataTable value={state?.purposes || []} dataKey="purpose" loading={loading} size="small" stripedRows className="privacy__table">
        <Column header={t("privacy.colPurpose")} body={(r) => (
          <div className="privacy__purpose">
            <span className="privacy__purpose-name">{purposeLabel(r.purpose)}</span>
            <small>{t(`privacy.purposeHint.${r.purpose}`)}</small>
          </div>
        )} />
        <Column header={t("privacy.colStatus")} body={(r) => <ConsentStatusTag status={r.status} />} />
        <Column header={t("privacy.colSince")} body={(r) => showDateTime(r.status === "withdrawn" ? r.withdrawnAt : r.recordedAt)} />
        <Column header={t("privacy.colChannel")} body={(r) => (r.channel ? t(`privacy.channel.${r.channel}`) : "")} />
        <Column field="noticeVersion" header={t("privacy.colNoticeVersion")} />
        <Column header="" style={{ width: "12rem" }} body={actions} />
      </DataTable>
      {showHistory ? (
        <DataTable value={state?.history || []} dataKey="id" size="small" stripedRows className="privacy__table mt-3" emptyMessage={t("privacy.noHistory")}>
          <Column header={t("privacy.colRecorded")} body={(r) => showDateTime(r.recordedAt)} />
          <Column header={t("privacy.colPurpose")} body={(r) => purposeLabel(r.purpose)} />
          <Column header={t("privacy.colStatus")} body={(r) => <ConsentStatusTag status={r.status} />} />
          <Column header={t("privacy.colChannel")} body={(r) => t(`privacy.channel.${r.channel}`)} />
          <Column field="noticeVersion" header={t("privacy.colNoticeVersion")} />
          <Column field="evidence" header={t("privacy.colEvidence")} />
          <Column field="recordedBy" header={t("privacy.colRecordedBy")} />
          <Column header={t("privacy.colWithdrawn")} body={(r) => (r.withdrawnAt ? `${showDateTime(r.withdrawnAt)}${r.withdrawalReason ? ` (${r.withdrawalReason})` : ""}` : "")} />
        </DataTable>
      ) : null}

      <Dialog header={t("privacy.recordConsent")} visible={!!form} style={{ width: "34rem" }} modal onHide={() => setForm(null)}
        footer={<>
          <Button label={t("privacy.cancel")} text onClick={() => setForm(null)} />
          <Button label={t("privacy.save")} icon="pi pi-check" loading={saving} disabled={!form?.purpose || !form?.channel} onClick={save} />
        </>}>
        {form ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field">
              <label htmlFor="pc-purpose">{t("privacy.colPurpose")}</label>
              <Dropdown inputId="pc-purpose" value={form.purpose} options={options.purposes} onChange={(e) => setForm((f) => ({ ...f, purpose: e.value }))} />
              <small>{t(`privacy.purposeHint.${form.purpose}`)}</small>
            </div>
            <div className="admin__field">
              <label htmlFor="pc-decision">{t("privacy.decision")}</label>
              <SelectButton id="pc-decision" value={form.granted} options={decisions} allowEmpty={false} onChange={(e) => setForm((f) => ({ ...f, granted: e.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="pc-channel">{t("privacy.colChannel")}</label>
              <Dropdown inputId="pc-channel" value={form.channel} options={options.channels} onChange={(e) => setForm((f) => ({ ...f, channel: e.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="pc-version">{t("privacy.colNoticeVersion")}</label>
              <InputText id="pc-version" value={form.noticeVersion} onChange={(e) => setForm((f) => ({ ...f, noticeVersion: e.target.value }))} />
              <small>{t("privacy.noticeVersionHint")}</small>
            </div>
            <div className="admin__field">
              <label htmlFor="pc-evidence">{t("privacy.colEvidence")}</label>
              <InputTextarea id="pc-evidence" rows={3} value={form.evidence} onChange={(e) => setForm((f) => ({ ...f, evidence: e.target.value }))} placeholder={t("privacy.evidenceHint")} />
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("privacy.withdrawTitle")} visible={!!withdrawing} style={{ width: "30rem" }} modal onHide={() => setWithdrawing(null)}
        footer={<>
          <Button label={t("privacy.cancel")} text onClick={() => setWithdrawing(null)} />
          <Button label={t("privacy.withdraw")} icon="pi pi-check" severity="danger" loading={saving} disabled={(withdrawing?.reason || "").trim().length < 2} onClick={withdraw} />
        </>}>
        {withdrawing ? (
          <div className="admin__grid admin__grid--single">
            <p>{t("privacy.withdrawIntro", { purpose: purposeLabel(withdrawing.purpose) })}</p>
            <div className="admin__field">
              <label htmlFor="pc-reason">{t("privacy.reason")}</label>
              <InputTextarea id="pc-reason" rows={3} value={withdrawing.reason} onChange={(e) => setWithdrawing((w) => ({ ...w, reason: e.target.value }))} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default PartyPrivacyPanel;
