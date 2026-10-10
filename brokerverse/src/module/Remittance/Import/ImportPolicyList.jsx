import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { ColumnGroup } from "primereact/columngroup";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Row } from "primereact/row";
import { Skeleton } from "primereact/skeleton";
import FieldError from "../../../components/FieldError";
import FileField from "../../../components/FileField";
import KeyValueGrid from "../../../components/KeyValueGrid";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../../components/ReasonPicker";
import StatusChip from "../../../components/StatusChip";
import { UploadPreview } from "../../../components/ImportDialog";
import { openConfirm } from "../../../components/ConfirmDialog";
import { remittanceService } from "../../../services/remittanceService";
import { money, statusChip } from "../shared";
import SubmitResults from "../Remittances/SubmitResults";
import { submitDrafts } from "../Remittances/submitDrafts";
import { FILE_CODES, RESULT_FILTERS, countChips, fileProblem, resultSeverity } from "./importModel";
import "../remittance.scss";

const TEMPLATE = "Remittance_Policy_List_Template.xlsx";

/**
 * Import policy list (dialog, 720px to choose the file, 1100px for the result; Remittances ?import=new, or ?import=<id>
 * for an import of the history): off-cycle draft remittances from a list of policies. The file selects the policies;
 * every amount is the system's.
 *
 * Choose: Download template, the purpose (a remittance_off_cycle reason, the off-cycle reason of the drafts) and the
 * file, checked in the browser against the server's limits before anything is sent; Validate keeps the file and a
 * result per row under an IMP number and creates nothing. Preview: the counts as chips, the paged rows with a result
 * filter, the remittances to create with their totals, the error report, Discard and "Create n draft remittances"
 * behind a confirmation; Create is disabled with the reason for a file imported before or when no row is ready. The
 * result bar links the drafts and the import and offers to submit the drafts for approval. A server error keeps the
 * chosen file and offers Try again.
 */
const ImportPolicyList = ({ importId, onHide, onOpen, onChanged, onGoToDrafts }) => {
  const { t } = useTranslation();
  const visible = !!importId;
  const [limits, setLimits] = useState(null);
  const [purpose, setPurpose] = useState(null);
  const [tried, setTried] = useState(false);
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [created, setCreated] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  // the import on screen, so that the address taking the id of a file just validated does not load it again
  const shown = useRef(null);
  const show = useCallback((imp) => {
    shown.current = imp?.id ?? null;
    setPreview(imp);
  }, []);

  const ruleText = useCallback(() => t("remittance.import.fileRule", { mb: limits?.maxMb ?? 10 }), [t, limits]);

  const loadImport = useCallback(async (id) => {
    setLoadFailed(false);
    try {
      show(await remittanceService.getImport(id));
    } catch (e) {
      setLoadFailed(true);
      setError({ message: e.message });
    }
  }, [show]);

  useEffect(() => {
    if (!visible) return;
    remittanceService.importLimits().then(setLimits).catch(() => setLimits(null));
  }, [visible]);

  useEffect(() => {
    if (!importId) return;
    setError(null);
    setSubmitted(null);
    if (importId === "new") {
      show(null);
      setCreated(null);
      setPurpose(null);
      setTried(false);
      setFile(null);
      setFileError(null);
      return;
    }
    if (shown.current === importId) return;
    setCreated(null);
    show(null);
    loadImport(importId);
  }, [importId, loadImport, show]);

  const download = (path, name) => remittanceService.download(path, name).catch((e) => setError({ message: e.message }));

  const choose = (chosen) => {
    setError(null);
    const problem = fileProblem(chosen, limits);
    if (problem) {
      setFile(null);
      setFileError(ruleText());
      return;
    }
    setFileError(null);
    setFile(chosen);
  };

  const validate = async () => {
    setTried(true);
    if (!file) setFileError(t("remittance.import.fileRequired"));
    if (reasonProblem(purpose) || !file) return;
    setBusy("validate");
    setError(null);
    try {
      const { reasonCode, note } = reasonPayload(purpose);
      const out = await remittanceService.validateImport(file, { purposeCode: reasonCode, note });
      show(out);
      onOpen(out.id);
    } catch (e) {
      if (FILE_CODES.includes(e.code)) setFileError(e.code === "TOO_MANY_ROWS" ? e.message : ruleText());
      else setError({ message: e.message, code: e.code, retry: e.code !== "HEADER_MISSING" });
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    setBusy("discard");
    setError(null);
    try {
      show(await remittanceService.discardImport(preview.id));
      onChanged();
    } catch (e) {
      setError({ message: e.message });
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    const totals = preview.totals || {};
    let out = null;
    const done = await openConfirm({
      title: t("remittance.import.createTitle"),
      message: t("remittance.import.createMessage", { count: totals.remittances, amount: money(totals.dueToInsurer), policies: totals.policies }),
      confirmLabel: t("remittance.import.createVerb", { count: totals.remittances }),
      onConfirm: async () => {
        out = (await remittanceService.commitImport(preview.id, preview.version)).data;
      },
    });
    if (!done || !out) return;
    setCreated(out);
    show(out.import);
    onChanged();
  };

  const submitCreated = async () => {
    setBusy("submit");
    try {
      const out = await submitDrafts(t, created.drafts);
      if (out) {
        setSubmitted(out);
        onChanged();
      }
    } finally {
      setBusy(null);
    }
  };

  const rows = useCallback((p, { result, page, perPage }) => remittanceService.importRows(p.id, { result: result || undefined, page, perPage })
    .then((r) => ({ rows: r.data || [], total: r.total ?? 0 })), []);
  const rowColumns = [
    { field: "rowNo", header: t("remittance.import.rows.row"), type: "number", key: true, width: "4.5rem" },
    { field: "policyNo", header: t("remittance.import.rows.policyNo") },
    { field: "insurer", header: t("remittance.import.rows.insurer") },
    { field: "productLine", header: t("remittance.import.rows.productLine") },
    { field: "result", header: t("remittance.import.rows.result"), body: (r) => <StatusChip label={r.resultLabel} severity={resultSeverity(r.kind)} /> },
    { field: "message", header: t("remittance.import.rows.message") },
    { field: "systemDue", header: t("remittance.import.rows.systemDue"), type: "amount", body: (r) => <span className="rm-num">{money(r.systemDue)}</span> },
    { field: "expectedDue", header: t("remittance.import.rows.expectedDue"), type: "amount", body: (r) => <span className="rm-num">{money(r.expectedDue)}</span> },
    { field: "variance", header: t("remittance.import.rows.variance"), type: "amount", body: (r) => <span className="rm-num">{money(r.variance)}</span> },
  ];
  const filters = RESULT_FILTERS.map((value) => ({ label: t(`remittance.import.filters.${value || "all"}`), value }));

  const committable = preview && preview.status === "validated";
  const totals = preview?.totals || {};
  const footer = (
    <div className="rm-import__footer">
      <Button type="button" label={t("remittance.common.close")} text onClick={onHide} disabled={!!busy} />
      {!preview && !loadFailed ? (
        <Button type="button" label={t("remittance.import.validate")} onClick={validate} loading={busy === "validate"} disabled={!!busy} />
      ) : null}
      {committable ? <Button type="button" label={t("remittance.import.discard")} outlined onClick={discard} loading={busy === "discard"} disabled={!!busy} /> : null}
      {committable ? (
        <span className="rm-action-with-reason">
          <Button type="button" label={t("remittance.import.create", { count: totals.remittances || 0 })} onClick={create} disabled={!preview.canCommit || !!busy} />
          {!preview.canCommit && preview.commitBlockedReason ? <span className="rm-action-reason">{preview.commitBlockedReason}</span> : null}
        </span>
      ) : null}
      {created?.drafts?.length && !submitted ? (
        <Button type="button" label={t("remittance.import.submitDrafts", { count: created.drafts.length })} onClick={submitCreated} loading={busy === "submit"} disabled={!!busy} />
      ) : null}
      {preview?.status === "committed" ? <Button type="button" label={t("remittance.import.goToDrafts")} outlined onClick={onGoToDrafts} /> : null}
    </div>
  );

  const groupFooter = (
    <ColumnGroup>
      <Row>
        <Column footer={t("remittance.import.toCreate.total")} colSpan={3} />
        <Column footer={<span className="rm-num">{totals.policies ?? 0}</span>} align="right" />
        <Column footer={<span className="rm-num">{money(totals.dueToInsurer)}</span>} align="right" />
        <Column footer={<span className="rm-num">{(preview?.toCreate || []).reduce((s, g) => s + (g.varianceRows || 0), 0)}</span>} align="right" />
      </Row>
    </ColumnGroup>
  );

  const drafts = created?.drafts || (preview?.status === "committed" ? preview.drafts : []);

  const choosing = (
    <div className="rm-import__choose">
      <div className="rm-field">
        <span className="bv-field-label">{t("remittance.import.template")}</span>
        <Button type="button" label={t("remittance.import.downloadTemplate")} icon="pi pi-download" outlined size="small" className="rm-import__template"
          onClick={() => download(remittanceService.importTemplatePath, TEMPLATE)} />
      </div>
      <ReasonPicker context="remittance_off_cycle" value={purpose} onChange={setPurpose} label={t("remittance.import.purpose")} showErrors={tried} disabled={!!busy} />
      <div className="rm-field">
        <label htmlFor="rm-import-file" className="bv-field-label">{t("remittance.import.file")}<span className="required-marker">*</span></label>
        <FileField id="rm-import-file" accept=".xlsx,.csv" value={file} onChange={choose} invalid={!!fileError} disabled={!!busy} hint={ruleText()} />
        <FieldError id="rm-import-file-error" error={fileError} />
      </div>
    </div>
  );

  const previewing = preview ? (
    <>
      <KeyValueGrid columns={4} items={[
        { label: t("remittance.import.importNo"), value: preview.importNo },
        { label: t("remittance.import.fileName"), value: `${preview.file?.name || ""} · ${preview.file?.sizeText || ""}` },
        { label: t("remittance.import.purpose"), value: preview.purpose?.text },
        { label: t("remittance.import.status"), value: <StatusChip {...statusChip(preview.status, preview.statusLabel)} /> },
      ]} />
      <div className="rm-strip" aria-label={t("remittance.import.counts")}>
        {countChips(preview.counts).map((c) => <StatusChip key={c.key} label={t(`remittance.import.chips.${c.key}`, { count: c.count })} severity="secondary" />)}
        <StatusChip label={t("remittance.import.chips.fullyPaid")} severity="secondary" />
      </div>
      <UploadPreview preview={preview} loadRows={rows} columns={rowColumns} filters={filters} hasErrors={(preview.counts?.errors || 0) + (preview.counts?.warnings || 0) > 0}
        onErrorReport={(p) => remittanceService.download(remittanceService.importErrorsPath(p.id), `${p.importNo}_Errors.xlsx`)} />
      {preview.status !== "discarded" ? (
        <section className="rm-import__create" aria-label={t("remittance.import.toCreate.title")}>
          <h3 className="rm-import__heading">{t("remittance.import.toCreate.title")}</h3>
          <DataTable value={preview.toCreate || []} size="small" className="rm-table" footerColumnGroup={(preview.toCreate || []).length ? groupFooter : null}
            emptyMessage={t("remittance.import.toCreate.empty")}>
            <Column header={t("remittance.import.toCreate.insurer")} body={(g) => g.insurer?.name} />
            <Column header={t("remittance.import.toCreate.productLine")} body={(g) => g.productLine || "-"} />
            <Column header={t("remittance.import.toCreate.basis")} body={(g) => g.basisLabel || "-"} />
            <Column header={t("remittance.import.toCreate.policies")} body={(g) => <span className="rm-num">{g.policies}</span>} align="right" />
            <Column header={t("remittance.import.toCreate.dueToInsurer")} body={(g) => <span className="rm-num">{money(g.dueToInsurer)}</span>} align="right" />
            <Column header={t("remittance.import.toCreate.varianceRows")} body={(g) => <span className="rm-num">{g.varianceRows}</span>} align="right" />
          </DataTable>
        </section>
      ) : null}
    </>
  ) : null;

  const result = drafts.length || created ? (
    <section className="rm-import__result" role="status" aria-label={t("remittance.import.result")}>
      <p>
        <strong>{t("remittance.import.created", { count: drafts.length })}</strong>
        {drafts.map((d) => <Link key={d.id} to={d.link} onClick={onHide} className="rm-ref">{d.remittanceNo}</Link>)}
        <span>{t("remittance.flags.offCycle")}</span>
        <span className="rm-ref">{preview?.importNo}</span>
      </p>
      {(created?.skipped || []).length ? (
        <ul className="rm-import__skipped">
          {created.skipped.map((s) => <li key={s.rowNo}>{t("remittance.import.skippedRow", { row: s.rowNo, policy: s.policyNo, message: s.message })}</li>)}
        </ul>
      ) : null}
      <SubmitResults out={submitted} />
    </section>
  ) : null;

  return (
    <Dialog visible={visible} onHide={busy ? () => {} : onHide} header={t("remittance.import.title")} footer={footer} modal draggable={false} resizable={false}
      style={{ width: preview ? "1100px" : "720px" }} breakpoints={{ "1140px": "100vw" }} className="rm-panel rm-import">
      <div className="rm-import__body">
        {result}
        {!preview && importId === "new" ? choosing : null}
        {!preview && importId !== "new" && !loadFailed ? <Skeleton height="12rem" /> : null}
        {previewing}
        {error ? (
          <div className="rm-inline-error" role="alert">
            <span>{error.message}</span>
            {error.code === "HEADER_MISSING" ? (
              <Button type="button" label={t("remittance.import.downloadTemplate")} link size="small" onClick={() => download(remittanceService.importTemplatePath, TEMPLATE)} />
            ) : null}
            {error.retry ? <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={validate} /> : null}
            {loadFailed ? <Button type="button" label={t("remittance.common.tryAgain")} text size="small" onClick={() => loadImport(importId)} /> : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
};

ImportPolicyList.propTypes = {
  /** "new" to choose a file, an import id to show it; null keeps the dialog closed */
  importId: PropTypes.string,
  onHide: PropTypes.func.isRequired,
  /** the import validated, so the address keeps it (?import=<id>) */
  onOpen: PropTypes.func.isRequired,
  /** drafts were created or submitted, or the import was discarded */
  onChanged: PropTypes.func,
  onGoToDrafts: PropTypes.func,
};

ImportPolicyList.defaultProps = { importId: null, onChanged: () => {}, onGoToDrafts: () => {} };

export default ImportPolicyList;
