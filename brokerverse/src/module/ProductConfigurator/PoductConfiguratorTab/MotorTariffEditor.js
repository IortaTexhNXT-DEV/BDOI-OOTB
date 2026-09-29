import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";

const slug = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/**
 * Motor tariff of a product template: Insurance Commission vehicle classes with default seats, the CTPL amount for
 * one year and for the 3-year upfront cover of brand-new vehicles (blank = not offered), both inclusive of taxes and
 * fees, and the Auto Passenger PA rate and limits per person. The quote screens and the server read these values.
 */
const MotorTariffEditor = ({ configuration = {}, fallbackClasses = [], onChange, labelClass, inputClass }) => {
  const classes = Array.isArray(configuration.vehicleClasses)
    ? configuration.vehicleClasses
    : fallbackClasses.map((c) => ({ code: c.key, label: c.label, seats: "" }));
  const ctpl = configuration.ctplSetting || {};
  const ctpl3 = configuration.ctplSetting3Year || {};
  const appa = configuration.appaSetting || {};

  const update = (patch) => onChange({ ...configuration, ...patch });

  const setClass = (index, field, value) => {
    const next = classes.map((c, i) => (i === index ? { ...c, [field]: value } : c));
    const before = classes[index];
    // a new class takes its code from its name until the code is typed
    if (field === "label" && before?.isNew && !before?.codeTyped) next[index].code = slug(value);
    if (field === "code") next[index].codeTyped = true;
    const patch = { vehicleClasses: next };
    // keep the amounts with the class when its code changes
    if ((field === "code" || next[index].code !== before?.code) && before?.code) {
      const move = (table) => {
        const out = { ...table };
        if (out[before.code] !== undefined) {
          out[next[index].code] = out[before.code];
          delete out[before.code];
        }
        return out;
      };
      patch.ctplSetting = move(ctpl);
      patch.ctplSetting3Year = move(ctpl3);
    }
    update(patch);
  };

  const setAmount = (key, code, value) => {
    const table = { ...(configuration[key] || {}) };
    if (value === "") delete table[code];
    else table[code] = value;
    update({ [key]: table, vehicleClasses: classes });
  };

  const addClass = () =>
    update({ vehicleClasses: [...classes, { code: "", label: "", seats: "", isNew: true }] });

  const removeClass = (index) => {
    const code = classes[index]?.code;
    const drop = (table) => {
      const out = { ...(table || {}) };
      delete out[code];
      return out;
    };
    update({
      vehicleClasses: classes.filter((_, i) => i !== index),
      ctplSetting: drop(ctpl),
      ctplSetting3Year: drop(ctpl3),
    });
  };

  return (
    <div className="mt-4">
      <h4>CTPL by vehicle class (Insurance Commission tariff, inclusive of taxes and fees)</h4>
      <p className="mt-0 text-sm">
        The 1-year amount is charged on every CTPL quote for the class. Enter a 3-year amount to offer the 3-year upfront
        CTPL for brand-new vehicles (LTO 3-year registration); leave it blank where the class has none. Default seats are
        used for Auto Passenger PA when the vehicle has no seating capacity.
      </p>
      <div className="grid font-semibold mt-2">
        <div className="col-12 md:col-4">Vehicle class</div>
        <div className="col-6 md:col-2">Code</div>
        <div className="col-6 md:col-1">Seats</div>
        <div className="col-6 md:col-2">CTPL 1 year (₱)</div>
        <div className="col-6 md:col-2">CTPL 3 years (₱)</div>
        <div className="col-12 md:col-1" />
      </div>
      {classes.map((c, i) => (
        <div key={i} className="grid align-items-center">
          <div className="col-12 md:col-4">
            <InputText className={inputClass} aria-label="Vehicle class" value={c.label || ""} onChange={(e) => setClass(i, "label", e.target.value)} />
          </div>
          <div className="col-6 md:col-2">
            <InputText
              className={inputClass}
              aria-label="Class code"
              value={c.code || ""}
              disabled={!c.isNew}
              onChange={(e) => setClass(i, "code", slug(e.target.value))}
            />
          </div>
          <div className="col-6 md:col-1">
            <InputText className={inputClass} aria-label="Default seats" keyfilter="int" value={c.seats ?? ""} onChange={(e) => setClass(i, "seats", e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div className="col-6 md:col-2">
            <InputText className={inputClass} aria-label="CTPL 1 year" keyfilter="num" value={ctpl[c.code] ?? ""} disabled={!c.code} onChange={(e) => setAmount("ctplSetting", c.code, e.target.value)} />
          </div>
          <div className="col-6 md:col-2">
            <InputText className={inputClass} aria-label="CTPL 3 years" keyfilter="num" placeholder="not offered" value={ctpl3[c.code] ?? ""} disabled={!c.code} onChange={(e) => setAmount("ctplSetting3Year", c.code, e.target.value)} />
          </div>
          <div className="col-12 md:col-1">
            <Button icon="pi pi-trash" className="p-button-text p-button-danger p-button-sm" tooltip="Remove class" onClick={() => removeClass(i)} />
          </div>
        </div>
      ))}
      <Button label="Add vehicle class" icon="pi pi-plus" className="p-button-text mt-2" onClick={addClass} />

      <h4 className="mt-5">Auto Passenger Personal Accident</h4>
      <p className="mt-0 text-sm">Premium = limit per person x seats (driver and passengers) x rate.</p>
      <div className="formgrid grid">
        <div className="field col-12 lg:col-6">
          <label className={labelClass}>Rate (% of limit per seat)</label>
          <InputText
            className={inputClass}
            keyfilter="num"
            value={appa.ratePercent ?? ""}
            onChange={(e) => update({ appaSetting: { ...appa, ratePercent: e.target.value === "" ? "" : e.target.value } })}
          />
        </div>
        <div className="field col-12 lg:col-6">
          <label className={labelClass}>Limits per person offered (₱, separated by commas)</label>
          <InputText
            className={inputClass}
            value={(appa.limitsText ?? (appa.limits || []).join(", "))}
            onChange={(e) =>
              update({
                appaSetting: {
                  ...appa,
                  limitsText: e.target.value,
                  limits: e.target.value
                    .split(/[,;\s]+/)
                    .map((x) => Number(x.replace(/[^0-9.]/g, "")))
                    .filter((x) => x > 0),
                },
              })
            }
          />
        </div>
      </div>
    </div>
  );
};

/** The tariff as it is saved: helper flags removed, amounts and seats as numbers where given. */
export const cleanMotorTariff = (configuration = {}) => {
  if (!Array.isArray(configuration.vehicleClasses) && !configuration.appaSetting) return configuration;
  const out = { ...configuration };
  if (Array.isArray(out.vehicleClasses)) {
    out.vehicleClasses = out.vehicleClasses.map(({ isNew, codeTyped, ...c }) => ({
      ...c,
      seats: c.seats === "" || c.seats == null ? undefined : Number(c.seats),
    }));
  }
  if (out.appaSetting) {
    const { limitsText, ...a } = out.appaSetting;
    out.appaSetting = { ...a, ratePercent: a.ratePercent === "" || a.ratePercent == null ? 0 : Number(a.ratePercent) };
  }
  return out;
};

export default MotorTariffEditor;
