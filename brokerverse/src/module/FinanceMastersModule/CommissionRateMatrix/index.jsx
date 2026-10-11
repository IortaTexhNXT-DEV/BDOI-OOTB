import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import numberingService from "../../../services/numberingService";
import { formatDate } from "../../../utility/dateFormat";
import DateField from "../../../components/DateField";
import ImportDialog from "../../../components/ImportDialog";
import PageHeader from "../../../components/PageHeader";
import RowActions, { actionsColumn } from "../../../components/RowActions";
import StatusChip from "../../../components/StatusChip";
import { openConfirm } from "../../../components/ConfirmDialog";
import { hasPermission } from "../../../utils/canOpen";
import "../../Administration/index.scss";
import "./index.scss";

const POLICY_TYPES = ["any", "new", "renewal"];
const STATUSES = ["all", "approved", "pending", "draft", "returned", "withdrawn"];
const BASES = ["issuing-remitting", "premium-pct", "none"];
const pct = (rate) => `${(Math.round(Number(rate) * 1000000) / 10000).toLocaleString(undefined, { maximumFractionDigits: 4 })}%`;
const pct4 = (v) => (v === null || v === undefined || v === "" ? "—" : `${Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 })}%`);
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const EMPTY = { insuranceCompanyId: null, productId: null, lineOfBusiness: null, policyType: "any", channelType: null, motorType: null, siFrom: null, siTo: null,
  rateBasis: "net-premium", ratePercent: null, perilRates: [], effectiveFrom: "", effectiveTo: "", active: true, remarks: "" };
const STATUS_CODE = { approved: "approved", pending: "for-approval", draft: "draft", returned: "returned", withdrawn: "cancelled" };

/**
 * Master > Finance > Commission Rate Matrix: the commission rules register. A rule is keyed by insurer, product, line
 * of business, policy type, channel type, motor type and sum insured band for a date range, with one rate (% of net
 * premium) or the issuing, TIS remitting and insurer net rate of each Motor peril. Rules are drafted, submitted and
 * approved on Configuration Approvals, amended as new versions and ended; a net rate schedule is loaded from Excel.
 * The Test rate panel shows which rule a placement gets and why.
 */
const CommissionRateMatrix = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`numberingMasters.commissionRates.${key}`, opts);
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insurers, setInsurers] = useState([]);
  const [products, setProducts] = useState([]);
  const [lobs, setLobs] = useState([]);
  const [options, setOptions] = useState({ approvalRequired: false, motorTypes: [], channelTypes: [], perils: [], defaultPerilRates: [], dualRateLines: ["motor"] });
  const [filter, setFilter] = useState({ insuranceCompanyId: null, policyType: null, status: "all", search: "" });
  const [edit, setEdit] = useState(null);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState(0);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [test, setTest] = useState({ insurerId: null, productId: null, lob: null, policyType: "new", channelType: null, motorType: null, sumInsured: null, date: todayIso() });
  const [result, setResult] = useState(null);
  const canWrite = hasPermission("write:commission-rules") || hasPermission("write:masters");
  const canApprove = hasPermission("approve:commission-rules");
  const review = options.approvalRequired;

  const error = (e) => toast.current?.show({ severity: "error", summary: k("title"), detail: e.message, life: 6000 });
  const success = (detail) => toast.current?.show({ severity: "success", summary: k("title"), detail, life: 4000 });

  const load = useCallback(() => {
    setLoading(true);
    return numberingService
      .listRates({ insuranceCompanyId: filter.insuranceCompanyId, policyType: filter.policyType, status: filter.status === "all" ? undefined : filter.status })
      .then(setRows)
      .catch(error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.insuranceCompanyId, filter.policyType, filter.status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const opts = (list) => list.map((o) => ({ label: o.label, value: o.value }));
    numberingService.options("insurance-company").then((l) => setInsurers(opts(l))).catch(() => {});
    numberingService.options("product").then((l) => setProducts(opts(l))).catch(() => {});
    numberingService
      .options("line-of-business", "code")
      .then((l) => setLobs(l.map((o) => ({ label: o.label, value: String(o.value || o.code || "").toLowerCase() }))))
      .catch(() => {});
    numberingService.rateOptions().then(setOptions).catch(() => {});
  }, []);

  const visible = useMemo(() => {
    const q = filter.search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.insurerName, r.productName, r.lineOfBusiness, r.motorTypeName, r.remarks].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [rows, filter.search]);

  const policyTypeOptions = POLICY_TYPES.map((p) => ({ label: k(`policyTypes.${p}`), value: p }));
  const channelOptions = (options.channelTypes || []).map((c) => ({ label: c.label, value: c.code }));
  const motorOptions = (options.motorTypes || []).map((m) => ({ label: m.name, value: m.code }));
  const lobLabel = (code) => lobs.find((l) => l.value === String(code || "").toLowerCase())?.label || (code ? String(code).toUpperCase() : "");
  const productLine = (productId) => String(products.find((p) => p.value === productId)?.label || "").toLowerCase();
  // issuing vs remitting, a motor type and a band are offered for the Motor line only (commission.dual_rate_lines)
  const isMotor = (v) => {
    const lines = (options.dualRateLines || []).map((x) => String(x).toLowerCase());
    if (v.lineOfBusiness) return lines.includes(String(v.lineOfBusiness).toLowerCase());
    return !!v.productId && lines.some((l) => productLine(v.productId).includes(l));
  };

  const openAdd = () => {
    setErrors({});
    setTab(0);
    setHistory([]);
    setEdit({ ...EMPTY, effectiveFrom: todayIso(), perilRates: options.defaultPerilRates.map((p) => ({ ...p })) });
  };
  const openEdit = async (r, { copy = false } = {}) => {
    setErrors({});
    setTab(0);
    const perilRates = r.perilRates?.length ? r.perilRates.map((p) => ({ ...p })) : options.defaultPerilRates.map((p) => ({ ...p }));
    setEdit({ ...r, ...(copy ? { id: null, approvalStatus: "draft", version: 1, effectiveFrom: "", effectiveTo: "", pendingChangeId: null } : {}),
      ratePercent: Math.round(r.rate * 1000000) / 10000, effectiveTo: copy ? "" : r.effectiveTo || "", remarks: r.remarks || "", perilRates, amend: !copy && r.approvalStatus === "approved" && review });
    setHistory(copy || !r.id ? [] : await numberingService.rateHistory(r.id).catch(() => []));
  };
  const set = (key, value) => setEdit((e) => ({ ...e, [key]: value }));
  const setPeril = (code, key, value) => setEdit((e) => ({ ...e, perilRates: e.perilRates.map((p) => (p.peril === code ? { ...p, [key]: value } : p)) }));

  const validate = (v) => {
    const e = {};
    if (!v.insuranceCompanyId && !v.productId && !v.lineOfBusiness) e.key = k("keyRequired");
    if (v.rateBasis === "net-premium" && (v.ratePercent === null || v.ratePercent === undefined || v.ratePercent < 0 || v.ratePercent > 100)) e.rate = k("rateRequired");
    if (!v.effectiveFrom) e.effectiveFrom = k("fromRequired");
    if (v.effectiveTo && v.effectiveFrom && v.effectiveTo < v.effectiveFrom) e.effectiveTo = k("toBeforeFrom");
    if (v.siFrom !== null && v.siTo !== null && v.siFrom !== undefined && v.siTo !== undefined && Number(v.siTo) <= Number(v.siFrom)) e.band = k("bandOrder");
    if (v.rateBasis === "issuing-remitting") {
      for (const p of v.perilRates || []) {
        if (p.basis !== "issuing-remitting") continue;
        if (p.insurerNet === null || p.insurerNet === undefined || p.tisRemitting === null || p.tisRemitting === undefined) e.perils = k("perilRatesRequired");
        else if (Number(p.insurerNet) > Number(p.tisRemitting) || (p.issuing !== null && p.issuing !== undefined && Number(p.tisRemitting) > Number(p.issuing))) e.perils = k("perilRatesOrder", { peril: p.name });
      }
    }
    return e;
  };

  const bodyOf = (v, submit) => ({
    insuranceCompanyId: v.insuranceCompanyId || null, productId: v.productId || null, lineOfBusiness: v.lineOfBusiness || null, policyType: v.policyType,
    channelType: v.channelType || null, motorType: v.motorType || null, siFrom: v.siFrom ?? null, siTo: v.siTo ?? null, rateBasis: v.rateBasis,
    rate: v.rateBasis === "net-premium" ? Math.round((v.ratePercent || 0) * 10000) / 1000000 : 0,
    perilRates: v.rateBasis === "issuing-remitting" ? v.perilRates.map((p) => ({ peril: p.peril, basis: p.basis, issuing: p.issuing ?? null, tisRemitting: p.tisRemitting ?? null, insurerNet: p.insurerNet ?? null, commissionPct: p.commissionPct ?? null })) : [],
    effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo || null, active: review ? true : !!v.active, remarks: v.remarks || null, ...(submit ? { submit: true } : {}),
  });

  const save = async ({ submit = false } = {}) => {
    const e = validate(edit);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const saved = edit.id ? await numberingService.updateRate(edit.id, bodyOf(edit, submit)) : await numberingService.createRate(bodyOf(edit, submit));
      success(saved.approvalStatus === "pending" ? k("submitted") : t("numberingMasters.saved"));
      setEdit(null);
      load();
    } catch (err) {
      error(err);
    } finally {
      setSaving(false);
    }
  };

  const facts = (r) => [
    { label: k("insurer"), value: r.insurerName || k("anyInsurer") },
    { label: k("product"), value: r.productName || (r.lineOfBusiness ? lobLabel(r.lineOfBusiness) : k("anyProduct")) },
    { label: k("motorType"), value: r.motorTypeName || k("anyMotorType"), hidden: !r.motorType },
    { label: k("policyType"), value: k(`policyTypes.${r.policyType}`) },
    { label: k("effectiveFrom"), value: r.effectiveFrom, type: "date" },
  ];
  const act = async (code, r) => {
    try {
      if (code === "view" || code === "edit") return openEdit(r);
      if (code === "copy") return openEdit(r, { copy: true });
      if (code === "submit") {
        if (!(await openConfirm({ title: k("submitTitle"), message: k("submitMessage"), facts: facts(r), confirmLabel: k("submitAction"), onConfirm: () => numberingService.submitRate(r.id) }))) return null;
        success(k("submitted"));
      } else if (code === "withdraw") {
        if (!(await openConfirm({ title: k("withdrawTitle"), severity: "warning", message: k("withdrawMessage"), facts: facts(r), confirmLabel: k("withdrawAction"), onConfirm: () => numberingService.withdrawRate(r.id) }))) return null;
        success(k("withdrawn"));
      } else if (code === "end") {
        const date = await openConfirm({ title: k("endTitle"), severity: "warning", message: k("endMessage"), facts: facts(r), input: { type: "date", label: k("effectiveTo"), required: true, min: r.effectiveFrom }, confirmLabel: k("endAction") });
        if (!date) return null;
        const after = await numberingService.endRate(r.id, { effectiveTo: date });
        success(after.pendingChangeId ? k("endSubmitted") : k("ended"));
      } else if (code === "delete") {
        if (!(await openConfirm({ title: k("deleteTitle"), severity: "danger", message: k("deleteMessage"), facts: facts(r), confirmLabel: k("deleteAction"), onConfirm: () => numberingService.deleteRate(r.id) }))) return null;
        success(k("deleted"));
      }
      return load();
    } catch (err) {
      return error(err);
    }
  };
  const actionsOf = (r) => {
    const s = r.approvalStatus;
    const list = [{ code: "view", label: canWrite && ["draft", "returned", "withdrawn"].includes(s) ? t("numberingMasters.edit") : k("view"), allowed: true }];
    if (!canWrite) return list;
    if (review) {
      if (["draft", "returned", "withdrawn"].includes(s)) list.push({ code: "submit", label: k("submitAction"), allowed: true });
      if (s === "pending") list.push({ code: "withdraw", label: k("withdrawAction"), allowed: true });
      if (s === "approved") list.push({ code: "end", label: k("endAction"), allowed: !r.pendingChangeId, blockedReason: r.pendingChangeId ? k("pendingChange") : null });
      list.push({ code: "copy", label: k("copy"), allowed: true });
      list.push({ code: "delete", label: t("numberingMasters.delete"), allowed: ["draft", "returned", "withdrawn"].includes(s), blockedReason: s === "approved" ? k("deleteApproved") : null });
    } else {
      list.push({ code: "copy", label: k("copy"), allowed: true }, { code: "delete", label: t("numberingMasters.delete"), allowed: true });
    }
    return list;
  };

  const runTest = async () => {
    try {
      setResult(await numberingService.resolveRate({ ...test, sumInsured: test.sumInsured || undefined }));
    } catch (err) {
      error(err);
    }
  };

  const any = (label) => <span className="dn__muted">{label}</span>;
  const rateCell = (r) => {
    if (r.rateBasis !== "issuing-remitting") return <strong>{pct(r.rate)}</strong>;
    const od = (r.perilRates || []).find((p) => p.peril === "OD");
    return <span className="cr__peril-rates">{od ? k("odRates", { issuing: pct4(od.issuing), tis: pct4(od.tisRemitting), net: pct4(od.insurerNet) }) : k("perPeril")}</span>;
  };
  const statusCell = (r) => <StatusChip code={STATUS_CODE[r.approvalStatus] || r.approvalStatus} label={r.statusLabel} />;
  const perilRow = (p) => {
    const comm = p.basis === "issuing-remitting" && p.issuing !== null && p.issuing !== undefined ? Number(p.issuing) - Number(p.insurerNet || 0) : p.basis === "premium-pct" ? p.commissionPct : null;
    const variance = p.basis === "issuing-remitting" && p.issuing !== null && p.issuing !== undefined ? Number(p.issuing) - Number(p.tisRemitting || 0) : null;
    return { comm, variance };
  };

  const header = (
    <PageHeader title={k("title")} home={t("numberingMasters.master")} section={t("numberingMasters.finance")} trail={[k("title")]} help={k("help")}
      actions={canWrite ? (
        <>
          <Button label={k("upload")} icon="pi pi-upload" outlined onClick={() => setImportOpen(true)} />
          <Button label={k("add")} icon="pi pi-plus" onClick={openAdd} />
        </>
      ) : null} />
  );

  return (
    <div className="admin__page dn__page cr__page">
      <Toast ref={toast} />
      {header}
      <div className="cr__layout">
        <div>
          <div className="dn__toolbar">
            <span className="p-input-icon-left dn__search">
              <i className="pi pi-search" />
              <InputText value={filter.search} onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))} placeholder={t("numberingMasters.search")} aria-label={t("numberingMasters.search")} />
            </span>
            <Dropdown value={filter.insuranceCompanyId} options={insurers} onChange={(e) => setFilter((f) => ({ ...f, insuranceCompanyId: e.value }))} placeholder={k("anyInsurer")} showClear filter className="dn__filter" aria-label={k("insurer")} />
            <Dropdown value={filter.policyType} options={policyTypeOptions} onChange={(e) => setFilter((f) => ({ ...f, policyType: e.value }))} placeholder={k("policyType")} showClear className="dn__filter" aria-label={k("policyType")} />
            <Dropdown value={filter.status} options={STATUSES.map((s) => ({ label: s === "all" ? t("numberingMasters.all") : k(`statuses.${s}`), value: s }))} onChange={(e) => setFilter((f) => ({ ...f, status: e.value }))} className="dn__filter" aria-label={k("status")} />
          </div>
          <DataTable value={visible} dataKey="id" loading={loading} stripedRows size="small" paginator rows={20} emptyMessage={k("empty")} className="dn__table" responsiveLayout="scroll">
            <Column header={k("insurer")} body={(r) => r.insurerName || any(k("anyInsurer"))} sortable sortField="insurerName" />
            <Column header={k("product")} body={(r) => r.productName || (r.lineOfBusiness ? lobLabel(r.lineOfBusiness) : any(k("anyProduct")))} sortable sortField="productName" />
            <Column header={k("motorType")} body={(r) => r.motorTypeName || any(k("anyMotorType"))} />
            <Column header={k("policyType")} body={(r) => k(`policyTypes.${r.policyType}`)} />
            <Column header={k("channelType")} body={(r) => r.channelTypeLabel || any(k("anyChannel"))} />
            <Column header={k("rate")} body={rateCell} className="dn__right" headerClassName="dn__right" />
            <Column header={k("effectiveFrom")} body={(r) => formatDate(r.effectiveFrom)} sortable sortField="effectiveFrom" />
            <Column header={k("effectiveTo")} body={(r) => (r.effectiveTo ? formatDate(r.effectiveTo) : any(k("openEnded")))} />
            <Column header={k("version")} body={(r) => `v${r.version}`} />
            <Column header={k("status")} body={statusCell} />
            <Column header="" body={(r) => <RowActions label={k("actionsFor", { rule: r.insurerName || r.productName || r.lineOfBusiness || r.id })} actions={actionsOf(r)} onAction={(a) => act(a.code, r)} />} {...actionsColumn} style={{ width: "4rem" }} />
          </DataTable>
        </div>

        <aside className="cr__test" aria-label={k("testTitle")}>
          <h3>{k("testTitle")}</h3>
          <div className="cr__test-fields">
            <div className="admin__field">
              <label htmlFor="cr-t-ins">{k("insurer")}</label>
              <Dropdown inputId="cr-t-ins" value={test.insurerId} options={insurers} filter showClear placeholder={k("anyInsurer")} onChange={(e) => setTest((x) => ({ ...x, insurerId: e.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="cr-t-prod">{k("product")}</label>
              <Dropdown inputId="cr-t-prod" value={test.productId} options={products} filter showClear placeholder={k("anyProduct")} onChange={(e) => setTest((x) => ({ ...x, productId: e.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="cr-t-lob">{k("lob")}</label>
              <Dropdown inputId="cr-t-lob" value={test.lob} options={lobs} showClear placeholder={k("anyLob")} onChange={(e) => setTest((x) => ({ ...x, lob: e.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="cr-t-type">{k("policyType")}</label>
              <Dropdown inputId="cr-t-type" value={test.policyType} options={policyTypeOptions.filter((o) => o.value !== "any")} onChange={(e) => setTest((x) => ({ ...x, policyType: e.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="cr-t-channel">{k("channelType")}</label>
              <Dropdown inputId="cr-t-channel" value={test.channelType} options={channelOptions} showClear placeholder={k("anyChannel")} onChange={(e) => setTest((x) => ({ ...x, channelType: e.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="cr-t-motor">{k("motorType")}</label>
              <Dropdown inputId="cr-t-motor" value={test.motorType} options={motorOptions} showClear placeholder={k("anyMotorType")} onChange={(e) => setTest((x) => ({ ...x, motorType: e.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="cr-t-si">{k("sumInsured")}</label>
              <InputNumber inputId="cr-t-si" value={test.sumInsured} min={0} mode="decimal" maxFractionDigits={2} onValueChange={(e) => setTest((x) => ({ ...x, sumInsured: e.value }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="cr-t-date">{k("date")}</label>
              <DateField id="cr-t-date" value={test.date} onChange={(e) => setTest((x) => ({ ...x, date: e.target.value }))} />
            </div>
            <Button label={k("testRun")} icon="pi pi-search" onClick={runTest} className="cr__test-run" />
          </div>
          {result && (
            <div className="cr__result" aria-live="polite">
              <div className="dn__muted">{k("result")}</div>
              {result.rateBasis === "issuing-remitting" ? (
                <table className="cr__result-perils">
                  <thead><tr><th>{k("peril")}</th><th>{k("issuing")}</th><th>{k("tisRemitting")}</th><th>{k("insurerNet")}</th><th>{k("commissionPct")}</th></tr></thead>
                  <tbody>
                    {(result.perilRates || []).filter((p) => p.basis !== "none").map((p) => (
                      <tr key={p.peril}><td>{p.peril}</td><td>{pct4(p.issuing)}</td><td>{pct4(p.tisRemitting)}</td><td>{pct4(p.insurerNet)}</td><td>{p.basis === "premium-pct" ? pct4(p.commissionPct) : pct4(perilRow(p).comm)}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="cr__result-rate">{pct(result.rate)}</div>}
              <div>{k(`sources.${result.source}`)}</div>
              {result.level ? <div className="dn__muted">{`${k("level")}: ${result.level}`}</div> : null}
            </div>
          )}
        </aside>
      </div>

      <Dialog
        header={edit?.id ? (edit.amend ? k("amendTitle", { version: (edit.version || 1) + 1 }) : k("editTitle")) : k("addTitle")}
        visible={!!edit}
        onHide={() => setEdit(null)}
        style={{ width: "min(1100px, 96vw)" }}
        footer={
          <div>
            <Button label={t("numberingMasters.cancel")} text onClick={() => setEdit(null)} />
            {review ? (
              <>
                <Button label={k("saveDraft")} icon="pi pi-save" outlined onClick={() => save()} loading={saving} disabled={!canWrite || edit?.approvalStatus === "pending"} />
                <Button label={k("submitAction")} icon="pi pi-send" onClick={() => save({ submit: true })} loading={saving} disabled={!canWrite || edit?.approvalStatus === "pending"} />
              </>
            ) : <Button label={t("numberingMasters.save")} icon="pi pi-check" onClick={() => save()} loading={saving} disabled={!canWrite} />}
          </div>
        }
      >
        {edit && (
          <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
            <TabPanel header={k("tabs.rule")}>
              <div className="dn__form">
                {edit.approvalStatus ? (
                  <div className="cr__status-line">
                    <StatusChip code={STATUS_CODE[edit.approvalStatus] || edit.approvalStatus} label={edit.statusLabel} />
                    {edit.version ? <span className="dn__muted">{k("versionN", { version: edit.version })}</span> : null}
                    {edit.amend ? <span className="dn__muted">{k("amendNote")}</span> : null}
                    {edit.approvalStatus === "pending" && canApprove ? <span className="dn__muted">{k("decideOnApprovals")}</span> : null}
                  </div>
                ) : null}
                <div className="admin__grid">
                  <div className="admin__field">
                    <label htmlFor="cr-ins">{k("insurer")}</label>
                    <Dropdown inputId="cr-ins" value={edit.insuranceCompanyId} options={insurers} filter showClear placeholder={k("anyInsurer")} onChange={(e) => set("insuranceCompanyId", e.value)} />
                  </div>
                  <div className="admin__field">
                    <label htmlFor="cr-prod">{k("product")}</label>
                    <Dropdown inputId="cr-prod" value={edit.productId} options={products} filter showClear placeholder={k("anyProduct")} onChange={(e) => set("productId", e.value)} />
                  </div>
                  <div className="admin__field">
                    <label htmlFor="cr-lob">{k("lob")}</label>
                    <Dropdown inputId="cr-lob" value={edit.lineOfBusiness} options={lobs} showClear placeholder={k("anyLob")} onChange={(e) => set("lineOfBusiness", e.value)} />
                  </div>
                </div>
                {errors.key ? <small className="dn__error">{errors.key}</small> : null}
                <div className="admin__grid">
                  <div className="admin__field">
                    <label htmlFor="cr-type">{k("policyType")}</label>
                    <Dropdown inputId="cr-type" value={edit.policyType} options={policyTypeOptions} onChange={(e) => set("policyType", e.value)} />
                  </div>
                  <div className="admin__field">
                    <label htmlFor="cr-channel">{k("channelType")}</label>
                    <Dropdown inputId="cr-channel" value={edit.channelType} options={channelOptions} showClear placeholder={k("anyChannel")} onChange={(e) => set("channelType", e.value)} />
                  </div>
                  <div className="admin__field">
                    <label htmlFor="cr-basis">{k("rateBasis")}</label>
                    <Dropdown inputId="cr-basis" value={edit.rateBasis} options={[{ label: k("bases.net-premium"), value: "net-premium" }, ...(isMotor(edit) ? [{ label: k("bases.issuing-remitting"), value: "issuing-remitting" }] : [])]}
                      onChange={(e) => set("rateBasis", e.value)} />
                  </div>
                </div>
                {isMotor(edit) ? (
                  <div className="admin__grid">
                    <div className="admin__field">
                      <label htmlFor="cr-motor">{k("motorType")}</label>
                      <Dropdown inputId="cr-motor" value={edit.motorType} options={motorOptions} showClear placeholder={k("anyMotorType")} onChange={(e) => set("motorType", e.value)} />
                    </div>
                    <div className="admin__field">
                      <label htmlFor="cr-si-from">{k("siFrom")}</label>
                      <InputNumber inputId="cr-si-from" value={edit.siFrom} min={0} mode="decimal" maxFractionDigits={2} onValueChange={(e) => set("siFrom", e.value)} />
                    </div>
                    <div className="admin__field">
                      <label htmlFor="cr-si-to">{k("siTo")}</label>
                      <InputNumber inputId="cr-si-to" value={edit.siTo} min={0} mode="decimal" maxFractionDigits={2} onValueChange={(e) => set("siTo", e.value)} className={errors.band ? "p-invalid" : undefined} />
                      {errors.band ? <small className="dn__error">{errors.band}</small> : null}
                    </div>
                  </div>
                ) : null}
                <div className="admin__grid">
                  {edit.rateBasis === "net-premium" ? (
                    <div className="admin__field">
                      <label htmlFor="cr-rate">{k("rate")}</label>
                      <InputNumber inputId="cr-rate" value={edit.ratePercent} min={0} max={100} minFractionDigits={0} maxFractionDigits={4} suffix=" %" onValueChange={(e) => set("ratePercent", e.value)} className={errors.rate ? "p-invalid" : undefined} />
                      {errors.rate ? <small className="dn__error">{errors.rate}</small> : null}
                    </div>
                  ) : null}
                  <div className="admin__field">
                    <label htmlFor="cr-from">{k("effectiveFrom")}</label>
                    <DateField id="cr-from" value={edit.effectiveFrom} onChange={(e) => set("effectiveFrom", e.target.value)} className={errors.effectiveFrom ? "p-invalid" : undefined} />
                    {errors.effectiveFrom ? <small className="dn__error">{errors.effectiveFrom}</small> : null}
                  </div>
                  <div className="admin__field">
                    <label htmlFor="cr-to">{k("effectiveTo")}</label>
                    <DateField id="cr-to" value={edit.effectiveTo} placeholder={k("openEnded")} onChange={(e) => set("effectiveTo", e.target.value)} className={errors.effectiveTo ? "p-invalid" : undefined} />
                    {errors.effectiveTo ? <small className="dn__error">{errors.effectiveTo}</small> : null}
                  </div>
                </div>
                <div className="admin__field">
                  <label htmlFor="cr-remarks">{k("remarks")}</label>
                  <InputTextarea id="cr-remarks" rows={2} autoResize value={edit.remarks} onChange={(e) => set("remarks", e.target.value)} />
                </div>
              </div>
            </TabPanel>
            <TabPanel header={k("tabs.perils")} disabled={edit.rateBasis !== "issuing-remitting"}>
              {errors.perils ? <small className="dn__error">{errors.perils}</small> : null}
              <DataTable value={edit.perilRates || []} dataKey="peril" size="small" className="cr__perils" responsiveLayout="scroll">
                <Column header={k("peril")} body={(p) => p.name || p.peril} />
                <Column header={k("perilBasis")} body={(p) => <Dropdown value={p.basis} options={BASES.map((b) => ({ label: k(`perilBases.${b}`), value: b }))} onChange={(e) => setPeril(p.peril, "basis", e.value)} aria-label={`${p.name} ${k("perilBasis")}`} />} />
                <Column header={k("issuing")} body={(p) => (p.basis === "issuing-remitting" ? <InputNumber value={p.issuing} min={0} max={100} maxFractionDigits={4} suffix=" %" onValueChange={(e) => setPeril(p.peril, "issuing", e.value)} aria-label={`${p.name} ${k("issuing")}`} /> : "—")} />
                <Column header={k("tisRemitting")} body={(p) => (p.basis === "issuing-remitting" ? <InputNumber value={p.tisRemitting} min={0} max={100} maxFractionDigits={4} suffix=" %" onValueChange={(e) => setPeril(p.peril, "tisRemitting", e.value)} aria-label={`${p.name} ${k("tisRemitting")}`} /> : "—")} />
                <Column header={k("insurerNet")} body={(p) => (p.basis === "issuing-remitting" ? <InputNumber value={p.insurerNet} min={0} max={100} maxFractionDigits={4} suffix=" %" onValueChange={(e) => setPeril(p.peril, "insurerNet", e.value)} aria-label={`${p.name} ${k("insurerNet")}`} /> : "—")} />
                <Column header={k("commissionPct")} body={(p) => (p.basis === "premium-pct"
                  ? <InputNumber value={p.commissionPct} min={0} max={100} maxFractionDigits={4} suffix=" %" onValueChange={(e) => setPeril(p.peril, "commissionPct", e.value)} aria-label={`${p.name} ${k("commissionPct")}`} />
                  : pct4(perilRow(p).comm))} />
                <Column header={k("variance")} body={(p) => pct4(perilRow(p).variance)} />
              </DataTable>
            </TabPanel>
            <TabPanel header={k("tabs.history")} disabled={!edit.id}>
              <DataTable value={history} dataKey="id" size="small" emptyMessage={k("noHistory")} responsiveLayout="scroll">
                <Column header={k("version")} body={(h) => `v${h.version}`} />
                <Column header={k("status")} body={statusCell} />
                <Column header={k("rate")} body={rateCell} />
                <Column header={k("effectiveFrom")} body={(h) => formatDate(h.effectiveFrom)} />
                <Column header={k("effectiveTo")} body={(h) => (h.effectiveTo ? formatDate(h.effectiveTo) : any(k("openEnded")))} />
                <Column header={k("maker")} body={(h) => h.submittedBy || h.updatedBy || "—"} />
                <Column header={k("approver")} body={(h) => h.approvedBy || "—"} />
                <Column header={k("approvedAt")} body={(h) => (h.approvedAt ? formatDate(h.approvedAt) : "—")} />
              </DataTable>
            </TabPanel>
          </TabView>
        )}
      </Dialog>

      <ImportDialog visible={importOpen} onHide={() => setImportOpen(false)} title={k("upload")} help={k("uploadHelp")}
        targets={[{ label: k("uploadTarget"), templatePath: "/commission-rates/upload/template", uploadPath: "/commission-rates/upload" }]}
        onDone={() => load()} />
    </div>
  );
};

export default CommissionRateMatrix;
