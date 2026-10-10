import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import renewalsWorkspaceService from "../../../services/renewalsWorkspaceService";
import StatCards from "../../../components/StatCards";
import LoadingBar from "../../../components/LoadingBar";
import DateField from "../../../components/DateField";
import ConfirmDialog from "../../../components/ConfirmDialog";
import { EmptyState, FilterBar, RowActions, SectionCard, StatusChip } from "../../../components/RecordPage";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { hasPermission } from "../../../utils/canOpen";
import { formatDate, toIsoDate } from "../../../utility/dateFormat";
import { ExpiryCell, NoticeChip, PolicyCell, RenewalHeader } from "../shared";

const WINDOWS = [30, 60, 90, 120];
const LOAN_SEVERITY = { current: "success", closed: "secondary", "past-due": "danger", fraud: "danger", terminated: "danger", "legal-dispute": "danger" };

const saveBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/**
 * Operations > Renewals > Lock-in Accounts: lock-in and Scheme 2 accounts expiring within the review window (as-of date
 * plus the days chosen, lockin.review_days_before by default) with their lock-in year, review date, TFS loan status and
 * the notice treatment of their renewal; the Excel extract of the list. The loan status of an account is set by hand
 * (write:renewals); a status that holds the notices needs a note.
 */
const LockInAccounts = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [asOf, setAsOf] = useState(toIsoDate(new Date()));
  const [days, setDays] = useState(null);
  const [source, setSource] = useState("");
  const [loanStatus, setLoanStatus] = useState("");
  const [treatment, setTreatment] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [note, setNote] = useState("");
  const canWrite = hasPermission("write:renewals");

  const params = useMemo(() => ({ asOf, days: days ?? undefined, source, loanStatus, treatment }), [asOf, days, source, loanStatus, treatment]);
  const loader = useCallback(() => renewalsWorkspaceService.getLockIns(params), [params]);
  const { data, loading, refreshing, reload } = useStableLoad(loader, { initialData: { items: [], sources: {}, loanStatuses: {}, treatments: {} } });
  const items = useMemo(() => data?.items || [], [data]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((r) => [r.policyNumber, r.clientName, r.tfsLoanAccount].some((v) => String(v || "").toLowerCase().includes(q))) : items;
  }, [items, search]);
  const options = (map) => Object.entries(map || {}).map(([value, label]) => ({ value, label }));
  const blocking = (code) => ["past-due", "fraud", "terminated", "legal-dispute"].includes(code);

  const figures = [
    { key: "accounts", label: t("lockIn.figures.accounts"), value: items.length },
    { key: "review", label: t("lockIn.figures.reviewDue"), value: items.filter((r) => r.reviewDue).length },
    { key: "suppressed", label: t("lockIn.figures.suppressed"), value: items.filter((r) => ["lock-in", "scheme2"].includes(r.noticeTreatment?.code)).length,
      onClick: () => setTreatment(treatment === "lock-in" ? "" : "lock-in"), active: treatment === "lock-in" },
    { key: "held", label: t("lockIn.figures.held"), value: items.filter((r) => r.noticeTreatment?.code === "held").length,
      onClick: () => setTreatment(treatment === "held" ? "" : "held"), active: treatment === "held" },
  ];

  const download = async () => {
    try {
      saveBlob(await renewalsWorkspaceService.lockInsWorkbook(params), `lock-in-accounts-${data?.asOf || asOf}.xlsx`);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error", "Error"), detail: e.message, life: 5000 });
    }
  };
  const startEdit = (row) => {
    setNote("");
    setEditing(row);
  };

  const actionsBody = (r) => (
    <RowActions
      actions={[{ icon: "pi pi-external-link", label: t("lockIn.openRenewal"), onClick: () => navigate(`/renewal/queue?renewal=${r.renewalId}`), disabled: !r.renewalId }]}
      menu={[{ label: t("lockIn.setLoanStatus"), icon: "pi pi-flag", command: () => startEdit(r), hidden: !canWrite }]} />
  );

  return (
    <div className="bv-ops-page">
      <Toast ref={toast} />
      <RenewalHeader title={t("lockIn.title")}
        actions={<Button icon="pi pi-file-excel" outlined label={t("lockIn.download")} onClick={download} disabled={!items.length} />} />
      <LoadingBar active={refreshing} />
      <StatCards items={figures} />
      <SectionCard>
        <FilterBar active={!!(source || loanStatus || treatment || search || days)}
          onClear={() => { setSource(""); setLoanStatus(""); setTreatment(""); setSearch(""); setDays(null); }}>
          <span className="p-input-icon-left bv-filter-bar__search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("lockIn.searchHint")} aria-label={t("lockIn.searchHint")} />
          </span>
          <DateField id="lk-asof" value={asOf} onChange={(e) => setAsOf(e.target.value || toIsoDate(new Date()))} aria-label={t("lockIn.asOf")} />
          <Dropdown value={days} onChange={(e) => setDays(e.value ?? null)} aria-label={t("lockIn.window")}
            options={[{ label: t("lockIn.reviewWindow"), value: null }, ...WINDOWS.map((d) => ({ label: t("lockIn.withinDays", { count: d }), value: d }))]} />
          <Dropdown value={source} onChange={(e) => setSource(e.value || "")} aria-label={t("lockIn.col.lockIn")}
            options={[{ label: t("lockIn.allSources"), value: "" }, ...options(data?.sources)]} />
          <Dropdown value={loanStatus} onChange={(e) => setLoanStatus(e.value || "")} aria-label={t("lockIn.col.loan")}
            options={[{ label: t("lockIn.allLoanStatuses"), value: "" }, ...options(data?.loanStatuses)]} />
          <Dropdown value={treatment} onChange={(e) => setTreatment(e.value || "")} aria-label={t("lockIn.col.notices")}
            options={[{ label: t("lockIn.allTreatments"), value: "" }, ...options(data?.treatments)]} />
        </FilterBar>
        <DataTable value={shown} dataKey="policyId" loading={loading} paginator rows={20} size="small" sortField="expiryDate" sortOrder={1}
          emptyMessage={<EmptyState icon="pi-lock" title={t("lockIn.emptyTitle")} text={t("lockIn.emptyText")} />}>
          <Column field="policyNumber" header={t("lockIn.col.policy")} sortable body={(r) => <PolicyCell policyNumber={r.policyNumber} insured={r.clientName} onOpen={() => navigate(`/agent/policydetail/${r.policyId}`)} />} />
          <Column field="sourceLabel" header={t("lockIn.col.lockIn")} sortable body={(r) => (
            <span className="bv-cell-stack"><span>{r.sourceLabel}</span><small>{r.year ? t("lockIn.yearOf", { year: r.year, years: r.lockIn?.years || "-" }) : r.lockIn?.reference || ""}</small></span>
          )} />
          <Column field="daysToExpiry" header={t("lockIn.col.expiry")} sortable body={(r) => <ExpiryCell date={r.expiryDate} days={r.daysToExpiry} />} />
          <Column field="reviewDate" header={t("lockIn.col.review")} sortable body={(r) => (
            <span className="bv-cell-stack"><span className="bv-nowrap">{formatDate(r.reviewDate)}</span>{r.reviewDue ? <small className="bv-text-alert">{t("lockIn.reviewDue")}</small> : null}</span>
          )} />
          <Column field="loanStatus" header={t("lockIn.col.loan")} sortable body={(r) => (
            <span className="bv-cell-stack"><StatusChip label={r.loanStatusLabel} severity={LOAN_SEVERITY[r.loanStatus] || "info"} /><small>{r.tfsLoanAccount}</small></span>
          )} />
          <Column header={t("lockIn.col.notices")} body={(r) => (r.noticeTreatment?.code === "send" ? <span className="bv-muted">{t("renewalNotices.treatment.send")}</span> : <NoticeChip treatment={r.noticeTreatment} />)} />
          <Column field="owner" header={t("lockIn.col.owner")} sortable />
          <Column header={t("lockIn.col.actions")} body={actionsBody} className="bv-actions" headerClassName="bv-actions" />
        </DataTable>
      </SectionCard>

      <ConfirmDialog visible={!!editing} onHide={() => setEditing(null)} severity="warning" title={t("lockIn.setLoanStatus")}
        message={t("lockIn.loanStatusMessage")}
        facts={editing ? [
          { label: t("lockIn.col.policy"), value: editing.policyNumber },
          { label: t("lockIn.loanAccount"), value: editing.tfsLoanAccount || "-" },
          { label: t("lockIn.currentStatus"), value: editing.loanStatusLabel },
        ] : []}
        input={{ type: "select", label: t("lockIn.newStatus"), required: true, defaultValue: editing?.loanStatus, options: options(data?.loanStatuses) }}
        confirmLabel={t("lockIn.saveLoanStatus")}
        onConfirm={async (status) => {
          if (blocking(status) && !note.trim()) throw new Error(t("lockIn.noteRequired"));
          const r = await renewalsWorkspaceService.setLoanStatus(editing.policyId, status, note.trim() || undefined);
          toast.current?.show({ severity: "success", summary: t("lockIn.loanStatusSaved"), detail: r?.skippedNotices ? t("lockIn.noticesSkipped", { count: r.skippedNotices }) : editing.policyNumber, life: 4000 });
          reload();
        }}>
        <div className="bv-confirm__field">
          <label htmlFor="lk-note">{t("lockIn.note")}</label>
          <InputTextarea id="lk-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} autoResize maxLength={1000} className="w-full" />
        </div>
      </ConfirmDialog>
    </div>
  );
};

export default LockInAccounts;
