import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AutoComplete } from "primereact/autocomplete";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Menu } from "primereact/menu";
import { Message } from "primereact/message";
import { SelectButton } from "primereact/selectbutton";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import privacyService, { errorMessage } from "../../services/privacyService";
import { OPEN_STATUSES, PageHeader, RequestStatusTag, fromIsoDay, isoDay, showDate, useOptions } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

const EMPTY = { party: null, requesterName: "", requesterContact: "", requestType: "access", receivedOn: null, description: "", assignedTo: null, status: "open", responseNotes: "" };
const partyText = (p) => (p ? `${p.code || ""} ${p.name || ""}`.trim() : "");

/**
 * Master > Data Privacy > Data Subject Requests: requests of data subjects under the Data Privacy Act (access,
 * rectification, erasure, objection, portability, withdrawal of consent), due a set number of days after receipt.
 * Actions: export the party's personal data, anonymise it once the records no longer have to be kept, close.
 */
const DataSubjectRequests = () => {
  const { t } = useTranslation();
  const options = useOptions();
  const toast = useRef(null);
  const exportMenu = useRef(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [filters, setFilters] = useState({ status: null, requestType: null, overdue: false, search: "" });
  const [loading, setLoading] = useState(true);
  const [assignees, setAssignees] = useState([]);
  const [form, setForm] = useState(null);
  const [partySuggestions, setPartySuggestions] = useState([]);
  const [closing, setClosing] = useState(null);
  const [anonymising, setAnonymising] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [saving, setSaving] = useState(false);

  const fail = (e, key) => toast.current?.show({ severity: "error", summary: errorMessage(e, t(key)) });
  const done = (message) => toast.current?.show({ severity: "success", summary: message });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await privacyService.requests({ status: filters.status, requestType: filters.requestType, overdue: filters.overdue ? "true" : undefined, search: filters.search });
      setRows(r.items);
      setSummary(r.summary || {});
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("privacy.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    privacyService.assignees().then((list) => setAssignees(list.map((u) => ({ value: u.id, label: `${u.name} (${u.username})` })))).catch(() => setAssignees([]));
  }, []);

  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const typeLabel = (v) => t(`privacy.requestType.${v}`);

  // ---------- log / edit ----------
  const openNew = () => setForm({ ...EMPTY, receivedOn: new Date() });
  const openEdit = (r) => setForm({
    id: r.id, requestNumber: r.requestNumber, party: r.partyId ? { partyType: r.partyType, partyId: r.partyId, code: r.partyCode, name: r.partyName } : null,
    requesterName: r.requesterName || "", requesterContact: r.requesterContact || "", requestType: r.requestType, receivedOn: fromIsoDay(r.receivedOn),
    description: r.description || "", assignedTo: r.assignedTo || null, status: r.status, responseNotes: r.responseNotes || "",
  });
  const searchParties = async (e) => {
    try {
      setPartySuggestions(await privacyService.searchParties(e.query));
    } catch {
      setPartySuggestions([]);
    }
  };
  const save = async () => {
    setSaving(true);
    const party = form.party && typeof form.party === "object" ? form.party : null;
    const body = {
      partyType: party ? party.partyType : null, partyId: party ? party.partyId : null, requesterName: form.requesterName.trim(),
      requesterContact: form.requesterContact || null, requestType: form.requestType, receivedOn: isoDay(form.receivedOn),
      description: form.description || null, assignedTo: form.assignedTo || null, responseNotes: form.responseNotes || null,
    };
    try {
      const r = form.id ? await privacyService.updateRequest(form.id, { ...body, status: form.status }) : await privacyService.createRequest(body);
      done(r.message);
      setForm(null);
      load();
    } catch (e) {
      fail(e, "privacy.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  // ---------- close ----------
  const close = async () => {
    setSaving(true);
    try {
      const r = await privacyService.closeRequest(closing.id, { status: closing.status, outcome: closing.outcome.trim(), responseNotes: closing.responseNotes || undefined });
      done(r.message);
      setClosing(null);
      load();
    } catch (e) {
      fail(e, "privacy.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  // ---------- export ----------
  const runExport = async (row, format) => {
    try {
      if (format === "xlsx") await privacyService.exportPartyXlsx(row.partyType, row.partyId, row.id);
      else await privacyService.exportParty(row.partyType, row.partyId, row.id);
      done(t("privacy.exported", { number: row.requestNumber }));
      load();
    } catch (e) {
      fail(e, "privacy.exportFailed");
    }
  };
  const exportItems = [
    { label: t("privacy.exportJson"), icon: "pi pi-file", command: () => exporting && runExport(exporting, "json") },
    { label: t("privacy.exportXlsx"), icon: "pi pi-file-excel", command: () => exporting && runExport(exporting, "xlsx") },
  ];

  // ---------- anonymise ----------
  const openAnonymise = async (row) => {
    setAnonymising({ row, dry: null, reason: t("privacy.anonymiseReasonDefault", { number: row.requestNumber }) });
    try {
      const dry = await privacyService.anonymiseDryRun(row.partyType, row.partyId);
      setAnonymising((a) => (a && a.row.id === row.id ? { ...a, dry } : a));
    } catch (e) {
      fail(e, "privacy.loadFailed");
      setAnonymising(null);
    }
  };
  const anonymise = async () => {
    setSaving(true);
    try {
      const { row, reason } = anonymising;
      const r = await privacyService.anonymise(row.partyType, row.partyId, { reason: reason.trim(), requestId: row.id });
      done(r.message);
      setAnonymising(null);
      load();
    } catch (e) {
      fail(e, "privacy.anonymiseFailed");
    } finally {
      setSaving(false);
    }
  };

  const stat = (key, label, patch) => {
    const selected = patch && Object.entries(patch).every(([k, v]) => filters[k] === v);
    return (
      <button type="button" key={key} className={`access__stat${selected ? " is-selected" : ""}`} onClick={() => setFilter(selected ? { status: null, overdue: false } : { status: null, overdue: false, ...patch })}>
        <span className="access__stat-value">{loading ? "–" : summary[key] ?? 0}</span>
        <span className="access__stat-label">{label}</span>
      </button>
    );
  };

  const actions = (r) => {
    const open = OPEN_STATUSES.includes(r.status);
    return (
      <div className="privacy__row-actions">
        {open ? <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("privacy.edit")} tooltip={t("privacy.edit")} onClick={() => openEdit(r)} /> : null}
        <Button icon="pi pi-download" text rounded size="small" aria-label={t("privacy.exportData")} tooltip={t("privacy.exportData")} disabled={!r.partyId}
          onClick={(e) => { setExporting(r); exportMenu.current?.toggle(e); }} />
        {open ? <Button icon="pi pi-eye-slash" text rounded size="small" aria-label={t("privacy.anonymise")} tooltip={t("privacy.anonymise")} disabled={!r.partyId} onClick={() => openAnonymise(r)} /> : null}
        {open ? <Button label={t("privacy.close")} text size="small" onClick={() => setClosing({ id: r.id, requestNumber: r.requestNumber, status: "completed", outcome: "", responseNotes: "" })} /> : null}
      </div>
    );
  };

  const formValid = form && form.requesterName.trim().length >= 2 && form.requestType && form.receivedOn;
  const dry = anonymising?.dry;

  return (
    <div className="admin__page access__page privacy__page">
      <Toast ref={toast} />
      <Menu model={exportItems} popup ref={exportMenu} />
      <PageHeader title={t("privacy.requestsTitle")}
        actions={<Button icon="pi pi-plus" label={t("privacy.logRequest")} onClick={openNew} />} />

      <div className="access__stats">
        {stat("open", t("privacy.statOpen"), { status: "open,in-progress" })}
        {stat("overdue", t("privacy.statOverdue"), { overdue: true })}
        {stat("completed", t("privacy.statCompleted"), { status: "completed" })}
        {stat("rejected", t("privacy.statRejected"), { status: "rejected" })}
      </div>

      <div className="admin__filters">
        <Dropdown value={filters.status} options={[{ value: "open,in-progress", label: t("privacy.allOpen") }, ...options.requestStatuses]} showClear
          placeholder={t("privacy.colStatus")} onChange={(e) => setFilter({ status: e.value || null })} />
        <Dropdown value={filters.requestType} options={options.requestTypes} showClear placeholder={t("privacy.colType")} onChange={(e) => setFilter({ requestType: e.value || null })} />
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("privacy.searchRequests")} onChange={(e) => setFilter({ search: e.target.value })} />
        </span>
        <div className="access__toggle">
          <InputSwitch inputId="dsr-overdue" checked={filters.overdue} onChange={(e) => setFilter({ overdue: e.value })} />
          <label htmlFor="dsr-overdue">{t("privacy.overdueOnly")}</label>
        </div>
      </div>

      <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("privacy.noRequests")}>
        <Column field="requestNumber" header={t("privacy.colNumber")} sortable />
        <Column field="receivedOn" header={t("privacy.colReceived")} sortable body={(r) => showDate(r.receivedOn)} />
        <Column field="dueOn" header={t("privacy.colDue")} sortable body={(r) => (
          <span className="privacy__due">
            {showDate(r.dueOn)}
            {r.overdue ? <Tag value={t("privacy.overdue")} severity="danger" /> : null}
          </span>
        )} />
        <Column header={t("privacy.colRequester")} body={(r) => (
          <div className="access__user">
            <span className="access__user-name">{r.requesterName}</span>
            <span className="access__muted">{r.requesterContact}</span>
          </div>
        )} />
        <Column header={t("privacy.colParty")} body={(r) => (r.partyId ? (
          <div className="access__user">
            <span className="access__user-name">{r.partyName}</span>
            <span className="access__muted">{`${t(`privacy.partyType.${r.partyType}`)} ${r.partyCode || ""}`}</span>
          </div>
        ) : <span className="access__muted">{t("privacy.noParty")}</span>)} />
        <Column header={t("privacy.colType")} body={(r) => typeLabel(r.requestType)} />
        <Column header={t("privacy.colStatus")} body={(r) => <RequestStatusTag status={r.status} />} />
        <Column field="assignedToName" header={t("privacy.colAssignedTo")} />
        <Column header="" style={{ width: "13rem" }} body={actions} />
      </DataTable>

      <Dialog header={form?.id ? t("privacy.editRequest", { number: form.requestNumber }) : t("privacy.logRequest")} visible={!!form} style={{ width: "36rem" }} modal onHide={() => setForm(null)}
        footer={<>
          <Button label={t("privacy.cancel")} text onClick={() => setForm(null)} />
          <Button label={t("privacy.save")} icon="pi pi-check" loading={saving} disabled={!formValid} onClick={save} />
        </>}>
        {form ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field">
              <label htmlFor="dsr-party">{t("privacy.colParty")}</label>
              <AutoComplete inputId="dsr-party" value={form.party} suggestions={partySuggestions} completeMethod={searchParties} field="name" forceSelection
                itemTemplate={(p) => `${t(`privacy.partyType.${p.partyType}`)} ${partyText(p)}`} selectedItemTemplate={partyText}
                onChange={(e) => setForm((f) => ({ ...f, party: e.value, requesterName: f.requesterName || (e.value && typeof e.value === "object" ? e.value.name : "") }))}
                placeholder={t("privacy.partyHint")} />
              <small>{t("privacy.partyNote")}</small>
            </div>
            <div className="access__two">
              <div className="admin__field">
                <label htmlFor="dsr-name">{t("privacy.requesterName")}</label>
                <InputText id="dsr-name" value={form.requesterName} onChange={(e) => setForm((f) => ({ ...f, requesterName: e.target.value }))} />
              </div>
              <div className="admin__field">
                <label htmlFor="dsr-contact">{t("privacy.requesterContact")}</label>
                <InputText id="dsr-contact" value={form.requesterContact} onChange={(e) => setForm((f) => ({ ...f, requesterContact: e.target.value }))} />
              </div>
            </div>
            <div className="access__two">
              <div className="admin__field">
                <label htmlFor="dsr-type">{t("privacy.colType")}</label>
                <Dropdown inputId="dsr-type" value={form.requestType} options={options.requestTypes} onChange={(e) => setForm((f) => ({ ...f, requestType: e.value }))} />
              </div>
              <div className="admin__field">
                <label htmlFor="dsr-received">{t("privacy.colReceived")}</label>
                <Calendar inputId="dsr-received" value={form.receivedOn} maxDate={new Date()} onChange={(e) => setForm((f) => ({ ...f, receivedOn: e.value }))} dateFormat="dd M yy" showIcon />
              </div>
            </div>
            <div className="admin__field">
              <label htmlFor="dsr-description">{t("privacy.description")}</label>
              <InputTextarea id="dsr-description" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="access__two">
              <div className="admin__field">
                <label htmlFor="dsr-assignee">{t("privacy.colAssignedTo")}</label>
                <Dropdown inputId="dsr-assignee" value={form.assignedTo} options={assignees} showClear filter onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.value || null }))}
                  placeholder={t("privacy.unassigned")} />
              </div>
              {form.id ? (
                <div className="admin__field">
                  <label htmlFor="dsr-status">{t("privacy.colStatus")}</label>
                  <Dropdown inputId="dsr-status" value={form.status} options={options.requestStatuses.filter((s) => OPEN_STATUSES.includes(s.value))}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.value }))} />
                </div>
              ) : null}
            </div>
            <div className="admin__field">
              <label htmlFor="dsr-notes">{t("privacy.responseNotes")}</label>
              <InputTextarea id="dsr-notes" rows={3} value={form.responseNotes} onChange={(e) => setForm((f) => ({ ...f, responseNotes: e.target.value }))} />
            </div>
            <small className="access__muted">{t("privacy.dueNote")}</small>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("privacy.closeTitle", { number: closing?.requestNumber || "" })} visible={!!closing} style={{ width: "32rem" }} modal onHide={() => setClosing(null)}
        footer={<>
          <Button label={t("privacy.cancel")} text onClick={() => setClosing(null)} />
          <Button label={t("privacy.close")} icon="pi pi-check" loading={saving} disabled={(closing?.outcome || "").trim().length < 2} onClick={close} />
        </>}>
        {closing ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field">
              <label htmlFor="dsr-close-status">{t("privacy.colStatus")}</label>
              <SelectButton id="dsr-close-status" value={closing.status} allowEmpty={false}
                options={options.requestStatuses.filter((s) => !OPEN_STATUSES.includes(s.value))} onChange={(e) => setClosing((c) => ({ ...c, status: e.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="dsr-outcome">{t("privacy.outcome")}</label>
              <InputTextarea id="dsr-outcome" rows={3} value={closing.outcome} onChange={(e) => setClosing((c) => ({ ...c, outcome: e.target.value }))} placeholder={t("privacy.outcomeHint")} />
            </div>
            <div className="admin__field">
              <label htmlFor="dsr-close-notes">{t("privacy.responseNotes")}</label>
              <InputTextarea id="dsr-close-notes" rows={2} value={closing.responseNotes} onChange={(e) => setClosing((c) => ({ ...c, responseNotes: e.target.value }))} />
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("privacy.anonymiseTitle", { name: anonymising?.row.partyName || "" })} visible={!!anonymising} style={{ width: "38rem" }} modal onHide={() => setAnonymising(null)}
        footer={<>
          <Button label={t("privacy.cancel")} text onClick={() => setAnonymising(null)} />
          <Button label={t("privacy.anonymise")} icon="pi pi-eye-slash" severity="danger" loading={saving}
            disabled={!dry?.allowed || (anonymising?.reason || "").trim().length < 5} onClick={anonymise} />
        </>}>
        {anonymising ? (
          <div className="admin__grid admin__grid--single">
            <p>{t("privacy.anonymiseIntro")}</p>
            {!dry ? <p className="access__muted">{t("privacy.checking")}</p> : null}
            {dry && !dry.allowed ? (
              <div className="privacy__blockers">
                <Message severity="warn" className="w-full" text={t("privacy.anonymiseRefused")} />
                <ul>{dry.blockers.map((b) => <li key={b.code}>{b.message}</li>)}</ul>
              </div>
            ) : null}
            {dry?.retention?.lastPolicyExpiry ? (
              <p className="access__muted">{t("privacy.retentionNote", { expiry: showDate(dry.retention.lastPolicyExpiry), until: showDate(dry.retention.retainedUntil), years: dry.retention.years })}</p>
            ) : null}
            {dry ? (
              <div className="admin__field">
                <label>{t("privacy.fieldsCleared")}</label>
                <DataTable value={Object.entries(dry.cleared || {}).map(([table, v]) => ({ table, ...v }))} dataKey="table" size="small" emptyMessage={t("privacy.nothingToClear")}>
                  <Column field="table" header={t("privacy.colRecordType")} />
                  <Column field="rows" header={t("privacy.colRows")} />
                  <Column header={t("privacy.colFields")} body={(r) => r.fields.join(", ")} />
                </DataTable>
                <small>{t("privacy.keptNote")}</small>
              </div>
            ) : null}
            <div className="admin__field">
              <label htmlFor="dsr-anon-reason">{t("privacy.reason")}</label>
              <InputTextarea id="dsr-anon-reason" rows={2} value={anonymising.reason} onChange={(e) => setAnonymising((a) => ({ ...a, reason: e.target.value }))} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default DataSubjectRequests;
