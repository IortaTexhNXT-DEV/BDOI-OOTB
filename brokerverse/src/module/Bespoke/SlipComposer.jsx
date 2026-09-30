import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Dropdown } from "primereact/dropdown";
import { SelectButton } from "primereact/selectbutton";
import { Dialog } from "primereact/dialog";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import bespokeService from "../../services/bespokeService";
import placementService from "../../services/placementService";
import { BespokeTag, DiffText, PageHeader, formatDate, move } from "./shared";
import "../Placement/index.scss";
import "./index.scss";

/** Broker slip / placement picker for a new composed slip. */
export const LinkPicker = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const kind = value?.kind || "brokerSlip";
  useEffect(() => {
    let alive = true;
    const call = kind === "placement" ? placementService.listPlacements({ pageSize: 100, status: "draft,sent,bound,declined" }) : placementService.listSlips({ pageSize: 100, status: "draft,submitted,responses-in" });
    call.then((r) => alive && setRows(r.data || [])).catch(() => alive && setRows([]));
    return () => { alive = false; };
  }, [kind]);
  const options = rows.map((r) => ({ label: `${r.slipNumber || r.placementNumber} ${r.insuredName || r.customerName || ""}`, value: r.id }));
  return (
    <div>
      <SelectButton value={kind} options={[{ label: t("bespoke.composer.forRfq"), value: "brokerSlip" }, { label: t("bespoke.composer.forPlacement"), value: "placement" }]}
        onChange={(e) => e.value && onChange({ kind: e.value, id: null })} className="mb-2" />
      <Dropdown value={value?.id || null} options={options} onChange={(e) => onChange({ kind, id: e.value })} filter className="w-full" placeholder={t("bespoke.composer.chooseLink")} />
    </div>
  );
};

/** List of composed slips and the "new slip" dialog. */
const ComposerList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(null);
  const [templates, setTemplates] = useState([]);
  const load = useCallback(async () => {
    try {
      setRows(await bespokeService.listSlips({ search: search || undefined, brokerSlipId: params.get("brokerSlipId") || undefined, placementId: params.get("placementId") || undefined }));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 5000 });
    }
  }, [search, params, t]);
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h); }, [load]);
  useEffect(() => { bespokeService.listTemplates().then(setTemplates).catch(() => {}); }, []);
  const create = async () => {
    try {
      const body = { templateId: creating.templateId || undefined, title: creating.title || undefined };
      if (creating.link?.id) body[creating.link.kind === "placement" ? "placementId" : "brokerSlipId"] = creating.link.id;
      const s = await bespokeService.createSlip(body);
      navigate(`/placement/bespoke/composer/${s.id}`);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 5000 });
    }
  };
  return (
    <div className="placement-page bespoke-page">
      <Toast ref={toast} />
      <PageHeader title={t("bespoke.composer.title")} subtitle={t("bespoke.composer.subtitle")}>
        <Button label={t("bespoke.composer.new")} icon="pi pi-plus" onClick={() => setCreating({ link: { kind: params.get("placementId") ? "placement" : "brokerSlip", id: params.get("brokerSlipId") || params.get("placementId") }, templateId: null })} />
      </PageHeader>
      <div className="placement-card">
        <div className="toolbar">
          <span className="p-input-icon-left search">
            <i className="pi pi-search" />
            <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("bespoke.composer.search")} />
          </span>
        </div>
        <DataTable value={rows} dataKey="id" stripedRows size="small" className="placement-grid" paginator rows={15} emptyMessage={t("bespoke.composer.empty")}
          onRowClick={(e) => navigate(`/placement/bespoke/composer/${e.data.id}`)} rowClassName={() => "clickable"}>
          <Column field="slipNumber" header={t("bespoke.fields.number")} body={(r) => <span className="doc-number">{r.slipNumber}</span>} />
          <Column field="title" header={t("bespoke.fields.title")} />
          <Column header={t("bespoke.fields.link")} body={(r) => r.brokerSlipNumber || r.placementNumber || "-"} />
          <Column field="insuredName" header={t("bespoke.fields.insured")} />
          <Column field="version" header={t("bespoke.fields.version")} className="num" />
          <Column header={t("bespoke.fields.status")} body={(r) => <BespokeTag status={r.status} />} />
          <Column header={t("bespoke.fields.updated")} body={(r) => `${formatDate(r.updatedAt)} ${r.updatedBy || ""}`} />
        </DataTable>
      </div>
      <Dialog header={t("bespoke.composer.new")} visible={!!creating} style={{ width: "min(640px, 96vw)" }} onHide={() => setCreating(null)} className="placement-dialog"
        footer={<Button label={t("bespoke.composer.start")} icon="pi pi-check" onClick={create} />}>
        {creating && (
          <div className="grid">
            <div className="col-12"><LinkPicker value={creating.link} onChange={(link) => setCreating({ ...creating, link })} /></div>
            <div className="col-12">
              <label htmlFor="new-template">{t("bespoke.composer.template")}</label>
              <Dropdown inputId="new-template" value={creating.templateId} options={[{ label: t("bespoke.composer.blank"), value: null }, ...templates.map((x) => ({ label: `${x.name} (${x.code})`, value: x.id }))]}
                onChange={(e) => setCreating({ ...creating, templateId: e.value })} className="w-full" />
            </div>
            <div className="col-12">
              <label htmlFor="new-title">{t("bespoke.fields.title")}</label>
              <InputText id="new-title" value={creating.title || ""} onChange={(e) => setCreating({ ...creating, title: e.target.value })} className="w-full" placeholder={t("bespoke.composer.titleHint")} />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

/** The composer: placeholder values, sections, clauses (library or manuscript), versions and diff. */
const ComposerEditor = ({ id }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [slip, setSlip] = useState(null);
  const [draft, setDraft] = useState(null);
  const [library, setLibrary] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [types, setTypes] = useState([]);
  const [pick, setPick] = useState(null);
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [diff, setDiff] = useState(null);
  const [manuscript, setManuscript] = useState(null);

  const fail = (e) => toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 6000 });
  const reset = (s) => {
    setSlip(s);
    setDraft({ title: s.title, variables: { ...s.variables }, sections: s.sections.map(({ key, heading, text }) => ({ key, heading, text })),
      clauses: s.clauses.map((c) => ({ clauseId: c.clauseId, clauseVersion: c.clauseVersion, code: c.code, title: c.title, clauseType: c.clauseType, wording: c.wording, libraryWording: c.libraryWording, newerVersionAvailable: c.newerVersionAvailable, latestVersion: c.latestVersion })) });
  };
  const load = useCallback(async () => {
    try {
      reset(await bespokeService.getSlip(id));
    } catch (e) {
      fail(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    bespokeService.clauseOptions().then((o) => { setPlaceholders(o.placeholders || []); setTypes(o.clauseTypes || []); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (slip) bespokeService.listClauses({ lob: slip.lob || undefined }).then(setLibrary).catch(() => {});
  }, [slip]);

  const editable = slip?.status === "draft";
  const usedKeys = useMemo(() => {
    if (!draft) return [];
    const text = [...draft.sections.map((s) => s.text), ...draft.clauses.map((c) => c.wording)].join(" ");
    return [...new Set([...text.matchAll(/\{([a-z][a-z0-9_]*)\}/g)].map((m) => m[1]))];
  }, [draft]);
  if (!slip || !draft) return <div className="placement-page"><Toast ref={toast} /></div>;

  const setClause = (i, patch) => setDraft({ ...draft, clauses: draft.clauses.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const setSection = (i, patch) => setDraft({ ...draft, sections: draft.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const addLibraryClause = async () => {
    try {
      const c = await bespokeService.libraryClause(pick);
      setDraft({ ...draft, clauses: [...draft.clauses, { ...c, libraryWording: c.wording }] });
      setPick(null);
    } catch (e) {
      fail(e);
    }
  };
  const updateToLatest = async (i) => {
    try {
      const c = await bespokeService.libraryClause(draft.clauses[i].clauseId);
      setClause(i, { clauseVersion: c.clauseVersion, wording: c.wording, libraryWording: c.wording, newerVersionAvailable: false });
    } catch (e) {
      fail(e);
    }
  };
  const save = async () => {
    setSaving(true);
    try {
      const r = await bespokeService.saveSlip(slip.id, { title: draft.title, variables: Object.fromEntries(Object.entries(draft.variables).filter(([, v]) => v !== "" && v !== null)),
        sections: draft.sections, clauses: draft.clauses.map((c) => (c.clauseId ? { clauseId: c.clauseId, clauseVersion: c.clauseVersion, wording: c.wording, title: c.title } : { title: c.title, clauseType: c.clauseType, wording: c.wording, code: c.code })),
        changeNote: changeNote || undefined });
      toast.current?.show({ severity: "success", summary: r.message, detail: (r.changes || []).join("; "), life: 5000 });
      setChangeNote("");
      reset(r.data);
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };
  const action = async (name) => {
    try {
      reset(await bespokeService.slipAction(slip.id, name));
    } catch (e) {
      fail(e);
    }
  };
  const showDiff = async (version) => {
    try {
      setDiff(await bespokeService.slipDiff(slip.id, Math.max(1, version - 1), version));
    } catch (e) {
      fail(e);
    }
  };
  const typeLabel = (c) => t(`bespoke.clauseType.${c}`, { defaultValue: c });

  return (
    <div className="placement-page bespoke-page">
      <Toast ref={toast} />
      <PageHeader title={`${slip.slipNumber} ${slip.title}`} subtitle={[slip.brokerSlipNumber, slip.placementNumber, slip.insuredName].filter(Boolean).join(" | ")} onBack={() => navigate("/placement/bespoke/composer")}>
        <BespokeTag status={slip.status} />
        <Tag value={`${t("bespoke.fields.version")} ${slip.version}`} severity="secondary" className="ml-2" />
        <Button label={t("bespoke.actions.print")} icon="pi pi-print" text onClick={() => bespokeService.openSlipPdf(slip.id).catch(fail)} />
        {editable && <Button label={t("bespoke.actions.save")} icon="pi pi-save" loading={saving} onClick={save} />}
        {editable && <Button label={t("bespoke.actions.finalise")} icon="pi pi-lock" severity="success" outlined onClick={() => action("finalise")} />}
        {slip.status === "final" && <Button label={t("bespoke.actions.reopen")} icon="pi pi-lock-open" outlined onClick={() => action("reopen")} />}
      </PageHeader>

      <div className="grid">
        <div className="col-12 lg:col-8">
          <div className="placement-card">
            <label htmlFor="cmp-title">{t("bespoke.fields.title")}</label>
            <InputText id="cmp-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full" disabled={!editable} />
            <div className="section-title">{t("bespoke.composer.sections")}</div>
            {draft.sections.map((s, i) => (
              <div key={`${s.key}-${i}`} className="grid align-items-start section-row">
                <div className="col-12 md:col-3"><InputText value={s.heading} onChange={(e) => setSection(i, { heading: e.target.value })} className="w-full" disabled={!editable} aria-label={t("bespoke.fields.heading")} /></div>
                <div className="col-12 md:col-7"><InputTextarea value={s.text} onChange={(e) => setSection(i, { text: e.target.value })} rows={1} autoResize className="w-full" disabled={!editable} aria-label={t("bespoke.fields.text")} /></div>
                {editable && (
                  <div className="col-12 md:col-2 row-actions">
                    <Button icon="pi pi-arrow-up" text rounded size="small" onClick={() => setDraft({ ...draft, sections: move(draft.sections, i, -1) })} aria-label={t("bespoke.actions.up")} />
                    <Button icon="pi pi-arrow-down" text rounded size="small" onClick={() => setDraft({ ...draft, sections: move(draft.sections, i, 1) })} aria-label={t("bespoke.actions.down")} />
                    <Button icon="pi pi-times" text rounded size="small" severity="secondary" onClick={() => setDraft({ ...draft, sections: draft.sections.filter((_, j) => j !== i) })} aria-label={t("bespoke.actions.remove")} />
                  </div>
                )}
              </div>
            ))}
            {editable && <Button label={t("bespoke.composer.addSection")} icon="pi pi-plus" text onClick={() => setDraft({ ...draft, sections: [...draft.sections, { key: "", heading: t("bespoke.composer.newSection"), text: "" }] })} />}

            <div className="section-title">{t("bespoke.composer.clauses")}</div>
            {draft.clauses.map((c, i) => {
              const edited = c.clauseId ? c.wording !== c.libraryWording : true;
              return (
                <div key={`${c.clauseId || c.title}-${i}`} className="clause-card">
                  <div className="clause-head">
                    <span className="clause-no">{i + 1}.</span>
                    {c.code && <span className="doc-number">{c.code}</span>}
                    <InputText value={c.title} onChange={(e) => setClause(i, { title: e.target.value })} disabled={!editable} className="clause-title" aria-label={t("bespoke.fields.title")} />
                    <Tag value={typeLabel(c.clauseType)} severity="info" />
                    {c.clauseId ? <Tag value={`v${c.clauseVersion}`} severity="secondary" /> : null}
                    {edited && <Tag value={t("bespoke.composer.manuscript")} severity="warning" />}
                    {c.newerVersionAvailable && editable && <Button label={t("bespoke.composer.useLatest", { version: c.latestVersion })} size="small" text onClick={() => updateToLatest(i)} />}
                    {editable && (
                      <span className="row-actions">
                        {c.clauseId && edited && <Button icon="pi pi-replay" text rounded size="small" tooltip={t("bespoke.composer.restore")} onClick={() => setClause(i, { wording: c.libraryWording })} aria-label={t("bespoke.composer.restore")} />}
                        <Button icon="pi pi-arrow-up" text rounded size="small" onClick={() => setDraft({ ...draft, clauses: move(draft.clauses, i, -1) })} aria-label={t("bespoke.actions.up")} />
                        <Button icon="pi pi-arrow-down" text rounded size="small" onClick={() => setDraft({ ...draft, clauses: move(draft.clauses, i, 1) })} aria-label={t("bespoke.actions.down")} />
                        <Button icon="pi pi-times" text rounded size="small" severity="secondary" onClick={() => setDraft({ ...draft, clauses: draft.clauses.filter((_, j) => j !== i) })} aria-label={t("bespoke.actions.remove")} />
                      </span>
                    )}
                  </div>
                  <InputTextarea value={c.wording} onChange={(e) => setClause(i, { wording: e.target.value })} rows={2} autoResize className="w-full" disabled={!editable} aria-label={t("bespoke.fields.wording")} />
                </div>
              );
            })}
            {editable && (
              <div className="flex gap-2 align-items-center flex-wrap mt-2">
                <Dropdown value={pick} options={library.map((c) => ({ label: `${c.code} ${c.title} (${typeLabel(c.clauseType)})`, value: c.id }))} onChange={(e) => setPick(e.value)} filter
                  placeholder={t("bespoke.composer.pickClause")} className="flex-1" />
                <Button label={t("bespoke.composer.addClause")} icon="pi pi-plus" onClick={addLibraryClause} disabled={!pick} />
                <Button label={t("bespoke.composer.addManuscript")} icon="pi pi-pencil" outlined onClick={() => setManuscript({ title: "", clauseType: types[0] || "clause", wording: "" })} />
              </div>
            )}
            {editable && (
              <div className="mt-3">
                <label htmlFor="cmp-note">{t("bespoke.fields.changeNote")}</label>
                <InputText id="cmp-note" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} className="w-full" />
              </div>
            )}
          </div>
        </div>
        <div className="col-12 lg:col-4">
          <div className="placement-card">
            <div className="section-title mt-0">{t("bespoke.composer.values")}</div>
            {usedKeys.map((k) => {
              const label = placeholders.find((p) => p.key === k)?.label || k;
              return (
                <div key={k} className="mb-2">
                  <label htmlFor={`var-${k}`}>{label} <span className="muted small">{`{${k}}`}</span></label>
                  <InputText id={`var-${k}`} value={draft.variables[k] ?? ""} placeholder={slip.derivedVariables?.[k] ? String(slip.derivedVariables[k]) : t("bespoke.composer.missing")}
                    onChange={(e) => setDraft({ ...draft, variables: { ...draft.variables, [k]: e.target.value } })} className="w-full" disabled={!editable} />
                </div>
              );
            })}
            {!usedKeys.length && <span className="muted small">{t("bespoke.composer.noPlaceholders")}</span>}
          </div>
          <div className="placement-card">
            <div className="section-title mt-0">{t("bespoke.composer.history")}</div>
            <ul className="version-list">
              {slip.versions.map((v) => (
                <li key={v.version}>
                  <div className="flex justify-content-between align-items-center">
                    <strong>{t("bespoke.fields.version")} {v.version}</strong>
                    {v.version > 1 && <Button label={t("bespoke.composer.compare")} size="small" text onClick={() => showDiff(v.version)} />}
                  </div>
                  <span className="muted small">{v.changedBy} | {formatDate(v.changedAt)}</span>
                  {v.changeNote && <div className="small">{v.changeNote}</div>}
                  <ul className="change-list">{(v.changes || []).map((c, i) => <li key={i}>{c}</li>)}</ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Dialog header={diff ? t("bespoke.composer.diffTitle", { from: diff.from.version, to: diff.to.version }) : ""} visible={!!diff} style={{ width: "min(900px, 96vw)" }} onHide={() => setDiff(null)} className="placement-dialog">
        {diff && (
          <div>
            <p className="muted">{diff.to.changedBy} | {formatDate(diff.to.changedAt)}</p>
            <ul className="change-list">{diff.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
            {[...diff.sections, ...diff.clauses].filter((x) => x.diff).map((x) => (
              <div key={`${x.key}-${x.change}`} className="diff-block">
                <strong>{x.heading || x.label}</strong> <Tag value={t(`bespoke.diff.${x.change}`, { defaultValue: x.change })} severity="secondary" />
                <div><DiffText parts={x.diff} /></div>
              </div>
            ))}
          </div>
        )}
      </Dialog>
      <Dialog header={t("bespoke.composer.addManuscript")} visible={!!manuscript} style={{ width: "min(720px, 96vw)" }} onHide={() => setManuscript(null)} className="placement-dialog"
        footer={<Button label={t("bespoke.actions.add")} icon="pi pi-plus" disabled={!manuscript?.title || !manuscript?.wording}
          onClick={() => { setDraft({ ...draft, clauses: [...draft.clauses, { ...manuscript, clauseId: null }] }); setManuscript(null); }} />}>
        {manuscript && (
          <div className="grid">
            <div className="col-12 md:col-8">
              <label htmlFor="ms-title">{t("bespoke.fields.title")}</label>
              <InputText id="ms-title" value={manuscript.title} onChange={(e) => setManuscript({ ...manuscript, title: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-4">
              <label htmlFor="ms-type">{t("bespoke.fields.clauseType")}</label>
              <Dropdown inputId="ms-type" value={manuscript.clauseType} options={types.map((c) => ({ label: typeLabel(c), value: c }))} onChange={(e) => setManuscript({ ...manuscript, clauseType: e.value })} className="w-full" />
            </div>
            <div className="col-12">
              <label htmlFor="ms-wording">{t("bespoke.fields.wording")}</label>
              <InputTextarea id="ms-wording" value={manuscript.wording} onChange={(e) => setManuscript({ ...manuscript, wording: e.target.value })} rows={5} autoResize className="w-full" />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

/** Operations > Placement > Slip Composer. */
const SlipComposer = () => {
  const { id } = useParams();
  return id ? <ComposerEditor id={id} /> : <ComposerList />;
};

export default SlipComposer;
