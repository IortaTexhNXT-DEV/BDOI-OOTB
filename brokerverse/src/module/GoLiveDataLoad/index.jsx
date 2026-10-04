import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { SelectButton } from "primereact/selectbutton";
import { TabPanel, TabView } from "primereact/tabview";
import { Tag } from "primereact/tag";
import goLiveDataService, { errorMessage } from "../../services/goLiveDataService";
import { showErrorMessage, showSuccessMessage, showWarningMessage } from "../../utility/toastUtils";
import { formatDate } from "../../utility/dateFormat";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import CompareEnvironments from "./CompareEnvironments";
import "./index.scss";

const STATUS_SEVERITY = { validated: "info", failed: "danger", loaded: "success" };
const COUNT_KEYS = ["read", "valid", "errors", "held", "created", "updated", "unchanged", "proposed", "ignored", "skipped"];
const money = (v) => (typeof v === "number" ? v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v);
const totalsText = (o) => Object.entries(o || {}).map(([k, v]) => `${k}: ${money(v)}`).join(" · ");

/**
 * Master > Go-Live Data Load: the configuration workbook (everything needed for new business) and the migration
 * workbook (open business of the old system at cutover). Download a template (blank or with the current data),
 * upload it (validated as a dry run, nothing saved), download the rows in error, load, history and reconciliation;
 * compare environments (an export of another environment against this one, or two exports: never loads).
 */
const GoLiveDataLoad = () => {
  const { t } = useTranslation();
  const fileInput = useRef(null);
  const [catalogue, setCatalogue] = useState({ kits: [], cutoverDate: null, locked: false });
  const [kit, setKit] = useState("configuration");
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(null);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState({ items: [], total: 0 });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [validRowsOnly, setValidRowsOnly] = useState(true);
  const [passwords, setPasswords] = useState(null);
  const [confirmLoad, setConfirmLoad] = useState(false);

  const fail = async (e, key) => showErrorMessage(await errorMessage(e, t(key)), t("goLiveData.title"));

  const loadCatalogue = useCallback(async () => {
    try {
      setCatalogue(await goLiveDataService.kits());
    } catch (e) {
      showErrorMessage(await errorMessage(e, t("goLiveData.loadFailed")), t("goLiveData.title"));
    }
  }, [t]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await goLiveDataService.batches({ kit, perPage: 100 }));
    } catch (e) {
      showErrorMessage(await errorMessage(e, t("goLiveData.loadFailed")), t("goLiveData.title"));
    } finally {
      setHistoryLoading(false);
    }
  }, [kit, t]);

  useEffect(() => { loadCatalogue(); }, [loadCatalogue]);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => {
    setCurrent(null);
    setValidRowsOnly(kit === "configuration");
  }, [kit]);

  const kitInfo = catalogue.kits.find((k) => k.kit === kit);
  const kitOptions = [
    { value: "configuration", label: t("goLiveData.kitConfiguration") },
    { value: "migration", label: t("goLiveData.kitMigration") },
  ];
  const migrationBlocked = kit === "migration" && (catalogue.locked || !catalogue.cutoverDate);

  // ---------- template ----------
  const downloadTemplate = async (prefill) => {
    setBusy(prefill ? "prefill" : "blank");
    try {
      await goLiveDataService.downloadTemplate(kit, prefill);
    } catch (e) {
      await fail(e, "goLiveData.downloadFailed");
    } finally {
      setBusy(null);
    }
  };

  // ---------- upload and validate ----------
  const showResult = (r, message) => {
    setCurrent(r);
    setTab(1);
    if (r.batch.rowsError) showWarningMessage(message, t("goLiveData.title"));
    else showSuccessMessage(message, t("goLiveData.title"));
  };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("upload");
    try {
      const r = await goLiveDataService.upload(kit, file);
      showResult(r.data, r.message);
      loadHistory();
    } catch (err) {
      await fail(err, "goLiveData.uploadFailed");
    } finally {
      setBusy(null);
    }
  };
  const revalidate = async () => {
    setBusy("validate");
    try {
      const r = await goLiveDataService.validate(current.batch.id);
      showResult({ ...r.data, totalErrors: r.data.errors.length }, r.message);
      loadHistory();
    } catch (e) {
      await fail(e, "goLiveData.validateFailed");
    } finally {
      setBusy(null);
    }
  };
  const openBatch = async (row) => {
    setBusy(`open-${row.id}`);
    try {
      setCurrent(await goLiveDataService.batch(row.id));
      setTab(1);
    } catch (e) {
      await fail(e, "goLiveData.loadFailed");
    } finally {
      setBusy(null);
    }
  };
  const downloadErrors = async (id) => {
    setBusy(`errors-${id}`);
    try {
      await goLiveDataService.downloadErrors(id);
    } catch (e) {
      await fail(e, "goLiveData.downloadFailed");
    } finally {
      setBusy(null);
    }
  };
  const downloadReconciliation = async (id) => {
    setBusy(`recon-${id}`);
    try {
      await goLiveDataService.downloadReconciliation(id);
    } catch (e) {
      await fail(e, "goLiveData.downloadFailed");
    } finally {
      setBusy(null);
    }
  };

  // ---------- load ----------
  const load = async () => {
    setConfirmLoad(false);
    setBusy("load");
    try {
      const r = await goLiveDataService.load(current.batch.id, current.batch.rowsError ? validRowsOnly : false);
      setCurrent((c) => ({ ...c, batch: r.data.batch }));
      showSuccessMessage(r.message, t("goLiveData.title"));
      if (r.data.temporaryPasswords?.length) setPasswords(r.data.temporaryPasswords);
      loadHistory();
      loadCatalogue();
    } catch (e) {
      await fail(e, "goLiveData.loadBatchFailed");
      if (current?.batch?.id) goLiveDataService.batch(current.batch.id).then(setCurrent).catch(() => {});
    } finally {
      setBusy(null);
    }
  };
  const copyPasswords = async () => {
    const text = passwords.map((p) => `${p.username}\t${p.temporaryPassword}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showSuccessMessage(t("goLiveData.copied"), t("goLiveData.title"));
    } catch {
      showErrorMessage(t("goLiveData.copyFailed"), t("goLiveData.title"));
    }
  };

  const batch = current?.batch;
  const canLoad = batch && batch.status !== "loaded" && batch.rowsValid > 0 && (!batch.rowsError || validRowsOnly) && !(batch.kit === "migration" && catalogue.locked);
  const statusTag = (s) => <Tag value={t(`goLiveData.status.${s}`)} severity={STATUS_SEVERITY[s] || "secondary"} />;
  const count = (key) => (r) => (r[key] ? <span className={key === "errors" ? "golive__count--error" : undefined}>{r[key]}</span> : <span className="access__dash">0</span>);

  const iconButton = (icon, label, onClick, { disabled = false, loading = false } = {}) => (
    <Button icon={icon} text rounded size="small" className="golive__icon" aria-label={label} tooltip={label} tooltipOptions={{ position: "top" }}
      disabled={disabled} loading={loading} onClick={onClick} />
  );

  return (
    <div className="admin__page access__page golive__page">
      <BreadCrumb model={[{ label: t("goLiveData.title") }]} home={{ label: t("goLiveData.master") }} className="admin__breadcrumb" />
      <div className="admin__header">
        <h2>{t("goLiveData.title")}</h2>
        <div className="golive__header-actions">
          <Tag className="golive__chip" icon="pi pi-calendar" severity={catalogue.cutoverDate ? "info" : "warning"}
            value={catalogue.cutoverDate ? t("goLiveData.cutover", { date: formatDate(catalogue.cutoverDate) }) : t("goLiveData.noCutover")} />
          {catalogue.locked ? <Tag className="golive__chip" icon="pi pi-lock" severity="danger" value={t("goLiveData.locked")} /> : null}
          <SelectButton value={kit} options={kitOptions} allowEmpty={false} onChange={(e) => e.value && setKit(e.value)} aria-label={t("goLiveData.kit")} />
        </div>
      </div>

      <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
        <TabPanel header={t("goLiveData.tabTemplate")}>
          <div className="golive__toolbar">
            <Button icon="pi pi-file-excel" label={t("goLiveData.downloadBlank")} outlined loading={busy === "blank"} disabled={!!busy} onClick={() => downloadTemplate(false)} />
            <Button icon="pi pi-database" label={t("goLiveData.downloadCurrent")} outlined loading={busy === "prefill"} disabled={!!busy} onClick={() => downloadTemplate(true)} />
          </div>
          <DataTable value={kitInfo?.sheets || []} dataKey="key" size="small" stripedRows className="access__table" emptyMessage={t("goLiveData.noSheets")}>
            <Column header="#" body={(_, o) => o.rowIndex + 1} style={{ width: "3rem" }} />
            <Column field="name" header={t("goLiveData.colSheet")} />
            <Column field="menu" header={t("goLiveData.colScreen")} />
            <Column header={t("goLiveData.colKey")} body={(s) => s.keyColumns.map((k) => s.columns.find((c) => c.key === k)?.header || k).join(" + ")} />
            <Column header={t("goLiveData.colColumns")} body={(s) => s.columns.length} style={{ width: "6rem" }} />
            <Column header={t("goLiveData.colRequired")} body={(s) => s.columns.filter((c) => c.required).map((c) => c.header).join(", ")} />
          </DataTable>
        </TabPanel>

        <TabPanel header={t("goLiveData.tabUpload")}>
          <div className="golive__toolbar">
            <input ref={fileInput} type="file" accept=".xlsx" className="golive__file" onChange={onFile} aria-label={t("goLiveData.chooseFile")} />
            <Button icon="pi pi-upload" label={t("goLiveData.uploadValidate")} loading={busy === "upload"} disabled={!!busy || migrationBlocked} onClick={() => fileInput.current?.click()} />
            {migrationBlocked ? <span className="access__warn">{catalogue.locked ? t("goLiveData.lockedHint") : t("goLiveData.noCutoverHint")}</span> : null}
          </div>
          {batch ? (
            <>
              <div className="golive__batch">
                <div className="golive__batch-title">
                  <strong>{t("goLiveData.batch", { id: batch.id })}</strong>
                  <span className="access__muted">{batch.fileName}</span>
                  {statusTag(batch.status)}
                </div>
                <div className="golive__batch-actions">
                  {iconButton("pi pi-refresh", t("goLiveData.revalidate"), revalidate, { disabled: !!busy || batch.status === "loaded", loading: busy === "validate" })}
                  {iconButton("pi pi-file-excel", t("goLiveData.downloadErrors"), () => downloadErrors(batch.id), { disabled: !batch.rowsError || !!busy, loading: busy === `errors-${batch.id}` })}
                  {batch.reconciliation ? iconButton("pi pi-chart-bar", t("goLiveData.downloadReconciliation"), () => downloadReconciliation(batch.id), { disabled: !!busy, loading: busy === `recon-${batch.id}` }) : null}
                  {batch.rowsError && batch.status !== "loaded" ? (
                    <div className="access__toggle golive__valid-only">
                      <Checkbox inputId="gl-valid-only" checked={validRowsOnly} onChange={(e) => setValidRowsOnly(e.checked)} />
                      <label htmlFor="gl-valid-only">{t("goLiveData.validRowsOnly")}</label>
                    </div>
                  ) : null}
                  <Button icon="pi pi-check" label={t("goLiveData.load")} disabled={!canLoad || !!busy} loading={busy === "load"} onClick={() => setConfirmLoad(true)} />
                </div>
              </div>
              <div className="access__stats">
                {[["rowsRead", "statRead"], ["rowsValid", "statValid"], ["rowsError", "statErrors"]].map(([k, label]) => (
                  <div key={k} className={`access__stat golive__stat${k === "rowsError" && batch[k] ? " golive__stat--error" : ""}`}>
                    <span className="access__stat-value">{batch[k] ?? 0}</span>
                    <span className="access__stat-label">{t(`goLiveData.${label}`)}</span>
                  </div>
                ))}
              </div>
              {batch.message ? <p className="access__muted" style={{ whiteSpace: "pre-line" }}>{batch.message}</p> : null}
              <DataTable value={(batch.sheets || []).filter((s) => s.read)} dataKey="sheet" size="small" stripedRows className="access__table" emptyMessage={t("goLiveData.noRows")}>
                <Column field="name" header={t("goLiveData.colSheet")} />
                {COUNT_KEYS.map((k) => <Column key={k} header={t(`goLiveData.count.${k}`)} body={count(k)} style={{ width: "7rem" }} />)}
              </DataTable>
              {current.errors?.length ? (
                <>
                  <h3 className="golive__section">{t("goLiveData.errorsTitle", { count: current.totalErrors ?? current.errors.length })}</h3>
                  <DataTable value={current.errors} size="small" stripedRows paginator rows={20} className="access__table">
                    <Column field="sheetName" header={t("goLiveData.colSheet")} style={{ width: "12rem" }} />
                    <Column field="row" header={t("goLiveData.colRow")} style={{ width: "5rem" }} body={(r) => r.row ?? t("goLiveData.wholeSheet")} />
                    <Column field="column" header={t("goLiveData.colColumn")} style={{ width: "12rem" }} body={(r) => r.column || <span className="access__dash">-</span>} />
                    <Column field="message" header={t("goLiveData.colMessage")} />
                  </DataTable>
                </>
              ) : null}
              {batch.reconciliation ? (
                <>
                  <h3 className="golive__section">{t("goLiveData.reconciliationTitle")}</h3>
                  <DataTable value={batch.reconciliation.sheets} dataKey="sheet" size="small" stripedRows className="access__table">
                    <Column field="sheet" header={t("goLiveData.colSheet")} style={{ width: "12rem" }} />
                    <Column field="workbookRows" header={t("goLiveData.colWorkbookRows")} style={{ width: "8rem" }} />
                    <Column header={t("goLiveData.colWorkbookTotals")} body={(r) => totalsText(r.workbook)} />
                    <Column field="inBrokerVerse" header={t("goLiveData.colInSystem")} style={{ width: "8rem" }} />
                    <Column header={t("goLiveData.colSystemTotals")} body={(r) => totalsText(r.detail)} />
                  </DataTable>
                  <DataTable value={batch.reconciliation.checks} size="small" stripedRows className="access__table golive__checks">
                    <Column field="check" header={t("goLiveData.colCheck")} />
                    <Column header={t("goLiveData.colLeft")} body={(r) => money(r.left)} style={{ width: "10rem" }} />
                    <Column header={t("goLiveData.colRight")} body={(r) => money(r.right)} style={{ width: "10rem" }} />
                    <Column header={t("goLiveData.colDifference")} body={(r) => money(r.difference)} style={{ width: "9rem" }} />
                    <Column header={t("goLiveData.colResult")} style={{ width: "8rem" }}
                      body={(r) => <Tag value={r.ok ? t("goLiveData.agrees") : t("goLiveData.differs")} severity={r.ok ? "success" : "danger"} />} />
                  </DataTable>
                </>
              ) : null}
            </>
          ) : null}
        </TabPanel>

        <TabPanel header={t("goLiveData.tabHistory")}>
          <DataTable value={history.items} dataKey="id" loading={historyLoading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("goLiveData.noBatches")}>
            <Column field="id" header={t("goLiveData.colBatch")} style={{ width: "5rem" }} />
            <Column field="fileName" header={t("goLiveData.colFile")} />
            <Column header={t("goLiveData.colStatus")} body={(r) => statusTag(r.status)} style={{ width: "8rem" }} />
            <Column field="rowsRead" header={t("goLiveData.count.read")} style={{ width: "6rem" }} />
            <Column field="rowsValid" header={t("goLiveData.count.valid")} style={{ width: "6rem" }} />
            <Column header={t("goLiveData.count.errors")} body={count("rowsError")} style={{ width: "6rem" }} />
            <Column header={t("goLiveData.colUploaded")} body={(r) => (
              <div className="access__user"><span>{r.createdBy}</span><span className="access__muted">{formatDate(r.createdAt, { withTime: true, empty: "" })}</span></div>
            )} />
            <Column header={t("goLiveData.colLoaded")} body={(r) => (r.loadedAt ? (
              <div className="access__user"><span>{r.loadedBy}</span><span className="access__muted">{formatDate(r.loadedAt, { withTime: true, empty: "" })}</span></div>
            ) : <span className="access__dash">-</span>)} />
            <Column header="" style={{ width: "9rem" }} body={(r) => (
              <div className="access__row-actions">
                {iconButton("pi pi-eye", t("goLiveData.viewResult"), () => openBatch(r), { disabled: !!busy, loading: busy === `open-${r.id}` })}
                {iconButton("pi pi-file-excel", t("goLiveData.downloadErrors"), () => downloadErrors(r.id), { disabled: !r.rowsError || !!busy, loading: busy === `errors-${r.id}` })}
                {r.kit === "migration" ? iconButton("pi pi-chart-bar", t("goLiveData.downloadReconciliation"), () => downloadReconciliation(r.id), { disabled: !r.reconciliation || !!busy, loading: busy === `recon-${r.id}` }) : null}
              </div>
            )} />
          </DataTable>
        </TabPanel>

        <TabPanel header={t("goLiveData.tabCompare")}>
          <CompareEnvironments iconButton={iconButton} />
        </TabPanel>
      </TabView>

      <Dialog header={t("goLiveData.confirmLoadTitle")} visible={confirmLoad} style={{ width: "32rem" }} onHide={() => setConfirmLoad(false)}
        footer={(
          <>
            <Button label={t("goLiveData.cancel")} text onClick={() => setConfirmLoad(false)} />
            <Button label={t("goLiveData.load")} icon="pi pi-check" onClick={load} />
          </>
        )}>
        {batch ? t(batch.rowsError ? "goLiveData.confirmLoadPartial" : "goLiveData.confirmLoad", { valid: batch.rowsValid, errors: batch.rowsError, id: batch.id }) : null}
      </Dialog>

      <Dialog header={t("goLiveData.passwordsTitle")} visible={!!passwords} style={{ width: "44rem" }} closable onHide={() => setPasswords(null)}
        footer={(
          <>
            <Button label={t("goLiveData.copy")} icon="pi pi-copy" outlined onClick={copyPasswords} />
            <Button label={t("goLiveData.done")} onClick={() => setPasswords(null)} />
          </>
        )}>
        <p className="golive__warn-line"><i className="pi pi-exclamation-triangle" /> {t("goLiveData.passwordsOnce")}</p>
        <DataTable value={passwords || []} dataKey="username" size="small" stripedRows className="access__table">
          <Column field="username" header={t("goLiveData.colUsername")} />
          <Column field="displayName" header={t("goLiveData.colName")} />
          <Column header={t("goLiveData.colTemporaryPassword")} body={(r) => <span className="access__code">{r.temporaryPassword}</span>} />
        </DataTable>
      </Dialog>
    </div>
  );
};

export default GoLiveDataLoad;
