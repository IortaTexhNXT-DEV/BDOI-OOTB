import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputSwitch } from "primereact/inputswitch";
import { SelectButton } from "primereact/selectbutton";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import SvgDot from "../../../assets/icons/SvgDot";
import postingRulesService from "../../../services/postingRulesService";
import DateField from "../../../components/DateField";
import "./index.scss";

const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const blankLine = (amountKey) => ({ side: "Dr", accountType: "role", account: "", fallbackRole: null, amountKey, perParticipant: false, narration: "" });
const editable = (l) => ({ side: l.side, accountType: l.accountType, account: l.account, fallbackRole: l.fallbackRole || null, amountKey: l.amountKey, perParticipant: !!l.perParticipant, narration: l.narration || "" });

/**
 * Master > Finance > Posting Rules: the rule behind every system journal. Pick a business event, read the version in
 * force, simulate the journal it builds for a sample (single insurer or co-insured), or save a new version effective from
 * a date. The server validates the lines against the event and refuses a version whose sample journal does not balance.
 */
const PostingRules = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const [events, setEvents] = useState([]);
  const [meta, setMeta] = useState({ sides: [], accountTypes: [], roles: [], resolvers: [], branchSources: [] });
  const [gl, setGl] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [versions, setVersions] = useState([]);
  const [versionId, setVersionId] = useState(null);
  const [edit, setEdit] = useState(null); // { lines, effectiveFrom, changeNote, narration, branchSource }
  const [sim, setSim] = useState(null);
  const [coInsurance, setCoInsurance] = useState(false);
  const [history, setHistory] = useState(null);
  const [saving, setSaving] = useState(false);

  const fail = (e) => toast.current?.show({ severity: "error", summary: t("postingRules.error"), detail: e.message, life: 8000 });

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      setEvents(await postingRulesService.events());
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadEvents();
    postingRulesService.meta().then(setMeta).catch(fail);
    postingRulesService.glAccounts().then((rows) => setGl(rows || [])).catch(() => setGl([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadEvents]);

  const loadVersions = useCallback(async (ev, keep) => {
    try {
      const rows = await postingRulesService.rules(ev.eventCode);
      setVersions(rows);
      setVersionId(keep || ev.activeRuleId || rows[0]?.id || null);
    } catch (e) {
      fail(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (ev) => {
    setSelected(ev);
    setEdit(null);
    setSim(null);
    setCoInsurance(false);
    if (ev) loadVersions(ev);
  };

  const rule = versions.find((v) => v.id === versionId) || null;
  const modules = useMemo(() => [...new Set(events.map((e) => e.module))].sort().map((m) => ({ label: m, value: m })), [events]);
  const shown = useMemo(() => events.filter((e) => (!moduleFilter || e.module === moduleFilter)
    && (!search.trim() || `${e.label} ${e.eventCode}`.toLowerCase().includes(search.trim().toLowerCase()))), [events, moduleFilter, search]);

  const roleOptions = useMemo(() => meta.roles.map((r) => ({ label: `${r.role} → ${r.glCode || "?"}${r.glName ? ` ${r.glName}` : ""}`, value: r.role })), [meta]);
  const glOptions = useMemo(() => gl.map((a) => ({ label: `${a.code} – ${a.name}`, value: a.code })), [gl]);
  const resolverOptions = useMemo(() => meta.resolvers.map((r) => ({ label: `${r.name} – ${r.label}`, value: r.name })), [meta]);
  const typeOptions = meta.accountTypes.map((x) => ({ label: t(`postingRules.accountType.${x}`), value: x }));
  const amountOptions = (selected?.amountKeys || []).map((k) => ({ label: k, value: k }));
  const branchOptions = meta.branchSources.map((x) => ({ label: t(`postingRules.branchSource.${x}`), value: x }));

  const accountLabel = (l) => {
    if (l.accountType === "role") {
      const r = meta.roles.find((x) => x.role === l.account);
      return `${l.account} (${r?.glCode || "?"}${r?.glName ? ` ${r.glName}` : ""})`;
    }
    if (l.accountType === "gl") return `${l.account} ${gl.find((a) => a.code === l.account)?.name || ""}`.trim();
    if (l.accountType === "resolver") return `${t("postingRules.accountType.resolver")}: ${l.account}${l.fallbackRole ? ` / ${l.fallbackRole}` : ""}`;
    return `${t("postingRules.accountType.context")}: ${l.account}${l.fallbackRole ? ` / ${l.fallbackRole}` : ""}`;
  };

  const runSimulation = async (lines) => {
    if (!selected) return;
    try {
      const body = { eventCode: selected.eventCode, coInsurance };
      if (lines) Object.assign(body, { lines, narration: edit?.narration || undefined });
      else if (rule) body.ruleId = rule.id;
      setSim(await postingRulesService.simulate(body));
    } catch (e) {
      setSim(null);
      fail(e);
    }
  };

  const startEdit = () => setEdit({ lines: (rule?.lines || []).map(editable), effectiveFrom: today(), changeNote: "", narration: rule?.narration || "", branchSource: rule?.branchSource || "policy_owner" });
  const setLine = (i, patch) => setEdit((e) => ({ ...e, lines: e.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const moveLine = (i, d) => setEdit((e) => {
    const lines = [...e.lines];
    const [x] = lines.splice(i, 1);
    lines.splice(Math.max(0, Math.min(lines.length, i + d)), 0, x);
    return { ...e, lines };
  });

  const save = async () => {
    setSaving(true);
    try {
      const out = await postingRulesService.saveVersion(selected.eventCode, { lines: edit.lines, effectiveFrom: edit.effectiveFrom, changeNote: edit.changeNote || undefined,
        narration: edit.narration || null, branchSource: edit.branchSource });
      toast.current?.show(out.change
        ? { severity: "info", summary: t("postingRules.saved"), detail: t("postingRules.versionPending", { version: out.version }), life: 6000 }
        : { severity: "success", summary: t("postingRules.saved"), detail: t("postingRules.versionSaved", { version: out.version }), life: 4000 });
      setEdit(null);
      await loadEvents();
      await loadVersions(selected, out.id);
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    try {
      const out = await postingRulesService.setActive(rule.id, !rule.active);
      if (out.change) toast.current?.show({ severity: "info", summary: t("postingRules.saved"), detail: t("postingRules.changePending"), life: 6000 });
      await loadEvents();
      await loadVersions(selected, rule.id);
    } catch (e) {
      fail(e);
    }
  };

  const openHistory = async () => {
    try {
      setHistory(await postingRulesService.history(rule.id));
    } catch (e) {
      fail(e);
    }
  };

  const accountEditor = (l, i) => {
    if (l.accountType === "role") return <Dropdown value={l.account} options={roleOptions} filter onChange={(e) => setLine(i, { account: e.value })} placeholder={t("postingRules.pickRole")} className="w-full" />;
    if (l.accountType === "gl") return <Dropdown value={l.account} options={glOptions} filter onChange={(e) => setLine(i, { account: e.value })} placeholder={t("postingRules.pickGl")} className="w-full" />;
    if (l.accountType === "resolver") return <Dropdown value={l.account} options={resolverOptions} onChange={(e) => setLine(i, { account: e.value })} placeholder={t("postingRules.pickResolver")} className="w-full" />;
    return <InputText value={l.account} onChange={(e) => setLine(i, { account: e.target.value })} placeholder={(selected?.contextAccounts || []).join(", ") || "account key"} className="w-full" />;
  };

  const versionOptions = versions.map((v) => ({ label: `v${v.version} · ${v.effectiveFrom}${v.approvalStatus && v.approvalStatus !== "approved" ? ` (${t(`postingRules.approval.${v.approvalStatus}`)})` : v.active ? "" : ` (${t("postingRules.inactive")})`}${v.id === selected?.activeRuleId ? ` · ${t("postingRules.inForce")}` : ""}`, value: v.id }));

  return (
    <div className="posting-rules">
      <Toast ref={toast} />
      <div className="grid m-0">
        <div className="col-12 p-0">
          <div className="posting-rules__title">{t("postingRules.title")}</div>
          <BreadCrumb home={{ label: t("postingRules.master") }} className="posting-rules__crumbs" separatorIcon={<SvgDot color={"#000"} />}
            model={[{ label: t("postingRules.finance") }, { label: t("postingRules.title"), url: "/master/finance/posting-rules" }]} />
        </div>
      </div>

      <div className="grid">
        <div className="col-12 xl:col-5">
          <div className="posting-rules__card">
            <div className="flex gap-2 mb-2">
              <span className="p-input-icon-left flex-1">
                <i className="pi pi-search" />
                <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("postingRules.searchEvents")} className="w-full" />
              </span>
              <Dropdown value={moduleFilter} options={modules} onChange={(e) => setModuleFilter(e.value)} placeholder={t("postingRules.allModules")} showClear />
            </div>
            <DataTable value={shown} loading={loading} selectionMode="single" selection={selected} onSelectionChange={(e) => choose(e.value)} dataKey="eventCode"
              size="small" stripedRows scrollable scrollHeight="560px" emptyMessage={t("postingRules.noEvents")}>
              <Column header={t("postingRules.event")} body={(e) => (<div><div className="font-semibold">{e.label}</div><code className="text-500">{e.eventCode}</code> <span className="text-500 text-sm">· {e.module}</span></div>)} />
              <Column header={t("postingRules.version")} style={{ width: "5.5rem" }} body={(e) => (
                <span className="flex flex-column gap-1">
                  {e.activeVersion ? <Tag value={`v${e.activeVersion}`} severity="success" /> : <Tag value={t("postingRules.none")} severity="danger" />}
                  {e.pending && <Tag value={`v${e.pending.version} ${t("postingRules.approval.pending")}`} severity="warning" />}
                </span>
              )} />
            </DataTable>
          </div>
        </div>

        <div className="col-12 xl:col-7">
          {!selected && <div className="posting-rules__card posting-rules__empty">{t("postingRules.pickEvent")}</div>}
          {selected && (
            <div className="posting-rules__card">
              <div className="flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                  <div className="posting-rules__event">{selected.label}</div>
                  <code>{selected.eventCode}</code>
                  {selected.perParticipant && <Tag className="ml-2" value={t("postingRules.coInsuranceAware")} severity="warning" icon="pi pi-users" />}
                  {rule?.description && <p className="text-600 mt-2 mb-0">{rule.description}</p>}
                </div>
                <div className="flex gap-2 align-items-center">
                  <Dropdown value={versionId} options={versionOptions} onChange={(e) => { setVersionId(e.value); setSim(null); }} disabled={!!edit} />
                  {!edit && <Button label={t("postingRules.newVersion")} icon="pi pi-pencil" onClick={startEdit} disabled={!rule} />}
                </div>
              </div>

              <div className="posting-rules__chips">
                <span className="text-600 mr-2">{t("postingRules.amounts")}:</span>
                {(selected.amountKeys || []).map((k) => <Tag key={k} value={k} severity="info" className="mr-1 mb-1" />)}
                <span className="text-600 mx-2">{t("postingRules.variables")}:</span>
                {(selected.vars || []).map((k) => <code key={k} className="mr-2">{`{{${k}}}`}</code>)}
              </div>

              {!edit && rule && (
                <>
                  <div className="text-sm text-600 mb-2">
                    {t("postingRules.narration")}: <code>{rule.narration || "—"}</code> · {t("postingRules.branch")}: {t(`postingRules.branchSource.${rule.branchSource}`)} · {t("postingRules.effectiveFrom")}: {rule.effectiveFrom}
                    {rule.changeNote ? ` · ${rule.changeNote}` : ""}
                  </div>
                  <DataTable value={rule.lines} size="small" dataKey="lineNo" className="posting-rules__lines">
                    <Column field="lineNo" header="#" style={{ width: "3rem" }} />
                    <Column header={t("postingRules.side")} style={{ width: "5rem" }} body={(l) => <Tag value={l.side} severity={l.side === "Dr" ? "success" : "info"} />} />
                    <Column header={t("postingRules.account")} body={accountLabel} />
                    <Column field="amountKey" header={t("postingRules.amount")} style={{ width: "9rem" }} />
                    <Column header={t("postingRules.perParticipant")} style={{ width: "6rem" }} body={(l) => (l.perParticipant ? <i className="pi pi-users" /> : null)} />
                    <Column field="narration" header={t("postingRules.lineNarration")} />
                  </DataTable>
                  <div className="flex gap-2 mt-3 flex-wrap align-items-center">
                    <Button label={t("postingRules.simulate")} icon="pi pi-play" className="p-button-outlined" onClick={() => runSimulation(null)} />
                    {selected.perParticipant && (
                      <span className="flex align-items-center gap-2">
                        <InputSwitch checked={coInsurance} onChange={(e) => setCoInsurance(e.value)} /> {t("postingRules.coInsuredSample")}
                      </span>
                    )}
                    <Button label={rule.active ? t("postingRules.deactivate") : t("postingRules.activate")} icon={rule.active ? "pi pi-ban" : "pi pi-check"} className="p-button-text" onClick={toggleActive}
                      disabled={rule.approvalStatus && rule.approvalStatus !== "approved"} />
                    <Button label={t("postingRules.history")} icon="pi pi-history" className="p-button-text" onClick={openHistory} />
                  </div>
                </>
              )}

              {edit && (
                <div className="posting-rules__editor">
                  <div className="grid">
                    <div className="col-12 md:col-3">
                      <label>{t("postingRules.effectiveFrom")}</label>
                      <DateField value={edit.effectiveFrom} onChange={(e) => setEdit({ ...edit, effectiveFrom: e.target.value })} />
                    </div>
                    <div className="col-12 md:col-3">
                      <label>{t("postingRules.branch")}</label>
                      <Dropdown value={edit.branchSource} options={branchOptions} onChange={(e) => setEdit({ ...edit, branchSource: e.value })} className="w-full" />
                    </div>
                    <div className="col-12 md:col-6">
                      <label>{t("postingRules.narration")}</label>
                      <InputText value={edit.narration} onChange={(e) => setEdit({ ...edit, narration: e.target.value })} className="w-full" />
                    </div>
                  </div>
                  {edit.lines.map((l, i) => (
                    <div key={i} className="posting-rules__line">
                      <div className="posting-rules__row">
                        <span className="posting-rules__no">{i + 1}</span>
                        <SelectButton value={l.side} options={meta.sides.map((x) => ({ label: x, value: x }))} onChange={(e) => e.value && setLine(i, { side: e.value })} className="posting-rules__side" />
                        <Dropdown value={l.accountType} options={typeOptions} onChange={(e) => setLine(i, { accountType: e.value, account: "" })} className="posting-rules__type" />
                        <div className="posting-rules__grow">{accountEditor(l, i)}</div>
                        <Button icon="pi pi-arrow-up" className="p-button-text p-button-sm" onClick={() => moveLine(i, -1)} disabled={i === 0} tooltip={t("postingRules.moveUp")} aria-label={t("postingRules.moveUp")} />
                        <Button icon="pi pi-trash" className="p-button-text p-button-sm p-button-danger" onClick={() => setEdit({ ...edit, lines: edit.lines.filter((_, j) => j !== i) })} tooltip={t("postingRules.removeLine")} aria-label={t("postingRules.removeLine")} />
                      </div>
                      <div className="posting-rules__row">
                        <span className="posting-rules__no" />
                        <Dropdown value={l.amountKey} options={amountOptions} onChange={(e) => setLine(i, { amountKey: e.value })} placeholder={t("postingRules.amount")} className="posting-rules__amount" />
                        {["context", "resolver"].includes(l.accountType) && (
                          <Dropdown value={l.fallbackRole} options={roleOptions} filter showClear onChange={(e) => setLine(i, { fallbackRole: e.value || null })} placeholder={t("postingRules.fallbackRole")} className="posting-rules__type" />
                        )}
                        <InputText value={l.narration} onChange={(e) => setLine(i, { narration: e.target.value })} placeholder={t("postingRules.lineNarration")} className="posting-rules__grow" />
                        {selected.perParticipant && (
                          <span className="flex align-items-center gap-2">
                            <Checkbox inputId={`pp-${i}`} checked={l.perParticipant} onChange={(e) => setLine(i, { perParticipant: e.checked })} />
                            <label htmlFor={`pp-${i}`} className="m-0">{t("postingRules.perParticipant")}</label>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="grid mt-2">
                    <div className="col-12 md:col-8">
                      <InputText value={edit.changeNote} onChange={(e) => setEdit({ ...edit, changeNote: e.target.value })} placeholder={t("postingRules.changeNote")} className="w-full" />
                    </div>
                    <div className="col-12 md:col-4 flex justify-content-end gap-2">
                      <Button icon="pi pi-plus" className="p-button-text" label={t("postingRules.addLine")} onClick={() => setEdit({ ...edit, lines: [...edit.lines, blankLine(amountOptions[0]?.value)] })} />
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap align-items-center">
                    <Button label={t("postingRules.simulate")} icon="pi pi-play" className="p-button-outlined" onClick={() => runSimulation(edit.lines)} />
                    {selected.perParticipant && (
                      <span className="flex align-items-center gap-2">
                        <InputSwitch checked={coInsurance} onChange={(e) => setCoInsurance(e.value)} /> {t("postingRules.coInsuredSample")}
                      </span>
                    )}
                    <span className="flex-1" />
                    <Button label={t("postingRules.cancel")} className="p-button-text" onClick={() => { setEdit(null); setSim(null); }} />
                    <Button label={t("postingRules.saveVersion")} icon="pi pi-save" loading={saving} onClick={save} />
                  </div>
                </div>
              )}

              {sim && (
                <div className="posting-rules__sim">
                  <div className="flex justify-content-between align-items-center mb-2">
                    <div className="font-semibold">{t("postingRules.simulation")}: {sim.description}</div>
                    <Tag value={sim.balanced ? t("postingRules.balanced") : t("postingRules.notBalanced")} severity={sim.balanced ? "success" : "danger"} icon={sim.balanced ? "pi pi-check" : "pi pi-exclamation-triangle"} />
                  </div>
                  <DataTable value={sim.lines} size="small" dataKey="lineNo">
                    <Column field="accountCode" header={t("postingRules.glAccount")} style={{ width: "7rem" }} />
                    <Column field="accountName" header={t("postingRules.accountName")} body={(l) => (l.accountValid ? l.accountName : <span className="text-red-500">{t("postingRules.invalidAccount")}</span>)} />
                    <Column header={t("postingRules.debit")} className="text-right" body={(l) => (l.debit ? money(l.debit) : "")} />
                    <Column header={t("postingRules.credit")} className="text-right" body={(l) => (l.credit ? money(l.credit) : "")} />
                    <Column field="memo" header={t("postingRules.lineNarration")} />
                  </DataTable>
                  <div className="flex justify-content-end gap-4 mt-2 font-semibold">
                    <span>{t("postingRules.totalDebit")}: {money(sim.totalDebit)}</span>
                    <span>{t("postingRules.totalCredit")}: {money(sim.totalCredit)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog header={t("postingRules.history")} visible={!!history} style={{ width: "min(640px, 95vw)" }} onHide={() => setHistory(null)}>
        <DataTable value={history || []} size="small" emptyMessage={t("postingRules.noHistory")}>
          <Column field="at" header={t("postingRules.when")} body={(h) => new Date(h.at).toLocaleString()} />
          <Column field="action" header={t("postingRules.action")} />
          <Column field="version" header={t("postingRules.version")} />
          <Column field="username" header={t("postingRules.by")} />
          <Column field="changeNote" header={t("postingRules.changeNote")} />
        </DataTable>
      </Dialog>
    </div>
  );
};

export default PostingRules;
