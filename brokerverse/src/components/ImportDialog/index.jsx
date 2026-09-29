import React, { useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import importService from "../../services/importService";
import "./index.scss";

/**
 * Spreadsheet import dialog shared by the master screens, the chart of accounts and the go-live imports.
 *
 * targets: [{ label, templatePath, uploadPath }] (a dropdown appears when there are several, e.g. Vehicle: brand,
 * model, variant, vehicle). goLiveDate: ask for the go-live date and send it with the file. note: text above the form.
 * onDone(result) is called after an upload that saved at least one row.
 */
const ImportDialog = ({ visible, onHide, title, targets, note, goLiveDate = false, onDone }) => {
  const [target, setTarget] = useState(targets?.[0] || null);
  const [file, setFile] = useState(null);
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const input = useRef(null);

  useEffect(() => {
    if (!visible) return;
    setTarget(targets?.[0] || null);
    setFile(null);
    setResult(null);
    setError(null);
  }, [visible, targets]);

  const download = async () => {
    setError(null);
    try {
      await importService.downloadTemplate(target.templatePath);
    } catch (e) {
      setError(e.message);
    }
  };

  const upload = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await importService.upload(target.uploadPath, file, goLiveDate ? { goLiveDate: date } : {});
      setResult(r);
      if (onDone && (r.created || r.updated || r.accounts)) onDone(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const ready = target && file && (!goLiveDate || /^\d{4}-\d{2}-\d{2}$/.test(date));
  return (
    <Dialog header={title} visible={visible} onHide={onHide} style={{ width: "min(720px, 96vw)" }} className="import-dialog">
      {note && <p className="import-dialog__note">{note}</p>}
      {targets?.length > 1 && (
        <div className="import-dialog__field">
          <label htmlFor="import-target">Upload into</label>
          <Dropdown inputId="import-target" value={target} options={targets} optionLabel="label" onChange={(e) => { setTarget(e.value); setResult(null); }} />
        </div>
      )}
      <div className="import-dialog__field">
        <span>1. Download the template, fill in the Data sheet and delete the sample rows.</span>
        <Button type="button" label="Download template" icon="pi pi-download" className="p-button-outlined p-button-sm" onClick={download} disabled={!target} />
      </div>
      {goLiveDate && (
        <div className="import-dialog__field">
          <label htmlFor="import-go-live">Go-live date (first day of live transactions)</label>
          <InputText id="import-go-live" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      )}
      <div className="import-dialog__field">
        <span>2. Choose the filled file (.xlsx or .csv).</span>
        <input ref={input} type="file" accept=".xlsx,.csv" hidden onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); e.target.value = ""; }} />
        <Button type="button" label={file ? file.name : "Choose file"} icon="pi pi-file" className="p-button-text p-button-sm" onClick={() => input.current?.click()} />
      </div>
      <div className="import-dialog__actions">
        <Button type="button" label="Close" className="p-button-text" onClick={onHide} />
        <Button type="button" label={busy ? "Uploading..." : "Upload"} icon="pi pi-upload" onClick={upload} disabled={!ready || busy} />
      </div>
      {error && <div className="import-dialog__error" role="alert">{error}</div>}
      {result && (
        <div className="import-dialog__result">
          <p>{result.message}</p>
          {result.errors?.length > 0 && (
            <table>
              <thead><tr><th>Row</th><th>Problem</th></tr></thead>
              <tbody>
                {result.errors.map((e, i) => (
                  <tr key={`${e.row}-${i}`}><td>{e.row ?? e.path}</td><td>{e.message || e.error}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Dialog>
  );
};

/** Upload target of a master type (GET /masters/:type/template, POST /masters/:type/upload). */
export const masterTarget = (type, label) => ({ label, templatePath: `/masters/${type}/template?samples=true`, uploadPath: `/masters/${type}/upload` });

export default ImportDialog;
