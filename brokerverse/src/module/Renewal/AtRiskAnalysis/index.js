import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
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
import RecordTaskDialog from "../../../components/RecordPage/RecordTaskDialog";
import { formatDate, toIsoDate } from "../../../utility/dateFormat";
import { ExpiryCell, PolicyCell, RenewalHeader, RiskChip } from "../shared";
import "./index.scss";

const PRIORITY_OF = { Critical: "urgent", High: "high", Medium: "normal" };

/** Due date offered for a new task: three days from today, or the expiry date when that comes first. */
const defaultDue = (expiryDate) => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  const soon = toIsoDate(d);
  const expiry = expiryDate ? String(expiryDate).slice(0, 10) : "";
  return expiry && expiry > toIsoDate(new Date()) && expiry < soon ? expiry : soon;
};

/**
 * Operations > Renewals > At-Risk Policies: the retention risk register. Open renewals of Medium risk or above with the
 * main drivers of their score, expiry, premium, account executive and the next action; the detail panel shows the score
 * breakdown, the recommended actions (each creates a My Work task on the renewal, or escalates it to the unit head) and
 * the communication history of the renewal.
 */
const AtRiskAnalysis = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const table = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [agent, setAgent] = useState("");
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [task, setTask] = useState(null);
  const [escalation, setEscalation] = useState(null);

  const showError = (e) => toast.current?.show({ severity: "error", summary: t("common.error", "Error"), detail: e?.message || String(e), life: 5000 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await renewalsWorkspaceService.getAtRisk();
      setRows(data);
      setSelected((s) => (s ? data.find((r) => r.id === s.id) || null : s));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error", "Error"), detail: e?.message || t("atRisk.loadFailed"), life: 5000 });
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const open = async (row) => {
    setSelected(row);
    setHistory(null);
    try {
      const renewal = await renewalsWorkspaceService.getRenewal(row.id);
      const notices = (renewal.notices || []).map((n) => ({
        key: `n${n.stage}`, date: n.sentAt, type: t("atRisk.noticeSent", { stage: n.stage }), method: n.method, detail: n.recipient || "", by: n.sentBy,
      }));
      const activities = (renewal.activities || []).map((a) => ({
        key: `a${a.id}`, date: a.date, type: a.type, method: a.method, detail: [a.description, a.outcome].filter(Boolean).join(" - "), by: a.by,
      }));
      setHistory([...activities, ...notices].sort((x, y) => String(y.date || "").localeCompare(String(x.date || ""))));
    } catch (e) {
      setHistory([]);
      showError(e);
    }
  };

  const agents = useMemo(() => [...new Set(rows.map((r) => r.assignedAgent).filter(Boolean))].sort(), [rows]);
  const levels = useMemo(() => [...new Set(rows.map((r) => r.riskCategory))], [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (!level || r.riskCategory === level) && (!agent || r.assignedAgent === agent)
      && (!q || [r.policyNumber, r.insuredName, r.renewalNumber].some((v) => String(v || "").toLowerCase().includes(q))));
  }, [rows, search, level, agent]);

  const count = (lvl) => rows.filter((r) => r.riskCategory === lvl).length;
  const figures = [
    { key: "all", label: t("atRisk.figures.atRisk"), value: rows.length, onClick: () => setLevel(""), active: !level },
    ...["Critical", "High", "Medium"].filter((l) => l !== "Critical" || levels.includes(l)).map((l) => ({
      key: l, label: t(`renewalPages.risk.${l}`, l), value: count(l), onClick: () => setLevel(level === l ? "" : l), active: level === l,
    })),
    { key: "premium", label: t("atRisk.figures.premium"), value: formatCurrency(rows.reduce((s, r) => s + (Number(r.currentPremium) || 0), 0)) },
    { key: "noAction", label: t("atRisk.figures.noNextAction"), value: rows.filter((r) => !r.nextAction).length },
  ];

  const factorText = (f) => (f.amount ? `${f.details || f.value}: ${formatCurrency(f.amount)}` : f.details || f.value);

  const driversBody = (r) => (
    <ul className="bv-risk-drivers">
      {(r.riskFactors || []).slice(0, 3).map((f) => <li key={f.code || f.factor}>{factorText(f)}</li>)}
      {(r.riskFactors || []).length > 3 ? <li className="bv-muted">{t("atRisk.moreDrivers", { count: r.riskFactors.length - 3 })}</li> : null}
    </ul>
  );
  const riskBody = (r) => (
    <span className="bv-risk-score">
      <RiskChip level={r.riskCategory} />
      <span className="bv-risk-score__value">{r.riskScore}</span>
    </span>
  );
  const nextBody = (r) => {
    if (!r.nextAction) return <span className="bv-muted">{t("atRisk.noNextAction")}</span>;
    return (
      <span className="bv-cell-stack">
        <span>{r.nextAction.title}</span>
        <small>{r.nextAction.dueDate ? t("atRisk.due", { date: formatDate(r.nextAction.dueDate) }) : null}</small>
      </span>
    );
  };

  const newTask = (row, title) => setTask({ row, title, dueDate: defaultDue(row.expiryDate), priority: PRIORITY_OF[row.riskCategory] || "normal" });
  const actionsBody = (r) => (
    <RowActions
      actions={[{ icon: "pi pi-eye", label: t("atRisk.view"), onClick: () => open(r) }, { icon: "pi pi-check-square", label: t("atRisk.createTask"), onClick: () => newTask(r, "") }]}
      menu={[
        { label: t("atRisk.escalate"), icon: "pi pi-arrow-up", command: () => setEscalation({ row: r, note: "" }) },
        { label: t("atRisk.openQueue"), icon: "pi pi-list", command: () => navigate("/renewal/queue", { state: { search: r.policyNumber } }) },
        { label: t("atRisk.openPolicy"), icon: "pi pi-file", command: () => navigate(`/agent/policydetail/${r.policyId}`), hidden: !r.policyId },
      ]} />
  );

  const doEscalate = async () => {
    const { row, note } = escalation;
    try {
      const r = await renewalsWorkspaceService.escalate(row.id, note.trim() || undefined);
      const names = (r.escalatedTo || []).map((u) => u.name).join(", ");
      toast.current?.show({ severity: "success", summary: t("atRisk.escalated"), detail: names ? t("atRisk.escalatedTo", { names }) : row.policyNumber, life: 4000 });
      setEscalation(null);
      load();
      if (selected?.id === row.id) open(row);
    } catch (e) {
      showError(e);
    }
  };

  const breakdownTotal = (selected?.scoreBreakdown || []).reduce((s, f) => s + (f.points || 0), 0);

  return (
    <div className="bv-ops-page at-risk-register">
      <Toast ref={toast} />
      <RenewalHeader title={t("atRisk.title")}
        actions={(
          <>
            <Button icon="pi pi-refresh" text rounded aria-label={t("atRisk.refresh")} tooltip={t("atRisk.refresh")} tooltipOptions={{ position: "top" }} onClick={load} loading={loading} />
            <Button icon="pi pi-download" outlined label={t("atRisk.export")} onClick={() => table.current?.exportCSV()} disabled={!filtered.length} />
          </>
        )} />
      <StatCards items={figures} />

      <SectionCard title={t("atRisk.register")} hint={t("atRisk.registerHint")}>
        <FilterBar active={!!(search || level || agent)} onClear={() => { setSearch(""); setLevel(""); setAgent(""); }}>
          <span className="p-input-icon-left bv-filter-bar__search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("atRisk.searchHint")} aria-label={t("atRisk.searchHint")} />
          </span>
          <Dropdown value={level} onChange={(e) => setLevel(e.value || "")} aria-label={t("atRisk.col.risk")}
            options={[{ label: t("atRisk.allLevels"), value: "" }, ...levels.map((l) => ({ label: t(`renewalPages.risk.${l}`, l), value: l }))]} />
          <Dropdown value={agent} onChange={(e) => setAgent(e.value || "")} filter aria-label={t("atRisk.col.agent")}
            options={[{ label: t("atRisk.allAgents"), value: "" }, ...agents.map((a) => ({ label: a, value: a }))]} />
        </FilterBar>
        <DataTable ref={table} value={filtered} dataKey="id" loading={loading} paginator rows={20} size="small" sortField="riskScore" sortOrder={-1}
          exportFilename="at-risk-policies" emptyMessage={(
            <EmptyState icon="pi-shield" title={t("atRisk.emptyTitle")} text={rows.length ? t("atRisk.emptyFiltered") : t("atRisk.emptyText")} />
          )}>
          <Column field="policyNumber" header={t("atRisk.col.policy")} sortable body={(r) => <PolicyCell policyNumber={r.policyNumber} insured={r.insuredName} onOpen={() => open(r)} />} />
          <Column field="insuredName" header={t("atRisk.col.insured")} hidden exportable />
          <Column field="riskScore" header={t("atRisk.col.risk")} sortable body={riskBody} />
          <Column field="riskCategory" header={t("atRisk.col.level")} hidden exportable />
          <Column header={t("atRisk.col.drivers")} body={driversBody} exportable={false} />
          <Column field="expiryDate" header={t("atRisk.col.expiry")} sortable body={(r) => <ExpiryCell date={r.expiryDate} days={r.daysToExpiry} />} />
          <Column field="currentPremium" header={t("atRisk.col.premium")} sortable body={(r) => formatCurrency(r.currentPremium)} className="bv-num" headerClassName="bv-num" />
          <Column field="assignedAgent" header={t("atRisk.col.agent")} sortable />
          <Column header={t("atRisk.col.next")} body={nextBody} exportable={false} />
          <Column header={t("atRisk.col.actions")} body={actionsBody} exportable={false} className="bv-actions" headerClassName="bv-actions" />
        </DataTable>
      </SectionCard>

      <SidePanel visible={!!selected} onHide={() => setSelected(null)} title={selected ? `${selected.policyNumber} · ${selected.insuredName || ""}` : ""}
        meta={selected ? (
          <>
            <RiskChip level={selected.riskCategory} />
            <span>{t("atRisk.scoreOf", { score: selected.riskScore })}</span>
            {selected.renewalNumber ? <span>{selected.renewalNumber}</span> : null}
          </>
        ) : null}
        footer={selected ? (
          <>
            <Button label={t("atRisk.escalate")} icon="pi pi-arrow-up" outlined onClick={() => setEscalation({ row: selected, note: "" })} />
            <Button label={t("atRisk.createTask")} icon="pi pi-check-square" onClick={() => newTask(selected, "")} />
          </>
        ) : null}>
        {selected ? (
          <>
            <PanelSection title={t("atRisk.renewalDetails")}>
              <KeyFacts className="bv-key-facts--plain" items={[
                { key: "product", label: t("atRisk.col.product"), value: selected.product },
                { key: "insurer", label: t("atRisk.insurer"), value: selected.insurer },
                { key: "expiry", label: t("atRisk.col.expiry"), value: <ExpiryCell date={selected.expiryDate} days={selected.daysToExpiry} /> },
                { key: "status", label: t("atRisk.renewalStatus"), value: selected.status },
                { key: "premium", label: t("atRisk.currentPremium"), value: formatCurrency(selected.currentPremium) },
                { key: "renewalPremium", label: t("atRisk.quotedPremium"), value: selected.renewalPremium ? formatCurrency(selected.renewalPremium) : null },
                { key: "agent", label: t("atRisk.col.agent"), value: selected.assignedAgent },
                { key: "contact", label: t("atRisk.lastContact"), value: selected.lastContactDate ? formatDate(selected.lastContactDate) : t("atRisk.none") },
              ]} />
            </PanelSection>

            <PanelSection title={t("atRisk.breakdown")}>
              <table className="bv-detail-table">
                <thead>
                  <tr>
                    <th>{t("atRisk.factor")}</th>
                    <th>{t("atRisk.finding")}</th>
                    <th className="bv-num">{t("atRisk.weight")}</th>
                    <th className="bv-num">{t("atRisk.points")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.scoreBreakdown || []).map((f) => (
                    <tr key={f.code}>
                      <td>{t(`atRisk.factors.${f.code}`, f.factor)}</td>
                      <td className={f.points ? "" : "bv-muted"}>{f.points ? factorText(f) : t("atRisk.notFound")}</td>
                      <td className="bv-num">{f.weight}</td>
                      <td className="bv-num">{f.points}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>{t("atRisk.totalScore", { level: t(`renewalPages.risk.${selected.riskCategory}`, selected.riskCategory) })}</td>
                    <td className="bv-num">{Math.min(100, breakdownTotal)}</td>
                  </tr>
                </tfoot>
              </table>
              <p className="bv-panel-note">{t("atRisk.scoreRule")}</p>
            </PanelSection>

            <PanelSection title={t("atRisk.recommended")}>
              {selected.nextAction ? (
                <p className="bv-panel-text">{t("atRisk.nextActionIs", { title: selected.nextAction.title, date: selected.nextAction.dueDate ? formatDate(selected.nextAction.dueDate) : "-" })}</p>
              ) : null}
              {(selected.recommendedActions || []).length ? (
                <ul className="bv-action-list">
                  {selected.recommendedActions.map((a) => (
                    <li key={a}>
                      <span>{a}</span>
                      {/^escalate/i.test(a) ? (
                        <Button size="small" outlined icon="pi pi-arrow-up" label={t("atRisk.escalateShort")} onClick={() => setEscalation({ row: selected, note: "" })} />
                      ) : (
                        <Button size="small" outlined icon="pi pi-plus" label={t("atRisk.createTaskShort")} onClick={() => newTask(selected, a)} />
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="bv-panel-note">{t("atRisk.noRecommendations")}</p>}
            </PanelSection>

            <PanelSection title={t("atRisk.history")}>
              {history === null ? <p className="bv-panel-note">{t("atRisk.loadingHistory")}</p> : history.length ? (
                <table className="bv-detail-table">
                  <thead>
                    <tr>
                      <th>{t("atRisk.date")}</th>
                      <th>{t("atRisk.type")}</th>
                      <th>{t("atRisk.channel")}</th>
                      <th>{t("atRisk.details")}</th>
                      <th>{t("atRisk.by")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.key}>
                        <td className="bv-nowrap">{formatDate(h.date)}</td>
                        <td>{h.type}</td>
                        <td>{h.method || "—"}</td>
                        <td>{h.detail || "—"}</td>
                        <td>{h.by || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="bv-panel-note">{t("atRisk.noHistory")}</p>}
            </PanelSection>
          </>
        ) : null}
      </SidePanel>

      <RecordTaskDialog visible={!!task} entity="renewal" entityId={task?.row.id} title={task?.title} dueDate={task?.dueDate} priority={task?.priority}
        reference={task ? `${task.row.policyNumber} · ${task.row.insuredName || ""}` : null}
        onHide={() => setTask(null)}
        onSaved={(saved) => {
          toast.current?.show({ severity: "success", summary: t("atRisk.taskCreated"), detail: saved?.title, life: 3000 });
          setTask(null);
          load();
        }} />

      <Dialog header={t("atRisk.escalateHeader")} visible={!!escalation} onHide={() => setEscalation(null)} style={{ width: "32rem" }} breakpoints={{ "768px": "95vw" }}
        footer={(
          <div>
            <Button label={t("common.cancel", "Cancel")} text onClick={() => setEscalation(null)} />
            <Button label={t("atRisk.escalateShort")} icon="pi pi-arrow-up" onClick={doEscalate} />
          </div>
        )}>
        {escalation ? (
          <div className="grid">
            <div className="col-12">
              <p className="mt-0">{t("atRisk.escalateText", { policy: escalation.row.policyNumber, insured: escalation.row.insuredName || "" })}</p>
            </div>
            <div className="col-12">
              <label htmlFor="ar-note">{t("atRisk.escalateNote")}</label>
              <InputTextarea id="ar-note" value={escalation.note} onChange={(e) => setEscalation({ ...escalation, note: e.target.value })} rows={3} autoResize className="w-full" maxLength={2000} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default AtRiskAnalysis;
