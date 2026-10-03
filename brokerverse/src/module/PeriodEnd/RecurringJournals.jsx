import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import periodEndService from "../../services/periodEndService";
import { calendarDateFormat, toDate, toIsoDate } from "../../utility/dateFormat";
import { JournalDialog, JournalLink, PageHeader, StatusTag, date, money, showError, showSuccess } from "./common";
import LinesEditor, { emptyLines } from "./LinesEditor";

const EMPTY = { name: "", description: "", kind: "recurring", frequency: "monthly", startDate: null, endDate: null, nextRunDate: null, autoPost: true, autoReverse: false, status: "active" };

/**
 * Accounts > Period End > Recurring Journals: recurring journal templates (posted by the recurring-journals job on
 * their next run date) and accrual templates (posted by the month-end close at the period end and reversed on day 1
 * of the next period).
 */
const RecurringJournals = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [kind, setKind] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [journal, setJournal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await periodEndService.recurringJournals({ kind }));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [kind]);
  useEffect(() => { load(); }, [load]);

  const open = (row) => setEditing(row
    ? { id: row.id, values: { ...EMPTY, ...row, startDate: toDate(row.startDate), endDate: toDate(row.endDate), nextRunDate: toDate(row.nextRunDate) }, lines: row.lines.map((l) => ({ ...l })) }
    : { id: null, values: { ...EMPTY }, lines: emptyLines() });
  const setValue = (patch) => setEditing((e) => ({ ...e, values: { ...e.values, ...patch } }));

  const save = async () => {
    const v = editing.values;
    const body = { name: v.name, description: v.description || null, kind: v.kind, frequency: v.frequency, startDate: toIsoDate(v.startDate), endDate: v.endDate ? toIsoDate(v.endDate) : null,
      autoPost: !!v.autoPost, autoReverse: !!v.autoReverse, status: v.status,
      lines: editing.lines.filter((l) => l.accountCode).map((l) => ({ accountCode: l.accountCode, debit: Number(l.debit || 0), credit: Number(l.credit || 0), memo: l.memo || null })) };
    if (editing.id && v.nextRunDate) body.nextRunDate = toIsoDate(v.nextRunDate);
    setSaving(true);
    try {
      const r = editing.id ? await periodEndService.updateRecurring(editing.id, body) : await periodEndService.createRecurring(body);
      showSuccess(toast, `${r.code} ${r.name}`);
      setEditing(null);
      load();
    } catch (e) {
      showError(toast, e);
    } finally {
      setSaving(false);
    }
  };

  const runDue = async (row) => {
    try {
      const r = await periodEndService.runDueRecurring(null, row?.id);
      showSuccess(toast, `${r.created.length} ${t("periodEnd.journalsGenerated")}${r.errors.length ? ` · ${r.errors.map((e) => e.error).join("; ")}` : ""}`);
      load();
    } catch (e) {
      showError(toast, e);
    }
  };

  const v = editing?.values;
  const kindOptions = [{ label: t("periodEnd.kind.recurring"), value: "recurring" }, { label: t("periodEnd.kind.accrual"), value: "accrual" }];
  const freqOptions = ["monthly", "quarterly", "yearly"].map((f) => ({ label: t(`periodEnd.frequency.${f}`), value: f }));

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("periodEnd.recurringJournals")} trail={[t("periodEnd.recurringJournals")]}>
        <Dropdown value={kind} options={kindOptions} onChange={(e) => setKind(e.value)} placeholder={t("periodEnd.allKinds")} showClear style={{ minWidth: 180 }} />
        <Button icon="pi pi-bolt" outlined label={t("periodEnd.postDueNow")} onClick={() => runDue(null)} />
        <Button icon="pi pi-plus" label={t("periodEnd.newTemplate")} onClick={() => open(null)} />
      </PageHeader>

      <div className="pe-card">
        <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows emptyMessage={t("periodEnd.noRows")}>
          <Column field="code" header={t("periodEnd.code")} />
          <Column field="name" header={t("periodEnd.name")} />
          <Column header={t("periodEnd.kindLabel")} body={(r) => t(`periodEnd.kind.${r.kind}`)} />
          <Column header={t("periodEnd.frequencyLabel")} body={(r) => t(`periodEnd.frequency.${r.frequency}`)} />
          <Column header={t("periodEnd.nextRun")} body={(r) => date(r.nextRunDate)} />
          <Column header={t("periodEnd.endDate")} body={(r) => date(r.endDate)} />
          <Column header={t("periodEnd.amount")} body={(r) => money(r.totalDebit)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("periodEnd.autoPost")} body={(r) => (r.autoPost ? <i className="pi pi-check" /> : null)} />
          <Column header={t("periodEnd.autoReverse")} body={(r) => (r.autoReverse ? <i className="pi pi-check" /> : null)} />
          <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusTag status={r.status} />} />
          <Column header={t("periodEnd.actions")} body={(r) => (
            <div className="flex gap-1">
              <Button icon="pi pi-pencil" text size="small" tooltip={t("periodEnd.edit")} onClick={() => open(r)} aria-label={t("periodEnd.edit")} />
              <Button icon="pi pi-list" text size="small" tooltip={t("periodEnd.generated")} onClick={async () => { try { setDetail(await periodEndService.recurringJournal(r.id)); } catch (e) { showError(toast, e); } }} aria-label={t("periodEnd.generated")} />
              {r.kind === "recurring" && r.status === "active" && <Button icon="pi pi-bolt" text size="small" tooltip={t("periodEnd.postDueNow")} onClick={() => runDue(r)} aria-label={t("periodEnd.postDueNow")} />}
            </div>
          )} />
        </DataTable>
      </div>

      <Dialog className="pe-dialog" header={editing ? (editing.id ? `${t("periodEnd.edit")} ${v.code || ""}` : t("periodEnd.newTemplate")) : ""} visible={!!editing} style={{ width: "min(1000px, 96vw)" }}
        onHide={() => setEditing(null)} footer={(
          <div>
            <Button label={t("periodEnd.cancel")} text onClick={() => setEditing(null)} />
            <Button label={t("periodEnd.save")} icon="pi pi-save" loading={saving} onClick={save} disabled={!v?.name || !v?.startDate} />
          </div>
        )}>
        {editing && (
          <div className="grid">
            <div className="col-12 md:col-6"><label>{t("periodEnd.name")} *</label><InputText value={v.name} onChange={(e) => setValue({ name: e.target.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("periodEnd.kindLabel")}</label>
              <Dropdown value={v.kind} options={kindOptions} onChange={(e) => setValue({ kind: e.value, autoReverse: e.value === "accrual" ? true : v.autoReverse })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("periodEnd.frequencyLabel")}</label><Dropdown value={v.frequency} options={freqOptions} onChange={(e) => setValue({ frequency: e.value })} className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("periodEnd.startDate")} *</label>
              <Calendar value={v.startDate} onChange={(e) => setValue({ startDate: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" /></div>
            {editing.id && <div className="col-12 md:col-3"><label>{t("periodEnd.nextRun")}</label>
              <Calendar value={v.nextRunDate} onChange={(e) => setValue({ nextRunDate: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" /></div>}
            <div className="col-12 md:col-3"><label>{t("periodEnd.endDate")}</label>
              <Calendar value={v.endDate} onChange={(e) => setValue({ endDate: e.value })} dateFormat={calendarDateFormat()} showIcon showButtonBar className="w-full" /></div>
            <div className="col-12 md:col-3"><label>{t("periodEnd.statusLabel")}</label>
              <Dropdown value={v.status} options={["active", "inactive", "completed"].map((s) => ({ label: t(`periodEnd.status.${s}`), value: s }))} onChange={(e) => setValue({ status: e.value })} className="w-full" /></div>
            <div className="col-12"><label>{t("periodEnd.description")}</label><InputTextarea value={v.description || ""} onChange={(e) => setValue({ description: e.target.value })} rows={2} className="w-full" /></div>
            <div className="col-12 md:col-4 flex align-items-center gap-2"><Checkbox inputId="rj-post" checked={!!v.autoPost} onChange={(e) => setValue({ autoPost: e.checked })} /><label htmlFor="rj-post" className="m-0">{t("periodEnd.autoPostHelp")}</label></div>
            <div className="col-12 md:col-8 flex align-items-center gap-2"><Checkbox inputId="rj-rev" checked={!!v.autoReverse} onChange={(e) => setValue({ autoReverse: e.checked })} /><label htmlFor="rj-rev" className="m-0">{t("periodEnd.autoReverseHelp")}</label></div>
            <div className="col-12"><LinesEditor lines={editing.lines} onChange={(lines) => setEditing((e) => ({ ...e, lines }))} /></div>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={detail ? `${detail.code} ${detail.name}` : ""} visible={!!detail} style={{ width: "min(760px, 95vw)" }} onHide={() => setDetail(null)}>
        <DataTable value={detail?.runs || []} size="small" emptyMessage={t("periodEnd.noJournals")}>
          <Column header={t("periodEnd.date")} body={(r) => date(r.occurrenceDate)} />
          <Column field="period" header={t("periodEnd.period")} />
          <Column header={t("periodEnd.journal")} body={(r) => <JournalLink journal={{ ...r, date: r.occurrenceDate }} onOpen={setJournal} />} />
          <Column header={t("periodEnd.statusLabel")} body={(r) => <StatusTag status={r.status === "undone" ? "undone" : r.journalStatus} />} />
        </DataTable>
      </Dialog>
      <JournalDialog journal={journal} onHide={() => setJournal(null)} />
    </div>
  );
};

export default RecurringJournals;
