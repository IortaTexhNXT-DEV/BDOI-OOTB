import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { MultiSelect } from "primereact/multiselect";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import amlService, { errorMessage } from "../../services/amlService";
import { hasPermission } from "../../utils/canOpen";
import { AmlTag, FACTORS, PageHeader, showMoney, useOptionList } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";


/**
 * Compliance > AML Settings: the thresholds and periods of the AML programme (covered transaction amount and test,
 * filing days, match score, rating limits, KYC refresh months per rating, beneficial owner threshold, retention years,
 * events stopped by a hit, the commercial screening provider by environment variable name), the risk factors of the
 * customer risk rating and the monitoring rules with their parameters. Values marked "confirm" are the broker's to
 * check against the AMLC's current rules.
 */
const AmlSettings = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const factorNames = useOptionList(FACTORS, "factor");
  const blockEvents = useOptionList(["policy-issue", "payout", "onboarding"], "event");
  const [values, setValues] = useState({});
  const [original, setOriginal] = useState({});
  const [factors, setFactors] = useState([]);
  const [rules, setRules] = useState([]);
  const [factor, setFactor] = useState(null);
  const [rule, setRule] = useState(null);
  const [saving, setSaving] = useState(false);
  const canWrite = hasPermission("write:aml");

  const load = useCallback(async () => {
    try {
      const [s, f, r] = await Promise.all([amlService.settings(), amlService.factors(), amlService.rules()]);
      const map = Object.fromEntries(s.map((x) => [x.key, x.value]));
      setValues(map);
      setOriginal(map);
      setFactors(f);
      setRules(r);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, after) => {
    setSaving(true);
    try {
      const r = await fn();
      toast.current?.show({ severity: "success", summary: r.message });
      after?.(r);
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.saveFailed")) });
    } finally {
      setSaving(false);
    }
  };
  const set = (key, v) => setValues((x) => ({ ...x, [key]: v }));
  const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(original[k])));
  const provider = values["aml.screening_provider"] || {};
  const months = values["aml.kyc_refresh_months"] || {};
  const label = (key) => t(`aml.setting.${key.replace("aml.", "")}`);
  const num = (key, extra = {}) => (
    <div className="admin__field" key={key}>
      <label htmlFor={key}>{label(key)}</label>
      <InputNumber inputId={key} value={values[key] ?? null} disabled={!canWrite} onValueChange={(e) => set(key, e.value)} {...extra} />
    </div>
  );

  return (
    <div className="admin__page access__page aml__page">
      <Toast ref={toast} />
      <PageHeader title={t("aml.settingsTitle")} intro={t("aml.settingsIntro")} />
      <TabView>
        <TabPanel header={t("aml.tabGeneral")}>
          <Message severity="info" className="w-full mb-3" text={t("aml.confirmNote")} />
          <div className="aml__settings-grid">
            {num("aml.covered_threshold", { mode: "decimal", minFractionDigits: 2, maxFractionDigits: 2 })}
            <div className="admin__field">
              <label htmlFor="cov-agg">{label("aml.covered_aggregation")}</label>
              <Dropdown inputId="cov-agg" value={values["aml.covered_aggregation"]} disabled={!canWrite} onChange={(e) => set("aml.covered_aggregation", e.value)}
                options={[{ value: "banking-day", label: t("aml.aggregation.banking-day") }, { value: "single", label: t("aml.aggregation.single") }]} />
            </div>
            <div className="admin__field">
              <label htmlFor="cov-modes">{label("aml.covered_payment_modes")}</label>
              <InputText id="cov-modes" value={(values["aml.covered_payment_modes"] || []).join(", ")} disabled={!canWrite}
                onChange={(e) => set("aml.covered_payment_modes", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />
            </div>
            {num("aml.ctr_due_working_days")}
            {num("aml.str_due_working_days")}
            {num("aml.match_threshold", { minFractionDigits: 2, maxFractionDigits: 2, min: 0.5, max: 1 })}
            {num("aml.risk_low_max_score")}
            {num("aml.risk_high_min_score")}
            <div className="admin__field">
              <label htmlFor="pep-high">{label("aml.pep_always_high")}</label>
              <InputSwitch inputId="pep-high" checked={!!values["aml.pep_always_high"]} disabled={!canWrite} onChange={(e) => set("aml.pep_always_high", e.value)} />
            </div>
            {["low", "normal", "high"].map((r) => (
              <div className="admin__field" key={r}>
                <label htmlFor={`months-${r}`}>{t("aml.refreshMonths", { rating: t(`aml.rating.${r}`) })}</label>
                <InputNumber inputId={`months-${r}`} value={months[r] ?? null} disabled={!canWrite} onValueChange={(e) => set("aml.kyc_refresh_months", { ...months, [r]: e.value })} />
              </div>
            ))}
            {num("aml.kyc_refresh_notice_days")}
            {num("aml.beneficial_owner_threshold", { suffix: "%" })}
            {num("aml.record_retention_years", { min: 5 })}
            <div className="admin__field">
              <label htmlFor="blk-events">{label("aml.screening_block_events")}</label>
              <MultiSelect inputId="blk-events" value={values["aml.screening_block_events"] || []} options={blockEvents} display="chip" disabled={!canWrite} onChange={(e) => set("aml.screening_block_events", e.value)} />
            </div>
            <div className="admin__field">
              <label htmlFor="edd-block">{label("aml.block_issue_pending_edd")}</label>
              <InputSwitch inputId="edd-block" checked={!!values["aml.block_issue_pending_edd"]} disabled={!canWrite} onChange={(e) => set("aml.block_issue_pending_edd", e.value)} />
            </div>
            <div className="admin__field">
              <label htmlFor="inst-code">{label("aml.amlc_institution_code")}</label>
              <InputText id="inst-code" value={values["aml.amlc_institution_code"] || ""} disabled={!canWrite} onChange={(e) => set("aml.amlc_institution_code", e.target.value)} />
            </div>
          </div>
          <h4>{t("aml.transactionCodes")}</h4>
          <div className="aml__settings-grid">
            {Object.entries(values["aml.amlc_transaction_codes"] || {}).map(([k, v]) => (
              <div className="admin__field" key={k}>
                <label htmlFor={`tc-${k}`}>{t(`aml.txnCode.${k}`, { defaultValue: k })}</label>
                <InputText id={`tc-${k}`} value={v} disabled={!canWrite} onChange={(e) => set("aml.amlc_transaction_codes", { ...values["aml.amlc_transaction_codes"], [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <h4>{t("aml.providerSettings")}</h4>
          <div className="aml__settings-grid">
            <div className="admin__field">
              <label htmlFor="pv-provider">{t("aml.provider")}</label>
              <Dropdown inputId="pv-provider" value={provider.provider} disabled={!canWrite} onChange={(e) => set("aml.screening_provider", { ...provider, provider: e.value })}
                options={["lists", "fake", "http"].map((value) => ({ value, label: t(`aml.providerName.${value}`) }))} />
            </div>
            <div className="admin__field">
              <label htmlFor="pv-mode">{t("aml.mode")}</label>
              <Dropdown inputId="pv-mode" value={provider.mode} disabled={!canWrite} onChange={(e) => set("aml.screening_provider", { ...provider, mode: e.value })}
                options={[{ value: "sandbox", label: t("aml.sandbox") }, { value: "live", label: t("aml.live") }]} />
            </div>
            <div className="admin__field">
              <label htmlFor="pv-endpoint">{t("aml.endpoint")}</label>
              <InputText id="pv-endpoint" value={provider.endpoint || ""} disabled={!canWrite} onChange={(e) => set("aml.screening_provider", { ...provider, endpoint: e.target.value })} />
            </div>
            <div className="admin__field">
              <label htmlFor="pv-key">{t("aml.apiKeyEnv")}</label>
              <InputText id="pv-key" value={provider.apiKeyEnv || ""} disabled={!canWrite} onChange={(e) => set("aml.screening_provider", { ...provider, apiKeyEnv: e.target.value.toUpperCase() })} />
              <small>{t("aml.apiKeyEnvHelp")}</small>
            </div>
            <div className="admin__field">
              <label htmlFor="pv-timeout">{t("aml.timeoutMs")}</label>
              <InputNumber inputId="pv-timeout" value={provider.timeoutMs ?? null} disabled={!canWrite} onValueChange={(e) => set("aml.screening_provider", { ...provider, timeoutMs: e.value })} />
            </div>
            <div className="admin__field">
              <label htmlFor="pv-attempts">{t("aml.maxAttempts")}</label>
              <InputNumber inputId="pv-attempts" value={provider.maxAttempts ?? null} disabled={!canWrite} onValueChange={(e) => set("aml.screening_provider", { ...provider, maxAttempts: e.value })} />
            </div>
          </div>
          {canWrite ? (
            <div className="admin__actions mt-3">
              <Button label={t("aml.reset")} text disabled={!Object.keys(changed).length} onClick={() => setValues(original)} />
              <Button label={t("aml.save")} icon="pi pi-check" loading={saving} disabled={!Object.keys(changed).length} onClick={() => run(() => amlService.saveSettings(changed))} />
            </div>
          ) : null}
        </TabPanel>
        <TabPanel header={t("aml.tabFactors")}>
          <p className="access__muted">{t("aml.factorsIntro", { low: values["aml.risk_low_max_score"], high: values["aml.risk_high_min_score"] })}</p>
          {canWrite ? <Button className="mb-2" icon="pi pi-plus" label={t("aml.addFactor")} onClick={() => setFactor({ factor: "geography", matchValue: "", minAmount: null, maxAmount: null, score: 1, description: "", active: true })} /> : null}
          <DataTable value={factors} dataKey="id" size="small" stripedRows className="access__table" rowGroupMode="subheader" groupRowsBy="factor"
            rowGroupHeaderTemplate={(r) => <strong>{t(`aml.factor.${r.factor}`)}</strong>}>
            <Column header={t("aml.colValue")} body={(f) => (f.factor === "premium-size" ? `${showMoney(f.minAmount)} - ${f.maxAmount === null ? "" : showMoney(f.maxAmount)}` : f.matchValue === "*" ? t("aml.anyOther") : f.matchValue)} />
            <Column field="description" header={t("aml.colDescription")} />
            <Column field="score" header={t("aml.colScore")} />
            <Column header={t("aml.colActive")} body={(f) => (f.active ? t("aml.yes") : t("aml.no"))} />
            <Column header="" body={(f) => (canWrite ? (
              <div className="aml__row-actions">
                <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("aml.edit")} onClick={() => setFactor({ ...f })} />
                <Button icon="pi pi-trash" text rounded size="small" severity="danger" aria-label={t("aml.remove")} onClick={() => run(() => amlService.deleteFactor(f.id))} />
              </div>
            ) : null)} />
          </DataTable>
        </TabPanel>
        <TabPanel header={t("aml.tabRules")}>
          <DataTable value={rules} dataKey="code" size="small" stripedRows className="access__table">
            <Column field="code" header={t("aml.colCode")} />
            <Column header={t("aml.colRule")} body={(r) => <div className="access__user"><span className="access__user-name">{r.name}</span><span className="access__muted">{r.description}</span></div>} />
            <Column header={t("aml.colKind")} body={(r) => t(`aml.kind.${r.kind}`)} />
            <Column header={t("aml.colSeverity")} body={(r) => <AmlTag value={r.severity} group="severity" />} />
            <Column header={t("aml.params")} body={(r) => Object.entries(r.params).map(([k, v]) => `${t(`aml.param.${k}`, { defaultValue: k })}: ${v}`).join(", ")} />
            <Column header={t("aml.colActive")} body={(r) => <InputSwitch checked={r.enabled} disabled={!canWrite} onChange={(e) => run(() => amlService.saveRule(r.code, { enabled: e.value }))} />} />
            <Column header="" body={(r) => (canWrite && Object.keys(r.params).length ? <Button icon="pi pi-pencil" text rounded size="small" aria-label={t("aml.edit")} onClick={() => setRule({ ...r, params: { ...r.params } })} /> : null)} />
          </DataTable>
        </TabPanel>
      </TabView>

      <Dialog header={factor?.id ? t("aml.editFactor") : t("aml.addFactor")} visible={!!factor} style={{ width: "32rem" }} modal onHide={() => setFactor(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setFactor(null)} />
          <Button label={t("aml.save")} icon="pi pi-check" loading={saving} onClick={() => {
            const body = { factor: factor.factor, matchValue: factor.factor === "premium-size" ? "*" : (factor.matchValue || "*").trim(), minAmount: factor.factor === "premium-size" ? factor.minAmount ?? 0 : null,
              maxAmount: factor.factor === "premium-size" ? factor.maxAmount ?? null : null, score: factor.score ?? 0, description: factor.description || null, active: factor.active };
            run(() => (factor.id ? amlService.saveFactor(factor.id, body) : amlService.addFactor(body)), () => setFactor(null));
          }} />
        </>}>
        {factor ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field"><label htmlFor="ft-factor">{t("aml.colFactor")}</label><Dropdown inputId="ft-factor" value={factor.factor} options={factorNames} onChange={(e) => setFactor((f) => ({ ...f, factor: e.value }))} /></div>
            {factor.factor === "premium-size" ? (
              <div className="access__two">
                <div className="admin__field"><label htmlFor="ft-min">{t("aml.minAmount")}</label><InputNumber inputId="ft-min" value={factor.minAmount} onValueChange={(e) => setFactor((f) => ({ ...f, minAmount: e.value }))} /></div>
                <div className="admin__field"><label htmlFor="ft-max">{t("aml.maxAmount")}</label><InputNumber inputId="ft-max" value={factor.maxAmount} onValueChange={(e) => setFactor((f) => ({ ...f, maxAmount: e.value }))} /></div>
              </div>
            ) : (
              <div className="admin__field"><label htmlFor="ft-value">{t("aml.colValue")}</label><InputText id="ft-value" value={factor.matchValue} onChange={(e) => setFactor((f) => ({ ...f, matchValue: e.target.value }))} /><small>{t("aml.matchValueHelp")}</small></div>
            )}
            <div className="admin__field"><label htmlFor="ft-score">{t("aml.colScore")}</label><InputNumber inputId="ft-score" value={factor.score} min={0} max={100} onValueChange={(e) => setFactor((f) => ({ ...f, score: e.value }))} /></div>
            <div className="admin__field"><label htmlFor="ft-desc">{t("aml.colDescription")}</label><InputText id="ft-desc" value={factor.description || ""} onChange={(e) => setFactor((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="access__toggle"><InputSwitch inputId="ft-active" checked={factor.active} onChange={(e) => setFactor((f) => ({ ...f, active: e.value }))} /><label htmlFor="ft-active">{t("aml.colActive")}</label></div>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={rule ? `${rule.code}: ${rule.name}` : ""} visible={!!rule} style={{ width: "32rem" }} modal onHide={() => setRule(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setRule(null)} />
          <Button label={t("aml.save")} icon="pi pi-check" loading={saving} onClick={() => run(() => amlService.saveRule(rule.code, { params: rule.params, severity: rule.severity }), () => setRule(null))} />
        </>}>
        {rule ? (
          <div className="admin__grid admin__grid--single">
            {Object.entries(rule.params).map(([k, v]) => (
              <div className="admin__field" key={k}>
                <label htmlFor={`rp-${k}`}>{t(`aml.param.${k}`, { defaultValue: k })}</label>
                <InputNumber inputId={`rp-${k}`} value={v} min={0} maxFractionDigits={2} onValueChange={(e) => setRule((r) => ({ ...r, params: { ...r.params, [k]: e.value ?? 0 } }))} />
              </div>
            ))}
            <div className="admin__field">
              <label htmlFor="rp-sev">{t("aml.colSeverity")}</label>
              <Dropdown inputId="rp-sev" value={rule.severity} options={["low", "medium", "high"].map((value) => ({ value, label: t(`aml.severity.${value}`) }))} onChange={(e) => setRule((r) => ({ ...r, severity: e.value }))} />
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default AmlSettings;
