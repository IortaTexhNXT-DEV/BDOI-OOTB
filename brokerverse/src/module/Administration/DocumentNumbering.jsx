import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import numberingService from "../../services/numberingService";
import "./index.scss";

const RESET_RULES = ["yearly", "fiscal_yearly", "monthly", "never"];
const TOKENS = ["PREFIX", "YYYY", "YY", "MM", "FY", "BRANCH", "LOB", "SEQ"];
const MODULE_SEVERITY = { finance: "success", accounting: "success", policy: "info", sales: "info", renewals: "info", claims: "warning", placement: "warning" };

/** The next number the counter will issue, formatted by the server; shown in a monospace chip. */
const NumberChip = ({ value, muted }) => <code className={`dn__number${muted ? " dn__number--muted" : ""}`}>{value}</code>;

/**
 * Master > Document Numbering: every document series (quotation, policy, receipt, journal...) with its prefix,
 * format tokens, sequence digits and reset rule. Edit a series with a live preview; move the next number forward.
 */
const DocumentNumbering = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`numberingMasters.documentNumbering.${key}`, opts);
  const toast = useRef(null);
  const patternRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [module, setModule] = useState(null);
  const [status, setStatus] = useState("all");
  const [edit, setEdit] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [nextDialog, setNextDialog] = useState(null);

  const moduleLabel = (m) => k(`modules.${m}`, { defaultValue: m ? m.charAt(0).toUpperCase() + m.slice(1) : "" });
  const error = (e) => toast.current?.show({ severity: "error", summary: k("title"), detail: e.message, life: 6000 });

  const load = () => {
    setLoading(true);
    return numberingService
      .listSeries()
      .then((r) => setRows(r.data || []))
      .catch(error)
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modules = useMemo(() => [...new Set(rows.map((r) => r.module))].sort(), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!module || r.module === module) &&
        (status === "all" || (status === "active" ? r.active : !r.active)) &&
        (!q || [r.name, r.code, r.prefix].some((v) => String(v || "").toLowerCase().includes(q)))
    );
  }, [rows, search, module, status]);

  // live preview of the edit dialog (debounced, formatted by the server so it matches the issued numbers)
  useEffect(() => {
    if (!edit) return undefined;
    const handle = setTimeout(() => {
      numberingService
        .previewSeries(edit.code, {
          pattern: edit.pattern,
          prefix: edit.prefix,
          seqWidth: edit.seqWidth,
          resetRule: edit.resetRule,
          startNumber: edit.startNumber,
          branch: edit.sampleBranch,
          lob: edit.sampleLob,
        })
        .then(setPreview)
        .catch((e) => setPreview({ valid: false, errors: [{ message: e.message }] }));
    }, 300);
    return () => clearTimeout(handle);
  }, [edit]);

  const openEdit = (row) => {
    setPreview(null);
    setEdit({ ...row, description: row.description || "", sampleBranch: "", sampleLob: "" });
  };
  const set = (key, value) => setEdit((e) => ({ ...e, [key]: value }));

  const insertToken = (token) => {
    const el = patternRef.current;
    const text = `{${token}}`;
    const value = edit.pattern || "";
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    set("pattern", value.slice(0, start) + text + value.slice(end));
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        name: edit.name,
        module: edit.module,
        prefix: String(edit.prefix || "").trim(),
        pattern: String(edit.pattern || "").trim(),
        seqWidth: edit.seqWidth,
        resetRule: edit.resetRule,
        startNumber: edit.startNumber,
        active: edit.active,
        description: edit.description || null,
      };
      await numberingService.updateSeries(edit.code, body);
      toast.current?.show({ severity: "success", summary: edit.name, detail: t("numberingMasters.saved") });
      setEdit(null);
      load();
    } catch (e) {
      error(e);
    } finally {
      setSaving(false);
    }
  };

  const saveNext = async () => {
    const { row, value } = nextDialog;
    if (!value || value < row.nextNumber) return;
    setSaving(true);
    try {
      const after = await numberingService.setNextNumber(row.code, value);
      toast.current?.show({ severity: "success", summary: row.name, detail: k("setNextDone", { value: after.nextPreview }) });
      setNextDialog(null);
      load();
    } catch (e) {
      error(e);
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = [
    { label: t("numberingMasters.all"), value: "all" },
    { label: t("numberingMasters.active"), value: "active" },
    { label: t("numberingMasters.inactive"), value: "inactive" },
  ];

  const nameBody = (r) => (
    <div className="dn__name">
      <span className="dn__name-title">
        {r.name} {r.active ? null : <Tag value={t("numberingMasters.inactive")} severity="danger" className="dn__inactive" />}
      </span>
      <span className="dn__name-code">{r.code}</span>
    </div>
  );
  const actions = (r) => (
    <div className="admin__actions">
      <Button icon="pi pi-pencil" rounded text aria-label={t("numberingMasters.edit")} onClick={() => openEdit(r)} tooltip={t("numberingMasters.edit")} tooltipOptions={{ position: "top" }} />
      <Button
        icon="pi pi-forward"
        rounded
        text
        title={k("setNext")}
        aria-label={k("setNext")}
        onClick={() => setNextDialog({ row: r, value: r.nextNumber })} tooltip={k("setNext")} tooltipOptions={{ position: "top" }}
      />
    </div>
  );

  const nextRow = nextDialog?.row;
  const nextTooLow = nextDialog && (!nextDialog.value || nextDialog.value < nextRow.nextNumber);

  return (
    <div className="admin__page dn__page">
      <Toast ref={toast} />
      <BreadCrumb
        model={[{ label: k("title") }]}
        home={{ label: t("numberingMasters.master") }}
        className="admin__breadcrumb"
      />
      <div className="admin__header">
        <div>
          <h2>{k("title")}</h2>
        </div>
        <Button icon="pi pi-refresh" outlined label={t("numberingMasters.refresh")} className="dn__refresh" onClick={load} loading={loading} />
      </div>

      <div className="dn__stats">
        <div className="dn__stat">
          <span className="dn__stat-value">{rows.length}</span>
          <span className="dn__stat-label">{k("statSeries")}</span>
        </div>
        <div className="dn__stat">
          <span className="dn__stat-value">{rows.filter((r) => r.active).length}</span>
          <span className="dn__stat-label">{k("statActive")}</span>
        </div>
        <div className="dn__stat">
          <span className="dn__stat-value">{modules.length}</span>
          <span className="dn__stat-label">{k("statModules")}</span>
        </div>
      </div>

      <div className="dn__toolbar">
        <span className="p-input-icon-left dn__search">
          <i className="pi pi-search" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={k("searchPlaceholder")} aria-label={k("searchPlaceholder")} />
        </span>
        <Dropdown
          value={module}
          options={modules.map((m) => ({ label: moduleLabel(m), value: m }))}
          onChange={(e) => setModule(e.value)}
          placeholder={k("allModules")}
          showClear
          aria-label={k("module")}
          className="dn__filter"
        />
        <Dropdown value={status} options={statusOptions} onChange={(e) => setStatus(e.value)} aria-label={k("status")} className="dn__filter" />
      </div>

      <DataTable
        value={filtered}
        dataKey="code"
        loading={loading}
        stripedRows
        size="small"
        paginator
        rows={20}
        rowsPerPageOptions={[20, 50, 100]}
        sortField="module"
        sortOrder={1}
        emptyMessage={k("empty")}
        className="dn__table"
        responsiveLayout="scroll"
      >
        <Column header={k("series")} body={nameBody} sortable sortField="name" />
        <Column header={k("module")} body={(r) => <Tag value={moduleLabel(r.module)} severity={MODULE_SEVERITY[r.module] || null} />} sortable sortField="module" />
        <Column field="prefix" header={k("prefix")} sortable body={(r) => <strong>{r.prefix}</strong>} />
        <Column header={k("pattern")} body={(r) => <code className="dn__pattern">{r.pattern}</code>} />
        <Column header={k("reset")} body={(r) => <span title={k(`resetRules.${r.resetRule}`)}>{k(`resetShort.${r.resetRule}`)}</span>} />
        <Column header={k("currentNumber")} body={(r) => (r.currentValue ? r.currentValue.toLocaleString() : <span className="dn__muted">{k("none")}</span>)} className="dn__right" headerClassName="dn__right" />
        <Column header={k("nextNumber")} body={(r) => <NumberChip value={r.nextPreview} muted={!r.active} />} />
        <Column header="" body={actions} style={{ width: "6.5rem" }} frozen alignFrozen="right" />
      </DataTable>

      <Dialog
        header={edit ? k("editTitle", { name: edit.name }) : ""}
        visible={!!edit}
        onHide={() => setEdit(null)}
        style={{ width: "min(760px, 96vw)" }}
        footer={
          <div>
            <Button label={t("numberingMasters.cancel")} text onClick={() => setEdit(null)} />
            <Button label={t("numberingMasters.save")} icon="pi pi-check" onClick={save} loading={saving} disabled={preview && !preview.valid} />
          </div>
        }
      >
        {edit && (
          <div className="dn__form">
            <div className="admin__grid">
              <div className="admin__field">
                <label htmlFor="dn-name">{k("name")}</label>
                <InputText id="dn-name" value={edit.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="admin__field">
                <label htmlFor="dn-code">{k("code")}</label>
                <InputText id="dn-code" value={edit.code} disabled />
              </div>
              <div className="admin__field">
                <label htmlFor="dn-prefix">{k("prefix")}</label>
                <InputText id="dn-prefix" value={edit.prefix} maxLength={12} onChange={(e) => set("prefix", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
              </div>
              <div className="admin__field">
                <label htmlFor="dn-reset">{k("reset")}</label>
                <Dropdown inputId="dn-reset" value={edit.resetRule} options={RESET_RULES.map((r) => ({ label: k(`resetRules.${r}`), value: r }))} onChange={(e) => set("resetRule", e.value)} />
              </div>
            </div>

            <div className="admin__field dn__pattern-field">
              <label htmlFor="dn-pattern">{k("pattern")}</label>
              <InputText id="dn-pattern" ref={patternRef} value={edit.pattern} onChange={(e) => set("pattern", e.target.value)} className="dn__pattern-input" />
              <div className="dn__tokens" aria-label={k("tokens")}>
                {TOKENS.map((tok) => (
                  <Button key={tok} type="button" size="small" outlined className="dn__token" onClick={() => insertToken(tok)} tooltip={k(`tokenLabels.${tok}`)} tooltipOptions={{ position: "top" }}>
                    {`{${tok}}`}
                  </Button>
                ))}
              </div>
              <small>{k("tokenHelp")}</small>
            </div>

            <div className="admin__grid">
              <div className="admin__field">
                <label htmlFor="dn-width">{k("seqWidth")}</label>
                <InputNumber inputId="dn-width" value={edit.seqWidth} min={1} max={12} showButtons onValueChange={(e) => set("seqWidth", e.value || 1)} />
              </div>
              <div className="admin__field">
                <label htmlFor="dn-start">{k("startNumber")}</label>
                <InputNumber inputId="dn-start" value={edit.startNumber} min={1} useGrouping={false} onValueChange={(e) => set("startNumber", e.value || 1)} />
              </div>
              <div className="admin__field">
                <label htmlFor="dn-branch">{k("sampleBranch")}</label>
                <InputText id="dn-branch" value={edit.sampleBranch} placeholder="MKT" onChange={(e) => set("sampleBranch", e.target.value)} />
              </div>
              <div className="admin__field">
                <label htmlFor="dn-lob">{k("sampleLob")}</label>
                <InputText id="dn-lob" value={edit.sampleLob} placeholder="MOTOR" onChange={(e) => set("sampleLob", e.target.value)} />
              </div>
            </div>

            <div className={`dn__preview${preview && !preview.valid ? " dn__preview--invalid" : ""}`} aria-live="polite">
              <span className="dn__preview-label">{k("preview")}</span>
              {preview?.valid ? (
                <>
                  <NumberChip value={preview.preview} />
                  <span className="dn__muted">
                    {k("period")}: {preview.periodKey}
                  </span>
                </>
              ) : preview ? (
                <ul className="dn__errors">
                  {(preview.errors || []).map((e) => (
                    <li key={e.message}>{e.message}</li>
                  ))}
                </ul>
              ) : (
                <span className="dn__muted">…</span>
              )}
            </div>

            <div className="admin__grid">
              <div className="admin__field">
                <label htmlFor="dn-module">{k("module")}</label>
                <Dropdown inputId="dn-module" value={edit.module} editable options={modules.map((m) => ({ label: moduleLabel(m), value: m }))} onChange={(e) => set("module", e.value)} />
              </div>
              <div className="admin__field admin__field--inline">
                <label htmlFor="dn-active">{t("numberingMasters.active")}</label>
                <InputSwitch inputId="dn-active" checked={!!edit.active} onChange={(e) => set("active", e.value)} />
              </div>
            </div>
            <div className="admin__field">
              <label htmlFor="dn-desc">{k("description")}</label>
              <InputTextarea id="dn-desc" rows={2} autoResize value={edit.description} onChange={(e) => set("description", e.target.value)} />
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        header={nextRow ? k("setNextTitle", { name: nextRow.name }) : ""}
        visible={!!nextDialog}
        onHide={() => setNextDialog(null)}
        style={{ width: "min(480px, 95vw)" }}
        footer={
          <div>
            <Button label={t("numberingMasters.cancel")} text onClick={() => setNextDialog(null)} />
            <Button label={k("setNext")} icon="pi pi-check" onClick={saveNext} loading={saving} disabled={nextTooLow} />
          </div>
        }
      >
        {nextDialog && (
          <div className="admin__grid admin__grid--single">
            <p className="dn__help">{k("setNextHelp", { issued: nextRow.currentValue, period: nextRow.periodKey, min: nextRow.nextNumber })}</p>
            <div className="admin__field">
              <label htmlFor="dn-next">{k("nextNumber")}</label>
              <InputNumber
                inputId="dn-next"
                value={nextDialog.value}
                min={1}
                useGrouping={false}
                onValueChange={(e) => setNextDialog((d) => ({ ...d, value: e.value }))}
                className={nextTooLow ? "p-invalid" : undefined}
              />
              {nextTooLow ? <small className="dn__error">{k("setNextBelow", { min: nextRow.nextNumber })}</small> : null}
            </div>
            {nextRow.pattern.endsWith("{SEQ}") && !nextTooLow ? (
              <div className="dn__preview">
                <span className="dn__preview-label">{k("willIssue")}</span>
                <NumberChip value={nextRow.nextPreview.replace(/\d+$/, String(nextDialog.value).padStart(nextRow.seqWidth, "0"))} />
              </div>
            ) : null}
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default DocumentNumbering;
