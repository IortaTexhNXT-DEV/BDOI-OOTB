import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { SelectButton } from "primereact/selectbutton";
import { Toast } from "primereact/toast";
import ConfigStatus from "../../components/ConfigStatus";
import ConfirmDialog from "../../components/ConfirmDialog";
import DateField from "../../components/DateField";
import DetailDialog from "../../components/DetailDialog";
import KeyValueGrid from "../../components/KeyValueGrid";
import LoadingBar from "../../components/LoadingBar";
import TechnicalDetails from "../../components/TechnicalDetails";
import useStableLoad from "../../hooks/useStableLoad";
import birTaxService from "../../services/birTaxService";
import { hasPermission } from "../../utils/canOpen";
import { toIsoDate } from "../../utility/dateFormat";
import { BirTag, PageHeader, TECHNICAL_ROLES, showError, showSuccess } from "./common";
import { dateTime } from "../PeriodEnd/common";
import "./tax.scss";

export const FILTERS = ["all", "queued", "failed", "rejected", "accepted", "manual"];
const RETRYABLE = ["failed", "rejected"];
const MANUAL_ALLOWED = ["queued", "failed", "rejected"];

/** Status filter options with the count of each status ("Failed 2"). */
export const filterOptions = (t, counts = {}) => {
  const total = Object.values(counts).reduce((s, n) => s + Number(n || 0), 0);
  return FILTERS.map((f) => ({ value: f, label: `${f === "all" ? t("birTax.all") : t(`birTax.status.${f}`)} ${f === "all" ? total : counts[f] || 0}` }));
};

/** One submission: facts, and the payload and the response as technical details. */
const SubmissionDetail = ({ submission, onHide }) => {
  const { t } = useTranslation();
  return (
    <DetailDialog visible onHide={onHide} size="md" className="tax-dialog" header={`${t("birTax.eisSubmission")} · ${submission.invoiceNumber}`}>
      <KeyValueGrid columns={3} items={[
        { label: t("birTax.invoiceNumber"), value: submission.invoiceNumber },
        { label: t("birTax.kind"), value: t(`birTax.eisKind.${submission.kind}`) },
        { label: t("birTax.statusLabel"), value: <BirTag status={submission.status} /> },
        { label: t("birTax.mode"), value: t(`birTax.eisMode.${submission.mode}`, { defaultValue: submission.mode }) },
        { label: t("birTax.attempts"), value: submission.attempts, type: "number", decimals: 0 },
        { label: t("birTax.eisReference"), value: submission.eisReference },
        { label: t("birTax.submittedAt"), value: dateTime(submission.submittedAt) },
        { label: t("birTax.acceptedAt"), value: dateTime(submission.acceptedAt) },
        { label: t("birTax.queuedAt"), value: dateTime(submission.createdAt) },
        { label: t("birTax.lastError"), value: submission.lastError, span: "full", hidden: !submission.lastError },
      ]} />
      <TechnicalDetails roles={TECHNICAL_ROLES} className="mt-3" blocks={[
        { label: t("birTax.payloadHash"), text: `SHA-256 ${submission.payloadHash} · ${submission.signatureAlg}` },
        { label: t("birTax.payload"), text: JSON.stringify(submission.payload, null, 2) },
        ...(submission.response ? [{ label: t("birTax.response"), text: JSON.stringify(submission.response, null, 2) }] : []),
      ]} />
    </DetailDialog>
  );
};

/**
 * Accounts > Tax > E-Invoicing (EIS): whether the connection to the BIR Electronic Invoicing System is set up (a
 * configuration chip, with the Configure link for administrators), the outbox of e-invoices with a status filter,
 * Send now, Retry, Queue earlier invoices and the manual fallback (export the payloads, record the reference of a
 * manual upload).
 */
const EisOutbox = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [manual, setManual] = useState(null);
  const [backlog, setBacklog] = useState(null);
  const [backlogBusy, setBacklogBusy] = useState(false);
  const canWrite = hasPermission("write:period-end");

  const status = useStableLoad(useCallback(() => birTaxService.eisStatus(), []));
  const list = useStableLoad(useCallback(() => birTaxService.eisSubmissions({ status: filter === "all" ? undefined : filter }), [filter]), { initialData: [] });
  const reload = () => { status.reload(); list.reload(); };
  const run = async (fn, msg) => {
    try {
      const r = await fn();
      if (msg) showSuccess(toast, typeof msg === "function" ? msg(r) : msg);
      reload();
    } catch (e) {
      showError(toast, e);
    }
  };
  const sendNow = () => run(() => birTaxService.eisProcess(), (r) => (r.skipped ? t("birTax.eisOffMsg") : t("birTax.sentMsg", r)));
  const queueBacklog = async () => {
    setBacklogBusy(true);
    try {
      const r = await birTaxService.eisQueueBacklog(backlog.from, backlog.to);
      showSuccess(toast, t("birTax.queuedMsg", r));
      setBacklog(null);
      reload();
    } catch (e) {
      showError(toast, e);
    } finally {
      setBacklogBusy(false);
    }
  };

  const s = status.data;
  const enabled = !!s?.enabled;
  const setup = s?.setup || { state: "off", missing: [] };
  const rows = list.data || [];
  return (
    <div className="pe-page tax-page">
      <Toast ref={toast} />
      <PageHeader title={t("birTax.eis")} trail={[t("birTax.eis")]} subtitle={t("birTax.eisHelp")}>
        {canWrite && enabled && <Button icon="pi pi-send" label={t("birTax.sendNow")} onClick={sendNow} />}
        {canWrite && enabled && <Button icon="pi pi-list" outlined label={t("birTax.queueBacklog")} onClick={() => setBacklog({ from: "", to: toIsoDate(new Date()) })} />}
        <Button icon="pi pi-download" outlined label={t("birTax.exportPayloads")} onClick={() => run(() => birTaxService.eisExport())} />
      </PageHeader>
      {s && (
        <div className="tax-facts">
          <ConfigStatus state={setup.state} feature={t("birTax.eisConnection")} missing={setup.missing.map((m) => t(`birTax.eisMissing.${m}`))} area="accounting" />
          <span><span className="tax-fact__label">{t("birTax.mode")}</span><span className="tax-fact__value">{t(`birTax.eisMode.${s.mode}`, { defaultValue: s.mode })}</span></span>
          <span><span className="tax-fact__label">{t("birTax.lastSent")}</span><span className="tax-fact__value">{dateTime(s.lastSentAt)}</span></span>
        </div>
      )}

      <div className="pe-card bv-loading-host">
        <LoadingBar active={list.refreshing} />
        <div className="pe-card-title">
          <span>{t("birTax.outbox")}</span>
          <SelectButton className="tax-status-filter" value={filter} options={filterOptions(t, s?.counts)} onChange={(e) => e.value && setFilter(e.value)} allowEmpty={false} />
        </div>
        <DataTable value={rows} loading={list.loading} dataKey="id" size="small" stripedRows paginator={rows.length > 20} rows={20} emptyMessage={t("birTax.outboxEmpty")}>
            <Column field="invoiceNumber" header={t("birTax.invoiceNumber")} />
            <Column header={t("birTax.kind")} body={(r) => t(`birTax.eisKind.${r.kind}`)} />
            <Column header={t("birTax.statusLabel")} body={(r) => <BirTag status={r.status} />} />
            <Column header={t("birTax.mode")} body={(r) => t(`birTax.eisMode.${r.mode}`, { defaultValue: r.mode })} />
            <Column field="attempts" header={t("birTax.attempts")} className="bv-num" headerClassName="bv-num" />
            <Column header={t("birTax.nextAttempt")} body={(r) => (["queued", "failed"].includes(r.status) ? dateTime(r.nextAttemptAt) : "")} />
            <Column field="eisReference" header={t("birTax.eisReference")} />
            <Column header={t("birTax.lastError")} body={(r) => (r.lastError ? <span className="tax-ellipsis" title={r.lastError}>{r.lastError}</span> : "")} />
            <Column style={{ width: "8rem" }} body={(r) => (
              <span className="flex gap-1 justify-content-end">
                <Button icon="pi pi-eye" text size="small" aria-label={t("birTax.open")} tooltip={t("birTax.open")}
                  onClick={() => birTaxService.eisSubmission(r.id).then(setDetail).catch((e) => showError(toast, e))} />
                {canWrite && RETRYABLE.includes(r.status) && (
                  <Button icon="pi pi-refresh" text size="small" aria-label={t("birTax.retry")} tooltip={t("birTax.retry")} onClick={() => run(() => birTaxService.eisRetry(r.id), t("birTax.requeued"))} />
                )}
                {canWrite && MANUAL_ALLOWED.includes(r.status) && (
                  <Button icon="pi pi-upload" text size="small" aria-label={t("birTax.recordManualUpload")} tooltip={t("birTax.recordManualUpload")} onClick={() => setManual(r)} />
                )}
              </span>
            )} />
          </DataTable>
        {list.error ? <div className="pe-error" role="alert">{list.error}</div> : null}
      </div>

      {detail && <SubmissionDetail submission={detail} onHide={() => setDetail(null)} />}
      <ConfirmDialog visible={!!manual} title={t("birTax.recordManualUpload")} confirmLabel={t("birTax.recordManualUpload")}
        facts={manual ? [{ label: t("birTax.invoiceNumber"), value: manual.invoiceNumber }, { label: t("birTax.kind"), value: t(`birTax.eisKind.${manual.kind}`) }] : []}
        input={{ type: "text", label: t("birTax.eisReference"), required: true, minLength: 3, maxLength: 100 }}
        onConfirm={(reference) => birTaxService.eisManual(manual.id, reference.trim())}
        onHide={(r) => { setManual(null); if (r?.confirmed) { showSuccess(toast, t("birTax.saved")); reload(); } }} />
      <Dialog className="pe-dialog bv-centered tax-dialog" visible={!!backlog} header={t("birTax.queueBacklog")} style={{ width: "min(520px, 95vw)" }} onHide={() => !backlogBusy && setBacklog(null)}
        footer={(
          <div>
            <Button label={t("periodEnd.cancel")} text disabled={backlogBusy} onClick={() => setBacklog(null)} />
            <Button label={t("birTax.queueInvoices")} loading={backlogBusy} onClick={queueBacklog} disabled={!backlog?.from || !backlog?.to} />
          </div>
        )}>
        {backlog && (
          <div className="grid">
            <div className="col-6 tax-field"><label htmlFor="eis-from">{t("birTax.from")}</label>
              <DateField id="eis-from" value={backlog.from} max={backlog.to || undefined} onChange={(e) => setBacklog({ ...backlog, from: e.target.value })} /></div>
            <div className="col-6 tax-field"><label htmlFor="eis-to">{t("birTax.to")}</label>
              <DateField id="eis-to" value={backlog.to} min={backlog.from || undefined} onChange={(e) => setBacklog({ ...backlog, to: e.target.value })} /></div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default EisOutbox;
