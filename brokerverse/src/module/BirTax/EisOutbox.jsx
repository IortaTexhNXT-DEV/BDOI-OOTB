import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Toast } from "primereact/toast";
import birTaxService from "../../services/birTaxService";
import { calendarDateFormat, toIsoDate } from "../../utility/dateFormat";
import { BirTag, Kpis, PageHeader, showError, showSuccess } from "./common";
import { dateTime } from "../PeriodEnd/common";

const STATUSES = ["queued", "sending", "accepted", "rejected", "failed", "manual"];

/**
 * Accounts > Tax > E-Invoicing (EIS): the connector to the BIR Electronic Invoicing System. Status (switched on, mode,
 * endpoint, whether the credential variables are set), the outbox of e-invoice payloads with their status, attempts
 * and response, Send now, Retry, the manual fallback (export the payloads, record the reference of a manual upload)
 * and what remains with the BIR. The connector is switched on and configured in Master > Configuration (EIS).
 */
const EisOutbox = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [status, setStatus] = useState(null);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [manual, setManual] = useState(null);
  const [backlog, setBacklog] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([birTaxService.eisStatus(), birTaxService.eisSubmissions({ status: filter })]);
      setStatus(s);
      setRows(list);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  }, [filter]);
  useEffect(() => { load(); }, [load]);
  const run = async (fn, msg) => { try { const r = await fn(); if (msg) showSuccess(toast, typeof msg === "function" ? msg(r) : msg); load(); } catch (e) { showError(toast, e); } };

  const c = status?.counts || {};
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader title={t("birTax.eis")} trail={[t("birTax.eis")]} subtitle={t("birTax.eisHelp")}>
        <Dropdown value={filter} options={STATUSES.map((x) => ({ label: t(`birTax.status.${x}`), value: x }))} onChange={(e) => setFilter(e.value)} placeholder={t("birTax.allStatuses")} showClear />
        <Button icon="pi pi-send" label={t("birTax.sendNow")} onClick={() => run(() => birTaxService.eisProcess(), (r) => (r.skipped ? r.skipped : t("birTax.sentMsg", r)))} disabled={!status?.enabled} />
        <Button icon="pi pi-list" outlined label={t("birTax.queueBacklog")} onClick={() => setBacklog({ from: null, to: new Date() })} disabled={!status?.enabled} />
        <Button icon="pi pi-download" outlined label={t("birTax.exportPayloads")} onClick={() => run(() => birTaxService.eisExport())} />
      </PageHeader>
      {status && (
        <Message severity={status.enabled ? "success" : "warn"} className="w-full mb-2"
          text={status.enabled
            ? t("birTax.eisOn", { mode: status.mode, endpoint: status.endpoint || "-", creds: status.credentialsPresent ? t("birTax.set") : t("birTax.notSet") })
            : t("birTax.eisOff")} />
      )}
      <Kpis items={["queued", "accepted", "failed", "rejected", "manual"].map((k) => ({ label: t(`birTax.status.${k}`), value: c[k] || 0 }))} />
      <div className="pe-card">
        <DataTable value={rows} loading={loading} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("birTax.noRows")}>
          <Column field="invoiceNumber" header={t("birTax.invoiceNumber")} />
          <Column header={t("birTax.kind")} body={(r) => t(`birTax.eisKind.${r.kind}`)} />
          <Column header={t("birTax.statusLabel")} body={(r) => <BirTag status={r.status} />} />
          <Column field="mode" header={t("birTax.mode")} />
          <Column field="attempts" header={t("birTax.attempts")} className="bv-num" headerClassName="bv-num" />
          <Column header={t("birTax.nextAttempt")} body={(r) => (["queued", "failed"].includes(r.status) ? dateTime(r.nextAttemptAt) : "")} />
          <Column field="eisReference" header={t("birTax.eisReference")} />
          <Column field="lastError" header={t("birTax.lastError")} />
          <Column body={(r) => (
            <span className="flex gap-1">
              <Button icon="pi pi-eye" text size="small" aria-label={t("birTax.open")} onClick={() => run(async () => setDetail(await birTaxService.eisSubmission(r.id)))} />
              {["failed", "rejected"].includes(r.status) && <Button icon="pi pi-refresh" text size="small" aria-label={t("birTax.retry")} tooltip={t("birTax.retry")} onClick={() => run(() => birTaxService.eisRetry(r.id), t("birTax.requeued"))} />}
              {["queued", "failed", "rejected"].includes(r.status) && <Button icon="pi pi-upload" text size="small" aria-label={t("birTax.manualUpload")} tooltip={t("birTax.manualUpload")} onClick={() => setManual({ id: r.id, reference: "" })} />}
            </span>
          )} />
        </DataTable>
      </div>
      {status && (
        <div className="pe-card">
          <h4>{t("birTax.remainingWithBir")}</h4>
          <ul>{status.remainingWithBir.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="pe-muted">{t("birTax.eisSettingsNote", { id: status.clientIdEnv, secret: status.clientSecretEnv, key: status.signingKeyEnv })}</p>
        </div>
      )}
      <Dialog className="pe-dialog" visible={!!detail} header={detail ? `${detail.invoiceNumber} (${detail.kind})` : ""} style={{ width: "min(900px, 96vw)" }} onHide={() => setDetail(null)}>
        {detail && (
          <>
            <p className="pe-muted">SHA-256 {detail.payloadHash} · {t("birTax.signature")}: {detail.signatureAlg}</p>
            <h4>{t("birTax.payload")}</h4>
            <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", maxHeight: "22rem", overflow: "auto" }}>{JSON.stringify(detail.payload, null, 2)}</pre>
            {detail.response && (<><h4>{t("birTax.response")}</h4><pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>{JSON.stringify(detail.response, null, 2)}</pre></>)}
          </>
        )}
      </Dialog>
      <Dialog className="pe-dialog" visible={!!manual} header={t("birTax.manualUpload")} style={{ width: "min(520px, 95vw)" }} onHide={() => setManual(null)}
        footer={<div><Button label={t("periodEnd.cancel")} text onClick={() => setManual(null)} /><Button label={t("periodEnd.save")} onClick={() => run(async () => { await birTaxService.eisManual(manual.id, manual.reference); setManual(null); }, t("birTax.saved"))} disabled={!manual || manual.reference.trim().length < 3} /></div>}>
        {manual && (<><label>{t("birTax.eisReference")} *</label><InputText value={manual.reference} onChange={(e) => setManual({ ...manual, reference: e.target.value })} className="w-full" /><p className="pe-muted">{t("birTax.manualUploadNote")}</p></>)}
      </Dialog>
      <Dialog className="pe-dialog" visible={!!backlog} header={t("birTax.queueBacklog")} style={{ width: "min(520px, 95vw)" }} onHide={() => setBacklog(null)}
        footer={<div><Button label={t("periodEnd.cancel")} text onClick={() => setBacklog(null)} /><Button label={t("birTax.queue")} onClick={() => run(async () => { const r = await birTaxService.eisQueueBacklog(toIsoDate(backlog.from), toIsoDate(backlog.to)); setBacklog(null); return r; }, (r) => t("birTax.queuedMsg", r))} disabled={!backlog?.from || !backlog?.to} /></div>}>
        {backlog && (
          <div className="grid">
            <div className="col-6"><label>{t("birTax.from")}</label><Calendar value={backlog.from} onChange={(e) => setBacklog({ ...backlog, from: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" /></div>
            <div className="col-6"><label>{t("birTax.to")}</label><Calendar value={backlog.to} onChange={(e) => setBacklog({ ...backlog, to: e.value })} dateFormat={calendarDateFormat()} showIcon className="w-full" /></div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default EisOutbox;
