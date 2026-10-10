import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Message } from "primereact/message";
import { HelpTip } from "../../components/PageHeader";
import importService from "../../services/importService";
import { useLabels } from "./common";

/**
 * Upload of the Authority Matrix: download the matrix as it is (the template), change the limits in it and choose
 * the file. The server checks every row without saving; a file with problems lists them by row, transaction and
 * role; a file without problems goes to the review (onChecked) and is then sent for approval.
 *
 * target: { templatePath, uploadPath } (accessControlService.authorityUploadTarget).
 */
const AuthorityUploadDialog = ({ visible, target, onHide, onChecked }) => {
  const k = useLabels();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setFile(null);
    setError(null);
    setResult(null);
  }, [visible]);

  const download = async () => {
    setError(null);
    try {
      await importService.downloadTemplate(target.templatePath, "authority-matrix.xlsx");
    } catch (e) {
      setError(e.message);
    }
  };
  const check = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await importService.upload(target.uploadPath, file);
      if (r.updated) onChecked(r);
      else setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <div className="am-panel__footer">
      <span />
      <span className="rp-actions">
        <Button label={k("cancel", "Cancel")} text onClick={onHide} disabled={busy} />
        <Button label={k("authority.checkFile", "Check the file")} icon="pi pi-check-square" onClick={check} loading={busy} disabled={!file} />
      </span>
    </div>
  );

  return (
    <Dialog visible={visible} onHide={onHide} modal className="am-panel am-upload" style={{ width: "min(40rem, 96vw)" }} footer={footer}
      header={(
        <span className="am-upload__title">
          {k("authority.uploadTitle", "Upload approval limits")}
          <HelpTip text={k("authority.uploadHelp", "The template is the matrix as it is today. Change the limits you want to change, keep the other rows as they are and upload the file: every row is checked before anything is sent for approval.")}
            label={k("authority.uploadHelpLabel", "About the upload")} />
        </span>
      )}>
      <ol className="am-upload__steps">
        <li>
          <span>{k("authority.uploadStep1", "Download the matrix as it is")}</span>
          <Button label={k("authority.downloadTemplate", "Download template")} icon="pi pi-download" outlined size="small" className="am-upload__button" onClick={download}
            disabled={!target} />
        </li>
        <li>
          <span>{k("authority.uploadStep2", "Choose the changed file (.xlsx or .csv)")}</span>
          <input ref={input} type="file" accept=".xlsx,.csv" hidden onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); e.target.value = ""; }} />
          <Button label={file ? file.name : k("authority.chooseFile", "Choose file")} icon="pi pi-file" outlined size="small" className="am-upload__button"
            onClick={() => input.current?.click()} />
        </li>
      </ol>
      {error ? <Message severity="error" text={error} className="am-upload__message" /> : null}
      {result ? (
        <div className="am-upload__result">
          <Message severity={result.errors?.length ? "error" : "info"} text={result.message} className="am-upload__message" />
          {result.errors?.length ? (
            <DataTable value={result.errors.map((e, i) => ({ ...e, key: `${e.row}-${i}` }))} dataKey="key" size="small" className="rp-table" scrollable scrollHeight="16rem">
              <Column header={k("authority.colRow", "Row")} field="row" style={{ width: "4rem" }} />
              <Column header={k("authority.colProblem", "Problem")} body={(e) => e.message} />
            </DataTable>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  );
};

AuthorityUploadDialog.propTypes = {
  visible: PropTypes.bool,
  target: PropTypes.shape({ templatePath: PropTypes.string, uploadPath: PropTypes.string }),
  onHide: PropTypes.func.isRequired,
  onChecked: PropTypes.func.isRequired,
};

export default AuthorityUploadDialog;
