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
import { calendarDateFormat, formatDate } from "../../../utility/dateFormat";
import { ExpiryCell, PolicyCell, RenewalHeader, RiskChip, StageChip } from "../shared";
import "./index.scss";

const METHODS = ["Email", "SMS", "Phone", "Letter"];

/**
 * Operations > Renewals > Renewal Queue: open renewals with their expiry, premium, stage, retention risk and contacts so
 * far. Row actions follow the stage: prepare the renewal quote, send the next notice, record a reminder, complete an
 * approved renewal; the detail opens on the right.
 */
const RenewalQueue = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const table = useRef(null);
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
  const selected = rows.find((r) => r.id === panelId) || null;

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

  const canQuote = (r) => r.isOpen && r.statusCode !== "pending-approval";
  const menuOf = (r) => [
    { label: r.nextNotice ? t("queue.sendNotice", { notice: r.nextNotice.label }) : t("queue.allNoticesSent"), icon: "pi pi-envelope", command: () => sendNotice(r), disabled: !r.nextNotice },
    { label: t("queue.recordReminder"), icon: "pi pi-phone", command: () => setReminder({ row: r, method: "Email", note: "" }) },
    { label: t("queue.complete"), icon: "pi pi-check-circle", command: () => complete(r), hidden: r.statusCode !== "approved" },
    { label: t("queue.openPolicy"), icon: "pi pi-file", command: () => navigate(`/agent/policydetail/${r.policyId}`), hidden: !r.policyId },
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
            <Button icon="pi pi-download" outlined label={t("queue.export")} onClick={() => table.current?.exportCSV()} disabled={!filtered.length} />
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
        <DataTable ref={table} value={filtered} dataKey="id" loading={loading} paginator rows={20} size="small" sortField="daysToExpiry" sortOrder={1}
          exportFilename="renewal-queue"
          emptyMessage={<EmptyState icon="pi-calendar" title={t("queue.emptyTitle")} text={rows.length ? t("queue.emptyFiltered") : t("queue.emptyText")} />}>
          <Column field="policyNumber" header={t("queue.col.policy")} sortable body={(r) => <PolicyCell policyNumber={r.policyNumber} insured={r.insuredName} onOpen={() => setPanelId(r.id)} />} />
          <Column field="insuredName" header={t("queue.col.insured")} hidden exportable />
          <Column field="product" header={t("queue.col.product")} sortable body={(r) => <span className="bv-cell-stack"><span>{r.product}</span><small>{r.insurer}</small></span>} />
          <Column field="daysToExpiry" header={t("queue.col.expiry")} sortable body={(r) => <ExpiryCell date={r.expiryDate} days={r.daysToExpiry} />} />
          <Column field="currentPremium" header={t("queue.col.premium")} sortable body={(r) => formatCurrency(r.currentPremium)} className="bv-num" headerClassName="bv-num" />
          <Column field="status" header={t("queue.col.stage")} sortable body={(r) => <StageChip row={r} />} />
          <Column field="retentionRisk" header={t("queue.col.risk")} sortable body={(r) => <RiskChip level={r.retentionRisk} />} />
          <Column field="assignedAgent" header={t("queue.col.agent")} sortable />
          <Column header={t("queue.col.actions")} body={actionsBody} exportable={false} className="bv-actions" headerClassName="bv-actions" />
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
