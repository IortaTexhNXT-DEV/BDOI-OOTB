import React, { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Dropdown } from "primereact/dropdown";
import { TabPanel, TabView } from "primereact/tabview";
import DetailHeader from "../../components/DetailHeader";
import DetailDialog from "../../components/DetailDialog";
import FieldError from "../../components/FieldError";
import ImportDialog from "../../components/ImportDialog";
import LoadState from "../../components/LoadState";
import LoadingBar from "../../components/LoadingBar";
import StatusChip from "../../components/StatusChip";
import { RecordActivityLog } from "../../components/ActivityLog";
import RowActions, { actionsColumn } from "../../components/RowActions";
import { SectionCard } from "../../components/RecordPage";
import { openConfirm } from "../../components/ConfirmDialog";
import { useStableLoad } from "../../hooks/useStableLoad";
import { numberLocale } from "../../utility/currencyConverter";
import goLiveService from "../../services/goLiveService";
import { Chip, ROOT, amount, chipOf, count, dateTimeOf, makerOf, myId, num, useAccess, useDownload, useWorkspace } from "./shared";

/** A count line is compared exactly; every other measure is an amount in pesos. */
export const isCount = (l) => /count/i.test(String(l.measure || ""));
const figure = (l, v) => (v === null || v === undefined ? "—" : isCount(l) ? count(v) : amount(v));
const lineName = (l) => [l.label || l.measure, l.group].filter(Boolean).join(" · ");
const DIFF_KINDS = ["measure", "check", "not-loaded", "extra"];

/** Legacy figure of a line (write) and its tolerance with the reason (approve; never on a count). */
const LineDialog = ({ recon, line, canWrite, canApprove, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [legacy, setLegacy] = useState(line.legacyValue);
  const [tolerance, setTolerance] = useState(line.tolerance || 0);
  const [reason, setReason] = useState(line.toleranceReason || "");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toleranceChanged = canApprove && !isCount(line) && Number(tolerance || 0) !== Number(line.tolerance || 0);
  const reasonProblem = tried && toleranceChanged && Number(tolerance) !== 0 && !reason.trim() ? t("goLive.recon.toleranceReasonRequired") : null;
  const save = async () => {
    setTried(true);
    if (toleranceChanged && Number(tolerance) !== 0 && !reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const body = {};
      if (canWrite && legacy !== line.legacyValue) body.legacyValue = legacy;
      if (toleranceChanged) Object.assign(body, { tolerance: Number(tolerance || 0), toleranceReason: reason.trim() || null });
      if (Object.keys(body).length) await goLiveService.updateLine(recon.id, line.id, body);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DetailDialog visible onHide={onHide} size="md" header={`${line.object} · ${lineName(line)}`} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.recon.saveLine")} icon="pi pi-check" onClick={save} loading={busy} />
      </>
    )}>
      <div className="go-live__form">
        <span className="bv-field-label">{line.sides?.system || t("goLive.recon.brokerVerse")}</span>
        <span className="go-live__figure">{figure(line, line.systemValue)}</span>
        <label htmlFor="line-legacy" className="bv-field-label">{line.sides?.other || t("goLive.recon.legacy")}</label>
        <InputNumber inputId="line-legacy" value={legacy} onValueChange={(e) => setLegacy(e.value ?? null)} mode="decimal" locale={numberLocale()} disabled={!canWrite}
          minFractionDigits={isCount(line) ? 0 : 2} maxFractionDigits={isCount(line) ? 0 : 2} className="w-full go-live__amount-input" />
        {canApprove && !isCount(line) ? (
          <>
            <label htmlFor="line-tolerance" className="bv-field-label">{t("goLive.recon.tolerance")}</label>
            <InputNumber inputId="line-tolerance" value={tolerance} onValueChange={(e) => setTolerance(e.value ?? 0)} mode="decimal" locale={numberLocale()} min={0}
              minFractionDigits={2} maxFractionDigits={2} className="w-full go-live__amount-input" />
            <label htmlFor="line-reason" className="bv-field-label">{t("goLive.recon.toleranceReason")}</label>
            <InputTextarea id="line-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoResize maxLength={500}
              className={`w-full${reasonProblem ? " p-invalid" : ""}`} />
            <FieldError error={reasonProblem} />
          </>
        ) : null}
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** Explanation of a difference: explanation, action, owner and status (explained or fixed). */
const DifferenceDialog = ({ recon, diff, onHide, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ explanation: diff.explanation || "", action: diff.action || "", owner: diff.owner || "", status: diff.status === "fixed" ? "fixed" : "explained" });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const problem = tried && !form.explanation.trim() ? t("goLive.recon.explanationRequired") : null;
  const save = async () => {
    setTried(true);
    if (!form.explanation.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await goLiveService.explainDifference(recon.id, diff.id, { explanation: form.explanation.trim(), action: form.action.trim() || null, owner: form.owner.trim() || null, status: form.status });
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target ? e.target.value : e.value }));
  return (
    <DetailDialog visible onHide={onHide} size="md" header={t("goLive.recon.explainTitle")} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.recon.saveExplanation")} icon="pi pi-check" onClick={save} loading={busy} />
      </>
    )}>
      <div className="go-live__form">
        <p className="go-live__subject">{diff.description}</p>
        <label htmlFor="diff-explanation" className="bv-field-label">{t("goLive.recon.explanation")}<span className="required-marker">*</span></label>
        <InputTextarea id="diff-explanation" value={form.explanation} onChange={set("explanation")} rows={3} autoResize maxLength={2000} className={`w-full${problem ? " p-invalid" : ""}`} />
        <FieldError error={problem} />
        <label htmlFor="diff-action" className="bv-field-label">{t("goLive.recon.action")}</label>
        <InputText id="diff-action" value={form.action} onChange={set("action")} maxLength={500} className="w-full" />
        <label htmlFor="diff-owner" className="bv-field-label">{t("goLive.recon.owner")}</label>
        <InputText id="diff-owner" value={form.owner} onChange={set("owner")} maxLength={200} className="w-full" />
        <label htmlFor="diff-status" className="bv-field-label">{t("goLive.loads.status")}</label>
        <Dropdown inputId="diff-status" value={form.status} options={["explained", "fixed"].map((s) => ({ label: t(`goLive.status.difference.${s}`), value: s }))} onChange={set("status")}
          className="w-full" />
        {error ? <p className="go-live__error" role="alert">{error}</p> : null}
      </div>
    </DetailDialog>
  );
};

/** The sub-ledger tie-outs: GL accounts and tolerance of each (approve:data-load). */
const TieoutsDialog = ({ recon, onHide, onSaved }) => {
  const { t } = useTranslation();
  const loader = useCallback(() => goLiveService.tieouts(recon.id), [recon.id]);
  const { data } = useStableLoad(loader);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const list = rows || (data?.definitions || []).map((d) => ({ ...d, accountsText: (d.accounts || []).join(", ") }));
  const edit = (i, patch) => setRows(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await goLiveService.saveTieouts(list.map(({ accountsText, ...d }) => ({ ...d, accounts: accountsText.split(/[\s,;]+/).filter(Boolean) })));
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DetailDialog visible onHide={onHide} size="xl" header={t("goLive.recon.tieoutsTitle")} footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.recon.saveTieouts")} icon="pi pi-check" onClick={save} loading={busy} disabled={!list.length} />
      </>
    )}>
      <DataTable value={list} dataKey="key" size="small">
        <Column field="label" header={t("goLive.recon.tieout")} />
        <Column header={t("goLive.recon.accounts")} body={(r, o) => (
          <InputText value={r.accountsText} onChange={(e) => edit(o.rowIndex, { accountsText: e.target.value })} aria-label={`${r.label} ${t("goLive.recon.accounts")}`} className="w-full" />
        )} />
        <Column header={t("goLive.recon.tolerance")} body={(r, o) => (
          <InputNumber value={r.tolerance ?? 0} onValueChange={(e) => edit(o.rowIndex, { tolerance: e.value ?? 0 })} mode="decimal" locale={numberLocale()} min={0} minFractionDigits={2}
            maxFractionDigits={2} aria-label={`${r.label} ${t("goLive.recon.tolerance")}`} className="go-live__amount-input" />
        )} {...num} />
      </DataTable>
      {error ? <p className="go-live__error" role="alert">{error}</p> : null}
    </DetailDialog>
  );
};

/**
 * One reconciliation (/reconciliation/:id): lines against the legacy figures, checks and tie-outs, the difference list,
 * the sign-off slots and the report. The users who loaded its loads neither accept a difference nor sign.
 */
const ReconciliationPage = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notify } = useWorkspace();
  const { canWrite, canApprove } = useAccess();
  const download = useDownload();
  const loader = useCallback(() => goLiveService.reconciliation(id), [id]);
  const { data: r, loading, refreshing, error, reload } = useStableLoad(loader);
  const [line, setLine] = useState(null);
  const [diff, setDiff] = useState(null);
  const [legacyUpload, setLegacyUpload] = useState(false);
  const [tieouts, setTieouts] = useState(false);
  const legacyTargets = useMemo(() => [{ label: t("goLive.recon.controlTotals"), uploadPath: goLiveService.paths.legacy(id) }], [t, id]);

  if (!r) return <LoadState loading={loading} error={error} onRetry={reload} onBack={() => navigate(`${ROOT}/reconciliation`)} backLabel={t("goLive.recon.title")} />;

  const open = r.status === "open";
  const unsigned = open && !r.signoffs.some((s) => s.signedAt);
  const maker = makerOf(r.makers);
  const signedOther = r.signoffs.some((s) => s.signedById === myId());
  const measures = r.lines.filter((l) => l.kind === "measure");
  const checks = r.lines.filter((l) => l.kind !== "measure");
  const saved = (message) => {
    notify("success", message);
    reload();
  };

  const recompute = () => openConfirm({
    title: t("goLive.recon.recomputeTitle"), severity: "neutral", message: t("goLive.recon.recomputeMessage", { number: r.reconNumber }),
    confirmLabel: t("goLive.recon.recompute"),
    onConfirm: async () => {
      await goLiveService.recompute(r.id);
      saved(t("goLive.recon.recomputed", { number: r.reconNumber }));
    },
  });
  const accept = (d) => openConfirm({
    title: t("goLive.recon.acceptTitle"), severity: "warning", message: t("goLive.recon.acceptMessage"),
    facts: [{ label: t("goLive.recon.difference"), value: d.description }, { label: t("goLive.recon.amount"), value: d.amount, type: "amount", hidden: d.amount === null },
      { label: t("goLive.recon.explanation"), value: d.explanation }],
    input: { type: "textarea", label: t("goLive.recon.acceptance"), required: true, defaultValue: d.explanation || "" },
    confirmLabel: t("goLive.recon.acceptDifference"),
    onConfirm: async (text) => {
      await goLiveService.acceptDifference(r.id, d.id, text);
      saved(t("goLive.recon.accepted"));
    },
  });
  const sign = (s) => openConfirm({
    title: t("goLive.recon.signTitle", { slot: s.label }), severity: "warning",
    message: t("goLive.recon.signMessage", { number: r.reconNumber, slot: s.label }),
    facts: [{ label: t("goLive.recon.lines"), value: r.summary.lines, type: "number" }, { label: t("goLive.recon.matched"), value: r.summary.matched, type: "number" },
      { label: t("goLive.recon.differencesCount"), value: r.summary.differences, type: "number" }],
    input: { type: "textarea", label: t("goLive.recon.remarks"), required: true },
    confirmLabel: t("goLive.recon.signAs", { slot: s.label }),
    onConfirm: async (remarks) => {
      await goLiveService.sign(r.id, s.slot, remarks);
      saved(t("goLive.recon.signed", { slot: s.label }));
    },
  });

  const lineActions = (l) => ((canWrite || canApprove) && unsigned ? (
    <RowActions onEdit={() => setLine(l)} editLabel={t("goLive.recon.editLine")} />
  ) : null);
  const lineColumns = (withActions) => [
    <Column key="name" header={t("goLive.recon.line")} body={lineName} />,
    <Column key="sys" header={t("goLive.recon.brokerVerse")} body={(l) => figure(l, l.systemValue)} {...num} />,
    <Column key="leg" header={t("goLive.recon.legacy")} body={(l) => figure(l, l.legacyValue)} {...num} />,
    <Column key="diff" header={t("goLive.recon.difference")} body={(l) => figure(l, l.difference)} {...num} />,
    <Column key="tol" header={t("goLive.recon.tolerance")} body={(l) => (isCount(l) ? "—" : amount(l.tolerance))} {...num} />,
    <Column key="status" header={t("goLive.loads.status")} body={(l) => <Chip kind="line" code={l.status} />} />,
    ...(withActions ? [<Column key="act" body={lineActions} {...actionsColumn} />] : []),
  ];

  const headerActions = (
    <div className="go-live__actions">
      {canWrite && unsigned ? <Button type="button" icon="pi pi-refresh" label={t("goLive.recon.recompute")} outlined onClick={recompute} /> : null}
      {canWrite && unsigned ? <Button type="button" icon="pi pi-upload" label={t("goLive.recon.uploadControlTotals")} outlined onClick={() => setLegacyUpload(true)} /> : null}
      <Button type="button" icon="pi pi-file-pdf" label={t("goLive.recon.reportPdf")} outlined onClick={() => download(() => goLiveService.reconciliationReport(r.id, "pdf"))} />
      <Button type="button" icon="pi pi-file-excel" label={t("goLive.recon.reportXlsx")} outlined onClick={() => download(() => goLiveService.reconciliationReport(r.id, "xlsx"))} />
      {r.signedReport ? (
        <Button type="button" icon="pi pi-verified" label={t("goLive.recon.signedReport")} onClick={() => download(() => goLiveService.reconciliationReport(r.id, "pdf", true))} />
      ) : null}
    </div>
  );

  return (
    <div className="go-live__stack">
      <SectionCard className="bv-loading-host">
        <LoadingBar active={refreshing} />
        <Button type="button" icon="pi pi-arrow-left" text label={t("goLive.recon.title")} onClick={() => navigate(`${ROOT}/reconciliation`)} className="go-live__back" />
        <DetailHeader title={r.reconNumber} status={chipOf(t, "recon", r.status)} subtitle={r.batches.map((b) => b.loadNumber).join(", ") || t("goLive.recon.noLoads")}
          actions={headerActions} meta={[
            { label: t("goLive.header.cutover"), value: r.cutoverDate, type: "date" },
            { label: t("goLive.recon.asAt"), value: r.openingBalancesAsAt, type: "date" },
            { label: t("goLive.recon.computedAt"), value: r.computedAt, type: "datetime" },
            { label: t("goLive.recon.openDifferences"), value: r.summary.openDifferences, type: "number" },
            { label: t("goLive.recon.signoffs"), value: `${r.summary.signed} / ${r.summary.slots}` },
          ]} />
      </SectionCard>
      <TabView className="go-live__record-tabs">
        <TabPanel header={t("goLive.recon.tabs.lines")}>
          <DataTable value={measures} dataKey="id" size="small" rowGroupMode="subheader" groupRowsBy="object" sortField="object" sortOrder={1}
            rowGroupHeaderTemplate={(l) => <strong>{l.object}</strong>} emptyMessage={t("goLive.recon.noLines")}>
            {lineColumns(true)}
          </DataTable>
        </TabPanel>
        <TabPanel header={t("goLive.recon.tabs.checks")}>
          {canApprove && unsigned ? (
            <div className="go-live__actions go-live__actions--end">
              <Button type="button" icon="pi pi-sliders-h" label={t("goLive.recon.tieouts")} outlined onClick={() => setTieouts(true)} />
            </div>
          ) : null}
          <DataTable value={checks} dataKey="id" size="small" emptyMessage={t("goLive.recon.noLines")}>
            <Column header={t("goLive.recon.kind")} body={(l) => t(`goLive.recon.kinds.${l.kind}`)} />
            <Column header={t("goLive.recon.sides")} body={(l) => `${l.sides?.system || ""} / ${l.sides?.other || ""}`} />
            <Column header={t("goLive.recon.accounts")} body={(l) => (l.accounts || []).join(", ") || "—"} />
            {lineColumns(true)}
          </DataTable>
        </TabPanel>
        <TabPanel header={t("goLive.recon.tabs.differences", { count: r.summary.openDifferences })}>
          <DataTable value={r.differences} dataKey="id" size="small" emptyMessage={t("goLive.recon.noDifferences")} sortField="kind">
            <Column header={t("goLive.recon.kind")} body={(d) => (DIFF_KINDS.includes(d.kind) ? t(`goLive.recon.diffKinds.${d.kind}`) : d.kind)} />
            <Column field="description" header={t("goLive.recon.description")} />
            <Column header={t("goLive.recon.amount")} body={(d) => (d.amount === null ? "—" : amount(d.amount))} {...num} />
            <Column header={t("goLive.loads.status")} body={(d) => <Chip kind="difference" code={d.status} />} />
            <Column header={t("goLive.recon.explanation")} body={(d) => d.explanation || "—"} />
            <Column header={t("goLive.recon.action")} body={(d) => d.action || "—"} />
            <Column header={t("goLive.recon.owner")} body={(d) => d.owner || "—"} />
            <Column header={t("goLive.recon.acceptedBy")} body={(d) => (d.acceptedBy ? `${d.acceptedBy} · ${dateTimeOf(d.acceptedAt)}` : "—")} />
            <Column body={(d) => (open && d.status !== "accepted" ? (
              <RowActions>
                {canWrite ? <Button type="button" icon="pi pi-pencil" text rounded aria-label={t("goLive.recon.explain")} tooltip={t("goLive.recon.explain")}
                  tooltipOptions={{ position: "top" }} onClick={() => setDiff(d)} /> : null}
                {canApprove ? <Button type="button" icon="pi pi-check-circle" text rounded aria-label={t("goLive.recon.acceptDifference")}
                  tooltip={maker ? t("makerChecker.ownRecord") : t("goLive.recon.acceptDifference")} tooltipOptions={{ position: "top" }}
                  disabled={!!maker || !d.explanation} onClick={() => accept(d)} /> : null}
              </RowActions>
            ) : null)} {...actionsColumn} />
          </DataTable>
        </TabPanel>
        <TabPanel header={t("goLive.recon.tabs.signoff")}>
          <DataTable value={r.signoffs} dataKey="slot" size="small">
            <Column field="label" header={t("goLive.recon.slot")} />
            <Column header={t("goLive.recon.signedBy")} body={(s) => s.signedBy || "—"} />
            <Column header={t("goLive.recon.signedAt")} body={(s) => dateTimeOf(s.signedAt)} />
            <Column header={t("goLive.recon.remarks")} body={(s) => s.remarks || "—"} />
            <Column header={t("goLive.loads.status")} body={(s) => <StatusChip label={s.signedAt ? t("goLive.recon.signedChip") : t("goLive.recon.waiting")}
              severity={s.signedAt ? "success" : "warning"} />} />
            {canApprove && open ? (
              <Column body={(s) => (s.signedAt ? null : (
                <Button type="button" icon="pi pi-pen-to-square" label={t("goLive.recon.sign")} size="small" onClick={() => sign(s)}
                  disabled={!!maker || signedOther || r.summary.openDifferences > 0 || r.summary.missingLegacy.length > 0}
                  tooltip={maker ? t("makerChecker.ownRecord") : signedOther ? t("goLive.recon.signedOther") : undefined} tooltipOptions={{ position: "top", showOnDisabled: true }} />
              ))} {...actionsColumn} />
            ) : null}
          </DataTable>
        </TabPanel>
        <TabPanel header={t("goLive.common.activity")}>
          <RecordActivityLog entity="migration_reconciliation" recordId={r.id} />
        </TabPanel>
      </TabView>
      {line ? <LineDialog recon={r} line={line} canWrite={canWrite} canApprove={canApprove} onHide={() => setLine(null)}
        onSaved={() => { setLine(null); saved(t("goLive.recon.lineSaved")); }} /> : null}
      {diff ? <DifferenceDialog recon={r} diff={diff} onHide={() => setDiff(null)} onSaved={() => { setDiff(null); saved(t("goLive.recon.explained")); }} /> : null}
      {tieouts ? <TieoutsDialog recon={r} onHide={() => setTieouts(false)} onSaved={() => { setTieouts(false); saved(t("goLive.recon.tieoutsSaved")); }} /> : null}
      <ImportDialog visible={legacyUpload} onHide={() => setLegacyUpload(false)} title={t("goLive.recon.uploadControlTotals")} targets={legacyTargets} accept=".xlsx"
        onUploaded={() => { setLegacyUpload(false); saved(t("goLive.recon.legacyLoaded")); }} />
    </div>
  );
};

export default ReconciliationPage;
