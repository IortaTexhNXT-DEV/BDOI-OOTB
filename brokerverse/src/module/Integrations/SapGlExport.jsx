import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import service from "../../services/integrationsService";
import { useServerList } from "../../hooks/useServerList";
import { PageHeader, date, dateTime, isoDay, money, showError, showSuccess } from "./common";
import { openConfirm } from "../../components/ConfirmDialog";
import { calendarDateFormat, formatDate } from "../../utility/dateFormat";

const STATUSES = ["done", "empty", "failed", "running"];
const SEVERITY = { done: "success", empty: "secondary", failed: "danger", running: "info" };

/**
 * Accounts > SAP GL Export (TIS-BRD-INTG-04): the daily SAP GL header and line files written at the cut-off by the job
 * sap-gl-export, run now or re-generated for a day, and downloaded as written. The folder, cut-off and record layout
 * are settings (Master > Configuration, group integrations).
 */
const SapGlExport = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [status, setStatus] = useState(null);
  const [day, setDay] = useState(new Date());
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(null);
  const fetchPage = useCallback(({ page, pageSize }) => service.sapGlRuns({ status, page, pageSize }), [status]);
  const list = useServerList(fetchPage, { key: "sap-gl-runs" });
  useEffect(() => { service.sapGlSettings().then(setSettings).catch(() => setSettings(null)); }, []);
  const run = async () => {
    const iso = isoDay(day);
    const earlier = (list.rows || []).filter((r) => r.exportDate === iso && r.status !== "failed");
    let out = null;
    setBusy(true);
    const done = await openConfirm({
      title: t(earlier.length ? "sapGl.confirm.regenerateTitle" : "sapGl.confirm.runTitle"),
      severity: earlier.length ? "warning" : "neutral",
      message: t(earlier.length ? "sapGl.confirm.regenerateMessage" : "sapGl.confirm.runMessage"),
      facts: [
        { label: t("sapGl.exportDate"), value: iso, type: "date" },
        { label: t("sapGl.folder"), value: settings?.exportDir || settings?.folder, hidden: !settings },
        { label: t("sapGl.cutOff"), value: settings?.cutOff, hidden: !settings },
        { label: t("sapGl.previousRuns"), value: earlier.length, type: "number", decimals: 0, hidden: !earlier.length },
        { label: t("sapGl.lastJournals"), value: earlier[0] ? `${earlier[0].journalCount} / ${earlier[0].lineCount}` : null, hidden: !earlier.length },
        { label: t("sapGl.lastDebit"), value: earlier[0]?.totalDebit, type: "amount", hidden: !earlier.length },
        { label: t("sapGl.lastCredit"), value: earlier[0]?.totalCredit, type: "amount", hidden: !earlier.length },
      ],
      confirmLabel: t(earlier.length ? "sapGl.confirm.regenerateAction" : "sapGl.confirm.runAction"),
      onConfirm: async () => {
        out = await service.runSapGl(iso);
      },
    });
    setBusy(false);
    if (!done) return;
    const r = out?.data || out || {};
    showSuccess(toast, r.status === "empty" ? t("sapGl.nothingPosted", { date: formatDate(iso) }) : t("sapGl.written", { date: formatDate(iso), n: r.runNo }));
    list.reload();
  };
  // a setting named in a warning ("(sap_gl.account_pattern)") is configuration detail, not something to act on here
  const warningText = (w) => String(w).replace(/\s*\([a-z_]+(\.[a-z_]+)+\)/g, "");
  const download = (r, kind) => {
    const f = r.files.find((x) => x.kind === kind);
    service.downloadSapGlFile(r.id, kind, f?.fileName).catch((e) => showError(toast, e));
  };
  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("sidebar.Accounts")} section={t("sidebar.Accounts")} title={t("sapGl.title")} subtitle={t("sapGl.intro")}>
        <Calendar value={day} onChange={(e) => setDay(e.value)} dateFormat={calendarDateFormat()} maxDate={new Date()} aria-label={t("sapGl.exportDate")} />
        <Button icon="pi pi-play" label={t("sapGl.runNow")} loading={busy} disabled={!day} onClick={run} />
      </PageHeader>
      {settings && (
        <Message severity="info" className="w-full mb-2"
          text={t("sapGl.settingsLine", { folder: settings.exportDir || settings.folder, cutOff: settings.cutOff, format: settings.layout?.format || "-" })} />
      )}
      <div className="pe-card">
        <div className="pe-filters mb-2">
          <Dropdown value={status} showClear placeholder={t("sapGl.allStatuses")} aria-label={t("sapGl.status")} options={STATUSES.map((s) => ({ label: t(`sapGl.statuses.${s}`), value: s }))}
            onChange={(e) => setStatus(e.value)} />
        </div>
        <DataTable {...list.tableProps} dataKey="id" size="small" stripedRows emptyMessage={list.error || t("sapGl.noRuns")}>
          <Column header={t("sapGl.exportDate")} body={(r) => <div><div>{date(r.exportDate)}</div><div className="pe-muted">{t("sapGl.runNo", { n: r.runNo })}</div></div>} />
          <Column header={t("sapGl.window")} body={(r) => <div className="pe-muted">{dateTime(r.windowFrom)} - {dateTime(r.windowTo)}</div>} />
          <Column header={t("sapGl.status")} body={(r) => <Tag className="pe-tag" value={t(`sapGl.statuses.${r.status}`)} severity={SEVERITY[r.status] || "info"} />} />
          <Column header={t("sapGl.lines")} body={(r) => `${r.journalCount} / ${r.lineCount}`} />
          <Column header={t("sapGl.debit")} body={(r) => money(r.totalDebit)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("sapGl.credit")} body={(r) => money(r.totalCredit)} className="bv-num" headerClassName="bv-num" />
          <Column header={t("sapGl.trigger")} body={(r) => <div><div>{t(`sapGl.triggers.${r.trigger}`)}</div><div className="pe-muted">{r.createdBy || ""}</div></div>} />
          <Column header={t("sapGl.notes")} body={(r) => (r.error || (r.warnings || []).map(warningText).join("; ") || "-")} />
          <Column header={t("sapGl.files")} body={(r) => (r.files.length ? (
            <div className="flex gap-1">
              {r.files.map((f) => (
                <Button key={f.kind} icon="pi pi-download" label={f.fileName} text size="small" onClick={() => download(r, f.kind)} />
              ))}
            </div>
          ) : "-")} />
        </DataTable>
      </div>
    </div>
  );
};

export default SapGlExport;
