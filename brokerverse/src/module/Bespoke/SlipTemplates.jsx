import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import bespokeService from "../../services/bespokeService";
import { BespokeTag, PageHeader, move } from "./shared";
import "../Placement/index.scss";
import "./index.scss";

const LINES = ["FIRE", "IAR", "MARINE", "ENGINEERING", "CASUALTY", "ACCIDENT", "MOTOR", "BOND"];

/** Master > Slip Templates: the sections and library clauses a new composed slip starts from. */
const SlipTemplates = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [clauses, setClauses] = useState([]);
  const [sectionOptions, setSectionOptions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [pick, setPick] = useState(null);
  const [saving, setSaving] = useState(false);

  const fail = (e) => toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 5000 });
  const load = useCallback(async () => {
    try {
      setRows(await bespokeService.listTemplates({ status: "all" }));
    } catch (e) {
      fail(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    bespokeService.listClauses({}).then(setClauses).catch(() => {});
    bespokeService.clauseOptions().then((o) => setSectionOptions(o.sections || [])).catch(() => {});
  }, []);

  const open = async (row) => {
    if (!row) {
      setEditing({ isNew: true, code: "", name: "", linesOfBusiness: [], description: "", status: "active", sections: sectionOptions.map((s) => ({ ...s, text: "" })), clauses: [] });
      return;
    }
    try {
      setEditing({ ...(await bespokeService.getTemplate(row.id)), isNew: false });
    } catch (e) {
      fail(e);
    }
  };
  const save = async () => {
    setSaving(true);
    try {
      const body = { name: editing.name, linesOfBusiness: editing.linesOfBusiness, description: editing.description, status: editing.status,
        sections: editing.sections.map(({ key, heading, text }) => ({ key, heading, text })), clauseIds: editing.clauses.map((c) => c.clauseId) };
      if (editing.isNew) await bespokeService.createTemplate({ ...body, code: editing.code });
      else await bespokeService.updateTemplate(editing.id, body);
      toast.current?.show({ severity: "success", summary: t("bespoke.templates.saved"), life: 3000 });
      setEditing(null);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };
  const setSection = (i, patch) => setEditing({ ...editing, sections: editing.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const addClause = () => {
    const c = clauses.find((x) => x.id === pick);
    if (!c || editing.clauses.some((x) => x.clauseId === c.id)) return;
    setEditing({ ...editing, clauses: [...editing.clauses, { clauseId: c.id, code: c.code, title: c.title, clauseType: c.clauseType }] });
    setPick(null);
  };

  return (
    <div className="placement-page bespoke-page">
      <Toast ref={toast} />
      <PageHeader title={t("bespoke.templates.title")} subtitle={t("bespoke.templates.subtitle")}>
        <Button label={t("bespoke.templates.new")} icon="pi pi-plus" onClick={() => open(null)} />
      </PageHeader>
      <div className="placement-card">
        <DataTable value={rows} dataKey="id" stripedRows size="small" className="placement-grid" emptyMessage={t("bespoke.templates.empty")} onRowClick={(e) => open(e.data)} rowClassName={() => "clickable"}>
          <Column field="code" header={t("bespoke.fields.code")} body={(r) => <span className="doc-number">{r.code}</span>} />
          <Column field="name" header={t("bespoke.fields.name")} />
          <Column header={t("bespoke.fields.lines")} body={(r) => (r.linesOfBusiness.length ? r.linesOfBusiness.join(", ") : t("bespoke.library.allLines"))} />
          <Column field="clauseCount" header={t("bespoke.templates.clauses")} className="num" />
          <Column header={t("bespoke.fields.status")} body={(r) => <BespokeTag status={r.status} />} />
        </DataTable>
      </div>

      <Dialog header={editing?.isNew ? t("bespoke.templates.new") : editing?.name} visible={!!editing} style={{ width: "min(1000px, 96vw)" }} onHide={() => setEditing(null)} className="placement-dialog"
        footer={<Button label={t("common.save", { defaultValue: "Save" })} icon="pi pi-check" loading={saving} onClick={save} disabled={!editing?.name || (editing?.isNew && !editing?.code)} />}>
        {editing && (
          <div className="grid">
            <div className="col-12 md:col-3">
              <label htmlFor="tp-code">{t("bespoke.fields.code")}</label>
              <InputText id="tp-code" value={editing.code} disabled={!editing.isNew} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} className="w-full" />
            </div>
            <div className="col-12 md:col-5">
              <label htmlFor="tp-name">{t("bespoke.fields.name")}</label>
              <InputText id="tp-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-4">
              <label htmlFor="tp-lines">{t("bespoke.fields.lines")}</label>
              <MultiSelect inputId="tp-lines" value={editing.linesOfBusiness} options={LINES.map((l) => ({ label: l, value: l }))} onChange={(e) => setEditing({ ...editing, linesOfBusiness: e.value })}
                className="w-full" display="chip" placeholder={t("bespoke.library.allLines")} />
            </div>
            <div className="col-12 md:col-9">
              <label htmlFor="tp-desc">{t("bespoke.fields.description")}</label>
              <InputText id="tp-desc" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-3">
              <label htmlFor="tp-status">{t("bespoke.fields.status")}</label>
              <Dropdown inputId="tp-status" value={editing.status} options={["active", "inactive"].map((s) => ({ label: t(`bespoke.status.${s}`), value: s }))} onChange={(e) => setEditing({ ...editing, status: e.value })} className="w-full" />
            </div>
            <div className="col-12">
              <div className="section-title">{t("bespoke.composer.sections")}</div>
              {editing.sections.map((s, i) => (
                <div key={`${s.key}-${i}`} className="grid align-items-start section-row">
                  <div className="col-12 md:col-3"><InputText value={s.heading} onChange={(e) => setSection(i, { heading: e.target.value })} className="w-full" aria-label={t("bespoke.fields.heading")} /></div>
                  <div className="col-10 md:col-8"><InputTextarea value={s.text} onChange={(e) => setSection(i, { text: e.target.value })} rows={1} autoResize className="w-full" aria-label={t("bespoke.fields.text")} /></div>
                  <div className="col-2 md:col-1">
                    <Button icon="pi pi-times" text rounded severity="secondary" onClick={() => setEditing({ ...editing, sections: editing.sections.filter((_, j) => j !== i) })} aria-label={t("bespoke.actions.remove")} />
                  </div>
                </div>
              ))}
              <Button label={t("bespoke.composer.addSection")} icon="pi pi-plus" text onClick={() => setEditing({ ...editing, sections: [...editing.sections, { key: "", heading: t("bespoke.composer.newSection"), text: "" }] })} />
            </div>
            <div className="col-12">
              <div className="section-title">{t("bespoke.templates.clauses")}</div>
              <ol className="clause-order">
                {editing.clauses.map((c, i) => (
                  <li key={c.clauseId}>
                    <span className="doc-number">{c.code}</span> {c.title} <span className="muted small">({t(`bespoke.clauseType.${c.clauseType}`, { defaultValue: c.clauseType })})</span>
                    <span className="row-actions">
                      <Button icon="pi pi-arrow-up" text rounded size="small" onClick={() => setEditing({ ...editing, clauses: move(editing.clauses, i, -1) })} aria-label={t("bespoke.actions.up")} />
                      <Button icon="pi pi-arrow-down" text rounded size="small" onClick={() => setEditing({ ...editing, clauses: move(editing.clauses, i, 1) })} aria-label={t("bespoke.actions.down")} />
                      <Button icon="pi pi-times" text rounded size="small" severity="secondary" onClick={() => setEditing({ ...editing, clauses: editing.clauses.filter((_, j) => j !== i) })} aria-label={t("bespoke.actions.remove")} />
                    </span>
                  </li>
                ))}
              </ol>
              <div className="flex gap-2 align-items-center">
                <Dropdown value={pick} options={clauses.map((c) => ({ label: `${c.code} ${c.title}`, value: c.id }))} onChange={(e) => setPick(e.value)} filter placeholder={t("bespoke.composer.pickClause")} className="flex-1" />
                <Button label={t("bespoke.actions.add")} icon="pi pi-plus" onClick={addClause} disabled={!pick} />
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default SlipTemplates;
