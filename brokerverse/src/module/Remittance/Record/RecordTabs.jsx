/**
 * The tabs of the remittance record page in R1: Lines, Payment (through the settlement voucher), Documents (server
 * XLSX and PDF, never the browser's print) and Activity (the approval summary, the activity log and Download log). Held,
 * Exceptions and Insurer come with Phase 2 and 3.
 */
import React, { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import RowActions from "../../../components/RowActions";
import StatusChip from "../../../components/StatusChip";
import { ActivityLog, fromRemittanceActivity } from "../../../components/ActivityLog";
import { canOpen } from "../../../utils/canOpen";
import { remittanceService } from "../../../services/remittanceService";
import { formatDate, money } from "../shared";

const policyPath = (policyId) => `/agent/policydetail/${policyId}`;
const num = (v) => <span className="rm-num">{money(v)}</span>;
const sum = (lines, field) => lines.reduce((s, l) => s + Number(l[field] || 0), 0);

/** A file of the API saved under its server name; the failure is shown by the caller. */
const useDownload = () => {
  const [failed, setFailed] = useState(null);
  const run = (path, name) => {
    setFailed(null);
    return remittanceService.download(path, name).catch((e) => setFailed(e.message));
  };
  return [run, failed];
};

export const LinesTab = ({ record }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lines = record.lines || [];
  const imported = lines.some((l) => l.expectedDue !== null && l.expectedDue !== undefined);
  const footer = (field) => (lines.length ? num(sum(lines, field)) : null);
  const actions = (l) => (l.policyId && canOpen(policyPath(l.policyId)) ? [{ code: "view-policy", label: t("remittance.record.lines.viewPolicy"), allowed: true }] : []);
  return (
    <DataTable value={lines} dataKey="id" size="small" scrollable className="rm-table" emptyMessage={t("remittance.record.lines.empty")}>
      <Column header={t("remittance.record.lines.policyNo")} body={(l) => <span className="rm-ref">{l.policyNo}</span>} frozen footer={t("remittance.record.lines.total")} />
      <Column header={t("remittance.record.lines.client")} body={(l) => l.insuredName || "-"} />
      <Column header={t("remittance.record.lines.product")} body={(l) => l.product || "-"} />
      <Column header={t("remittance.record.lines.effective")} body={(l) => (l.effectiveDate ? formatDate(l.effectiveDate) : "-")} />
      <Column header={t("remittance.record.lines.premium")} body={(l) => num(l.premium)} align="right" footer={footer("premium")} />
      <Column header={t("remittance.record.lines.commission")} body={(l) => num(l.commission)} align="right" footer={footer("commission")} />
      <Column header={t("remittance.record.lines.tax")} body={(l) => num(l.tax)} align="right" footer={footer("tax")} />
      <Column header={t("remittance.record.lines.due")} body={(l) => num(l.netAmount)} align="right" footer={footer("netAmount")} />
      {imported ? <Column header={t("remittance.record.lines.expected")} body={(l) => (l.expectedDue === null || l.expectedDue === undefined ? "-" : num(l.expectedDue))} align="right" /> : null}
      {imported ? <Column header={t("remittance.record.lines.variance")} body={(l) => (l.variance ? <span className="rm-num rm-variance">{money(l.variance)}</span> : "-")} align="right" /> : null}
      <Column header={t("remittance.record.lines.status")} style={{ minWidth: "7rem" }}
        body={(l) => <StatusChip label={t(`remittance.record.lines.statuses.${String(l.status || "Active").toLowerCase()}`, { defaultValue: l.status })} severity="secondary" />} />
      <Column header={<span className="p-sr-only">{t("remittance.record.lines.actions")}</span>} align="center" style={{ width: "3.5rem" }}
        body={(l) => <RowActions label={t("remittance.record.lines.actionsFor", { policy: l.policyNo })} actions={actions(l)} onAction={() => navigate(policyPath(l.policyId))} />} />
    </DataTable>
  );
};

export const PaymentTab = ({ record }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const p = record.payment;
  if (!p) return <p className="rm-tab-text">{t("remittance.record.payment.none")}</p>;
  const voucherLink = p.voucher?.link && canOpen(p.voucher.link) ? p.voucher.link : null;
  const voucherNo = voucherLink ? (
    <Button type="button" label={p.voucher.number} link className="rm-link" onClick={() => navigate(voucherLink)} />
  ) : p.voucher?.number;
  return (
    <>
      <DetailSection title={t("remittance.record.payment.voucher")}>
        <KeyValueGrid columns={4} items={[
          { label: t("remittance.record.payment.voucherNo"), value: voucherNo },
          { label: t("remittance.record.payment.voucherStatus"), value: p.voucher?.status ? <StatusChip code={p.voucher.status} /> : null },
          { label: t("remittance.record.payment.amount"), value: money(p.voucher?.amount) },
          { label: t("remittance.record.payment.settlement"), value: p.settlement?.reference },
        ]} />
      </DetailSection>
      <DetailSection title={t("remittance.record.payment.payment")}>
        <KeyValueGrid columns={4} items={[
          { label: t("remittance.record.payment.method"), value: p.method },
          { label: t("remittance.record.payment.valueDate"), value: p.valueDate ? formatDate(p.valueDate) : null },
          { label: t("remittance.record.payment.bankReference"), value: p.bankReference },
          { label: t("remittance.record.payment.paidOn"), value: p.paidOn, type: "datetime" },
        ]} />
      </DetailSection>
    </>
  );
};

export const DocumentsTab = ({ record }) => {
  const { t } = useTranslation();
  const [download, failed] = useDownload();
  const docs = record.downloads || [];
  return (
    <>
      {failed ? <p className="rm-inline-error" role="alert">{failed}</p> : null}
      <ul className="rm-documents">
        {docs.map((d) => (
          <li key={d.code}>
            <span>{t(`remittance.record.documents.${d.code}`, { defaultValue: d.label })}</span>
            <Button type="button" label={t("remittance.record.documents.download")} outlined size="small"
              aria-label={t("remittance.record.documents.downloadOf", { name: t(`remittance.record.documents.${d.code}`, { defaultValue: d.label }) })}
              onClick={() => download(d.href, d.href.split("/").pop())} />
          </li>
        ))}
        {(record.documents || []).map((d) => (
          <li key={d.key}>
            <span>{d.name}</span>
            <span className="rm-muted">{formatDate(d.uploadedAt)}</span>
          </li>
        ))}
      </ul>
      {!docs.length && !(record.documents || []).length ? <p className="rm-tab-text">{t("remittance.record.documents.none")}</p> : null}
    </>
  );
};

/** "v3 · unchanged since submission" or "v4 · changed since submission (v3)". */
const contentText = (a, t) => {
  if (!a || a.contentVersion === null || a.contentVersion === undefined) return null;
  if (a.contentUnchanged === null || a.contentUnchanged === undefined) return t("remittance.record.activity.version", { version: a.contentVersion });
  return a.contentUnchanged ? t("remittance.record.activity.unchanged", { version: a.contentVersion })
    : t("remittance.record.activity.changed", { version: a.contentVersion, submitted: a.submittedVersion });
};

export const ActivityTab = ({ record }) => {
  const { t } = useTranslation();
  const [download, failed] = useDownload();
  const a = record.approval;
  const o = a?.outcome || null;
  const decisionText = a ? t(`remittance.record.activity.decisions.${a.status}`, { defaultValue: a.status }) : null;
  return (
    <>
      {a ? (
        <DetailSection title={t("remittance.record.activity.summary")}>
          <KeyValueGrid columns={4} items={[
            { label: t("remittance.record.activity.authority"), value: `${a.authorityType} · ${money(a.amount)}` },
            { label: t("remittance.record.activity.level"), value: a.level?.label },
            { label: t("remittance.record.activity.content"), value: contentText(a, t) },
            { label: t("remittance.record.activity.decision"), value: decisionText },
            { label: t("remittance.record.activity.decidedBy"), value: o?.by?.name },
            { label: t("remittance.record.activity.decidedOn"), value: o?.decidedAt, type: "datetime" },
            { label: t("remittance.record.activity.limit"), value: o?.limitAtDecision === null || o?.limitAtDecision === undefined ? null : money(o.limitAtDecision) },
            { label: t("remittance.record.activity.limitSource"), value: o?.limitSourceLabel },
            { label: t("remittance.record.activity.reason"), value: o?.reason || o?.note, span: 2 },
          ]} />
        </DetailSection>
      ) : null}
      <DetailSection title={t("remittance.record.activity.log")}
        actions={<Button type="button" label={t("remittance.record.activity.download")} outlined size="small"
          onClick={() => download(remittanceService.remittanceActivityPath(record.id), `activity-${record.remittanceNo}.xlsx`)} />}>
        {failed ? <p className="rm-inline-error" role="alert">{failed}</p> : null}
        <ActivityLog entries={fromRemittanceActivity(record.activityLog || [])} />
      </DetailSection>
    </>
  );
};

const recordShape = PropTypes.shape({ id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]) });
LinesTab.propTypes = { record: recordShape.isRequired };
PaymentTab.propTypes = { record: recordShape.isRequired };
DocumentsTab.propTypes = { record: recordShape.isRequired };
ActivityTab.propTypes = { record: recordShape.isRequired };
