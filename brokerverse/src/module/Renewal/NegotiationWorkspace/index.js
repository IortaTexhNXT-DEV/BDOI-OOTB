import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import renewalsWorkspaceService from "../../../services/renewalsWorkspaceService";
import StatCards from "../../../components/StatCards";
import FieldError from "../../../components/FieldError";
import { EmptyState, FilterBar, KeyFacts, PanelSection, RowActions, SectionCard, SidePanel } from "../../../components/RecordPage";
import { calendarDateFormat, formatDate, toIsoDate } from "../../../utility/dateFormat";
import { hasPermission } from "../../../utils/canOpen";
import { ExpiryCell, PolicyCell, RenewalHeader, StageChip, useRenewalParam } from "../shared";
import "./index.scss";

const UPDATE_TYPES = ["Update", "Meeting", "Counter Offer", "Competitor Quote", "Revised Offer"];
const METHODS = ["Phone", "Email", "Face-to-face", "Video Call", "SMS"];
const URGENCY = ["Normal", "High", "Urgent"];
const SPECIAL_TERMS = ["Extended payment terms", "Waived fees", "Additional coverage", "Multi-year discount", "Bundle discount", "Quarterly payment option", "Auto-debit setup"];
const STAGE_FILTERS = ["quoted", "pending-approval", "approved"];

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

/**
 * Operations > Renewals > Negotiations: the renewals being negotiated (notices sent, quoted, waiting for approval,
 * approved) as one list with filters; selecting a row opens its detail on the right with the premium, the timeline and
 * only the actions its state allows (record an update or a contact, submit the terms for approval, approve or reject).
 */
const NegotiationWorkspace = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode, locale } = useFormatCurrency();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("");
  const [agent, setAgent] = useState("");
  const [panelId, setPanelId] = useState(null);
  const [target, setTarget] = useState(null);
  const [update, setUpdate] = useState(null);
  const [updateErrors, setUpdateErrors] = useState({});
  const [approval, setApproval] = useState(null);
  const [message, setMessage] = useState(null);
  const canApprove = hasPermission("approve:renewals");

  const showError = useCallback((e) => toast.current?.show({ severity: "error", summary: t("common.error", "Error"), detail: e?.message || String(e), life: 5000 }), [t]);
  const done = (summary, detail) => toast.current?.show({ severity: "success", summary, detail, life: 3000 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await renewalsWorkspaceService.getNegotiations();
      setRows(data);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }, [showError]);
  useEffect(() => { load(); }, [load]);

  const selected = rows.find((r) => r.id === panelId) || null;
  const openRow = useCallback((row) => setPanelId(row.id), []);
  useRenewalParam(rows, openRow);
  const agents = useMemo(() => [...new Set(rows.map((r) => r.salesPerson).filter(Boolean))].sort(), [rows]);
  const stages = useMemo(() => [...new Map(rows.map((r) => [r.statusCode, r.currentStage])).entries()], [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (!stage || r.statusCode === stage) && (!agent || r.salesPerson === agent)
      && (!q || [r.policyNumber, r.clientName, r.negotiationId].some((v) => String(v || "").toLowerCase().includes(q))));
  }, [rows, search, stage, agent]);

  const countOf = (code) => rows.filter((r) => r.statusCode === code).length;
  const figures = [
    { key: "all", label: t("negotiations.figures.open"), value: rows.length, onClick: () => setStage(""), active: !stage },
    ...STAGE_FILTERS.map((code) => ({ key: code, label: t(`negotiations.figures.${code}`), value: countOf(code), onClick: () => setStage(stage === code ? "" : code), active: stage === code })),
    { key: "due", label: t("negotiations.figures.dueSoon"), value: rows.filter((r) => r.daysToExpiry !== null && r.daysToExpiry <= 15).length },
  ];

  // ---------------------------------------------------------------- actions
  const openUpdate = (row) => {
    setTarget(row);
    setUpdateErrors({});
    setUpdate({ type: "Update", method: "Phone", description: "", outcome: "", nextAction: "", followUpDate: tomorrow() });
  };
  const openMessage = (row) => {
    setTarget(row);
    setUpdateErrors({});
    setMessage({ method: "Email", subject: "", message: "", followUpDate: null });
  };
  const saveUpdate = async () => {
    const errors = {};
    if (!update.description.trim()) errors.description = t("negotiations.required");
    setUpdateErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      await renewalsWorkspaceService.addActivity(target.id, {
        type: update.type, method: update.method, description: update.description.trim(), outcome: update.outcome || undefined,
        nextAction: update.nextAction || undefined, followUpDate: toIsoDate(update.followUpDate) || undefined,
      });
      setUpdate(null);
      done(t("negotiations.updateSaved"), target.policyNumber);
      load();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };
  const saveMessage = async () => {
    if (!message.subject.trim() && !message.message.trim()) {
      setUpdateErrors({ message: t("negotiations.required") });
      return;
    }
    setSaving(true);
    try {
      await renewalsWorkspaceService.addActivity(target.id, {
        type: "Communication", method: message.method, description: [message.subject.trim(), message.message.trim()].filter(Boolean).join(": "),
        followUpDate: toIsoDate(message.followUpDate) || undefined,
      });
      setMessage(null);
      done(t("negotiations.messageSaved"), target.policyNumber);
      load();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  const quoted = (row) => Number(row?.quotedPremium || row?.currentPremium || 0);
  const openApproval = (row) => {
    setTarget(row);
    setApproval({ requestedPremium: quoted(row), discountPercent: 0, specialTerms: [], justification: "", urgency: "Normal" });
  };
  const submitApproval = async () => {
    setSaving(true);
    try {
      const note = [
        t("negotiations.noteRequested", { premium: formatCurrency(approval.requestedPremium), discount: approval.discountPercent }),
        approval.specialTerms.length ? t("negotiations.noteTerms", { terms: approval.specialTerms.join(", ") }) : "",
        t("negotiations.noteUrgency", { urgency: approval.urgency }),
        approval.justification.trim(),
      ].filter(Boolean).join("; ");
      await renewalsWorkspaceService.submitForApproval(target.id, note);
      setApproval(null);
      done(t("negotiations.submitted"), target.policyNumber);
      load();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };
  const decide = async (row, decision) => {
    setSaving(true);
    try {
      await renewalsWorkspaceService.decide(row.id, decision);
      done(decision === "approve" ? t("negotiations.approved") : t("negotiations.rejected"), row.policyNumber);
      load();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  /** The actions a negotiation allows in its state; `primary` is the main one. */
  const actionsOf = (row) => [
    { key: "note", label: t("negotiations.addUpdate"), icon: "pi pi-plus", onClick: () => openUpdate(row) },
    { key: "message", label: t("negotiations.logMessage"), icon: "pi pi-envelope", onClick: () => openMessage(row) },
    { key: "submit", label: t("negotiations.submitForApproval"), icon: "pi pi-send", onClick: () => openApproval(row), hidden: row.statusCode !== "quoted", primary: true },
    { key: "reject", label: t("negotiations.reject"), icon: "pi pi-times", onClick: () => decide(row, "reject"), hidden: row.statusCode !== "pending-approval" || !canApprove, danger: true },
    { key: "approve", label: t("negotiations.approve"), icon: "pi pi-check", onClick: () => decide(row, "approve"), hidden: row.statusCode !== "pending-approval" || !canApprove, primary: true },
  ].filter((a) => !a.hidden);

  const changeText = (row) => (row.premiumVariancePct === null || row.premiumVariancePct === undefined ? null
    : t("negotiations.change", { pct: `${row.premiumVariancePct > 0 ? "+" : ""}${Number(row.premiumVariancePct).toFixed(1)}` }));

  const premiumBody = (row) => (
    <span className="bv-cell-stack">
      <span>{row.quotedPremium ? formatCurrency(row.quotedPremium) : "—"}</span>
      {changeText(row) ? <small>{changeText(row)}</small> : null}
    </span>
  );
  const actionsBody = (row) => (
    <RowActions actions={[{ icon: "pi pi-eye", label: t("negotiations.view"), onClick: () => setPanelId(row.id) }]}
      menu={actionsOf(row).map((a) => ({ label: a.label, icon: a.icon, command: a.onClick, className: a.danger ? "bv-menu-danger" : undefined }))} />
  );

  const timeline = selected?.timeline || [];

  return (
    <div className="bv-ops-page negotiations-page">
      <Toast ref={toast} />
      <RenewalHeader title={t("negotiations.title")}
        actions={<Button icon="pi pi-refresh" text rounded aria-label={t("negotiations.refresh")} tooltip={t("negotiations.refresh")} tooltipOptions={{ position: "top" }} onClick={load} loading={loading} />} />
      <StatCards items={figures} />

      <SectionCard title={t("negotiations.list")} hint={t("negotiations.listHint")}>
        <FilterBar active={!!(search || stage || agent)} onClear={() => { setSearch(""); setStage(""); setAgent(""); }}>
          <span className="p-input-icon-left bv-filter-bar__search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("negotiations.searchHint")} aria-label={t("negotiations.searchHint")} />
          </span>
          <Dropdown value={stage} onChange={(e) => setStage(e.value || "")} aria-label={t("negotiations.col.stage")}
            options={[{ label: t("negotiations.allStages"), value: "" }, ...stages.map(([code, label]) => ({ label, value: code }))]} />
          <Dropdown value={agent} onChange={(e) => setAgent(e.value || "")} filter aria-label={t("negotiations.col.agent")}
            options={[{ label: t("negotiations.allAgents"), value: "" }, ...agents.map((a) => ({ label: a, value: a }))]} />
        </FilterBar>
        <DataTable value={filtered} dataKey="id" loading={loading} paginator rows={20} size="small" selectionMode="single" selection={selected}
          onSelectionChange={(e) => e.value && setPanelId(e.value.id)} metaKeySelection={false}
          emptyMessage={<EmptyState icon="pi-comments" title={t("negotiations.emptyTitle")} text={rows.length ? t("negotiations.emptyFiltered") : t("negotiations.emptyText")} />}>
          <Column field="policyNumber" header={t("negotiations.col.policy")} sortable body={(r) => <PolicyCell policyNumber={r.policyNumber} insured={r.clientName} onOpen={() => setPanelId(r.id)} />} />
          <Column field="currentStage" header={t("negotiations.col.stage")} sortable body={(r) => <StageChip row={r} />} />
          <Column field="expiryDate" header={t("negotiations.col.expiry")} sortable body={(r) => <ExpiryCell date={r.expiryDate} days={r.daysToExpiry} />} />
          <Column field="currentPremium" header={t("negotiations.col.current")} sortable body={(r) => formatCurrency(r.currentPremium)} className="bv-num" headerClassName="bv-num" />
          <Column field="quotedPremium" header={t("negotiations.col.proposed")} sortable body={premiumBody} className="bv-num" headerClassName="bv-num" />
          <Column field="lastUpdated" header={t("negotiations.col.lastActivity")} sortable body={(r) => formatDate(r.lastActivityAt || r.lastUpdated)} />
          <Column field="salesPerson" header={t("negotiations.col.agent")} sortable />
          <Column header={t("negotiations.col.actions")} body={actionsBody} className="bv-actions" headerClassName="bv-actions" />
        </DataTable>
      </SectionCard>

      <SidePanel visible={!!selected} onHide={() => setPanelId(null)} wide
        title={selected ? `${selected.policyNumber} · ${selected.clientName || ""}` : ""}
        meta={selected ? (
          <>
            <StageChip row={selected} />
            <span>{selected.negotiationId}</span>
          </>
        ) : null}
        footer={selected ? actionsOf(selected).map((a) => (
          <Button key={a.key} label={a.label} icon={a.icon} onClick={a.onClick} loading={saving && (a.key === "approve" || a.key === "reject")}
            outlined={!a.primary} severity={a.danger ? "danger" : undefined} />
        )) : null}>
        {selected ? (
          <>
            <PanelSection title={t("negotiations.terms")}>
              <KeyFacts className="bv-key-facts--plain" items={[
                { key: "product", label: t("negotiations.col.product"), value: selected.product },
                { key: "insurer", label: t("negotiations.insurer"), value: selected.insurer },
                { key: "expiry", label: t("negotiations.col.expiry"), value: <ExpiryCell date={selected.expiryDate} days={selected.daysToExpiry} /> },
                { key: "current", label: t("negotiations.col.current"), value: formatCurrency(selected.currentPremium) },
                { key: "proposed", label: t("negotiations.col.proposed"), value: selected.quotedPremium ? formatCurrency(selected.quotedPremium) : null },
                { key: "change", label: t("negotiations.premiumChange"), value: changeText(selected) },
                { key: "agent", label: t("negotiations.col.agent"), value: selected.salesPerson },
                { key: "last", label: t("negotiations.col.lastActivity"), value: formatDate(selected.lastActivityAt || selected.lastUpdated) },
              ]} />
              {selected.premiumChangeReview ? <p className="bv-panel-note">{t("negotiations.changeReview")}</p> : null}
            </PanelSection>
            <PanelSection title={t("negotiations.timeline")}>
              {timeline.length ? (
                <table className="bv-detail-table">
                  <thead>
                    <tr>
                      <th>{t("negotiations.date")}</th>
                      <th>{t("negotiations.event")}</th>
                      <th>{t("negotiations.channel")}</th>
                      <th>{t("negotiations.details")}</th>
                      <th>{t("negotiations.by")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((item, i) => (
                      <tr key={`${item.date}-${item.type}-${i}`}>
                        <td className="bv-nowrap">{formatDate(item.date)}</td>
                        <td>{item.type}</td>
                        <td>{item.method || "—"}</td>
                        <td>
                          {item.description || "—"}
                          {item.outcome ? <div className="bv-muted">{t("negotiations.outcome", { text: item.outcome })}</div> : null}
                          {item.nextAction ? (
                            <div className="bv-muted">{t("negotiations.next", { text: item.nextAction, date: item.followUpDate ? formatDate(item.followUpDate) : "-" })}</div>
                          ) : null}
                        </td>
                        <td>{item.by || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="bv-panel-note">{t("negotiations.noTimeline")}</p>}
            </PanelSection>
          </>
        ) : null}
      </SidePanel>

      <Dialog header={t("negotiations.addUpdate")} visible={!!update} onHide={() => setUpdate(null)} style={{ width: "40rem" }} breakpoints={{ "768px": "95vw" }}
        footer={(
          <div>
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setUpdate(null)} />
            <Button label={t("negotiations.save")} icon="pi pi-check" onClick={saveUpdate} loading={saving} />
          </div>
        )}>
        {update ? (
          <div className="grid">
            <div className="col-12 md:col-6">
              <label htmlFor="ng-type">{t("negotiations.updateType")}</label>
              <Dropdown inputId="ng-type" value={update.type} onChange={(e) => setUpdate({ ...update, type: e.value })} className="w-full"
                options={UPDATE_TYPES.map((v) => ({ label: t(`negotiations.types.${v}`, v), value: v }))} />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="ng-method">{t("negotiations.channel")}</label>
              <Dropdown inputId="ng-method" value={update.method} onChange={(e) => setUpdate({ ...update, method: e.value })} className="w-full"
                options={METHODS.map((v) => ({ label: t(`negotiations.methods.${v}`, v), value: v }))} />
            </div>
            <div className="col-12">
              <label htmlFor="ng-desc">{t("negotiations.description")} *</label>
              <InputTextarea id="ng-desc" value={update.description} onChange={(e) => setUpdate({ ...update, description: e.target.value })} rows={3} autoResize className="w-full" />
              <FieldError error={updateErrors.description} />
            </div>
            <div className="col-12">
              <label htmlFor="ng-outcome">{t("negotiations.outcomeLabel")}</label>
              <InputText id="ng-outcome" value={update.outcome} onChange={(e) => setUpdate({ ...update, outcome: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="ng-next">{t("negotiations.nextAction")}</label>
              <InputText id="ng-next" value={update.nextAction} onChange={(e) => setUpdate({ ...update, nextAction: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="ng-follow">{t("negotiations.followUp")}</label>
              <Calendar inputId="ng-follow" value={update.followUpDate} onChange={(e) => setUpdate({ ...update, followUpDate: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" />
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("negotiations.logMessage")} visible={!!message} onHide={() => setMessage(null)} style={{ width: "40rem" }} breakpoints={{ "768px": "95vw" }}
        footer={(
          <div>
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setMessage(null)} />
            <Button label={t("negotiations.save")} icon="pi pi-check" onClick={saveMessage} loading={saving} />
          </div>
        )}>
        {message ? (
          <div className="grid">
            <div className="col-12 md:col-6">
              <label htmlFor="ng-mmethod">{t("negotiations.channel")}</label>
              <Dropdown inputId="ng-mmethod" value={message.method} onChange={(e) => setMessage({ ...message, method: e.value })} className="w-full"
                options={METHODS.map((v) => ({ label: t(`negotiations.methods.${v}`, v), value: v }))} />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="ng-mfollow">{t("negotiations.followUp")}</label>
              <Calendar inputId="ng-mfollow" value={message.followUpDate} onChange={(e) => setMessage({ ...message, followUpDate: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" />
            </div>
            <div className="col-12">
              <label htmlFor="ng-subject">{t("negotiations.subject")}</label>
              <InputText id="ng-subject" value={message.subject} onChange={(e) => setMessage({ ...message, subject: e.target.value })} className="w-full" />
            </div>
            <div className="col-12">
              <label htmlFor="ng-message">{t("negotiations.message")}</label>
              <InputTextarea id="ng-message" value={message.message} onChange={(e) => setMessage({ ...message, message: e.target.value })} rows={4} autoResize className="w-full" />
              <FieldError error={updateErrors.message} />
            </div>
            <div className="col-12"><p className="bv-panel-note m-0">{t("negotiations.logHint")}</p></div>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("negotiations.submitForApproval")} visible={!!approval} onHide={() => setApproval(null)} style={{ width: "44rem" }} breakpoints={{ "768px": "95vw" }}
        footer={(
          <div>
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setApproval(null)} />
            <Button label={t("negotiations.submit")} icon="pi pi-send" onClick={submitApproval} loading={saving} />
          </div>
        )}>
        {approval && target ? (
          <div className="grid">
            <div className="col-12">
              <KeyFacts className="bv-key-facts--plain" items={[
                { key: "current", label: t("negotiations.col.current"), value: formatCurrency(target.currentPremium) },
                { key: "proposed", label: t("negotiations.col.proposed"), value: target.quotedPremium ? formatCurrency(target.quotedPremium) : null },
              ]} />
            </div>
            <div className="col-12 md:col-4">
              <label htmlFor="ng-req">{t("negotiations.requestedPremium")}</label>
              <InputNumber inputId="ng-req" value={approval.requestedPremium} mode="currency" currency={currencyCode} locale={locale} className="w-full"
                onValueChange={(e) => {
                  const base = quoted(target);
                  const value = e.value || 0;
                  setApproval({ ...approval, requestedPremium: value, discountPercent: base > 0 ? Math.round(((base - value) / base) * 1000) / 10 : 0 });
                }} />
            </div>
            <div className="col-12 md:col-4">
              <label htmlFor="ng-disc">{t("negotiations.discount")}</label>
              <InputNumber inputId="ng-disc" value={approval.discountPercent} suffix="%" min={0} max={100} maxFractionDigits={1} className="w-full"
                onValueChange={(e) => {
                  const pct = e.value || 0;
                  setApproval({ ...approval, discountPercent: pct, requestedPremium: Math.round(quoted(target) * (1 - pct / 100) * 100) / 100 });
                }} />
            </div>
            <div className="col-12 md:col-4">
              <label htmlFor="ng-urg">{t("negotiations.urgency")}</label>
              <Dropdown inputId="ng-urg" value={approval.urgency} onChange={(e) => setApproval({ ...approval, urgency: e.value })} className="w-full"
                options={URGENCY.map((v) => ({ label: t(`negotiations.urgencies.${v}`, v), value: v }))} />
            </div>
            <div className="col-12">
              <label>{t("negotiations.specialTerms")}</label>
              <div className="negotiations-terms">
                {SPECIAL_TERMS.map((term) => (
                  <span key={term} className="negotiations-terms__item">
                    <Checkbox inputId={`term-${term}`} checked={approval.specialTerms.includes(term)}
                      onChange={(e) => setApproval({ ...approval, specialTerms: e.checked ? [...approval.specialTerms, term] : approval.specialTerms.filter((x) => x !== term) })} />
                    <label htmlFor={`term-${term}`}>{t(`negotiations.termsList.${term}`, term)}</label>
                  </span>
                ))}
              </div>
            </div>
            <div className="col-12">
              <label htmlFor="ng-just">{t("negotiations.justification")}</label>
              <InputTextarea id="ng-just" value={approval.justification} onChange={(e) => setApproval({ ...approval, justification: e.target.value })} rows={3} autoResize className="w-full" />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default NegotiationWorkspace;
