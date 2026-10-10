import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import DateField from "../../components/DateField";
import birTaxService from "../../services/birTaxService";

/** Fields of each readiness item: number and date (permit, ATP) or a user with a position (custodian, contact). */
export const REGISTRATION_KINDS = {
  permit: { number: "permitNumber", date: "permitDate" },
  atp: { number: "atpNumber", date: "atpDateIssued" },
  custodian: { user: "custodianUserId", position: "custodianPosition" },
  contact: { user: "contactUserId", position: "contactPosition" },
};

/** Position kept in the printed "Name, position[, e-mail]" text of a custodian or contact. */
const positionOf = (text, person) => {
  if (!text || !person) return person?.position || "";
  const parts = String(text).split(",").map((p) => p.trim());
  return parts[0] === person.name && parts[1] && !parts[1].includes("@") ? parts[1] : person.position || "";
};

/**
 * CAS registration values of one readiness item, saved with the Accounting permission (PUT /bir/cas/registration):
 * the CAS permit number and date, the invoice ATP or acknowledgement number and date, the backup custodian or the
 * system contact (an active user and the position printed on the documents).
 */
const CasRegistrationDialog = ({ kind, onHide, onSaved }) => {
  const { t } = useTranslation();
  const spec = REGISTRATION_KINDS[kind] || {};
  const [values, setValues] = useState(null);
  const [people, setPeople] = useState([]);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!kind) return undefined;
    let live = true;
    setValues(null);
    setTried(false);
    setError(null);
    birTaxService.casRegistration().then((r) => {
      if (!live) return;
      setPeople(r.people || []);
      if (spec.user) {
        const userId = r[spec.user] || null;
        const person = (r.people || []).find((p) => p.userId === userId);
        setValues({ [spec.user]: userId, [spec.position]: positionOf(kind === "custodian" ? r.custodian : r.contact, person) });
      } else {
        setValues({ [spec.number]: r[spec.number] || "", [spec.date]: r[spec.date] || "" });
      }
    }).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [kind, spec.user, spec.position, spec.number, spec.date]);

  const missing = values ? (spec.user ? !values[spec.user] : !String(values[spec.number] || "").trim() || !values[spec.date]) : true;
  const save = async () => {
    setTried(true);
    if (missing) return;
    setSaving(true);
    setError(null);
    try {
      await birTaxService.saveCasRegistration(values);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const set = (field, value) => setValues((v) => ({ ...v, [field]: value }));
  const pick = (userId) => {
    const person = people.find((p) => p.userId === userId);
    setValues((v) => ({ ...v, [spec.user]: userId, [spec.position]: v?.[spec.position] || person?.position || "" }));
  };
  const required = (label) => <>{label}<span className="bv-required" aria-hidden="true"> *</span></>;
  const fieldError = (field, empty) => (tried && empty ? <small className="p-error" id={`cas-reg-${field}-error`}>{t("birTax.casReg.required")}</small> : null);

  return (
    <Dialog className="pe-dialog bv-centered" visible={!!kind} header={kind ? t(`birTax.casReg.title.${kind}`) : ""} style={{ width: "min(520px, 95vw)" }} onHide={onHide}
      footer={(
        <div>
          <Button label={t("periodEnd.cancel")} text onClick={onHide} disabled={saving} />
          <Button label={t("birTax.casReg.save")} icon="pi pi-check" onClick={save} loading={saving} disabled={!values} />
        </div>
      )}>
      {values && spec.number ? (
        <div className="grid formgrid">
          <div className="field col-12 md:col-7">
            <label htmlFor="cas-reg-number">{required(t(`birTax.casReg.number.${kind}`))}</label>
            <InputText id="cas-reg-number" className={`w-full${tried && !String(values[spec.number]).trim() ? " p-invalid" : ""}`} value={values[spec.number]} maxLength={100}
              onChange={(e) => set(spec.number, e.target.value)} />
            {fieldError(spec.number, !String(values[spec.number]).trim())}
          </div>
          <div className="field col-12 md:col-5">
            <label htmlFor="cas-reg-date">{required(t(`birTax.casReg.date.${kind}`))}</label>
            <DateField id="cas-reg-date" value={values[spec.date]} onChange={(e) => set(spec.date, e.target.value)} invalid={tried && !values[spec.date]} />
            {fieldError(spec.date, !values[spec.date])}
          </div>
        </div>
      ) : null}
      {values && spec.user ? (
        <div className="grid formgrid">
          <div className="field col-12">
            <label htmlFor="cas-reg-user">{required(t(`birTax.casReg.user.${kind}`))}</label>
            <Dropdown inputId="cas-reg-user" className={`w-full${tried && !values[spec.user] ? " p-invalid" : ""}`} value={values[spec.user]} filter
              options={people.map((p) => ({ label: p.email ? `${p.name} (${p.email})` : p.name, value: p.userId }))} onChange={(e) => pick(e.value)}
              placeholder={t("birTax.casReg.chooseUser")} />
            {fieldError(spec.user, !values[spec.user])}
          </div>
          <div className="field col-12">
            <label htmlFor="cas-reg-position">{t("birTax.casReg.position")}</label>
            <InputText id="cas-reg-position" className="w-full" value={values[spec.position] || ""} maxLength={120} onChange={(e) => set(spec.position, e.target.value)} />
          </div>
        </div>
      ) : null}
      {error ? <div className="pe-error" role="alert">{error}</div> : null}
    </Dialog>
  );
};

CasRegistrationDialog.propTypes = {
  /** permit, atp, custodian or contact; null when closed */
  kind: PropTypes.oneOf(["permit", "atp", "custodian", "contact", null]),
  onHide: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};
CasRegistrationDialog.defaultProps = { kind: null };

export default CasRegistrationDialog;
