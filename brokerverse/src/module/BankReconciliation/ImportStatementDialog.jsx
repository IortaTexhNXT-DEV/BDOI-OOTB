import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import bankReconciliationService from "../../services/bankReconciliationService";
import importService from "../../services/importService";
import { Amount, BrTag, date, money } from "./common";
import FileField from "../../components/FileField";

/**
 * Statement import: bank account (given), statement format, file, optional statement no. and opening / closing balance;
 * Preview parses the file on the server (nothing saved) and shows every line with duplicates and the suggested bank
 * transaction type, the totals and the balance check; Import saves it (and auto-matches).
 */
const ImportStatementDialog = ({ visible, onHide, account, formats, onImported }) => {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState(null);
  const [statementRef, setStatementRef] = useState("");
  const [opening, setOpening] = useState(null);
  const [closing, setClosing] = useState(null);
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setFile(null); setPreview(null); setError(null); setStatementRef(""); setOpening(null); setClosing(null); setSkipDuplicates(false);
    setFormat(account?.statementFormat || "GENERIC");
  }, [visible, account]);

  const fields = () => ({ bankAccount: account?.code, format, statementRef, openingBalance: opening ?? undefined, closingBalance: closing ?? undefined, skipDuplicates: skipDuplicates ? "true" : undefined });
  const run = async (kind) => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "preview") setPreview(await bankReconciliationService.previewStatement(file, fields()));
      else onImported(await bankReconciliationService.importStatement(file, fields()));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const chosen = formats.find((f) => f.code === format);
  const blocked = preview && (preview.errors?.length || !preview.balanced || preview.fileAlreadyImported || (preview.duplicates && !skipDuplicates) || preview.duplicates === preview.lineCount);

  return (
    <Dialog className="pe-dialog" visible={visible} onHide={onHide} style={{ width: "min(1100px, 97vw)" }} maximizable
      header={`${t("bankReconciliation.importStatement")} · ${account?.code || ""}`}
      footer={(
        <div>
          <Button label={t("bankReconciliation.cancel")} text onClick={onHide} />
          <Button label={t("bankReconciliation.preview")} icon="pi pi-eye" outlined loading={busy === "preview"} disabled={!file || !format} onClick={() => run("preview")} />
          <Button label={t("bankReconciliation.import")} icon="pi pi-upload" loading={busy === "import"} disabled={!preview || !!blocked} onClick={() => run("import")} />
        </div>
      )}>
      <div className="grid">
        <div className="col-12 md:col-4">
          <label htmlFor="br-imp-format">{t("bankReconciliation.statementFormat")} *</label>
          <Dropdown inputId="br-imp-format" value={format} onChange={(e) => { setFormat(e.value); setPreview(null); }} className="w-full"
            options={formats.map((f) => ({ label: `${f.code} – ${f.name}`, value: f.code }))} />
          {chosen && <div className="pe-muted mt-1">{chosen.dateFormat} · {chosen.fileType.toUpperCase()}{chosen.skipRows ? ` · ${t("bankReconciliation.skipRowsShort", { count: chosen.skipRows })}` : ""}{chosen.isExample ? ` · ${t("bankReconciliation.status.example")}` : ""}</div>}
          <Button type="button" text size="small" icon="pi pi-download" className="p-0 mt-1" label={t("bankReconciliation.downloadTemplate")}
            onClick={() => importService.downloadTemplate("/bank-reconciliation/statements/template").catch((e) => setError(e.message))} />
        </div>
        <div className="col-12 md:col-4">
          <label htmlFor="br-imp-file">{t("bankReconciliation.file")} *</label>
          <FileField id="br-imp-file" accept=".csv,.xlsx" value={file} onChange={(f) => { setFile(f); setPreview(null); }} />
        </div>
        <div className="col-12 md:col-4">
          <label htmlFor="br-imp-ref">{t("bankReconciliation.statementRef")}</label>
          <InputText id="br-imp-ref" value={statementRef} onChange={(e) => setStatementRef(e.target.value)} className="w-full" placeholder="SOA Sep 2026" />
        </div>
        <div className="col-12 md:col-4">
          <label htmlFor="br-imp-open">{t("bankReconciliation.openingBalance")}</label>
          <InputNumber inputId="br-imp-open" value={opening} onValueChange={(e) => { setOpening(e.value); setPreview(null); }} mode="decimal" minFractionDigits={2} maxFractionDigits={2} className="w-full" placeholder={t("bankReconciliation.fromFileOrPrevious")} />
        </div>
        <div className="col-12 md:col-4">
          <label htmlFor="br-imp-close">{t("bankReconciliation.closingBalance")}</label>
          <InputNumber inputId="br-imp-close" value={closing} onValueChange={(e) => { setClosing(e.value); setPreview(null); }} mode="decimal" minFractionDigits={2} maxFractionDigits={2} className="w-full" placeholder={t("bankReconciliation.fromFile")} />
        </div>
        <div className="col-12 md:col-4 flex align-items-center gap-2 mt-4">
          <Checkbox inputId="br-imp-skip" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.checked)} />
          <label htmlFor="br-imp-skip" className="m-0">{t("bankReconciliation.skipDuplicates")}</label>
        </div>
      </div>
      {error && <div className="br-notice br-notice-bad">{error}</div>}
      {preview && (
        <>
          <div className="br-preview-summary">
            <span>{t("bankReconciliation.lines")}: <b>{preview.lineCount}</b></span>
            <span>{t("bankReconciliation.period")}: <b>{date(preview.periodFrom)} – {date(preview.periodTo)}</b></span>
            <span>{t("bankReconciliation.openingBalance")}: <b>{money(preview.openingBalance)}</b></span>
            <span>{t("bankReconciliation.credits")}: <b>{money(preview.totalCredits)}</b></span>
            <span>{t("bankReconciliation.debits")}: <b>{money(preview.totalDebits)}</b></span>
            <span>{t("bankReconciliation.closingBalance")}: <b>{money(preview.closingBalance)}</b></span>
            {preview.skippedRows > 0 && <span>{t("bankReconciliation.skippedRows")}: <b>{preview.skippedRows}</b></span>}
          </div>
          <div className={`br-notice ${preview.balanced ? "br-notice-ok" : "br-notice-bad"}`}>
            {preview.balanced ? t("bankReconciliation.balanced") : t("bankReconciliation.notBalanced", { computed: money(preview.computedClosing), closing: money(preview.closingBalance), difference: money(preview.difference) })}
          </div>
          {preview.previousStatement && !preview.previousStatement.continues && (
            <div className="br-notice">{t("bankReconciliation.gapWarning", { number: preview.previousStatement.statementNumber, closing: money(preview.previousStatement.closingBalance) })}</div>
          )}
          {preview.fileAlreadyImported && <div className="br-notice br-notice-bad">{t("bankReconciliation.fileAlreadyImported", { number: preview.fileAlreadyImported })}</div>}
          {preview.duplicates > 0 && <div className="br-notice">{t("bankReconciliation.duplicatesFound", { count: preview.duplicates })}</div>}
          {preview.errors?.length > 0 && (
            <div className="br-notice br-notice-bad">{preview.errors.slice(0, 8).map((e) => <div key={e.row}>{t("bankReconciliation.row")} {e.row}: {e.message}</div>)}</div>
          )}
          <DataTable value={preview.lines} dataKey="lineNo" size="small" scrollable scrollHeight="340px" stripedRows>
            <Column field="lineNo" header="#" style={{ width: "3rem" }} />
            <Column header={t("bankReconciliation.date")} body={(l) => date(l.date)} style={{ width: "7rem" }} />
            <Column field="description" header={t("bankReconciliation.description")} />
            <Column field="reference" header={t("bankReconciliation.reference")} style={{ width: "9rem" }} />
            <Column header={t("bankReconciliation.amount")} body={(l) => <Amount value={l.amount} />} className="bv-num" headerClassName="bv-num" style={{ width: "8rem" }} />
            <Column header={t("bankReconciliation.balance")} body={(l) => (l.balance === null ? "" : money(l.balance))} className="bv-num" headerClassName="bv-num" style={{ width: "8rem" }} />
            <Column header="" body={(l) => (
              <span className="flex gap-1">{l.duplicate ? <BrTag status="duplicate" /> : <BrTag status="new" />}{l.suggestedType && <BrTag status="adjustment" value={l.suggestedType} />}</span>
            )} style={{ width: "9rem" }} />
          </DataTable>
        </>
      )}
    </Dialog>
  );
};

export default ImportStatementDialog;
