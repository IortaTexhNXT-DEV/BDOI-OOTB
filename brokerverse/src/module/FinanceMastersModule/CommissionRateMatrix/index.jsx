import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import numberingService from "../../../services/numberingService";
import { formatDate } from "../../../utility/dateFormat";
import DateField from "../../../components/DateField";
import { openConfirm } from "../../../components/ConfirmDialog";
import "../../Administration/index.scss";

const POLICY_TYPES = ["any", "new", "renewal"];
const pct = (rate) => `${(Math.round(Number(rate) * 1000000) / 10000).toLocaleString(undefined, { maximumFractionDigits: 4 })}%`;
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const EMPTY = { insuranceCompanyId: null, productId: null, lineOfBusiness: null, policyType: "any", ratePercent: null, effectiveFrom: "", effectiveTo: "", active: true, remarks: "" };

/**
 * Master > Finance > Commission Rate Matrix: brokerage commission rates by insurer, product, line of business and
 * policy type for a date range, with a "test rate" lookup that shows which rate a placement gets and why.
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
  const [filter, setFilter] = useState({ insuranceCompanyId: null, policyType: null, active: "true", search: "" });
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [test, setTest] = useState({ insurerId: null, productId: null, lob: null, policyType: "new", date: todayIso() });
  const [result, setResult] = useState(null);

  const error = (e) => toast.current?.show({ severity: "error", summary: k("title"), detail: e.message, life: 6000 });

  const load = () => {
    setLoading(true);
    return numberingService
      .listRates({ insuranceCompanyId: filter.insuranceCompanyId, policyType: filter.policyType, active: filter.active === "all" ? undefined : filter.active })
      .then(setRows)
      .catch(error)
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.insuranceCompanyId, filter.policyType, filter.active]);
  useEffect(() => {
    const opts = (list) => list.map((o) => ({ label: o.label, value: o.value }));
    numberingService.options("insurance-company").then((l) => setInsurers(opts(l))).catch(() => {});
    numberingService.options("product").then((l) => setProducts(opts(l))).catch(() => {});
    numberingService
      .options("line-of-business", "code")
      .then((l) => setLobs(l.map((o) => ({ label: o.label, value: String(o.value || o.code || "").toLowerCase() }))))
      .catch(() => {});
  }, []);

  const visible = useMemo(() => {
    const q = filter.search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.insurerName, r.productName, r.lineOfBusiness, r.remarks].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [rows, filter.search]);

  const policyTypeOptions = POLICY_TYPES.map((p) => ({ label: k(`policyTypes.${p}`), value: p }));
  const lobLabel = (code) => lobs.find((l) => l.value === String(code || "").toLowerCase())?.label || (code ? String(code).toUpperCase() : "");

  const openAdd = () => {
    setErrors({});
    setEdit({ ...EMPTY, effectiveFrom: todayIso() });
  };
  const openEdit = (r) => {
    setErrors({});
    setEdit({ ...r, ratePercent: Math.round(r.rate * 1000000) / 10000, effectiveTo: r.effectiveTo || "", remarks: r.remarks || "" });
  };
  const set = (key, value) => setEdit((e) => ({ ...e, [key]: value }));

  const validate = (v) => {
    const e = {};
    if (!v.insuranceCompanyId && !v.productId && !v.lineOfBusiness) e.key = k("keyRequired");
    if (v.ratePercent === null || v.ratePercent === undefined || v.ratePercent < 0 || v.ratePercent > 100) e.rate = k("rateRequired");
    if (!v.effectiveFrom) e.effectiveFrom = k("fromRequired");
    if (v.effectiveTo && v.effectiveFrom && v.effectiveTo < v.effectiveFrom) e.effectiveTo = k("toBeforeFrom");
    return e;
  };

  const save = async () => {
    const e = validate(edit);
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = {
      insuranceCompanyId: edit.insuranceCompanyId || null,
      productId: edit.productId || null,
      lineOfBusiness: edit.lineOfBusiness || null,
      policyType: edit.policyType,
      rate: Math.round(edit.ratePercent * 10000) / 1000000,
      effectiveFrom: edit.effectiveFrom,
      effectiveTo: edit.effectiveTo || null,
      active: !!edit.active,
      remarks: edit.remarks || null,
    };
    setSaving(true);
    try {
      if (edit.id) await numberingService.updateRate(edit.id, body);
      else await numberingService.createRate(body);
      toast.current?.show({ severity: "success", summary: k("title"), detail: t("numberingMasters.saved") });
      setEdit(null);
      load();
    } catch (err) {
      error(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    const deleted = await openConfirm({
      title: k("deleteTitle"),
      severity: "danger",
      message: k("deleteMessage"),
      facts: [
        { label: k("insurer"), value: r.insurerName || k("anyInsurer") },
        { label: k("product"), value: r.productName || k("anyProduct") },
        { label: k("lob"), value: r.lineOfBusiness ? lobLabel(r.lineOfBusiness) : k("anyLob") },
        { label: k("policyType"), value: k(`policyTypes.${r.policyType}`) },
        { label: k("rate"), value: pct(r.rate) },
        { label: k("effectiveFrom"), value: r.effectiveFrom, type: "date" },
      ],
      confirmLabel: k("deleteAction"),
      onConfirm: () => numberingService.deleteRate(r.id),
    });
    if (!deleted) return;
    toast.current?.show({ severity: "success", summary: k("title"), detail: k("deleted") });
    load();
  };

  const runTest = async () => {
    try {
      setResult(await numberingService.resolveRate(test));
    } catch (err) {
      error(err);
    }
  };

  const any = (label) => <span className="dn__muted">{label}</span>;
  const actions = (r) => (
    <div className="admin__actions">
      <Button icon="pi pi-pencil" rounded text aria-label={t("numberingMasters.edit")} onClick={() => openEdit(r)} tooltip={t("numberingMasters.edit")} tooltipOptions={{ position: "top" }} />
      <Button icon="pi pi-trash" rounded text severity="danger" aria-label={t("numberingMasters.delete")} onClick={() => remove(r)} tooltip={t("numberingMasters.delete")} tooltipOptions={{ position: "top" }} />
    </div>
  );

  return (
    <div className="admin__page dn__page">
      <Toast ref={toast} />
      <BreadCrumb
        model={[{ label: t("numberingMasters.finance") }, { label: k("title") }]}
        home={{ label: t("numberingMasters.master") }}
        className="admin__breadcrumb"
      />
      <div className="admin__header">
        <div>
          <h2>{k("title")}</h2>
        </div>
        <Button label={k("add")} icon="pi pi-plus" onClick={openAdd} />
      </div>

      <div className="cr__layout">
        <div>
          <div className="dn__toolbar">
            <span className="p-input-icon-left dn__search">
              <i className="pi pi-search" />
              <InputText value={filter.search} onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))} placeholder={t("numberingMasters.search")} aria-label={t("numberingMasters.search")} />
            </span>
            <Dropdown
              value={filter.insuranceCompanyId}
              options={insurers}
              onChange={(e) => setFilter((f) => ({ ...f, insuranceCompanyId: e.value }))}
              placeholder={k("anyInsurer")}
              showClear
              filter
              className="dn__filter"
              aria-label={k("insurer")}
            />
            <Dropdown
              value={filter.policyType}
              options={policyTypeOptions}
              onChange={(e) => setFilter((f) => ({ ...f, policyType: e.value }))}
              placeholder={k("policyType")}
              showClear
              className="dn__filter"
              aria-label={k("policyType")}
            />
            <Dropdown
              value={filter.active}
              options={[
                { label: t("numberingMasters.all"), value: "all" },
                { label: t("numberingMasters.active"), value: "true" },
                { label: t("numberingMasters.inactive"), value: "false" },
              ]}
              onChange={(e) => setFilter((f) => ({ ...f, active: e.value }))}
              className="dn__filter"
              aria-label={t("numberingMasters.active")}
            />
          </div>
          <p className="cr__note">{k("precedence")}</p>
          <DataTable value={visible} dataKey="id" loading={loading} stripedRows size="small" paginator rows={20} emptyMessage={k("empty")} className="dn__table" responsiveLayout="scroll">
            <Column header={k("insurer")} body={(r) => r.insurerName || any(k("anyInsurer"))} sortable sortField="insurerName" />
            <Column header={k("product")} body={(r) => r.productName || any(k("anyProduct"))} sortable sortField="productName" />
            <Column header={k("lob")} body={(r) => (r.lineOfBusiness ? lobLabel(r.lineOfBusiness) : any(k("anyLob")))} />
            <Column header={k("policyType")} body={(r) => k(`policyTypes.${r.policyType}`)} />
            <Column header={k("rate")} body={(r) => <strong>{pct(r.rate)}</strong>} sortable sortField="rate" className="dn__right" headerClassName="dn__right" />
            <Column header={k("effectiveFrom")} body={(r) => formatDate(r.effectiveFrom)} sortable sortField="effectiveFrom" />
            <Column header={k("effectiveTo")} body={(r) => (r.effectiveTo ? formatDate(r.effectiveTo) : any(k("openEnded")))} />
            <Column header={k("level")} body={(r) => <Tag value={r.level} severity="info" />} />
            <Column header={t("numberingMasters.active")} body={(r) => <Tag value={r.active ? t("numberingMasters.active") : t("numberingMasters.inactive")} severity={r.active ? "success" : "danger"} />} />
            <Column header="" body={actions} style={{ width: "6.5rem" }} />
          </DataTable>
        </div>

        <aside className="cr__test" aria-label={k("testTitle")}>
          <h3>{k("testTitle")}</h3>
          <span className="dn__muted">{k("testHelp")}</span>
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
            <label htmlFor="cr-t-date">{k("date")}</label>
            <DateField id="cr-t-date" value={test.date} onChange={(e) => setTest((x) => ({ ...x, date: e.target.value }))} />
          </div>
          <Button label={k("testRun")} icon="pi pi-search" onClick={runTest} className="cr__test-run" />
          </div>
          {result && (
            <div className="cr__result" aria-live="polite">
              <div className="dn__muted">{k("result")}</div>
              <div className="cr__result-rate">{pct(result.rate)}</div>
              <div>{k(`sources.${result.source}`)}</div>
              {result.level ? <div className="dn__muted">{`${k("level")}: ${result.level}`}</div> : null}
            </div>
          )}
        </aside>
      </div>

      <Dialog
        header={edit?.id ? k("editTitle") : k("addTitle")}
        visible={!!edit}
        onHide={() => setEdit(null)}
        style={{ width: "min(720px, 96vw)" }}
        footer={
          <div>
            <Button label={t("numberingMasters.cancel")} text onClick={() => setEdit(null)} />
            <Button label={t("numberingMasters.save")} icon="pi pi-check" onClick={save} loading={saving} />
          </div>
        }
      >
        {edit && (
          <div className="dn__form">
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
                <label htmlFor="cr-rate">{k("rate")}</label>
                <InputNumber inputId="cr-rate" value={edit.ratePercent} min={0} max={100} minFractionDigits={0} maxFractionDigits={4} suffix=" %" onValueChange={(e) => set("ratePercent", e.value)} className={errors.rate ? "p-invalid" : undefined} />
                {errors.rate ? <small className="dn__error">{errors.rate}</small> : null}
              </div>
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
            <div className="admin__field admin__field--inline">
              <label htmlFor="cr-active">{t("numberingMasters.active")}</label>
              <InputSwitch inputId="cr-active" checked={!!edit.active} onChange={(e) => set("active", e.value)} />
            </div>
            <div className="admin__field">
              <label htmlFor="cr-remarks">{k("remarks")}</label>
              <InputTextarea id="cr-remarks" rows={2} autoResize value={edit.remarks} onChange={(e) => set("remarks", e.target.value)} />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default CommissionRateMatrix;
