import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Skeleton } from "primereact/skeleton";
import { TabPanel, TabView } from "primereact/tabview";
import ActivityLog from "../../components/ActivityLog";
import ApprovalActions, { isInitiator } from "../../components/ApprovalActions";
import { openConfirm } from "../../components/ConfirmDialog";
import KeyValueGrid from "../../components/KeyValueGrid";
import LoadingBar from "../../components/LoadingBar";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import StatusChip from "../../components/StatusChip";
import useStableLoad from "../../hooks/useStableLoad";
import birTaxService from "../../services/birTaxService";
import { hasPermission } from "../../utils/canOpen";
import { dateTime } from "../PeriodEnd/common";
import "./cas.scss";

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const DASH = "-";

/** Section text with the live fields filled in (as the PDF prints it). */
export const resolveFields = (text, fields = []) => {
  const values = new Map(fields.map((f) => [f.key, f.value]));
  return String(text || "").replace(PLACEHOLDER, (m, key) => (values.has(key) ? values.get(key) || DASH : m));
};

const STATUS_SEVERITY = { draft: "info", submitted: "warning", approved: "success", superseded: "secondary", cancelled: "secondary" };
export const DocStatus = ({ status, t }) => (status ? <StatusChip code={status} label={t(`birTax.status.${status}`)} severity={STATUS_SEVERITY[status]} /> : null);

/** One section in the editor: heading, text, a live field to insert at the cursor, move and remove. */
const SectionEditor = ({ section, index, count, fields, onChange, onMove, onRemove }) => {
  const { t } = useTranslation();
  const area = useRef(null);
  const insert = (key) => {
    const el = area.current;
    const token = `{{${key}}}`;
    const text = section.text || "";
    const start = el && typeof el.selectionStart === "number" ? el.selectionStart : text.length;
    const end = el && typeof el.selectionEnd === "number" ? el.selectionEnd : text.length;
    onChange({ ...section, text: `${text.slice(0, start)}${token}${text.slice(end)}` });
  };
  const id = `cas-sec-${section.key}`;
  return (
    <div className="cas-section-editor">
      <div className="cas-section-editor__head">
        <span className="cas-section-editor__no">{index + 1}.</span>
        <InputText id={`${id}-heading`} aria-label={t("birTax.casDoc.heading")} className="flex-1" value={section.heading} maxLength={200}
          onChange={(e) => onChange({ ...section, heading: e.target.value })} />
        <Button type="button" icon="pi pi-arrow-up" text rounded size="small" aria-label={t("birTax.casDoc.moveUp")} tooltip={t("birTax.casDoc.moveUp")} disabled={index === 0} onClick={() => onMove(-1)} />
        <Button type="button" icon="pi pi-arrow-down" text rounded size="small" aria-label={t("birTax.casDoc.moveDown")} tooltip={t("birTax.casDoc.moveDown")} disabled={index === count - 1} onClick={() => onMove(1)} />
        <Button type="button" icon="pi pi-trash" text rounded size="small" severity="danger" aria-label={t("birTax.casDoc.removeSection")} tooltip={t("birTax.casDoc.removeSection")}
          disabled={count === 1} onClick={onRemove} />
      </div>
      <InputTextarea ref={area} id={`${id}-text`} aria-label={t("birTax.casDoc.text")} className="w-full" value={section.text} rows={5} autoResize maxLength={20000}
        onChange={(e) => onChange({ ...section, text: e.target.value })} />
      <Dropdown className="cas-section-editor__field" value={null} options={fields.map((f) => ({ label: f.label, value: f.key }))} onChange={(e) => insert(e.value)}
        placeholder={t("birTax.casDoc.insertField")} aria-label={t("birTax.casDoc.insertField")} filter />
    </div>
  );
};

/** Sections as printed. */
const SectionsView = ({ sections, fields }) => (
  <div className="cas-sections">
    {sections.map((s, i) => (
      <section key={s.key || i} className="cas-sections__item">
        <h5>{`${i + 1}. ${s.heading}`}</h5>
        <p>{resolveFields(s.text, fields)}</p>
      </section>
    ))}
  </div>
);

/** Comparison of two versions: section by section, removed and added lines marked. */
export const CompareView = ({ data }) => {
  const { t } = useTranslation();
  return (
    <div className="cas-compare">
      <div className="cas-compare__head">
        {t("birTax.casDoc.compareHead", { from: data.from.version, to: data.to.version })}
        <span className="pe-muted">{t("birTax.casDoc.compareSummary", data.summary)}</span>
      </div>
      {data.sections.map((s) => (
        <section key={s.key} className={`cas-compare__section cas-compare__section--${s.change}`}>
          <h5>
            {s.headingBefore ? <><del>{s.headingBefore}</del>{" "}</> : null}
            {s.heading}
            <span className="cas-compare__change">{t(`birTax.casDoc.change.${s.change}`)}</span>
          </h5>
          {s.change === "same" ? null : (
            <div className="cas-compare__lines">
              {s.lines.map((l, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className={`cas-compare__line cas-compare__line--${l.type}`}>
                  <span className="cas-compare__mark" aria-hidden="true">{l.type === "added" ? "+" : l.type === "removed" ? "-" : " "}</span>
                  <span className="cas-sr-only">{l.type === "same" ? "" : t(`birTax.casDoc.line.${l.type}`)}</span>
                  {l.text || " "}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
};

const sameSections = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

/**
 * A CAS document (system description and controls, backup and restore procedure) as a controlled document: its
 * content (edited as sections while a draft, with live fields), its versions with a comparison of two of them and
 * its activity log. Submit asks for a reason and a change note; approval is for another user with approve:period-end.
 */
const CasDocumentDialog = ({ slug, onHide, onChanged }) => {
  const { t } = useTranslation();
  const loader = useCallback(() => birTaxService.casDocument(slug), [slug]);
  const { data, loading, refreshing, error, setData } = useStableLoad(loader, { enabled: !!slug });
  const doc = data && data.slug === slug ? data : null;
  const [tab, setTab] = useState(0);
  const [sections, setSections] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [selected, setSelected] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState(null);
  const [changeNote, setChangeNote] = useState("");
  const [tried, setTried] = useState(false);

  const open = doc?.open;
  const draftKey = open ? `${open.id}:${open.updatedAt}:${open.status}` : null;
  useEffect(() => {
    setSections(open && open.status === "draft" ? open.sections : null);
    // reload the editor only when another version or a saved change arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);
  useEffect(() => {
    setTab(0);
    setSelected([]);
    setComparison(null);
    setActionError(null);
  }, [slug]);

  const canWrite = hasPermission("write:period-end");
  const canApprove = hasPermission("approve:period-end");
  const editing = !!(open && open.status === "draft" && canWrite && sections);
  const dirty = editing && !sameSections(sections, open.sections);
  const shown = open || doc?.approved;
  const fields = doc?.fields || [];

  const act = async (fn) => {
    setBusy(true);
    setActionError(null);
    try {
      const next = await fn();
      if (next) setData(next);
      onChanged();
      return true;
    } catch (e) {
      setActionError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const saveIfDirty = () => (dirty ? birTaxService.saveCasDraft(slug, sections) : Promise.resolve(null));

  const close = async () => {
    if (dirty && !(await openConfirm({ title: t("birTax.casDoc.unsavedTitle"), severity: "warning", message: t("birTax.casDoc.unsavedMessage"), confirmLabel: t("birTax.casDoc.closeWithoutSaving") }))) return;
    onHide();
  };
  const startDraft = () => act(() => birTaxService.startCasDraft(slug));
  const save = () => act(() => birTaxService.saveCasDraft(slug, sections));
  const discard = async () => {
    await openConfirm({
      title: t("birTax.casDoc.discardTitle"), severity: "danger", message: t("birTax.casDoc.discardMessage", { version: open.version }), confirmLabel: t("birTax.casDoc.discard"),
      onConfirm: async () => { setData(await birTaxService.discardCasDraft(slug)); onChanged(); },
    });
  };
  const submit = async () => {
    setTried(true);
    if (reasonProblem(reason) || !changeNote.trim()) return;
    const done = await act(async () => {
      await saveIfDirty();
      return birTaxService.submitCasDraft(slug, { ...reasonPayload(reason), changeNote: changeNote.trim() });
    });
    if (done) setSubmitting(false);
  };
  const openSubmit = () => {
    setReason(null);
    setChangeNote("");
    setTried(false);
    setSubmitting(true);
  };
  const approve = () => openConfirm({
    title: t("birTax.casDoc.approveTitle"), message: t("birTax.casDoc.approveMessage", { version: open.version }), confirmLabel: t("birTax.casDoc.approveVersion"),
    facts: [{ label: t("birTax.casDoc.changeNote"), value: open.changeNote }, { label: t("birTax.reason"), value: open.reason }, { label: t("birTax.casDoc.submittedBy"), value: open.submittedByName }],
    input: { type: "textarea", label: t("birTax.casDoc.remarks"), maxLength: 1000 },
    onConfirm: async (remarks) => { setData(await birTaxService.approveCasDraft(slug, remarks)); onChanged(); },
  });
  const reject = () => openConfirm({
    title: t("birTax.casDoc.rejectTitle"), severity: "warning", message: t("birTax.casDoc.rejectMessage", { version: open.version }), confirmLabel: t("birTax.casDoc.returnToPreparer"),
    input: { type: "textarea", label: t("birTax.casDoc.remarks"), required: true, maxLength: 1000 },
    onConfirm: async (remarks) => { setData(await birTaxService.rejectCasDraft(slug, remarks)); onChanged(); },
  });
  const compare = () => {
    const [a, b] = [...selected].sort((x, y) => x.version - y.version);
    act(async () => { setComparison(await birTaxService.compareCasDocument(slug, a.version, b.version)); return null; });
  };

  const moveSection = (i, dir) => setSections((list) => {
    const next = [...list];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    return next;
  });
  const changeSection = (i, s) => setSections((list) => list.map((x, j) => (j === i ? s : x)));
  const removeSection = (i) => setSections((list) => list.filter((_, j) => j !== i));
  const addSection = () => setSections((list) => [...list, { heading: "", text: "" }]);

  const facts = shown ? [
    { label: t("birTax.casDoc.version"), value: String(shown.version) },
    { label: t("birTax.statusLabel"), value: <DocStatus status={shown.status} t={t} /> },
    { label: t("birTax.casDoc.preparedBy"), value: shown.updatedByName || shown.createdByName },
    { label: t("birTax.casDoc.updatedAt"), value: shown.updatedAt, type: "datetime" },
    { label: t("birTax.casDoc.submittedBy"), value: shown.submittedByName, hidden: !shown.submittedAt },
    { label: t("birTax.casDoc.submittedAt"), value: shown.submittedAt, type: "datetime", hidden: !shown.submittedAt },
    { label: t("birTax.casDoc.approvedBy"), value: shown.approvedByName, hidden: !shown.approvedAt },
    { label: t("birTax.casDoc.approvedAt"), value: shown.approvedAt, type: "datetime", hidden: !shown.approvedAt },
    { label: t("birTax.reason"), value: shown.reason, hidden: !shown.reason },
    { label: t("birTax.casDoc.changeNote"), value: shown.changeNote, span: "full", hidden: !shown.changeNote },
    { label: t("birTax.casDoc.returnedWith"), value: shown.rejectionRemarks, span: "full", hidden: !(shown.status === "draft" && shown.rejectionRemarks) },
  ] : [{ label: t("birTax.casDoc.version"), value: t("birTax.casDoc.standardText") }, { label: t("birTax.statusLabel"), value: <DocStatus status="draft" t={t} /> }];

  const footer = doc ? (
    <div className="cas-doc-footer">
      <Button type="button" icon="pi pi-file-pdf" outlined label={open ? t("birTax.casDoc.printDraft") : t("birTax.print")} onClick={() => act(async () => { await birTaxService.casDocumentPdf(slug, open?.version); return null; })} />
      <span className="flex-1" />
      {!open && canWrite ? <Button type="button" icon="pi pi-pencil" label={t("birTax.casDoc.edit")} loading={busy} onClick={startDraft} /> : null}
      {editing ? (
        <>
          <Button type="button" label={t("birTax.casDoc.discard")} severity="danger" text disabled={busy} onClick={discard} />
          <Button type="button" icon="pi pi-save" outlined label={t("birTax.casDoc.saveDraft")} disabled={!dirty} loading={busy} onClick={save} />
          <Button type="button" icon="pi pi-send" label={t("birTax.submit")} disabled={busy} onClick={openSubmit} />
        </>
      ) : null}
      {open && open.status === "submitted" && canApprove ? (
        <ApprovalActions initiator={{ id: open.makers.find((m) => isInitiator({ id: m })) || open.submittedBy }} approveLabel={t("birTax.casDoc.approveVersion")}
          rejectLabel={t("birTax.casDoc.returnToPreparer")} onApprove={approve} onReject={reject} busy={busy} />
      ) : null}
    </div>
  ) : null;

  return (
    <Dialog className="pe-dialog cas-doc-dialog" visible={!!slug} onHide={close} style={{ width: "min(1100px, 96vw)" }} maximizable
      header={<span className="cas-doc-dialog__title">{doc?.title || ""}{shown ? <DocStatus status={shown.status} t={t} /> : null}</span>} footer={footer}>
      <div className="bv-loading-host">
        <LoadingBar active={refreshing || busy} />
        {loading || !doc ? <Skeleton height="16rem" /> : (
          <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
            <TabPanel header={t("birTax.casDoc.content")}>
              <KeyValueGrid columns={4} items={facts} />
              {editing ? (
                <div className="cas-editor">
                  {sections.map((s, i) => (
                    <SectionEditor key={s.key || `new-${i}`} section={s} index={i} count={sections.length} fields={fields}
                      onChange={(next) => changeSection(i, next)} onMove={(dir) => moveSection(i, dir)} onRemove={() => removeSection(i)} />
                  ))}
                  <Button type="button" icon="pi pi-plus" text label={t("birTax.casDoc.addSection")} onClick={addSection} />
                  <h5 className="cas-subtitle">{t("birTax.casDoc.liveFields")}</h5>
                  <KeyValueGrid columns={3} items={fields.map((f) => ({ key: f.key, label: f.label, value: f.value || <StatusChip code="missing" label={t("birTax.casReadiness.missing")} severity="warning" /> }))} />
                </div>
              ) : (
                <SectionsView sections={shown ? shown.sections : doc.standard || []} fields={fields} />
              )}
            </TabPanel>
            <TabPanel header={t("birTax.casDoc.versions")}>
              <DataTable value={doc.versions} size="small" dataKey="id" selectionMode="checkbox" selection={selected} emptyMessage={t("birTax.casDoc.noVersions")}
                onSelectionChange={(e) => { setSelected(e.value.slice(-2)); setComparison(null); }}>
                <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
                <Column field="version" header={t("birTax.casDoc.version")} className="bv-num" headerClassName="bv-num" />
                <Column header={t("birTax.statusLabel")} body={(r) => <DocStatus status={r.status} t={t} />} />
                <Column header={t("birTax.casDoc.preparedBy")} body={(r) => r.updatedByName || r.createdByName || DASH} />
                <Column header={t("birTax.casDoc.submittedAt")} body={(r) => dateTime(r.submittedAt)} />
                <Column header={t("birTax.casDoc.approvedBy")} body={(r) => r.approvedByName || DASH} />
                <Column header={t("birTax.casDoc.approvedAt")} body={(r) => dateTime(r.approvedAt)} />
                <Column field="changeNote" header={t("birTax.casDoc.changeNote")} body={(r) => r.changeNote || DASH} />
                <Column body={(r) => (
                  <Button type="button" icon="pi pi-file-pdf" text size="small" aria-label={t("birTax.casDoc.printVersion", { version: r.version })} tooltip={t("birTax.print")}
                    onClick={() => act(async () => { await birTaxService.casDocumentPdf(slug, r.version); return null; })} />
                )} />
              </DataTable>
              <div className="cas-compare-bar">
                <Button type="button" icon="pi pi-clone" outlined label={t("birTax.casDoc.compare")} disabled={selected.length !== 2 || busy} onClick={compare} />
                <span className="pe-muted">{t("birTax.casDoc.selectedCount", { count: selected.length })}</span>
              </div>
              {comparison ? <CompareView data={comparison} /> : null}
            </TabPanel>
            <TabPanel header={t("birTax.casDoc.activity")}>
              <ActivityLog entries={doc.activity || []} />
            </TabPanel>
          </TabView>
        )}
        {error || actionError ? <div className="pe-error" role="alert">{actionError || error}</div> : null}
      </div>

      <Dialog className="pe-dialog bv-centered" visible={submitting} header={t("birTax.casDoc.submitTitle")} style={{ width: "min(560px, 95vw)" }} onHide={() => setSubmitting(false)}
        footer={(
          <div>
            <Button type="button" label={t("periodEnd.cancel")} text disabled={busy} onClick={() => setSubmitting(false)} />
            <Button type="button" icon="pi pi-send" label={t("birTax.submit")} loading={busy} onClick={submit} />
          </div>
        )}>
        <ReasonPicker context="cas_document_change" value={reason} onChange={setReason} showErrors={tried} autoFocus />
        <div className="field mt-3">
          <label htmlFor="cas-change-note">{t("birTax.casDoc.changeNote")}<span className="bv-required" aria-hidden="true"> *</span></label>
          <InputTextarea id="cas-change-note" className={`w-full${tried && !changeNote.trim() ? " p-invalid" : ""}`} rows={3} autoResize maxLength={2000} value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)} />
          {tried && !changeNote.trim() ? <small className="p-error">{t("birTax.casReg.required")}</small> : null}
        </div>
        {actionError ? <div className="pe-error" role="alert">{actionError}</div> : null}
      </Dialog>
    </Dialog>
  );
};

CasDocumentDialog.propTypes = {
  /** system-description or backup-procedure; null when closed */
  slug: PropTypes.string,
  onHide: PropTypes.func.isRequired,
  onChanged: PropTypes.func.isRequired,
};
CasDocumentDialog.defaultProps = { slug: null };

export default CasDocumentDialog;
