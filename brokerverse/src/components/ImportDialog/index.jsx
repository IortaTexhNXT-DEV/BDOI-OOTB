import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import importService from "../../services/importService";
import DateField from "../DateField";
import KeyValueGrid from "../KeyValueGrid";
import StatusChip from "../StatusChip";
import ConfirmDialog from "../ConfirmDialog";
import { HelpTip } from "../PageHeader";
import "./index.scss";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// a refusal with row errors: the API's own message above the table (the error text also lists every row)
const failure = (e) => ({ message: e.errors?.length && e.summary ? e.summary : e.message, errors: e.errors });

/** "12.4 KB" / "1.2 MB" of a file size in bytes. */
export const fileSize = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

/** Row errors of the API ({ row, column, message }, { row, message }, { path: "row 5", message: "Row 5: ..." }) in one shape. */
export const errorRows = (errors = []) => (errors || []).map((e, i) => {
  const fromPath = /^row (\d+)$/i.exec(String(e.path || ""));
  const row = e.row ?? (fromPath ? Number(fromPath[1]) : e.path ?? null);
  const message = String(e.message || e.error || "").replace(/^Row \d+: /, "");
  return { key: `${row ?? "file"}-${i}`, row, column: e.column || null, message };
});

const ErrorTable = ({ errors }) => {
  const { t } = useTranslation();
  const rows = errorRows(errors);
  if (!rows.length) return null;
  const withColumn = rows.some((r) => r.column);
  return (
    <DataTable value={rows} dataKey="key" size="small" stripedRows scrollable scrollHeight="16rem" className="import-dialog__errors">
      <Column header={t("importDialog.row")} body={(r) => r.row ?? "—"} style={{ width: "5rem" }} />
      {withColumn && <Column header={t("importDialog.column")} body={(r) => r.column || "—"} style={{ width: "10rem" }} />}
      <Column field="message" header={t("importDialog.message")} />
    </DataTable>
  );
};

/**
 * Spreadsheet import dialog shared by the master screens, the chart of accounts, the bulk uploads and the go-live
 * imports. The steps sit in one aligned grid: the sheet to upload into (when there are several), the template, the
 * go-live date (`goLiveDate`) and the file (name, size and a remove button once chosen).
 *
 * targets: [{ label, templatePath, uploadPath, validatePath? }]. With a validatePath the dialog validates first (the
 * summary from `previewFacts(result)` and the errors with row and column, nothing saved), then loads the file after the
 * confirmation that `confirmLoad(result)` describes (ConfirmDialog props). note / help: one sentence behind the help
 * icon of the title. onDone(result) is called after an upload that saved at least one row.
 */
const ImportDialog = ({ visible, onHide, title, targets, note, help, goLiveDate = false, onDone, previewFacts, confirmLoad, loadLabel }) => {
  const { t } = useTranslation();
  const [target, setTarget] = useState(targets?.[0] || null);
  const [file, setFile] = useState(null);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const input = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setTarget(targets?.[0] || null);
    setFile(null);
    setResult(null);
    setPreview(null);
    setError(null);
  }, [visible, targets]);

  const validates = !!target?.validatePath;
  const fields = () => (goLiveDate ? { goLiveDate: date } : {});
  const changed = () => { setResult(null); setPreview(null); setError(null); };

  const download = async () => {
    setError(null);
    try {
      await importService.downloadTemplate(target.templatePath);
    } catch (e) {
      setError({ message: e.message });
    }
  };

  const validate = async () => {
    setBusy("validate");
    changed();
    try {
      setPreview(await importService.upload(target.validatePath, file, fields()));
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(null);
    }
  };

  // throws again after showing the error, so a confirmation dialog stays open with it
  const load = async () => {
    setBusy("upload");
    setError(null);
    setResult(null);
    try {
      const r = await importService.upload(target.uploadPath, file, fields());
      setResult(r);
      setPreview(null);
      if (onDone && (r.created || r.updated || r.accounts)) onDone(r);
    } catch (e) {
      setError(failure(e));
      throw e;
    } finally {
      setBusy(null);
    }
  };

  const upload = () => {
    if (validates && confirmLoad) setConfirm(confirmLoad(preview, { target, date, file }));
    else load().catch(() => {});
  };

  const ready = !!(target && file && (!goLiveDate || ISO_DATE.test(date)));
  const loadReady = ready && (!validates || preview?.valid === true);
  const tip = help || note;
  const defaultFacts = (r) => [
    { label: t("importDialog.rows"), value: r.rows ?? r.total, type: "number", hidden: (r.rows ?? r.total) === undefined },
    { label: t("importDialog.errors"), value: errorRows(r.errors).length, type: "number" },
  ];
  let step = 0;
  const number = () => { step += 1; return step; };

  const header = (
    <span className="import-dialog__title">
      <span>{title}</span>
      {tip && <HelpTip text={tip} label={t("importDialog.about")} />}
    </span>
  );
  const footer = (
    <div className="import-dialog__actions">
      <Button type="button" label={t("importDialog.close")} text onClick={onHide} disabled={!!busy} />
      {validates && (
        <Button type="button" label={busy === "validate" ? t("importDialog.validating") : t("importDialog.validate")} icon="pi pi-check-square" outlined
          onClick={validate} disabled={!ready || !!busy} />
      )}
      <Button type="button" label={busy === "upload" ? t("importDialog.uploading") : loadLabel || t("importDialog.upload")} icon="pi pi-upload"
        onClick={upload} disabled={!loadReady || !!busy} />
    </div>
  );

  return (
    <>
      <Dialog header={header} footer={footer} visible={visible} onHide={onHide} style={{ width: "min(720px, 96vw)" }} className="import-dialog bv-centered" draggable={false}>
        <div className="import-dialog__steps">
          {targets?.length > 1 && (
            <div className="import-dialog__step">
              <label htmlFor="import-target" className="import-dialog__label">{t("importDialog.uploadInto")}</label>
              <div className="import-dialog__control">
                <Dropdown inputId="import-target" value={target} options={targets} optionLabel="label" className="w-full" onChange={(e) => { setTarget(e.value); changed(); }} />
              </div>
            </div>
          )}
          <div className="import-dialog__step">
            <span className="import-dialog__label"><span className="import-dialog__no">{number()}</span>{t("importDialog.template")}</span>
            <div className="import-dialog__control">
              <Button type="button" label={t("importDialog.downloadTemplate")} icon="pi pi-download" outlined size="small" className="import-dialog__button" onClick={download} disabled={!target} />
            </div>
          </div>
          {goLiveDate && (
            <div className="import-dialog__step">
              <label htmlFor="import-go-live" className="import-dialog__label"><span className="import-dialog__no">{number()}</span>{t("importDialog.goLiveDate")}</label>
              <div className="import-dialog__control import-dialog__control--date">
                <DateField id="import-go-live" value={date} onChange={(e) => { setDate(e.target.value); changed(); }} />
              </div>
            </div>
          )}
          <div className="import-dialog__step">
            <span className="import-dialog__label"><span className="import-dialog__no">{number()}</span>{t("importDialog.file")}</span>
            <div className="import-dialog__control">
              <input ref={input} type="file" accept=".xlsx,.csv" hidden data-testid="import-file"
                onChange={(e) => { setFile(e.target.files?.[0] || null); changed(); e.target.value = ""; }} />
              {file ? (
                <span className="import-dialog__file">
                  <i className="pi pi-file" aria-hidden="true" />
                  <span className="import-dialog__file-name" title={file.name}>{file.name}</span>
                  <span className="import-dialog__file-size">{fileSize(file.size)}</span>
                  <Button type="button" icon="pi pi-times" text rounded size="small" aria-label={t("importDialog.removeFile", { name: file.name })}
                    onClick={() => { setFile(null); changed(); }} disabled={!!busy} />
                </span>
              ) : (
                <>
                  <Button type="button" label={t("importDialog.chooseFile")} icon="pi pi-paperclip" outlined size="small" className="import-dialog__button" onClick={() => input.current?.click()} />
                  <span className="import-dialog__hint">{t("importDialog.fileTypes")}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {preview && (
          <section className="import-dialog__outcome" aria-label={t("importDialog.validationResult")}>
            <div className="import-dialog__outcome-title">
              <span>{t("importDialog.validationResult")}</span>
              <StatusChip label={preview.valid ? t("importDialog.valid") : t("importDialog.invalid")} severity={preview.valid ? "success" : "danger"} />
            </div>
            <KeyValueGrid columns="auto" items={previewFacts ? previewFacts(preview) : defaultFacts(preview)} />
            <ErrorTable errors={preview.errors} />
          </section>
        )}
        {result && (
          <section className="import-dialog__outcome" aria-label={t("importDialog.uploadResult")}>
            {result.message && <p className="import-dialog__message">{result.message}</p>}
            <ErrorTable errors={result.errors} />
          </section>
        )}
        {error && (
          <section className="import-dialog__outcome" role="alert">
            <p className="import-dialog__error">{error.message}</p>
            <ErrorTable errors={error.errors} />
          </section>
        )}
      </Dialog>
      {confirmLoad && (
        <ConfirmDialog visible={!!confirm} onHide={() => setConfirm(null)} confirmIcon="pi pi-upload" {...(confirm || {})} onConfirm={load} />
      )}
    </>
  );
};

ImportDialog.propTypes = {
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  title: PropTypes.node,
  targets: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, templatePath: PropTypes.string, uploadPath: PropTypes.string, validatePath: PropTypes.string })),
  note: PropTypes.node,
  help: PropTypes.node,
  goLiveDate: PropTypes.bool,
  onDone: PropTypes.func,
  previewFacts: PropTypes.func,
  confirmLoad: PropTypes.func,
  loadLabel: PropTypes.string,
};

/** Upload target of a master type (GET /masters/:type/template, POST /masters/:type/upload). */
export const masterTarget = (type, label) => ({ label, templatePath: `/masters/${type}/template?samples=true`, uploadPath: `/masters/${type}/upload` });

export default ImportDialog;
