import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import emailService from "../../services/emailService";
import { formatDate as formatAppDate } from "../../utility/dateFormat";
import "./index.scss";

const STATUSES = ["queued", "sent", "failed"];
const SEVERITY = { queued: "warning", sent: "success", failed: "danger" };
const fmt = (d) => formatAppDate(d, { withTime: true });

/** Master > E-mail Outbox: every e-mail the system queued, whether it went out, and Retry for the ones that did not. */
const EmailOutbox = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [sending, setSending] = useState(null);
  const [counts, setCounts] = useState({});
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ status: null, search: "" });
  const [page, setPage] = useState({ first: 0, rows: 20 });
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await emailService.getOutbox({
        status: filters.status,
        search: filters.search.trim(),
        page: page.first / page.rows + 1,
        pageSize: page.rows,
      });
      setRows(r.data || []);
      setSending(r.sending || null);
      setCounts(r.counts || {});
      setTotal(r.total || 0);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("emailOutbox.title"), detail: e.message });
    } finally {
      setLoading(false);
    }
  }, [filters, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = async (row) => {
    setRetrying(row.id);
    try {
      const r = await emailService.retryOutbox(row.id);
      // sent: done; sending off: queued again and waiting; otherwise the new attempt failed too
      const severity = r.data?.status === "sent" ? "success" : r.sending?.active === false ? "warn" : "error";
      toast.current?.show({ severity, summary: row.subject, detail: r.message, life: 6000 });
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: row.subject, detail: e.message });
    } finally {
      setRetrying(null);
    }
  };

  const banner = () => {
    // same height as the banner until the sending status arrives, so the list below does not jump
    if (!sending) return <div className="bv-banner-placeholder" aria-hidden="true" />;
    if (sending.active) return <Message severity="success" className="w-full mb-3" text={t("emailOutbox.bannerActive")} />;
    const reasons = [
      !sending.smtpConfigured && t("emailOutbox.reasonSmtp"),
      !sending.enabled && t("emailOutbox.reasonSwitch"),
    ].filter(Boolean);
    return <Message severity="warn" className="w-full mb-3" text={`${t("emailOutbox.bannerInactive")} ${reasons.join(" ")}`} />;
  };

  const statusOptions = [{ label: t("emailOutbox.allStatuses"), value: null }, ...STATUSES.map((s) => ({ label: `${t(`emailOutbox.status.${s}`)} (${counts[s] || 0})`, value: s }))];

  return (
    <div className="admin__page">
      <Toast ref={toast} />
      <BreadCrumb model={[{ label: t("sidebar.Master") }, { label: t("emailOutbox.title") }]} home={{ icon: "pi pi-home", url: "/" }} className="admin__breadcrumb" />
      <div className="admin__header">
        <div>
          <h2>{t("emailOutbox.title")}</h2>
          <p>{t("emailOutbox.intro")}</p>
        </div>
        <Button icon="pi pi-refresh" label={t("emailOutbox.refresh")} outlined onClick={load} loading={loading} />
      </div>
      {banner()}
      <div className="flex flex-wrap gap-2 mb-3">
        <Dropdown value={filters.status} options={statusOptions} onChange={(e) => { setPage((p) => ({ ...p, first: 0 })); setFilters((f) => ({ ...f, status: e.value })); }} />
        <InputText value={filters.search} placeholder={t("emailOutbox.searchPlaceholder")}
          onChange={(e) => { setPage((p) => ({ ...p, first: 0 })); setFilters((f) => ({ ...f, search: e.target.value })); }} />
      </div>
      <DataTable value={rows} dataKey="id" stripedRows size="small" lazy paginator first={page.first} rows={page.rows} totalRecords={total}
        rowsPerPageOptions={[20, 50, 100]} onPage={(e) => setPage({ first: e.first, rows: e.rows })} loading={loading} emptyMessage={t("emailOutbox.empty")}>
        <Column header={t("emailOutbox.columns.status")} body={(r) => <Tag value={t(`emailOutbox.status.${r.status}`, r.status)} severity={SEVERITY[r.status] || "info"} />} />
        <Column field="to" header={t("emailOutbox.columns.to")} />
        <Column field="subject" header={t("emailOutbox.columns.subject")} />
        <Column header={t("emailOutbox.columns.about")} body={(r) => (r.entity ? `${r.entity} ${r.entityId || ""}` : "-")} />
        <Column field="attempts" header={t("emailOutbox.columns.attempts")} />
        <Column header={t("emailOutbox.columns.lastError")} body={(r) => r.lastError || "-"} style={{ maxWidth: "20rem", wordBreak: "break-word" }} />
        <Column header={t("emailOutbox.columns.created")} body={(r) => fmt(r.createdAt)} />
        <Column header={t("emailOutbox.columns.sent")} body={(r) => fmt(r.sentAt)} />
        <Column header="" body={(r) => (r.status === "sent" ? null : (
          <Button icon="pi pi-replay" label={t("emailOutbox.retry")} text size="small" loading={retrying === r.id} onClick={() => retry(r)} />
        ))} />
      </DataTable>
    </div>
  );
};

export default EmailOutbox;
