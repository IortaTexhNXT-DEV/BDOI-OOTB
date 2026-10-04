import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { InputText } from "primereact/inputtext";
import { SelectButton } from "primereact/selectbutton";
import { Toast } from "primereact/toast";
import complianceService, { errorMessage } from "../../services/complianceService";
import { FormDialog, PageHeader, StateTag, Stats, asOptions, showDate } from "./icCommon";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./ic.scss";

const CATEGORIES = ["director", "officer", "compliance-officer", "key-person"];
const OUTCOMES = ["fit", "conditional", "not-fit"];

/**
 * Compliance > Insurance Commission > Fit and Proper: the record of each director and officer: the declarations
 * answered, the supporting documents, the review outcome and the next review date.
 */
const FitAndProper = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ reviewState: null, search: "" });
  const [form, setForm] = useState(null);
  const [review, setReview] = useState(null);
  const [saving, setSaving] = useState(false);
  const fail = (e) => toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.failed")) });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await complianceService.fitProper(filters);
      setRows(r.items);
      setSummary(r.summary || {});
      setItems(r.declarationItems || []);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("compliance.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => setForm({ personName: "", roleCategory: "director", position: "", appointedOn: null, declarationSignedOn: null, remarks: "", documents: [],
    declarations: items.map((item) => ({ item, answer: null, remarks: "" })) });
  const openEdit = (r) => setForm({ id: r.id, personName: r.personName, roleCategory: r.roleCategory, position: r.position, appointedOn: r.appointedOn, ceasedOn: r.ceasedOn,
    declarationSignedOn: r.declarationSignedOn, remarks: r.remarks || "", documents: r.documents || [], declarations: r.declarations.map((d) => ({ ...d, remarks: d.remarks || "" })) });
  const setAnswer = (i, patch) => setForm((f) => ({ ...f, declarations: f.declarations.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));

  const save = async () => {
    setSaving(true);
    const { id, ...body } = form;
    body.declarations = body.declarations.map((d) => ({ item: d.item, answer: d.answer || null, remarks: d.remarks || null }));
    try {
      const r = id ? await complianceService.updateFitProper(id, body) : await complianceService.createFitProper(body);
      toast.current?.show({ severity: "success", summary: r.message });
      setForm(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };
  const saveReview = async () => {
    setSaving(true);
    try {
      const r = await complianceService.reviewFitProper(review.id, { outcome: review.outcome, reviewedOn: review.reviewedOn, notes: review.notes || null });
      toast.current?.show({ severity: "success", summary: r.message });
      setReview(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  const answerOptions = [{ value: "yes", label: t("compliance.fp.yes") }, { value: "no", label: t("compliance.fp.no") }];
  const formValid = form && form.personName.trim().length >= 2 && form.position.trim().length >= 2 && form.declarations.every((d) => d.answer !== "no" || d.remarks.trim());

  return (
    <div className="admin__page access__page compliance__page">
      <Toast ref={toast} />
      <PageHeader section={t("compliance.ic")} title={t("compliance.fp.title")} intro={t("compliance.fp.intro")}
        actions={(
          <>
            <Button icon="pi pi-file-excel" label={t("compliance.export")} outlined onClick={() => complianceService.exportFitProper().catch(fail)} />
            <Button icon="pi pi-plus" label={t("compliance.fp.add")} onClick={openNew} />
          </>
        )} />
      <Stats loading={loading} selected={filters.reviewState} onSelect={(reviewState) => setFilters((f) => ({ ...f, reviewState }))} items={[
        { key: "overdue", label: t("compliance.fp.overdue"), value: summary.overdue },
        { key: "due", label: t("compliance.fp.due"), value: summary.due },
        { key: "not-reviewed", label: t("compliance.state.not-reviewed"), value: summary.notReviewed },
      ]} />
      <div className="admin__filters">
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={filters.search} placeholder={t("compliance.search")} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
        </span>
      </div>
      <DataTable value={rows} dataKey="id" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("compliance.fp.none")}>
        <Column header={t("compliance.fp.person")} body={(r) => (
          <div className="access__user">
            <span className="access__user-name">{r.personName}</span>
            <span className="access__muted">{`${t(`compliance.fp.cat.${r.roleCategory}`)} · ${r.position}`}</span>
          </div>
        )} />
        <Column field="appointedOn" header={t("compliance.fp.appointedOn")} body={(r) => showDate(r.appointedOn)} />
        <Column header={t("compliance.fp.declarations")} body={(r) => (r.unanswered ? t("compliance.fp.unanswered", { n: r.unanswered }) : r.adverseAnswers ? t("compliance.fp.adverse", { n: r.adverseAnswers }) : t("compliance.fp.allClear"))} />
        <Column field="lastReviewOn" header={t("compliance.fp.lastReview")} body={(r) => showDate(r.lastReviewOn)} />
        <Column header={t("compliance.fp.outcome")} body={(r) => <StateTag value={r.reviewOutcome} />} />
        <Column field="nextReviewOn" header={t("compliance.fp.nextReview")} sortable body={(r) => showDate(r.nextReviewOn)} />
        <Column header={t("compliance.colState")} body={(r) => <StateTag value={r.reviewState} />} />
        <Column header="" body={(r) => (
          <div className="compliance__row-actions">
            <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("compliance.edit")} tooltip={t("compliance.edit")} onClick={() => openEdit(r)} />
            {r.status === "active" ? <Button label={t("compliance.fp.review")} text size="small" onClick={() => setReview({ id: r.id, person: r.personName, outcome: "fit", reviewedOn: null, notes: "" })} /> : null}
          </div>
        )} />
      </DataTable>

      <FormDialog header={form?.id ? t("compliance.fp.edit") : t("compliance.fp.add")} visible={!!form} form={form} setForm={setForm} onHide={() => setForm(null)} onSubmit={save}
        saving={saving} valid={!!formValid} width="60rem"
        fields={[
          { name: "personName", label: t("compliance.fp.person"), required: true },
          { name: "roleCategory", label: t("compliance.fp.category"), type: "dropdown", required: true, options: asOptions(CATEGORIES, t, "compliance.fp.cat") },
          { name: "position", label: t("compliance.fp.position"), required: true },
          { name: "appointedOn", label: t("compliance.fp.appointedOn"), type: "date" },
          { name: "declarationSignedOn", label: t("compliance.fp.signedOn"), type: "date" },
          { name: "ceasedOn", label: t("compliance.fp.ceasedOn"), type: "date", hidden: !form?.id },
          { name: "remarks", label: t("compliance.remarks"), type: "textarea", wide: true },
          { name: "documents", label: t("compliance.documents"), type: "documents", wide: true, help: t("compliance.fp.documentsHelp") },
        ]}>
        <div className="compliance__field--wide">
          <h4>{t("compliance.fp.declarations")}</h4>
          {(form?.declarations || []).map((d, i) => (
            <div key={d.item} className="compliance__declaration">
              <span>{d.item}</span>
              <SelectButton value={d.answer} options={answerOptions} onChange={(e) => setAnswer(i, { answer: e.value })} />
              {d.answer === "no" ? <InputText className="compliance__field--wide" value={d.remarks} placeholder={t("compliance.fp.explain")} onChange={(e) => setAnswer(i, { remarks: e.target.value })} /> : null}
            </div>
          ))}
        </div>
      </FormDialog>
      <FormDialog header={t("compliance.fp.reviewTitle", { person: review?.person || "" })} visible={!!review} form={review} setForm={setReview} onHide={() => setReview(null)}
        onSubmit={saveReview} saving={saving} valid={!!review?.outcome} submitLabel={t("compliance.fp.recordReview")}
        fields={[
          { name: "outcome", label: t("compliance.fp.outcome"), type: "dropdown", required: true, options: asOptions(OUTCOMES, t, "compliance.state") },
          { name: "reviewedOn", label: t("compliance.fp.reviewedOn"), type: "date" },
          { name: "notes", label: t("compliance.fp.notes"), type: "textarea", wide: true },
        ]} />
    </div>
  );
};

export default FitAndProper;
