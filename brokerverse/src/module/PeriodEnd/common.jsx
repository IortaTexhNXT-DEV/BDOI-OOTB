import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Tag } from "primereact/tag";
import SharedPageHeader from "../../components/PageHeader";
import periodEndService from "../../services/periodEndService";
import { formatCurrency } from "../../utility/currencyConverter";
import { formatDate } from "../../utility/dateFormat";
import "./index.scss";

export const money = (v) => (v === null || v === undefined || v === "" ? "" : formatCurrency(Number(v)));
export const date = (v) => (v ? formatDate(v) : "-");
export const dateTime = (v) => (v ? formatDate(v, { withTime: true }) : "-");
export const showError = (toast, e) => toast.current?.show({ severity: "error", summary: "Error", detail: e.message, life: 7000 });
export const showSuccess = (toast, detail) => toast.current?.show({ severity: "success", summary: "Done", detail, life: 5000 });

const SEVERITY = {
  open: "success", soft_closed: "warning", closed: "danger", locked: "secondary", closing: "warning",
  draft: "info", "in-progress": "info", blocked: "danger", ready: "success", "pending-approval": "warning", "soft-closed": "warning", cancelled: "secondary",
  checked: "success", reversed: "secondary", passed: "success", failed: "danger", warning: "warning", "not-applicable": "secondary", pending: "info", "signed-off": "success",
  done: "success", skipped: "secondary", active: "success", undone: "secondary", posted: "success", inactive: "secondary", completed: "secondary", issued: "success",
};

/** Status chip with a translated label (periodEnd.status.<status>). */
export const StatusTag = ({ status }) => {
  const { t } = useTranslation();
  if (!status) return null;
  return <Tag className="pe-tag" value={t(`periodEnd.status.${status}`, { defaultValue: String(status).replace(/[_-]/g, " ") })} severity={SEVERITY[status] || "info"} />;
};

/** Page title, breadcrumb (Accounts > Period End (or `section`) > page), help icon (`subtitle`) and action buttons. */
export const PageHeader = ({ section, ...props }) => {
  const { t } = useTranslation();
  return <SharedPageHeader home={t("periodEnd.accounts")} {...props} section={section || t("periodEnd.menu")} />;
};

/** Journal lines of a journal (opened from the journal number links). */
export const JournalDialog = ({ journal, onHide }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!journal) return;
    setRows(null);
    setError(null);
    periodEndService.journalLines(journal.journalNumber).then(setRows).catch((e) => setError(e.message));
  }, [journal]);
  const debit = (rows || []).reduce((s, r) => s + Number(r.debit || 0), 0);
  const credit = (rows || []).reduce((s, r) => s + Number(r.credit || 0), 0);
  return (
    <Dialog header={journal ? `${t("periodEnd.journal")} ${journal.journalNumber}` : ""} visible={!!journal} onHide={onHide} style={{ width: "min(960px, 96vw)" }} className="pe-dialog">
      {journal && (
        <div className="pe-journal-meta">
          <span>{date(journal.date)}</span>
          {journal.period && <span>{t("periodEnd.period")} {journal.period}</span>}
          <StatusTag status={journal.journalStatus || journal.status} />
          <span className="pe-muted">{journal.description}</span>
        </div>
      )}
      {error && <div className="pe-error">{error}</div>}
      <DataTable value={rows || []} loading={!rows && !error} size="small" stripedRows emptyMessage={t("periodEnd.noRows")}>
        <Column field="accountCode" header={t("periodEnd.account")} style={{ width: "8rem" }} />
        <Column field="accountName" header={t("periodEnd.accountName")} />
        <Column field="description" header={t("periodEnd.memo")} />
        <Column header={t("periodEnd.debit")} body={(r) => (Number(r.debit) ? money(r.debit) : "")} className="bv-num" headerClassName="bv-num" footer={money(debit)} footerClassName="bv-num" />
        <Column header={t("periodEnd.credit")} body={(r) => (Number(r.credit) ? money(r.credit) : "")} className="bv-num" headerClassName="bv-num" footer={money(credit)} footerClassName="bv-num" />
      </DataTable>
    </Dialog>
  );
};

/** Clickable journal number. */
export const JournalLink = ({ journal, onOpen }) => (journal?.journalNumber ? (
  <button type="button" className="pe-link" onClick={() => onOpen(journal)}>{journal.journalNumber}</button>
) : null);

export const currentPeriod = () => new Date().toISOString().slice(0, 7);
export const previousPeriod = () => {
  const d = new Date();
  const p = new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1));
  return p.toISOString().slice(0, 7);
};
