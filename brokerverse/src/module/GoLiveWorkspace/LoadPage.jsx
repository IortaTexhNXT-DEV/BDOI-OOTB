import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { TabPanel, TabView } from "primereact/tabview";
import { Message } from "primereact/message";
import DetailHeader from "../../components/DetailHeader";
import DetailDialog from "../../components/DetailDialog";
import KeyValueGrid from "../../components/KeyValueGrid";
import ApprovalActions from "../../components/ApprovalActions";
import ReasonPicker, { reasonProblem } from "../../components/ReasonPicker";
import LoadState from "../../components/LoadState";
import LoadingBar from "../../components/LoadingBar";
import ProgressMeter from "../../components/ProgressMeter";
import { RecordActivityLog } from "../../components/ActivityLog";
import { SectionCard } from "../../components/RecordPage";
import { openConfirm } from "../../components/ConfirmDialog";
import { useStableLoad } from "../../hooks/useStableLoad";
import goLiveService from "../../services/goLiveService";
import { ROOT, chipOf, count, dateTimeOf, duration, myId, makerOf, num, useAccess, useDownload, useWorkspace } from "./shared";
import RowsTab from "./RowsTab";
import DuplicatesTab from "./DuplicatesTab";
import UndoTab from "./UndoTab";

/** Statuses during which a job works on the load: the page follows its progress. */
export const WORKING = ["validating", "running", "undoing"];
export const POLL_MS = 3000;
const REVALIDATE = ["validated", "failed", "rejected", "withdrawn", "expired"];

/** Sum of the rows a load creates and changes, as the approval names them. */
const records = (b) => (b.rowsNew || 0) + (b.rowsChanged || 0);

/** Reject of a load: a reason of the Reason Codes master (data load rejection) and remarks. */
const RejectDialog = ({ batch, onHide, onDone }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const reject = async () => {
    setTried(true);
    if (reasonProblem(reason)) return;
    setBusy(true);
    setError(null);
    try {
      await goLiveService.rejectBatch(batch.id, reason);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DetailDialog visible onHide={onHide} header={t("goLive.load.rejectTitle", { number: batch.loadNumber })} size="md" footer={(
      <>
        <Button type="button" label={t("goLive.common.cancel")} text onClick={onHide} disabled={busy} />
        <Button type="button" label={t("goLive.load.rejectLoad")} severity="danger" onClick={reject} loading={busy} />
      </>
    )}>
      <ReasonPicker context="data_load_reject" value={reason} onChange={setReason} showErrors={tried} autoFocus />
      {error ? <p className="go-live__error" role="alert">{error}</p> : null}
    </DetailDialog>
  );
};

/**
 * One load (/loads/:id): its header, the progress of its job (followed every 3 seconds, also after a reload of the
 * page), the actions its status and the user's permissions allow, and the tabs Summary, Rows, Duplicates, Approval
 * and Undo.
 */
const LoadPage = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { notify, overview, reloadOverview } = useWorkspace();
  const { canWrite, canApprove, canViewPii } = useAccess();
  const download = useDownload();
  const [tab, setTab] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const loader = useCallback(() => goLiveService.batch(id), [id]);
  const { data, loading, error, reload } = useStableLoad(loader);
  const batch = data?.batch;
  const working = !!batch && WORKING.includes(batch.status);

  useEffect(() => {
    if (!working) return undefined;
    const timer = window.setInterval(reload, POLL_MS);
    return () => window.clearInterval(timer);
  }, [working, reload]);

  const after = (message) => {
    if (message) notify("success", message);
    reload();
    reloadOverview();
  };
  const act = async (fn, message) => {
    try {
      await fn();
      after(message);
    } catch (e) {
      notify("error", e.message);
    }
  };

  if (!batch) {
    return <LoadState loading={loading} error={error} onRetry={reload} onBack={() => navigate(`${ROOT}/loads`)} backLabel={t("goLive.loads.title")} />;
  }

  const makers = data.makers || { load: [], undo: [] };
  const me = myId();
  const mine = [batch.createdById, batch.submittedById].includes(me);
  const locked = !!overview?.locked;
  const progress = batch.progress || {};
  const queued = working && (progress.stage === "queued" || data.queue?.jobStatus === "waiting");
  const behind = data.queue?.behind || progress.behind;
  // the review tabs read the rows of the latest validation
  const version = `${batch.status}-${batch.validatedAt || ""}`;

  const submit = () => {
    const validRowsOnly = batch.rowsError > 0;
    return openConfirm({
      title: t("goLive.load.submitTitle"), severity: "neutral",
      message: t("goLive.load.submitMessage", { number: batch.loadNumber, new: count(batch.rowsNew), changed: count(batch.rowsChanged) }),
      facts: [{ label: t("goLive.loads.file"), value: batch.fileName }, { label: t("goLive.result.error"), value: batch.rowsError, type: "number", hidden: !validRowsOnly }],
      note: validRowsOnly ? t("goLive.load.validRowsOnly") : null,
      confirmLabel: validRowsOnly ? t("goLive.load.submitValidRows") : t("goLive.load.submit"),
      onConfirm: async () => {
        await goLiveService.submitBatch(batch.id, validRowsOnly);
        after(t("goLive.load.submitted", { number: batch.loadNumber }));
      },
    });
  };
  const approve = () => openConfirm({
    title: t("goLive.load.approveTitle"), severity: "warning",
    message: t("goLive.load.approveMessage", { number: batch.loadNumber, records: count(records(batch)) }),
    facts: [{ label: t("goLive.loads.kit"), value: t(`goLive.kit.${batch.kit}`) }, { label: t("goLive.loads.file"), value: batch.fileName },
      { label: t("goLive.load.submittedBy"), value: batch.submittedBy }, { label: t("goLive.header.cutover"), value: batch.cutoverDate, type: "date" }],
    confirmLabel: t("goLive.load.approveLoad"),
    onConfirm: async () => {
      await goLiveService.approveBatch(batch.id);
      after(t("goLive.load.approved", { number: batch.loadNumber }));
    },
  });
  const withdraw = () => openConfirm({
    title: t("goLive.load.withdrawTitle"), severity: "warning", message: t("goLive.load.withdrawMessage", { number: batch.loadNumber }),
    confirmLabel: t("goLive.load.withdrawLoad"),
    onConfirm: async () => {
      await goLiveService.withdrawBatch(batch.id);
      after(t("goLive.load.withdrawn", { number: batch.loadNumber }));
    },
  });
  const validate = () => act(() => goLiveService.validateBatch(batch.id), t("goLive.load.validating", { number: batch.loadNumber }));
  const reconcile = () => act(async () => {
    const r = await goLiveService.createReconciliation({ runId: batch.runId });
    navigate(`${ROOT}/reconciliation/${r.id}`);
  });

  const actions = (
    <div className="go-live__actions">
      {canWrite && REVALIDATE.includes(batch.status) && batch.fileStored ? (
        <Button type="button" icon="pi pi-refresh" label={t("goLive.load.validateAgain")} outlined onClick={validate} disabled={locked && batch.kit === "migration"} />
      ) : null}
      {(batch.rowsError || batch.rowsDuplicate) && !working ? (
        <Button type="button" icon="pi pi-download" label={t("goLive.load.downloadErrors")} outlined onClick={() => download(() => goLiveService.errorsFile(batch.id))} />
      ) : null}
      {canWrite && canViewPii && batch.fileStored ? (
        <Button type="button" icon="pi pi-file-excel" label={t("goLive.load.uploadedFile")} text onClick={() => download(() => goLiveService.uploadedFile(batch.id))} />
      ) : null}
      {canWrite && (batch.status === "validated" || (batch.status === "failed" && batch.validatedAt && batch.rowsError > 0)) ? (
        <Button type="button" icon="pi pi-send" label={t("goLive.load.submit")} onClick={submit} />
      ) : null}
      {canWrite && batch.status === "pending-approval" && mine ? (
        <Button type="button" icon="pi pi-undo" label={t("goLive.load.withdrawLoad")} outlined onClick={withdraw} />
      ) : null}
      {canApprove && batch.status === "pending-approval" ? (
        <ApprovalActions initiator={makerOf(makers.load)} approveLabel={t("goLive.load.approveLoad")} rejectLabel={t("goLive.load.rejectLoad")}
          onApprove={approve} onReject={() => setRejecting(true)} />
      ) : null}
      {canWrite && batch.status === "loaded" && batch.kit === "migration" && batch.runId ? (
        <Button type="button" icon="pi pi-calculator" label={t("goLive.load.reconcile")} outlined onClick={reconcile} />
      ) : null}
    </div>
  );

  const meta = [
    { label: t("goLive.loads.kit"), value: t(`goLive.kit.${batch.kit}`) },
    { label: t("goLive.loads.legacySystem"), value: batch.legacySystem, hidden: batch.kit !== "migration" },
    { label: t("goLive.loads.uploaded"), value: `${batch.createdBy} · ${dateTimeOf(batch.createdAt)}` },
    { label: t("goLive.header.cutover"), value: batch.cutoverDate, type: "date" },
    { label: t("goLive.loads.rowsRead"), value: batch.rowsRead, type: "number" },
  ];

  return (
    <div className="go-live__stack">
      <SectionCard className="bv-loading-host">
        <Button type="button" icon="pi pi-arrow-left" text label={t("goLive.loads.title")} onClick={() => navigate(`${ROOT}/loads`)} className="go-live__back" />
        <DetailHeader title={batch.loadNumber} status={chipOf(t, "batch", batch.status)} subtitle={batch.fileName} meta={meta} actions={actions} />
        {working ? (
          <div className="go-live__progress" role="status" aria-live="polite">
            <LoadingBar active inline label={t(`goLive.load.step.${progress.step || "validate"}`)} />
            {queued ? (
              <span>{behind ? t("goLive.load.queuedBehind", { number: behind }) : t("goLive.load.queued")}</span>
            ) : (
              <>
                <span>{t(`goLive.load.step.${progress.step || "validate"}`)}{progress.sheet ? ` · ${progress.sheet}` : ""}</span>
                <ProgressMeter value={progress.total ? (100 * (progress.done || 0)) / progress.total : 0}
                  label={t("goLive.load.rowsDone", { done: count(progress.done || 0), total: count(progress.total || 0) })} width="24rem" tone="primary" />
              </>
            )}
          </div>
        ) : null}
        {batch.sameFileAs ? (
          <Message severity="warn" text={t("goLive.load.sameFile", { number: batch.sameFileAs.loadNumber, status: t(`goLive.status.batch.${batch.sameFileAs.status}`) })} />
        ) : null}
        {batch.message && !working ? <Message severity={batch.status === "failed" ? "error" : "info"} text={batch.message} /> : null}
      </SectionCard>

      <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)} className="go-live__record-tabs">
        <TabPanel header={t("goLive.load.tabs.summary")}>
          <SummaryTab batch={batch} errors={data.errors || []} totalErrors={data.totalErrors || 0} />
        </TabPanel>
        <TabPanel header={t("goLive.load.tabs.rows")}>
          <RowsTab key={version} batch={batch} />
        </TabPanel>
        <TabPanel header={t("goLive.load.tabs.duplicates", { count: batch.rowsDuplicate || 0 })}>
          <DuplicatesTab key={version} batch={batch} canResolve={canWrite} onResolved={() => after(null)} />
        </TabPanel>
        <TabPanel header={t("goLive.load.tabs.approval")}>
          <ApprovalTab batch={batch} />
        </TabPanel>
        <TabPanel header={t("goLive.load.tabs.undo")} disabled={batch.kit !== "migration"}>
          <UndoTab batch={batch} makers={makers.undo} locked={locked} onChanged={after} />
        </TabPanel>
      </TabView>
      {rejecting ? (
        <RejectDialog batch={batch} onHide={() => setRejecting(false)} onDone={() => { setRejecting(false); after(t("goLive.load.rejected", { number: batch.loadNumber })); }} />
      ) : null}
    </div>
  );
};

/** Result per sheet, timings and the rows in error. */
const SummaryTab = ({ batch, errors, totalErrors }) => {
  const { t } = useTranslation();
  const download = useDownload();
  return (
    <div className="go-live__stack">
      <DataTable value={batch.sheets || []} dataKey="sheet" size="small" emptyMessage={t("goLive.load.noSheets")}>
        <Column field="name" header={t("goLive.load.sheet")} />
        <Column header={t("goLive.load.read")} body={(s) => count(s.read)} {...num} />
        <Column header={t("goLive.result.new")} body={(s) => count((s.created || 0) + (s.proposed || 0))} {...num} />
        <Column header={t("goLive.result.changed")} body={(s) => count(s.updated)} {...num} />
        <Column header={t("goLive.result.unchanged")} body={(s) => count(s.unchanged)} {...num} />
        <Column header={t("goLive.result.duplicate")} body={(s) => count(s.duplicate)} {...num} />
        <Column header={t("goLive.result.error")} body={(s) => count(s.errors)} {...num} />
        <Column header={t("goLive.load.held")} body={(s) => count(s.held)} {...num} />
        <Column header={t("goLive.load.ignored")} body={(s) => count(s.ignored)} {...num} />
      </DataTable>
      <KeyValueGrid columns={4} items={[
        { label: t("goLive.load.validateTime"), value: duration(batch.validateMs) },
        { label: t("goLive.load.loadTime"), value: duration(batch.loadMs) },
        { label: t("goLive.load.undoTime"), value: duration(batch.undoMs) },
        { label: t("goLive.load.validatedAt"), value: batch.validatedAt, type: "datetime" },
      ]} />
      {batch.reconciliation ? (
        <div>
          <Button type="button" icon="pi pi-download" label={t("goLive.load.controlTotals")} outlined size="small"
            onClick={() => download(() => goLiveService.batchReconciliation(batch.id))} />
        </div>
      ) : null}
      {errors.length ? (
        <SectionCard title={t("goLive.load.errorsTitle", { count: totalErrors })} flush>
          <DataTable value={errors} dataKey={(e) => `${e.sheet}-${e.row}-${e.column}-${e.message}`} size="small" paginator rows={20}>
            <Column field="sheetName" header={t("goLive.load.sheet")} />
            <Column field="row" header={t("goLive.load.row")} {...num} />
            <Column field="column" header={t("goLive.load.column")} body={(e) => e.column || "—"} />
            <Column field="message" header={t("goLive.load.message")} />
          </DataTable>
        </SectionCard>
      ) : null}
    </div>
  );
};

/** Who uploaded, submitted and decided on the load, and its activity log. */
const ApprovalTab = ({ batch }) => {
  const { t } = useTranslation();
  return (
    <div className="go-live__stack">
      <KeyValueGrid columns={3} items={[
        { label: t("goLive.load.uploadedBy"), value: batch.createdBy },
        { label: t("goLive.load.submittedBy"), value: batch.submittedBy },
        { label: t("goLive.load.submittedAt"), value: batch.submittedAt, type: "datetime" },
        { label: t("goLive.load.expiresAt"), value: batch.status === "pending-approval" ? batch.expiresAt : null, type: "datetime" },
        { label: t("goLive.load.decidedBy"), value: batch.decidedBy },
        { label: t("goLive.load.decision"), value: batch.decision ? t(`goLive.load.decisions.${batch.decision}`) : null },
        { label: t("goLive.load.decidedAt"), value: batch.decidedAt, type: "datetime" },
        { label: t("goLive.load.remarks"), value: batch.decisionRemarks, span: 2 },
        { label: t("goLive.load.loadedBy"), value: batch.loadedBy },
        { label: t("goLive.loads.loadedAt"), value: batch.loadedAt, type: "datetime" },
        { label: t("goLive.load.validRowsOnlyLabel"), value: !!batch.validRowsOnly, type: "boolean" },
      ]} />
      <SectionCard title={t("goLive.common.activity")} flush>
        <RecordActivityLog entity="data_load_batch" recordId={batch.id} />
      </SectionCard>
    </div>
  );
};

export default LoadPage;
