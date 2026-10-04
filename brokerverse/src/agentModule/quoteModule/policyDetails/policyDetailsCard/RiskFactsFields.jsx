import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { ageOn, riskFieldsToAsk } from "../../utils/useQuoteSetup";

const isoDay = (d) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : null);

/**
 * Risk details the product rules use: the fields the acceptance rules and rating factors of the governing template
 * test (driver date of birth, claims in the last 3 years, fair market value, modifications, claim-free years, number
 * of members...), so every rule is evaluated when the quotation is priced. Acceptance rule fields are required.
 */
const RiskFactsFields = ({ setup = null, value, onChange, missing = [] }) => {
  const { t } = useTranslation();
  const fields = riskFieldsToAsk(setup);
  if (!fields.length) return null;
  const set = (k, v) => onChange({ ...value, [k]: v });
  const label = (f) => `${t(`quoteRisk.fields.${f.field}`, { defaultValue: f.label })}${f.acceptanceRule ? " *" : ""}`;
  const err = (f) => (missing.includes(f.field) ? <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-2">{t("quoteRisk.required")}</div> : null);

  return (
    <div className="mt-3">
      <div className="coverage__details__card__container__sub__title mt-2 mb-1">{t("quoteRisk.title")}</div>
      <p className="mt-0 mb-2" style={{ fontSize: 13 }}>{t("quoteRisk.intro", { template: setup.templateName || setup.templateCode })}</p>
      <div className="grid m-0">
        {fields.map((f) => {
          const id = `risk-${f.field}`;
          if (f.field === "driverAge") {
            const age = ageOn(value.driverDateOfBirth);
            return (
              <div key={f.field} className="col-12 md:col-6 lg:col-6">
                <label htmlFor={id} className="block mb-1">{t("quoteRisk.driverDateOfBirth")}{f.acceptanceRule ? " *" : ""}</label>
                <Calendar inputId={id} value={value.driverDateOfBirth ? new Date(`${value.driverDateOfBirth}T00:00:00`) : null} onChange={(e) => set("driverDateOfBirth", isoDay(e.value))}
                  showIcon maxDate={new Date()} yearNavigator yearRange="1930:2030" dateFormat="yy-mm-dd" className="w-full" />
                {age !== null && <small>{t("quoteRisk.driverAgeIs", { age })}</small>}
                {err(f)}
              </div>
            );
          }
          if (f.type === "boolean") {
            return (
              <div key={f.field} className="col-12 md:col-6 lg:col-6 flex align-items-center gap-2">
                <Checkbox inputId={id} checked={value[f.field] === true} onChange={(e) => set(f.field, e.checked)} />
                <label htmlFor={id} className="m-0">{t(`quoteRisk.fields.${f.field}`, { defaultValue: f.label })}</label>
              </div>
            );
          }
          if (f.type === "text") {
            return (
              <div key={f.field} className="col-12 md:col-6 lg:col-6">
                <label htmlFor={id} className="block mb-1">{label(f)}</label>
                <Dropdown inputId={id} value={value[f.field] ?? null} options={(f.options || []).map((o) => ({ label: o, value: o }))} onChange={(e) => set(f.field, e.value)}
                  showClear editable className="w-full" />
                {err(f)}
              </div>
            );
          }
          return (
            <div key={f.field} className="col-12 md:col-6 lg:col-6">
              <label htmlFor={id} className="block mb-1">{label(f)}</label>
              <InputNumber inputId={id} value={value[f.field] ?? null} onValueChange={(e) => set(f.field, e.value)} min={0}
                {...(f.field === "fairMarketValue" ? { mode: "decimal", minFractionDigits: 2 } : { useGrouping: false })} className="w-full" />
              {err(f)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

RiskFactsFields.propTypes = {
  setup: PropTypes.object,
  value: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  missing: PropTypes.arrayOf(PropTypes.string),
};

export default RiskFactsFields;
