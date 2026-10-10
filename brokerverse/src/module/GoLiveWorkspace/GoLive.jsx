import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import ApprovalActions from "../../components/ApprovalActions";
import KeyValueGrid from "../../components/KeyValueGrid";
import LoadState from "../../components/LoadState";
import LoadingBar from "../../components/LoadingBar";
import { SectionCard } from "../../components/RecordPage";
import { openConfirm } from "../../components/ConfirmDialog";
import { useStableLoad } from "../../hooks/useStableLoad";
import goLiveService from "../../services/goLiveService";
import { Chip, dateOf, dateTimeOf, makerOf, myId, useAccess, useDownload, useWorkspace } from "./shared";
import DecisionBlock from "./DecisionBlock";
import LockBlock from "./LockBlock";

/** The one-time SAP opening file of the opening balance journal: request, approval by another user, download of its files. */
const SapOpeningBlock = ({ sap, onChanged }) => {
  const { t } = useTranslation();
  const { canWrite, canApprove } = useAccess();
  const download = useDownload();
  const pending = sap.pendingRequest;
  const generated = !!(sap.journal?.sapExportedAt || sap.run);
  const request = () => openConfirm({
    title: t("goLive.sap.requestTitle"), severity: "warning", message: t("goLive.sap.requestMessage", { number: sap.journal?.journalNumber || "" }),
    facts: [{ label: t("goLive.sap.asAt"), value: sap.journal?.asAt, type: "date" }, { label: t("goLive.sap.debit"), value: sap.journal?.totalDebit, type: "amount" },
      { label: t("goLive.sap.credit"), value: sap.journal?.totalCredit, type: "amount" }],
    input: { type: "textarea", label: t("goLive.lock.reason"), required: true }, confirmLabel: t("goLive.sap.request"),
    onConfirm: async (reason) => {
      await goLiveService.requestSapOpening(reason);
      onChanged(t("goLive.sap.requested"));
    },
  });
  const approve = () => openConfirm({
    title: t("goLive.sap.approveTitle"), severity: "danger", message: t("goLive.sap.approveMessage", { number: sap.journal?.journalNumber || "" }),
    facts: [{ label: t("goLive.lock.requestedBy"), value: pending.requestedBy }, { label: t("goLive.lock.reason"), value: pending.reason }],
    confirmLabel: t("goLive.sap.generate"),
    onConfirm: async () => {
      await goLiveService.approveSapOpening();
      onChanged(t("goLive.sap.generated"));
    },
  });
  const reject = () => openConfirm({
    title: t("goLive.sap.rejectTitle"), severity: "warning", message: pending.reason, input: { type: "textarea", label: t("goLive.lock.remarks"), required: true },
    confirmLabel: t("goLive.sap.reject"),
    onConfirm: async (remarks) => {
      await goLiveService.rejectSapOpening(remarks);
      onChanged(t("goLive.sap.rejected"));
    },
  });
  const withdraw = () => openConfirm({
    title: t("goLive.sap.withdrawTitle"), severity: "warning", message: pending.reason, confirmLabel: t("goLive.sap.withdraw"),
    onConfirm: async () => {
      await goLiveService.withdrawSapOpening();
      onChanged(t("goLive.sap.withdrawn"));
    },
  });
  return (
    <SectionCard title={t("goLive.sap.title")} actions={(
      <div className="go-live__actions">
        {canWrite && !generated && !pending && sap.journal ? <Button type="button" icon="pi pi-send" label={t("goLive.sap.request")} onClick={request} disabled={!sap.locked} /> : null}
        {generated ? (
          <>
            <Button type="button" icon="pi pi-download" label={t("goLive.sap.headerFile")} outlined onClick={() => download(() => goLiveService.sapOpeningFile("header"))} />
            <Button type="button" icon="pi pi-download" label={t("goLive.sap.lineFile")} outlined onClick={() => download(() => goLiveService.sapOpeningFile("line"))} />
          </>
        ) : null}
      </div>
    )}>
      <KeyValueGrid columns={4} items={[
        { label: t("goLive.sap.journal"), value: sap.journal?.journalNumber },
        { label: t("goLive.sap.asAt"), value: sap.journal?.asAt, type: "date" },
        { label: t("goLive.sap.debit"), value: sap.journal?.totalDebit, type: "amount" },
        { label: t("goLive.sap.credit"), value: sap.journal?.totalCredit, type: "amount" },
        { label: t("goLive.sap.sentAt"), value: sap.journal?.sapExportedAt, type: "datetime" },
      ]} />
      {pending ? (
        <div className="go-live__pending">
          <KeyValueGrid columns={3} items={[
            { label: t("goLive.lock.requestedBy"), value: `${pending.requestedBy} · ${dateTimeOf(pending.requestedAt)}` },
            { label: t("goLive.lock.reason"), value: pending.reason, span: 2 },
          ]} />
          <div className="go-live__actions">
            {canWrite && pending.requestedById === myId() ? <Button type="button" label={t("goLive.sap.withdraw")} outlined onClick={withdraw} /> : null}
            {canApprove ? <ApprovalActions initiator={makerOf([pending.requestedById])} approveLabel={t("goLive.sap.generate")} rejectLabel={t("goLive.sap.reject")}
              onApprove={approve} onReject={reject} /> : null}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
};

/** Go-Live: the cutover date, the Go / No-Go of the production run, the go-live lock and the one-time SAP opening file. */
const GoLive = () => {
  const { t } = useTranslation();
  const { notify, reloadOverview } = useWorkspace();
  const { canWrite } = useAccess();
  const loader = useCallback(async () => {
    const [state, requests, runs, sap] = await Promise.all([goLiveService.goLive(), goLiveService.lockRequests(), goLiveService.runs({ kind: "production", perPage: 20 }),
      goLiveService.sapOpening()]);
    return { state, requests, run: runs.rows.find((r) => r.status !== "cancelled") || null, sap };
  }, []);
  const { data, loading, refreshing, error, reload } = useStableLoad(loader);
  const changed = (message) => {
    if (message) notify("success", message);
    reload();
    reloadOverview();
  };

  if (!data) return <LoadState loading={loading} error={error} onRetry={reload} />;
  const { state, requests, run, sap } = data;

  const changeDate = () => openConfirm({
    title: t("goLive.cutoverDate.changeTitle"), severity: "warning", message: t("goLive.cutoverDate.changeMessage"),
    facts: [{ label: t("goLive.cutoverDate.current"), value: state.cutoverDate, type: "date" }],
    input: { type: "date", label: t("goLive.cutoverDate.newDate"), required: true, defaultValue: state.cutoverDate || undefined },
    confirmLabel: t("goLive.cutoverDate.save"),
    onConfirm: async (cutoverDate) => {
      await goLiveService.setCutoverDate(cutoverDate);
      changed(t("goLive.cutoverDate.saved", { date: dateOf(cutoverDate) }));
    },
  });

  return (
    <div className="go-live__stack bv-loading-host">
      <LoadingBar active={refreshing} />
      <SectionCard title={t("goLive.cutoverDate.title")} actions={canWrite ? (
        <Button type="button" icon="pi pi-calendar" label={t("goLive.cutoverDate.change")} outlined onClick={changeDate} disabled={state.locked} />
      ) : null}>
        <KeyValueGrid columns={4} items={[
          { label: t("goLive.header.cutover"), value: state.cutoverDate, type: "date" },
          { label: t("goLive.cutoverDate.productionRun"), value: run ? `${run.runNumber} · ${run.title}` : null },
          { label: t("goLive.loads.status"), value: run ? <Chip kind="run" code={run.status} /> : null },
        ]} />
      </SectionCard>
      <DecisionBlock run={run} />
      <LockBlock state={state} requests={requests} restorePoint={run?.restorePoint} onChanged={changed} />
      {state.settings?.sapGlIncludeOpening ? <SapOpeningBlock sap={sap} onChanged={changed} /> : null}
    </div>
  );
};

export default GoLive;
