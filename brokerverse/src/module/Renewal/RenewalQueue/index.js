import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import renewalsWorkspaceService from "../../../services/renewalsWorkspaceService";
import StatCards from "../../../components/StatCards";
import { EmptyState, FilterBar, KeyFacts, PanelSection, RowActions, SectionCard, SidePanel } from "../../../components/RecordPage";
import { calendarDateFormat, formatDate, toIsoDate } from "../../../utility/dateFormat";
import { downloadCsv } from "../../../utility/csvExport";
import { hasPermission } from "../../../utils/canOpen";
import BvConfirmDialog from "../../../components/ConfirmDialog";
import { ExpiryCell, NoticeChip, PolicyCell, RenewalHeader, RiskChip, StageChip, useRenewalParam } from "../shared";
import "./index.scss";

const METHODS = ["Email", "SMS", "Phone", "Letter"];

/**
 * Operations > Renewals > Renewal Queue: open renewals with their expiry, premium, stage, retention risk, notice
 * treatment and contacts so far. Row actions follow the stage: prepare the renewal quote, send the next notice, record a
 * reminder, complete an approved renewal; the renewal owner's unit (assign:renewals) reassigns a renewal or marks it not
 * for renewal with a coded reason. The detail opens on the right, also for the renewal named in the address
 * (?renewal=<id>, from My Work and the notifications).
 */
const RenewalQueue = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(location.state?.search || "");
  const [stage, setStage] = useState("");
  const [risk, setRisk] = useState("");
  const [agent, setAgent] = useState("");
  const [range, setRange] = useState(null);
  const [due, setDue] = useState("");
  const [panelId, setPanelId] = useState(null);
  const [reminder, setReminder] = useState(null);
  const [focus, setFocus] = useState(null);
  const [dispose, setDispose] = useState(null);
  const [assignees, setAssignees] = useState([]);
  const [assignee, setAssignee] = useState(null);
  const [assigneeTried, setAssigneeTried] = useState(false);
  const canAssign = hasPermission("assign:renewals");

  const showError = useCallback((e) => toast.current?.show({ severity: "error", summary: t("common.error", "Error"), detail: e?.message || String(e), life: 5000 }), [t]);
  const done = (summary, detail) => toast.current?.show({ severity: "success", summary, detail, life: 3000 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { items, dashboard: d } = await renewalsWorkspaceService.getQueue();
      setRows(items);
      setDashboard(d || {});
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [showError]);
  useEffect(() => { load(); }, [load]);

  const refreshPipeline = async () => {
    try {
      const r = await renewalsWorkspaceService.refreshPipeline();
      done(t("queue.pipelineRefreshed"), t("queue.pipelineResult", { created: r?.created ?? 0, lapsed: r?.lapsed ?? 0 }));
    } catch (e) {
      showError(e);
    }
    load();
  };

  const stages = useMemo(() => [...new Set(rows.map((r) => r.status).filter(Boolean))].sort(), [rows]);
  const agents = useMemo(() => [...new Set(rows.map((r) => r.assignedAgent).filter(Boolean))].sort(), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const [from, to] = range || [];
    return rows.filter((r) => (!stage || r.status === stage) && (!risk || r.retentionRisk === risk) && (!agent || r.assignedAgent === agent)
      && (!due || (due === "soon" && r.daysToExpiry > 0 && r.daysToExpiry <= 30) || (due === "risk" && ["High", "Critical"].includes(r.retentionRisk)) || (due === "grace" && r.inGracePeriod))
      && (!from || !to || (new Date(`${r.expiryDate}T00:00:00`) >= from && new Date(`${r.expiryDate}T00:00:00`) <= to))
      && (!q || [r.policyNumber, r.insuredName, r.renewalNumber, r.product].some((v) => String(v || "").toLowerCase().includes(q))));
  }, [rows, search, stage, risk, agent, range, due]);
  const selected = rows.find((r) => r.id === panelId) || (focus?.id === panelId ? focus : null);
  const openRow = useCallback((row) => setPanelId(row.id), []);
  const asked = useRenewalParam(rows, openRow);
  // a renewal named in the address that is not on the queue (closed, or filtered out) is read on its own
  useEffect(() => {
    if (!asked || loading || !rows.length || rows.some((r) => [r.id, r.renewalNumber].includes(asked))) return;
    renewalsWorkspaceService.getRenewal(asked).then((r) => { setFocus(r); setPanelId(r.id); }).catch(showError);
  }, [asked, loading, rows, showError]);

  const toggleDue = (key) => setDue(due === key ? "" : key);
  const figures = [
    { key: "all", label: t("queue.figures.open"), value: dashboard.totalPolicies ?? rows.length, onClick: () => setDue(""), active: !due },
    { key: "soon", label: t("queue.figures.dueSoon"), value: dashboard.dueSoon ?? null, onClick: () => toggleDue("soon"), active: due === "soon" },
    { key: "risk", label: t("queue.figures.atRisk"), value: dashboard.atRisk ?? null, onClick: () => toggleDue("risk"), active: due === "risk" },
    { key: "grace", label: t("queue.figures.grace"), value: dashboard.inGracePeriod ?? null, onClick: () => toggleDue("grace"), active: due === "grace" },
    { key: "premium", label: t("queue.figures.premium"), value: formatCurrency(dashboard.totalPremium || 0) },
  ];

  const sendNotice = async (r) => {
    try {
      await renewalsWorkspaceService.sendNotice(r.id);
      done(t("queue.noticeSent"), `${r.nextNotice?.label}: ${r.policyNumber}`);
      load();
    } catch (e) {
      showError(e);
    }
  };
  const saveReminder = async () => {
    try {
      await renewalsWorkspaceService.sendReminder(reminder.row.id, reminder.method, reminder.note.trim() || undefined);
      done(t("queue.reminderRecorded"), reminder.row.policyNumber);
      setReminder(null);
      load();
    } catch (e) {
      showError(e);
    }
  };
  const complete = (r) => confirmDialog({
    header: t("queue.complete"),
    message: t("queue.completeConfirm", { policy: r.policyNumber }),
    acceptLabel: t("queue.complete"),
    rejectLabel: t("common.cancel", "Cancel"),
    accept: async () => {
      try {
        const result = await renewalsWorkspaceService.complete(r.id);
        done(t("queue.completed"), result?.newPolicy?.policyNumber || r.policyNumber);
        load();
      } catch (e) {
        showError(e);
      }
    },
  });

  const exportCsv = () => {
    downloadCsv(`renewal-queue-${toIsoDate(new Date())}.csv`, filtered, [
      { header: t("queue.policy"), field: "policyNumber" },
      { header: t("queue.col.insured"), field: "insuredName" },
      { header: t("queue.col.product"), field: (r) => [r.product, r.insurer].filter(Boolean).join(" / ") },
      { header: t("queue.col.expiry"), field: (r) => formatDate(r.expiryDate) },
      { header: t("queue.col.premium"), field: "currentPremium" },
      { header: t("queue.renewalPremium"), field: "renewalPremium" },
      { header: t("queue.col.stage"), field: "status" },
      { header: t("queue.col.risk"), field: "retentionRisk" },
      { header: t("queue.col.agent"), field: "assignedAgent" },
      { header: t("queue.col.contacts"), field: "renewalAttempts" },
    ]);
    done(t("renewal.exportStarted"), t("renewal.rowsExported", { count: filtered.length }));
  };

  const startDispose = async (kind, row) => {
    setAssignee(null);
    setAssigneeTried(false);
    setDispose({ kind, row });
    if (kind === "reassign" && !assignees.length) {
      try {
        setAssignees(await renewalsWorkspaceService.getAssignees());
      } catch (e) {
        showError(e);
      }
    }
  };
  const confirmDispose = async (reason) => {
    const { kind, row } = dispose;
    if (kind === "reassign") {
      await renewalsWorkspaceService.reassign(row.id, assignee, reason);
      done(t("renewalDisposition.reassigned"), `${row.policyNumber} · ${assignees.find((u) => u.id === assignee)?.name || ""}`);
    } else {
      await renewalsWorkspaceService.notForRenewal(row.id, reason);
      done(t("renewalDisposition.markedNotForRenewal"), row.policyNumber);
      setPanelId(null);
    }
    load();
  };

  const canQuote = (r) => r.isOpen && r.statusCode !== "pending-approval";
  const withheld = (r) => r.noticeTreatment && r.noticeTreatment.code !== "send";
  const menuOf = (r) => [
    { label: withheld(r) ? t("renewalNotices.withheld") : r.nextNotice ? t("queue.sendNotice", { notice: r.nextNotice.label }) : t("queue.allNoticesSent"),
      icon: "pi pi-envelope", command: () => sendNotice(r), disabled: !r.nextNotice || withheld(r) },
    { label: t("queue.recordReminder"), icon: "pi pi-phone", command: () => setReminder({ row: r, method: "Email", note: "" }) },
    { label: t("queue.complete"), icon: "pi pi-check-circle", command: () => complete(r), hidden: r.statusCode !== "approved" },
    { label: t("queue.openPolicy"), icon: "pi pi-file", command: () => navigate(`/agent/policydetail/${r.policyId}`), hidden: !r.policyId },
    { label: t("renewalDisposition.reassign"), icon: "pi pi-user-edit", command: () => startDispose("reassign", r), hidden: !canAssign || !r.isOpen },
    { label: t("renewalDisposition.notForRenewal"), icon: "pi pi-ban", command: () => startDispose("not-for-renewal", r), hidden: !canAssign || !r.isOpen },
  ];
  const actionsBody = (r) => (
    <RowActions
      actions={[
        { icon: "pi pi-eye", label: t("queue.view"), onClick: () => setPanelId(r.id) },
        { icon: "pi pi-file-edit", label: t("queue.prepareQuote"), onClick: () => navigate(`/renewal/generate-quote/${r.id}`, { state: { policy: r } }), disabled: !canQuote(r) },
      ]}
      menu={menuOf(r)} />
  );

  return (
    <div className="bv-ops-page renewal-queue-page">
      <Toast ref={toast} />
      <ConfirmDialog />
      <RenewalHeader title={t("queue.title")}
        actions={(
          <>
            <Button icon="pi pi-download" outlined label={t("queue.export")} tooltip={t("renewal.exportToCsv")} tooltipOptions={{ position: "top" }}
              onClick={exportCsv} disabled={!filtered.length} />
            <Button icon="pi pi-sync" label={t("queue.refreshPipeline")} onClick={refreshPipeline} />
          </>
        )} />
      <StatCards items={figures} />

      <SectionCard>
        <FilterBar active={!!(search || stage || risk || agent || range || due)}
          onClear={() => { setSearch(""); setStage(""); setRisk(""); setAgent(""); setRange(null); setDue(""); }}>
          <span className="p-input-icon-left bv-filter-bar__search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("queue.searchHint")} aria-label={t("queue.searchHint")} />
          </span>
          <Dropdown value={stage} onChange={(e) => setStage(e.value || "")} aria-label={t("queue.col.stage")}
            options={[{ label: t("queue.allStages"), value: "" }, ...stages.map((s) => ({ label: s, value: s }))]} />
          <Dropdown value={risk} onChange={(e) => setRisk(e.value || "")} aria-label={t("queue.col.risk")}
            options={[{ label: t("queue.allRisks"), value: "" }, ...["Low", "Medium", "High", "Critical"].map((l) => ({ label: t(`renewalPages.risk.${l}`, l), value: l }))]} />
          <Dropdown value={agent} onChange={(e) => setAgent(e.value || "")} filter aria-label={t("queue.col.agent")}
            options={[{ label: t("queue.allAgents"), value: "" }, ...agents.map((a) => ({ label: a, value: a }))]} />
          <Calendar value={range} onChange={(e) => setRange(e.value)} selectionMode="range" readOnlyInput showIcon dateFormat={calendarDateFormat()}
            placeholder={t("queue.expiryRange")} aria-label={t("queue.expiryRange")} />
        </FilterBar>
        <DataTable value={filtered} dataKey="id" loading={loading} paginator rows={20} size="small" sortField="daysToExpiry" sortOrder={1}
          emptyMessage={<EmptyState icon="pi-calendar" title={t("queue.emptyTitle")} text={rows.length ? t("queue.emptyFiltered") : t("queue.emptyText")} />}>
          <Column field="policyNumber" header={t("queue.col.policy")} sortable body={(r) => <PolicyCell policyNumber={r.policyNumber} insured={r.insuredName} onOpen={() => setPanelId(r.id)} />} />
          <Column field="product" header={t("queue.col.product")} sortable body={(r) => <span className="bv-cell-stack"><span>{r.product}</span><small>{r.insurer}</small></span>} />
          <Column field="daysToExpiry" header={t("queue.col.expiry")} sortable body={(r) => <ExpiryCell date={r.expiryDate} days={r.daysToExpiry} />} />
          <Column field="currentPremium" header={t("queue.col.premium")} sortable body={(r) => formatCurrency(r.currentPremium)} className="bv-num" headerClassName="bv-num" />
          <Column field="status" header={t("queue.col.stage")} sortable body={(r) => (
            <span className="bv-cell-stack"><StageChip row={r} /><NoticeChip treatment={r.noticeTreatment} /></span>
          )} />
          <Column field="retentionRisk" header={t("queue.col.risk")} sortable body={(r) => <RiskChip level={r.retentionRisk} />} />
          <Column field="assignedAgent" header={t("queue.col.agent")} sortable />
          <Column header={t("queue.col.actions")} body={actionsBody} className="bv-actions" headerClassName="bv-actions" />
        </DataTable>
      </SectionCard>

      <SidePanel visible={!!selected} onHide={() => setPanelId(null)} title={selected ? `${selected.policyNumber} · ${selected.insuredName || ""}` : ""}
        meta={selected ? (
          <>
            <StageChip row={selected} />
            <RiskChip level={selected.retentionRisk} />
            <span>{selected.renewalNumber}</span>
          </>
        ) : null}
        footer={selected ? (
          <>
            <Button outlined icon="pi pi-phone" label={t("queue.recordReminder")} onClick={() => setReminder({ row: selected, method: "Email", note: "" })} />
            <Button icon="pi pi-file-edit" label={t("queue.prepareQuote")} disabled={!canQuote(selected)}
              onClick={() => navigate(`/renewal/generate-quote/${selected.id}`, { state: { policy: selected } })} />
          </>
        ) : null}>
        {selected ? (
          <>
            <PanelSection title={t("queue.policy")}>
              <KeyFacts className="bv-key-facts--plain" items={[
                { key: "product", label: t("queue.col.product"), value: selected.product },
                { key: "insurer", label: t("queue.insurer"), value: selected.insurer },
                { key: "expiry", label: t("queue.col.expiry"), value: <ExpiryCell date={selected.expiryDate} days={selected.daysToExpiry} /> },
                { key: "premium", label: t("queue.col.premium"), value: formatCurrency(selected.currentPremium) },
                { key: "renewal", label: t("queue.renewalPremium"), value: selected.renewalPremium ? formatCurrency(selected.renewalPremium) : null },
                { key: "si", label: t("queue.sumInsured"), value: selected.sumInsured ? formatCurrency(selected.sumInsured) : null },
                { key: "terms", label: t("queue.termsRenewed"), value: selected.loyaltyYears },
                { key: "claims", label: t("queue.claims"), value: selected.claimsHistory ? `${selected.claimsHistory.totalClaims} · ${formatCurrency(selected.claimsHistory.claimsAmount)}` : null },
              ]} />
            </PanelSection>
            {selected.lockIn || withheld(selected) ? (
              <PanelSection title={t("renewalNotices.lockInSection")}>
                <KeyFacts className="bv-key-facts--plain" items={[
                  { key: "treatment", label: t("renewalNotices.treatmentLabel"), value: withheld(selected) ? <NoticeChip treatment={selected.noticeTreatment} /> : t("renewalNotices.treatment.send") },
                  { key: "reason", label: t("renewalNotices.reason"), value: withheld(selected) ? selected.noticeTreatment.reason : null },
                  { key: "source", label: t("renewalNotices.source"), value: selected.lockIn?.sourceLabel },
                  { key: "year", label: t("renewalNotices.year"), value: selected.lockIn?.year },
                  { key: "end", label: t("renewalNotices.lockInEnd"), value: selected.lockIn?.endDate ? formatDate(selected.lockIn.endDate) : null },
                  { key: "review", label: t("renewalNotices.reviewDate"), value: selected.lockIn?.reviewDate ? formatDate(selected.lockIn.reviewDate) : null },
                  { key: "loan", label: t("renewalNotices.loanStatus"), value: selected.lockIn?.loanStatusLabel },
                ]} />
              </PanelSection>
            ) : null}
            <PanelSection title={t("queue.contact")}>
              <KeyFacts className="bv-key-facts--plain" items={[
                { key: "mobile", label: t("queue.mobile"), value: selected.insuredContact?.mobile },
                { key: "email", label: t("queue.email"), value: selected.insuredContact?.email },
                { key: "notice", label: t("queue.lastNotice"), value: selected.lastNoticeAt ? formatDate(selected.lastNoticeAt) : t("queue.none") },
                { key: "next", label: t("queue.nextNotice"), value: selected.nextNotice?.label || t("queue.allNoticesSent") },
                { key: "contact", label: t("queue.lastContact"), value: selected.lastContactDate ? formatDate(selected.lastContactDate) : t("queue.none") },
                { key: "contacts", label: t("queue.col.contacts"), value: selected.renewalAttempts },
                { key: "agent", label: t("queue.col.agent"), value: selected.assignedAgent },
              ]} />
            </PanelSection>
          </>
        ) : null}
      </SidePanel>

      <BvConfirmDialog visible={!!dispose} onHide={() => setDispose(null)} severity={dispose?.kind === "reassign" ? "neutral" : "danger"}
        title={dispose?.kind === "reassign" ? t("renewalDisposition.reassign") : t("renewalDisposition.notForRenewal")}
        message={dispose?.kind === "reassign" ? t("renewalDisposition.reassignMessage") : t("renewalDisposition.notForRenewalMessage")}
        facts={dispose ? [
          { label: t("queue.col.policy"), value: dispose.row.policyNumber },
          { label: t("queue.col.insured"), value: dispose.row.insuredName },
          { label: t("queue.col.agent"), value: dispose.row.assignedAgent || "-" },
          { label: t("queue.col.expiry"), value: dispose.row.expiryDate, type: "date" },
        ] : []}
        reason={{ context: dispose?.kind === "reassign" ? "renewal_reassign" : "non_renewal" }}
        beforeConfirm={() => { setAssigneeTried(true); return dispose?.kind !== "reassign" || !!assignee; }}
        confirmLabel={dispose?.kind === "reassign" ? t("renewalDisposition.reassignConfirm") : t("renewalDisposition.notForRenewalConfirm")}
        onConfirm={confirmDispose}>
        {dispose?.kind === "reassign" ? (
          <div className="bv-confirm__field">
            <label htmlFor="rq-assignee">{t("renewalDisposition.newOwner")}</label>
            <Dropdown inputId="rq-assignee" value={assignee} onChange={(e) => setAssignee(e.value)} filter className={assigneeTried && !assignee ? "w-full p-invalid" : "w-full"}
              options={assignees.filter((u) => u.name !== dispose.row.assignedAgent).map((u) => ({ label: u.name, value: u.id }))} placeholder={t("renewalDisposition.chooseOwner")} />
            {assigneeTried && !assignee ? <small className="bv-confirm__field-error" role="alert">{t("renewalDisposition.ownerRequired")}</small> : null}
          </div>
        ) : null}
      </BvConfirmDialog>

      <Dialog header={t("queue.recordReminder")} visible={!!reminder} onHide={() => setReminder(null)} style={{ width: "32rem" }} breakpoints={{ "768px": "95vw" }}
        footer={(
          <div>
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setReminder(null)} />
            <Button label={t("queue.save")} icon="pi pi-check" onClick={saveReminder} />
          </div>
        )}>
        {reminder ? (
          <div className="grid">
            <div className="col-12"><p className="bv-panel-text">{`${reminder.row.policyNumber} · ${reminder.row.insuredName || ""}`}</p></div>
            <div className="col-12 md:col-6">
              <label htmlFor="rq-method">{t("queue.channel")}</label>
              <Dropdown inputId="rq-method" value={reminder.method} onChange={(e) => setReminder({ ...reminder, method: e.value })} className="w-full"
                options={METHODS.map((m) => ({ label: t(`lapse.channels.${m}`, m), value: m }))} />
            </div>
            <div className="col-12 md:col-6">
              <label>{t("queue.sentTo")}</label>
              <p className="bv-panel-text">
                {reminder.method === "Email" ? reminder.row.insuredContact?.email || t("queue.noEmail") : null}
                {["SMS", "Phone"].includes(reminder.method) ? reminder.row.insuredContact?.mobile || t("queue.noMobile") : null}
                {reminder.method === "Letter" ? t("queue.mailingAddress") : null}
              </p>
            </div>
            <div className="col-12">
              <label htmlFor="rq-note">{t("queue.note")}</label>
              <InputTextarea id="rq-note" value={reminder.note} onChange={(e) => setReminder({ ...reminder, note: e.target.value })} rows={3} autoResize className="w-full" maxLength={2000} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default RenewalQueue;
