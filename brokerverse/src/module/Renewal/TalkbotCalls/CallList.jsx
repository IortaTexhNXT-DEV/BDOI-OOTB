import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import DetailDialog from "../../../components/DetailDialog";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import LoadingBar from "../../../components/LoadingBar";
import StatCards from "../../../components/StatCards";
import StatusChip from "../../../components/StatusChip";
import RecordActivityLog from "../../../components/ActivityLog/RecordActivityLog";
import { openConfirm } from "../../../components/ConfirmDialog";
import { EmptyState, FilterBar, RowActions, SectionCard } from "../../../components/RecordPage";
import { useStableLoad } from "../../../hooks/useStableLoad";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { hasPermission } from "../../../utils/canOpen";
import { formatDate, formatInstant } from "../../../utility/dateFormat";
import talkbotService from "../../../services/talkbotService";
import { RenewalHeader } from "../shared";
import { ListStatus, NoAccess, expiryRange } from "./index";
import RecordOutcomeDialog from "./RecordOutcomeDialog";
import UploadResultsDialog from "./UploadResultsDialog";
import "./talkbot.scss";

export const OUTCOMES = ["willing", "not-willing", "already-renewed", "call-back", "wrong-contact", "uncontacted", "missed-call", "not-called"];
const OUTCOME_SEVERITY = { willing: "success", "not-willing": "danger", "already-renewed": "secondary", "call-back": "warning", "wrong-contact": "danger",
  uncontacted: "info", "missed-call": "info", "not-called": "secondary" };
const QUOTE_SEVERITY = { "in-batch": "info", quoted: "success", skipped: "warning" };

/**
 * A Talkbot call list (FR-TBT-003, 004, 006, 012, 014, 020): its accounts with their Talkbot outcome, the counts per
 * outcome, and the actions of its status: Download call list and Mark as sent (Draft), Upload results (Sent to Talkbot,
 * Results loaded), Record outcome, Create renewal batch (write:renewals), Close list and Cancel list. Mobile numbers are
 * masked; the full number is only in the downloaded file.
 */
const CallList = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useRef(null);
  const { formatCurrency } = useFormatCurrency();
  const read = hasPermission("read:talkbot-calls");
  const write = hasPermission("write:talkbot-calls");
  const canBatch = hasPermission("write:renewals");
  const [outcome, setOutcome] = useState("");
  const [search, setSearch] = useState("");
  const [lineStatus, setLineStatus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(null);
  const [calls, setCalls] = useState(null);

  const loader = useCallback(() => talkbotService.list(id, { outcome, search: search.trim(), lineStatus }), [id, outcome, search, lineStatus]);
  const { data: list, loading, refreshing, error, reload } = useStableLoad(loader, { debounceMs: 300, enabled: read });
  const uploadsLoader = useCallback(() => talkbotService.uploads(id), [id]);
  const { data: uploads, reload: reloadUploads } = useStableLoad(uploadsLoader, { enabled: read });

  const ok = (detail, severity = "success") => toast.current?.show({ severity, summary: list?.listNumber, detail, life: 5000 });
  const fail = (e) => toast.current?.show({ severity: "error", summary: t("talkbot.error"), detail: e?.message || String(e), life: 6000 });
  const refresh = () => { reload(); reloadUploads(); };
  // a confirmed action: its message as the toast, then the list again
  const confirmed = async (options, action) => {
    let message = null;
    const done = await openConfirm({ ...options, onConfirm: async (value) => { message = (await action(value))?.message; } });
    if (done) {
      ok(message);
      reload();
    }
  };

  const status = list?.status;
  const download = async () => {
    try {
      await talkbotService.download(list.id, list.listNumber);
      const after = await reload();
      ok(t("talkbot.downloaded", { count: after?.lastDownloadRows ?? list.accounts }));
      if (after?.lastDownloadDropped?.length) ok(t("talkbot.dropped", { count: after.lastDownloadDropped.length, policies: after.lastDownloadDropped.join(", ") }), "warn");
    } catch (e) {
      fail(e);
      reload();
    }
  };
  const markSent = async () => {
    const options = await talkbotService.options().catch(() => ({}));
    await confirmed({
      title: t("talkbot.markSent"), severity: "neutral", message: t("talkbot.markSentMessage", { list: list.listNumber }),
      facts: [{ label: t("talkbot.col.accounts"), value: list.accounts, type: "number" }],
      input: { type: "text", label: t("talkbot.taskName"), required: true, maxLength: 100, defaultValue: options.taskName || "" },
      confirmLabel: t("talkbot.markSent"),
    }, (taskName) => talkbotService.markSent(list.id, taskName));
  };
  const cancelList = async () => {
    await confirmed({
      title: t("talkbot.cancelList"), severity: "danger", message: t("talkbot.cancelMessage", { list: list.listNumber }),
      facts: [{ label: t("talkbot.col.status"), value: t(`talkbot.status.${status}`) }, { label: t("talkbot.col.accounts"), value: list.accounts, type: "number" }],
      reason: { context: "talkbot_list_cancel" }, confirmLabel: t("talkbot.cancelList"),
    }, (reason) => talkbotService.cancel(list.id, reason));
  };
  const closeList = async () => {
    await confirmed({
      title: t("talkbot.closeList"), severity: "neutral", message: t("talkbot.closeMessage", { list: list.listNumber }),
      confirmLabel: t("talkbot.closeList"),
    }, () => talkbotService.close(list.id));
  };
  const createBatch = async () => {
    await confirmed({
      title: t("talkbot.createBatch"), severity: "neutral", message: t("talkbot.createBatchMessage", { list: list.listNumber }),
      facts: [{ label: t("talkbot.outcomes.willing"), value: list.willing, type: "number" }],
      confirmLabel: t("talkbot.createBatch"),
    }, () => talkbotService.createRenewalBatches(list.id));
  };
  const removeLine = async (line) => {
    await confirmed({
      title: t("talkbot.removeLine"), severity: "warning", message: t("talkbot.removeMessage", { policy: line.policyNumber, client: line.clientName }),
      reason: { context: "talkbot_line_remove" }, confirmLabel: t("talkbot.removeLine"),
    }, (reason) => talkbotService.removeLine(list.id, line.id, reason));
  };
  const restoreLine = async (line) => {
    try {
      const r = await talkbotService.restoreLine(list.id, line.id);
      ok(r.message);
      reload();
    } catch (e) {
      fail(e);
    }
  };
  const showCalls = async (line) => {
    try {
      setCalls({ line, rows: await talkbotService.attempts(list.id, line.id) });
    } catch (e) {
      fail(e);
    }
  };

  const counts = list?.outcomeCounts || {};
  const figure = (key) => ({ key, label: t(`talkbot.outcomes.${key}`), value: counts[key] || 0, onClick: () => setOutcome(outcome === key ? "" : key), active: outcome === key });
  const figures = list ? [
    { key: "accounts", label: t("talkbot.col.accounts"), value: list.accounts, onClick: () => setOutcome(""), active: !outcome },
    ...OUTCOMES.map(figure),
    { key: "records", label: t("talkbot.callRecords"), value: list.callRecords },
  ] : [];

  const pageActions = list ? (
    <>
      {write && ["draft", "sent"].includes(status) ? <Button type="button" icon="pi pi-download" outlined label={t("talkbot.download")} onClick={download} /> : null}
      {/* always inside the same span: a tooltip shown on a disabled button wraps it, and swapping the wrapper breaks the page */}
      {write && status === "draft" ? (
        <span className="talkbot-action-hint" title={!list.downloads ? t("talkbot.downloadFirst") : undefined}>
          <Button type="button" icon="pi pi-send" outlined label={t("talkbot.markSent")} onClick={markSent} disabled={!list.downloads} />
        </span>
      ) : null}
      {write && ["sent", "results-loaded"].includes(status) ? <Button type="button" icon="pi pi-upload" outlined label={t("talkbot.uploadResults")} onClick={() => setUploading(true)} /> : null}
      {canBatch && status !== "cancelled" && list.willing > 0 ? <Button type="button" icon="pi pi-replay" label={t("talkbot.createBatch")} onClick={createBatch} /> : null}
      {write && status === "results-loaded" ? <Button type="button" icon="pi pi-lock" outlined label={t("talkbot.closeList")} onClick={closeList} /> : null}
      {write && ["draft", "sent"].includes(status) ? <Button type="button" icon="pi pi-times" outlined severity="danger" label={t("talkbot.cancelList")} onClick={cancelList} /> : null}
    </>
  ) : null;

  const outcomeBody = (l) => (
    <span className="talkbot-outcome">
      <StatusChip code={l.outcome} label={`${t(`talkbot.outcomes.${l.outcome}`, l.outcomeLabel)}${l.manual ? ` (${t("talkbot.manual")})` : ""}`} severity={OUTCOME_SEVERITY[l.outcome] || "info"} />
      {l.outcomeDetail ? <small className="talkbot-muted">{l.outcomeDetail}</small> : null}
    </span>
  );
  const batchBody = (l) => {
    if (l.lineStatus === "removed") return <span className="talkbot-outcome"><StatusChip code="removed" label={t("talkbot.removed")} severity="danger" /><small className="talkbot-muted">{l.removedReason}</small></span>;
    if (!l.quoteStatus) return "-";
    const text = { "in-batch": t("talkbot.inBatch", { batch: l.batchNumber || "" }), quoted: t("talkbot.quoted", { quote: l.quoteNumber || "" }), skipped: t("talkbot.skipped") }[l.quoteStatus] || l.quoteStatus;
    return <span className="talkbot-outcome"><StatusChip code={l.quoteStatus} label={text} severity={QUOTE_SEVERITY[l.quoteStatus] || "info"} />{l.skipReason ? <small className="talkbot-muted">{l.skipReason}</small> : null}</span>;
  };
  const actionsBody = (l) => (
    <RowActions actions={[{ icon: "pi pi-list", label: t("talkbot.viewCalls"), onClick: () => showCalls(l), disabled: !l.calls }]}
      menu={[
        { label: t("talkbot.recordOutcome"), icon: "pi pi-pencil", command: () => setRecording(l), hidden: !write || !["sent", "results-loaded"].includes(status) || l.lineStatus !== "active" },
        { label: t("talkbot.removeLine"), icon: "pi pi-minus-circle", command: () => removeLine(l), hidden: !write || status !== "draft" || l.lineStatus !== "active" },
        { label: t("talkbot.restoreLine"), icon: "pi pi-undo", command: () => restoreLine(l), hidden: !write || status !== "draft" || l.lineStatus !== "removed" },
        { label: t("talkbot.openPolicy"), icon: "pi pi-file", command: () => navigate(`/agent/policydetail/${l.policyId}`) },
      ]} />
  );

  if (!read) return <NoAccess />;
  if (error && !list) {
    return (
      <div className="bv-ops-page talkbot-page">
        <RenewalHeader title={t("talkbot.title")} />
        <SectionCard><EmptyState icon="pi-exclamation-circle" title={error} action={<Button type="button" label={t("talkbot.back")} text onClick={() => navigate("/renewal/talkbot")} />} /></SectionCard>
      </div>
    );
  }

  return (
    <div className="bv-ops-page talkbot-page">
      <Toast ref={toast} />
      <RenewalHeader title={list ? list.listNumber : t("talkbot.title")} actions={pageActions}
        meta={list ? (
          <>
            <ListStatus status={list.status} />
            {list.taskName ? <span>{list.taskName}</span> : null}
            <span>{expiryRange(list)}</span>
          </>
        ) : null} />
      <StatCards items={figures} className="talkbot-figures" />
      <DetailSection title={t("talkbot.details")}>
        {list ? (
          <KeyValueGrid columns={4} items={[
            { label: t("talkbot.col.expiry"), value: expiryRange(list) },
            { label: t("talkbot.createdBy"), value: [list.createdBy, formatInstant(list.createdAt)].filter(Boolean).join(" · ") },
            { label: t("talkbot.taskName"), value: list.taskName, hidden: !list.taskName },
            { label: t("talkbot.sentOn"), value: list.sentAt ? [formatInstant(list.sentAt), list.sentBy].filter(Boolean).join(" · ") : null, hidden: !list.sentAt },
            { label: t("talkbot.lastDownload"), value: list.lastDownloadAt ? t("talkbot.lastDownloadValue", { at: formatInstant(list.lastDownloadAt), count: list.lastDownloadRows }) : null, hidden: !list.lastDownloadAt },
            { label: t("talkbot.lastUpload"), value: formatInstant(list.lastUploadAt), hidden: !list.lastUploadAt },
            { label: t("talkbot.col.batch"), value: list.batchNumbers?.join(", "), hidden: !list.batchNumbers?.length },
            { label: t("talkbot.leftOut"), value: list.leftOut || t("talkbot.new.noneLeftOut") },
            { label: t("talkbot.removedCount"), value: list.removed, type: "number", hidden: !list.removed },
            { label: t("talkbot.cancelReason"), value: list.cancelReason, hidden: !list.cancelReason },
          ]} />
        ) : null}
      </DetailSection>

      <SectionCard title={t("talkbot.accounts")}>
        <FilterBar active={!!(outcome || search || lineStatus)} onClear={() => { setOutcome(""); setSearch(""); setLineStatus(""); }}>
          <span className="p-input-icon-left bv-filter-bar__search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("talkbot.lineSearchHint")} aria-label={t("talkbot.lineSearchHint")} />
          </span>
          <Dropdown value={outcome} onChange={(e) => setOutcome(e.value || "")} aria-label={t("talkbot.col.outcome")}
            options={[{ label: t("talkbot.allOutcomes"), value: "" }, ...OUTCOMES.map((o) => ({ label: t(`talkbot.outcomes.${o}`), value: o }))]} />
          <Dropdown value={lineStatus} onChange={(e) => setLineStatus(e.value || "")} aria-label={t("talkbot.lineStatus")}
            options={[{ label: t("talkbot.allLines"), value: "" }, { label: t("talkbot.onList"), value: "active" }, { label: t("talkbot.removed"), value: "removed" }]} />
        </FilterBar>
        <div className="bv-loading-host">
          <LoadingBar active={refreshing} />
          <DataTable value={list?.lines || []} dataKey="id" size="small" loading={loading && !list} paginator={(list?.lines?.length || 0) > 25} rows={25} scrollable
            emptyMessage={<EmptyState icon="pi-users" title={t("talkbot.noAccounts")} />}>
            <Column header={t("talkbot.col.contactId")} body={(l) => (
              <span className="bv-cell-stack"><span>{l.policyNumber}</span><small>{l.clientName}</small></span>
            )} />
            <Column header={t("talkbot.col.mobile")} field="mobile" />
            <Column header={t("talkbot.col.vehicle")} body={(l) => l.vehicle || "-"} />
            <Column header={t("talkbot.col.expiryDate")} body={(l) => formatDate(l.expiryDate)} />
            <Column header={t("talkbot.col.premium")} body={(l) => (l.premium === null ? "-" : formatCurrency(l.premium))} align="right" />
            <Column header={t("talkbot.col.calls")} body={(l) => (
              <span className="bv-cell-stack"><span className="talkbot-num">{l.calls}</span>{l.lastCallAt ? <small>{formatInstant(l.lastCallAt)}</small> : null}</span>
            )} align="right" />
            <Column header={t("talkbot.col.outcome")} body={outcomeBody} />
            <Column header={t("talkbot.col.batchQuote")} body={batchBody} />
            <Column header={<span className="p-sr-only">{t("talkbot.col.actions")}</span>} body={actionsBody} className="bv-actions" headerClassName="bv-actions" />
          </DataTable>
        </div>
      </SectionCard>

      {uploads?.length ? (
        <SectionCard title={t("talkbot.uploads")}>
          <DataTable value={uploads} dataKey="id" size="small">
            <Column header={t("talkbot.col.upload")} body={(u) => <span className="bv-cell-stack"><span>{u.uploadNumber}</span><small>{formatInstant(u.uploadedAt)}</small></span>} />
            <Column header={t("talkbot.col.file")} body={(u) => (u.fileAvailable && write
              ? <button type="button" className="bv-link-button" onClick={() => talkbotService.uploadFile(list.id, u).catch(fail)}>{u.fileName}</button> : u.fileName)} />
            <Column header={t("talkbot.col.uploadedBy")} body={(u) => u.uploadedBy || "-"} />
            <Column header={t("talkbot.col.rows")} body={(u) => <span className="talkbot-num">{u.total}</span>} align="right" />
            <Column header={t("talkbot.col.loaded")} body={(u) => <span className="talkbot-num">{u.loaded}</span>} align="right" />
            <Column header={t("talkbot.col.failed")} body={(u) => <span className="talkbot-num">{u.failed}</span>} align="right" />
          </DataTable>
        </SectionCard>
      ) : null}

      {list ? <SectionCard title={t("talkbot.history")}><RecordActivityLog entity="talkbot_call_list" recordId={list.id} /></SectionCard> : null}

      {list ? (
        <UploadResultsDialog visible={uploading} onHide={() => { setUploading(false); refresh(); }} list={{ id: list.id, listNumber: list.listNumber, taskName: list.taskName }} onDone={refresh} />
      ) : null}
      <RecordOutcomeDialog visible={!!recording} onHide={() => setRecording(null)} listId={list?.id} line={recording}
        onDone={(message) => { ok(message); reload(); }} />
      <DetailDialog visible={!!calls} onHide={() => setCalls(null)} header={calls ? t("talkbot.callsOf", { policy: calls.line.policyNumber }) : ""} size="lg">
        {calls ? (
          <DataTable value={calls.rows} dataKey="id" size="small">
            <Column header={t("talkbot.col.callTime")} body={(a) => formatInstant(a.callTime)} />
            <Column header={t("talkbot.col.callId")} field="callId" />
            <Column header={t("talkbot.col.result")} field="result" />
            <Column header={t("talkbot.col.callStatus")} body={(a) => a.callStatus || "-"} />
            <Column header={t("talkbot.col.callResult")} body={(a) => [a.callResult, a.dropOffPoint].filter(Boolean).join(" · ") || "-"} />
            <Column header={t("talkbot.col.callback")} body={(a) => (a.callbackDate ? formatDate(a.callbackDate) : "-")} />
            <Column header={t("talkbot.col.outcome")} body={(a) => t(`talkbot.outcomes.${a.outcome}`, a.outcome)} />
            <Column header={t("talkbot.col.upload")} body={(a) => a.uploadNumber} />
          </DataTable>
        ) : null}
      </DetailDialog>
    </div>
  );
};

export default CallList;
