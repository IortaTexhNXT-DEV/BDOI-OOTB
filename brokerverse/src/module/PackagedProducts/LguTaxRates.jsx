import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { TabView, TabPanel } from "primereact/tabview";
import { Tag } from "primereact/tag";
import packagesService from "../../services/packagesService";
import { confirmAction, notifyError, notifySuccess } from "../../utility/dialogs";
import { formatDate } from "../../utility/dateFormat";
import { PageHeader } from "../Placement/shared";
import { ChargesBreakdown, PRODUCT_LINES, RULE_KINDS, RULE_METHODS, TAX_REGIMES, todayIso, usePackageOptions, lguOptions } from "./common";
import "../Placement/index.scss";
import "../Administration/index.scss";
import "./index.scss";

const EMPTY_LGU = { code: "", name: "", province: "Metro Manila", rate: 0.2, effectiveFrom: todayIso(), effectiveTo: "", active: true, remarks: "" };
const EMPTY_RULE = { code: "", name: "", kind: "other", method: "flat", rate: 0, unitAmount: 0, unitSize: 0, fractionRule: "round_up", lines: [], regimes: [], minimumAmount: 0,
  sortOrder: 100, active: true, effectiveFrom: todayIso(), effectiveTo: "", remarks: "" };

/**
 * Master > Packaged Products > LGU Tax Rates: the local government (premium) tax rate of each city or municipality, the
 * Taxes & Charges rules of the premium tax engine (VAT or premium tax, DST, FST, LGT, other charges) and a calculator
 * to check a premium's breakdown.
 */
const LguTaxRates = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`packagedProducts.taxes.${key}`, opts);
  const options = usePackageOptions();
  const [lgus, setLgus] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lgu, setLgu] = useState(null);
  const [rule, setRule] = useState(null);
  const [calc, setCalc] = useState({ premium: 10000, productId: null, lguCode: null });
  const [result, setResult] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([packagesService.listLguRates(), packagesService.listChargeRules()])
      .then(([l, r]) => { setLgus(l); setRules(r); })
      .catch((e) => notifyError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const saveLgu = async () => {
    const body = { ...lgu, effectiveTo: lgu.effectiveTo || null, remarks: lgu.remarks || null };
    delete body.id; delete body.cityName; delete body.updatedBy; delete body.updatedAt; delete body.cityId;
    try {
      if (lgu.id) await packagesService.updateLguRate(lgu.id, body);
      else await packagesService.createLguRate(body);
      notifySuccess(k("saved"));
      setLgu(null);
      load();
    } catch (e) {
      notifyError(e.message);
    }
  };
  const removeLgu = async (row) => {
    if (!(await confirmAction(k("deleteLgu", { name: row.name }), { danger: true }))) return;
    packagesService.deleteLguRate(row.id).then(load).catch((e) => notifyError(e.message));
  };
  const saveRule = async () => {
    const body = { ...rule, effectiveTo: rule.effectiveTo || null, remarks: rule.remarks || null, lines: rule.lines?.length ? rule.lines : null, regimes: rule.regimes?.length ? rule.regimes : null };
    const existing = rules.some((r) => r.code === rule.code) && rule.original;
    delete body.original; delete body.updatedBy; delete body.updatedAt;
    try {
      if (existing) {
        delete body.code;
        await packagesService.updateChargeRule(rule.code, body);
      } else await packagesService.createChargeRule(body);
      notifySuccess(k("saved"));
      setRule(null);
      load();
    } catch (e) {
      notifyError(e.message);
    }
  };
  const removeRule = async (row) => {
    if (!(await confirmAction(k("deleteRule", { name: row.name }), { danger: true }))) return;
    packagesService.deleteChargeRule(row.code).then(load).catch((e) => notifyError(e.message));
  };
  const runCalc = () => packagesService.calculateCharges({ premium: calc.premium || 0, productId: calc.productId, lguCode: calc.lguCode }).then(setResult).catch((e) => notifyError(e.message));

  const opt = (list, prefix) => list.map((v) => ({ label: t(`${prefix}.${v}`, { defaultValue: v }), value: v }));
  const active = (r) => <Tag value={r.active ? t("packagedProducts.active") : t("packagedProducts.inactive")} severity={r.active ? "success" : "danger"} />;
  const howMuch = (r) => (r.method === "per_unit" ? k("perUnit", { amount: r.unitAmount, size: r.unitSize }) : r.method === "flat" ? k("flat", { amount: r.unitAmount }) : `${r.rate}%`);

  return (
    <div className="placement-page pkg-page">
      <PageHeader title={k("title")} subtitle={k("subtitle")} />
      <TabView>
        <TabPanel header={k("lguTab")}>
          <div className="pkg-toolbar"><Button label={k("addLgu")} icon="pi pi-plus" onClick={() => setLgu({ ...EMPTY_LGU })} /></div>
          <DataTable value={lgus} loading={loading} dataKey="id" size="small" stripedRows paginator rows={15} emptyMessage={k("noLgu")} responsiveLayout="scroll">
            <Column field="code" header={k("code")} sortable />
            <Column field="name" header={k("lguName")} sortable />
            <Column field="province" header={k("province")} sortable />
            <Column header={k("rate")} body={(r) => `${r.rate}%`} className="num" headerClassName="num" />
            <Column header={k("effectiveFrom")} body={(r) => formatDate(r.effectiveFrom)} />
            <Column header={k("effectiveTo")} body={(r) => (r.effectiveTo ? formatDate(r.effectiveTo) : "-")} />
            <Column header={t("packagedProducts.active")} body={active} />
            <Column body={(r) => (
              <div className="admin__actions">
                <Button icon="pi pi-pencil" rounded text aria-label={t("common.edit")} onClick={() => setLgu({ ...r, effectiveTo: r.effectiveTo || "", remarks: r.remarks || "" })} />
                <Button icon="pi pi-trash" rounded text severity="danger" aria-label={t("common.delete")} onClick={() => removeLgu(r)} />
              </div>
            )} style={{ width: "7rem" }} />
          </DataTable>
        </TabPanel>
        <TabPanel header={k("rulesTab")}>
          <p className="muted">{k("rulesHelp")}</p>
          <div className="pkg-toolbar"><Button label={k("addRule")} icon="pi pi-plus" onClick={() => setRule({ ...EMPTY_RULE })} /></div>
          <DataTable value={rules} loading={loading} dataKey="code" size="small" stripedRows emptyMessage={k("noRule")} responsiveLayout="scroll">
            <Column field="code" header={k("code")} />
            <Column field="name" header={k("ruleName")} />
            <Column header={k("kind")} body={(r) => t(`packagedProducts.kinds.${r.kind}`, { defaultValue: r.kind })} />
            <Column header={k("amount")} body={howMuch} />
            <Column header={k("lines")} body={(r) => (r.lines || []).join(", ") || k("allLines")} />
            <Column header={k("regimes")} body={(r) => (r.regimes || []).map((x) => t(`packagedProducts.regimes.${x}`, { defaultValue: x })).join(", ") || k("allRegimes")} />
            <Column header={t("packagedProducts.active")} body={active} />
            <Column body={(r) => (
              <div className="admin__actions">
                <Button icon="pi pi-pencil" rounded text aria-label={t("common.edit")} onClick={() => setRule({ ...r, lines: r.lines || [], regimes: r.regimes || [], effectiveTo: r.effectiveTo || "", remarks: r.remarks || "", original: true })} />
                {r.kind === "other" && <Button icon="pi pi-trash" rounded text severity="danger" aria-label={t("common.delete")} onClick={() => removeRule(r)} />}
              </div>
            )} style={{ width: "7rem" }} />
          </DataTable>
        </TabPanel>
        <TabPanel header={k("calculatorTab")}>
          <div className="grid">
            <div className="col-12 md:col-5">
              <div className="admin__field"><label htmlFor="calc-premium">{k("premium")}</label>
                <InputNumber inputId="calc-premium" value={calc.premium} onValueChange={(e) => setCalc({ ...calc, premium: e.value })} mode="decimal" minFractionDigits={2} maxFractionDigits={2} /></div>
              <div className="admin__field"><label htmlFor="calc-product">{k("product")}</label>
                <Dropdown inputId="calc-product" value={calc.productId} options={options.products.map((p) => ({ label: p.name, value: p.id }))} filter showClear onChange={(e) => setCalc({ ...calc, productId: e.value })} /></div>
              <div className="admin__field"><label htmlFor="calc-lgu">{k("location")}</label>
                <Dropdown inputId="calc-lgu" value={calc.lguCode} options={lguOptions(options.lgus)} filter showClear placeholder={k("ruleRate")} onChange={(e) => setCalc({ ...calc, lguCode: e.value })} /></div>
              <Button label={k("calculate")} icon="pi pi-calculator" onClick={runCalc} className="mt-2" />
            </div>
            <div className="col-12 md:col-7">
              {result && <ChargesBreakdown premium={result.premium} lines={result.lines} total={result.total} />}
            </div>
          </div>
        </TabPanel>
      </TabView>

      <Dialog header={lgu?.id ? k("editLgu") : k("addLgu")} visible={Boolean(lgu)} onHide={() => setLgu(null)} style={{ width: "34rem" }} breakpoints={{ "640px": "95vw" }}
        footer={<><Button label={t("common.cancel")} text onClick={() => setLgu(null)} /><Button label={t("common.save")} icon="pi pi-check" onClick={saveLgu} /></>}>
        {lgu && (
          <div className="admin__grid">
            <div className="admin__field"><label htmlFor="lgu-code">{k("code")}</label><InputText id="lgu-code" value={lgu.code} disabled={Boolean(lgu.id)} onChange={(e) => setLgu({ ...lgu, code: e.target.value.toUpperCase() })} /></div>
            <div className="admin__field"><label htmlFor="lgu-name">{k("lguName")}</label><InputText id="lgu-name" value={lgu.name} onChange={(e) => setLgu({ ...lgu, name: e.target.value })} /></div>
            <div className="admin__field"><label htmlFor="lgu-province">{k("province")}</label><InputText id="lgu-province" value={lgu.province || ""} onChange={(e) => setLgu({ ...lgu, province: e.target.value })} /></div>
            <div className="admin__field"><label htmlFor="lgu-rate">{k("rate")}</label><InputNumber inputId="lgu-rate" value={lgu.rate} suffix="%" maxFractionDigits={4} min={0} max={100} onValueChange={(e) => setLgu({ ...lgu, rate: e.value })} /></div>
            <div className="admin__field"><label htmlFor="lgu-from">{k("effectiveFrom")}</label><InputText id="lgu-from" type="date" value={lgu.effectiveFrom || ""} onChange={(e) => setLgu({ ...lgu, effectiveFrom: e.target.value })} /></div>
            <div className="admin__field"><label htmlFor="lgu-to">{k("effectiveTo")}</label><InputText id="lgu-to" type="date" value={lgu.effectiveTo || ""} onChange={(e) => setLgu({ ...lgu, effectiveTo: e.target.value })} /></div>
            <div className="admin__field"><label htmlFor="lgu-active">{t("packagedProducts.active")}</label><InputSwitch inputId="lgu-active" checked={Boolean(lgu.active)} onChange={(e) => setLgu({ ...lgu, active: e.value })} /></div>
          </div>
        )}
      </Dialog>

      <Dialog header={rule?.original ? k("editRule") : k("addRule")} visible={Boolean(rule)} onHide={() => setRule(null)} style={{ width: "44rem" }} breakpoints={{ "760px": "95vw" }}
        footer={<><Button label={t("common.cancel")} text onClick={() => setRule(null)} /><Button label={t("common.save")} icon="pi pi-check" onClick={saveRule} /></>}>
        {rule && (
          <div className="admin__grid">
            <div className="admin__field"><label htmlFor="rule-code">{k("code")}</label><InputText id="rule-code" value={rule.code} disabled={rule.original} onChange={(e) => setRule({ ...rule, code: e.target.value.toUpperCase() })} /></div>
            <div className="admin__field"><label htmlFor="rule-name">{k("ruleName")}</label><InputText id="rule-name" value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} /></div>
            <div className="admin__field"><label htmlFor="rule-kind">{k("kind")}</label><Dropdown inputId="rule-kind" value={rule.kind} options={opt(RULE_KINDS, "packagedProducts.kinds")} disabled={rule.original} onChange={(e) => setRule({ ...rule, kind: e.value })} /></div>
            <div className="admin__field"><label htmlFor="rule-method">{k("method")}</label><Dropdown inputId="rule-method" value={rule.method} options={opt(RULE_METHODS, "packagedProducts.methods")} onChange={(e) => setRule({ ...rule, method: e.value })} /></div>
            {rule.method === "percent" && (
              <div className="admin__field"><label htmlFor="rule-rate">{k("rate")}</label><InputNumber inputId="rule-rate" value={rule.rate} suffix="%" maxFractionDigits={4} min={0} max={100} onValueChange={(e) => setRule({ ...rule, rate: e.value })} /></div>
            )}
            {rule.method !== "percent" && (
              <div className="admin__field"><label htmlFor="rule-unit-amount">{rule.method === "flat" ? k("flatAmount") : k("unitAmount")}</label><InputNumber inputId="rule-unit-amount" value={rule.unitAmount} minFractionDigits={2} maxFractionDigits={2} min={0} onValueChange={(e) => setRule({ ...rule, unitAmount: e.value })} /></div>
            )}
            {rule.method === "per_unit" && (
              <>
                <div className="admin__field"><label htmlFor="rule-unit-size">{k("unitSize")}</label><InputNumber inputId="rule-unit-size" value={rule.unitSize} minFractionDigits={2} maxFractionDigits={2} min={0} onValueChange={(e) => setRule({ ...rule, unitSize: e.value })} /></div>
                <div className="admin__field"><label htmlFor="rule-fraction">{k("fractionRule")}</label><Dropdown inputId="rule-fraction" value={rule.fractionRule} options={opt(["round_up", "prorate"], "packagedProducts.fraction")} onChange={(e) => setRule({ ...rule, fractionRule: e.value })} /></div>
              </>
            )}
            <div className="admin__field"><label htmlFor="rule-lines">{k("lines")}</label><MultiSelect inputId="rule-lines" value={rule.lines} options={PRODUCT_LINES.map((l) => ({ label: l, value: l }))} placeholder={k("allLines")} onChange={(e) => setRule({ ...rule, lines: e.value })} /></div>
            <div className="admin__field"><label htmlFor="rule-regimes">{k("regimes")}</label><MultiSelect inputId="rule-regimes" value={rule.regimes} options={opt(TAX_REGIMES, "packagedProducts.regimes")} placeholder={k("allRegimes")} onChange={(e) => setRule({ ...rule, regimes: e.value })} /></div>
            <div className="admin__field"><label htmlFor="rule-min">{k("minimumAmount")}</label><InputNumber inputId="rule-min" value={rule.minimumAmount} minFractionDigits={2} maxFractionDigits={2} min={0} onValueChange={(e) => setRule({ ...rule, minimumAmount: e.value })} /></div>
            <div className="admin__field"><label htmlFor="rule-sort">{k("sortOrder")}</label><InputNumber inputId="rule-sort" value={rule.sortOrder} min={0} onValueChange={(e) => setRule({ ...rule, sortOrder: e.value })} /></div>
            <div className="admin__field"><label htmlFor="rule-from">{k("effectiveFrom")}</label><InputText id="rule-from" type="date" value={rule.effectiveFrom || ""} onChange={(e) => setRule({ ...rule, effectiveFrom: e.target.value })} /></div>
            <div className="admin__field"><label htmlFor="rule-to">{k("effectiveTo")}</label><InputText id="rule-to" type="date" value={rule.effectiveTo || ""} onChange={(e) => setRule({ ...rule, effectiveTo: e.target.value })} /></div>
            <div className="admin__field"><label htmlFor="rule-active">{t("packagedProducts.active")}</label><InputSwitch inputId="rule-active" checked={Boolean(rule.active)} onChange={(e) => setRule({ ...rule, active: e.value })} /></div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default LguTaxRates;
