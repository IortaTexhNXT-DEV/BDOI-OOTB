import React, { useCallback, useRef, useState } from "react";
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
import { useListState, useServerList } from "../../hooks/useServerList";
import "./index.scss";

const STATUSES = ["queued", "sent", "failed"];
const SEVERITY = { queued: "warning", sent: "success", failed: "danger" };
const fmt = (d) => formatAppDate(d, { withTime: true });

/** Master > E-mail Outbox: every e-mail the system queued, whether it went out, and Retry for the ones that did not. */
const EmailOutbox = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [sending, setSending] = useState(null);
  const [counts, setCounts] = useState({});
  const [filters, setFilters] = useListState("email-outbox", { status: null, search: "" });
  const [retrying, setRetrying] = useState(null);

  // paged and searched by the server; the sending status and the counts per status come with each page
  const fetchPage = useCallback(async ({ page, pageSize }) => {
    const r = await emailService.getOutbox({ status: filters.status, search: filters.search.trim(), page, pageSize });
    setSending(r.sending || null);
    setCounts(r.counts || {});
    return { rows: r.data || [], total: r.total || 0 };
  }, [filters.status, filters.search]);
  const list = useServerList(fetchPage, { key: "email-outbox" });
  const load = list.reload;

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

  // the banner has a fixed slot: it appears with the sending status without moving the list below
  const banner = () => {
    if (!sending) return <div className="bv-banner-slot" aria-hidden="true" />;
    if (sending.active) return <div className="bv-banner-slot"><Message severity="success" className="w-full" text={t("emailOutbox.bannerActive")} /></div>;
    const reasons = [
      !sending.smtpConfigured && t("emailOutbox.reasonSmtp"),
      !sending.enabled && t("emailOutbox.reasonSwitch"),
    ].filter(Boolean);
    return <div className="bv-banner-slot"><Message severity="warn" className="w-full" text={`${t("emailOutbox.bannerInactive")} ${reasons.join(" ")}`} /></div>;
  };

  const statusOptions = [{ label: t("emailOutbox.allStatuses"), value: null }, ...STATUSES.map((s) => ({ label: `${t(`emailOutbox.status.${s}`)} (${counts[s] || 0})`, value: s }))];

  return (
    <div className="admin__page">
      <Toast ref={toast} />
      <BreadCrumb model={[{ label: t("emailOutbox.title") }]} home={{ label: t("sidebar.Master") }} className="admin__breadcrumb" />
      <div className="admin__header">
        <div>
          <h2>{t("emailOutbox.title")}</h2>
        </div>
        <Button icon="pi pi-refresh" label={t("emailOutbox.refresh")} outlined onClick={load} />
      </div>
      {banner()}
      <div className="bv-list-toolbar">
        <span className="p-input-icon-left bv-list-search">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("emailOutbox.searchPlaceholder")} aria-label={t("emailOutbox.searchPlaceholder")} onChange={(e) => setFilters({ search: e.target.value })} />
        </span>
        <Dropdown value={filters.status} options={statusOptions} onChange={(e) => setFilters({ status: e.value })} placeholder={t("emailOutbox.allStatuses")} className="bv-list-filter" aria-label={t("emailOutbox.columns.status")} />
      </div>
      <DataTable {...list.tableProps} dataKey="id" stripedRows size="small" emptyMessage={list.error || t("emailOutbox.empty")}>
        <Column header={t("emailOutbox.columns.status")} body={(r) => <Tag value={t(`emailOutbox.status.${r.status}`, r.status)} severity={SEVERITY[r.status] || "info"} />} />
        <Column header={t("emailOutbox.columns.to")} body={(r) => <span className="bv-break">{r.to}</span>} style={{ minWidth: "12rem" }} />
        <Column field="subject" header={t("emailOutbox.columns.subject")} style={{ minWidth: "16rem" }} />
        <Column header={t("emailOutbox.columns.about")} body={(r) => (r.entity ? `${r.entity} ${r.entityId || ""}` : "-")} />
        <Column header={t("emailOutbox.columns.attachments")} body={(r) => (r.attachments?.length ? (
          <span className="flex flex-column gap-1">
            {r.attachments.map((a) => <span key={a.fileName} className="white-space-nowrap"><i className="pi pi-paperclip mr-1" aria-hidden="true" />{a.fileName}</span>)}
          </span>
        ) : "-")} />
        <Column field="attempts" header={t("emailOutbox.columns.attempts")} />
        <Column header={t("emailOutbox.columns.lastError")} body={(r) => r.lastError || "-"} style={{ maxWidth: "20rem", wordBreak: "break-word" }} />
        <Column header={t("emailOutbox.columns.created")} body={(r) => fmt(r.createdAt)} />
        <Column header={t("emailOutbox.columns.sent")} body={(r) => fmt(r.sentAt)} />
        <Column header="" body={(r) => (r.status === "sent" ? null : (
          <Button icon="pi pi-replay" text rounded size="small" aria-label={t("emailOutbox.retry")} tooltip={t("emailOutbox.retry")} tooltipOptions={{ position: "top" }} loading={retrying === r.id} onClick={() => retry(r)} />
        ))} />
      </DataTable>
    </div>
  );
};

export default EmailOutbox;
