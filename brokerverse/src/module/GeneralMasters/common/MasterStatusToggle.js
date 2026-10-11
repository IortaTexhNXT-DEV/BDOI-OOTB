import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "../../../components/ToggleButton/index.scss";
import mastersService from "../../../services/mastersService";
import { openConfirm } from "../../../components/ConfirmDialog";
import { humanize } from "../../../components/ActivityLog";

export const isActiveRecord = (record) =>
  record?.isActive ?? String(record?.status || "Active").toLowerCase() === "active";

// placeholders some lists put in empty cells
const EMPTY_TEXT = ["n/a", "na", "-", "—"];
const textOf = (v) => {
  const s = typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
  return EMPTY_TEXT.includes(s.toLowerCase()) ? "" : s;
};

// codes that belong to an address or a counterpart, not to the record itself
const NOT_RECORD_CODE = /^(pin|postal|zip|area|phone|country|state|city|tocurrency|employee|branch)code$/i;

// master lists name their columns differently (roleName, CompanyName, userName ...): the first name and code found
const fieldOf = (record, pattern, skip = () => false) => {
  const key = Object.keys(record || {}).find((k) => pattern.test(k) && !skip(k) && textOf(record[k]));
  return key ? textOf(record[key]) : "";
};

/** Name and code of a master record, as far as the row carries them. */
export const recordIdentity = (record) => ({
  name: textOf(record?.displayName) || textOf(record?.name) || fieldOf(record, /name$/i, (k) => /^(createdBy|modifiedBy|updatedBy|user)Name$/i.test(k)),
  code: textOf(record?.code) || fieldOf(record, /code$/i, (k) => NOT_RECORD_CODE.test(k)),
});

/**
 * The facts that tell one record from the others in the deactivation confirm. Most masters are named by their name
 * and code; a user by name, user name and roles, a role by its name alone (its code is internal), an exchange rate by
 * its currencies, rate and validity.
 */
export const identityFacts = (type, record, t) => {
  const { name, code } = recordIdentity(record);
  const fact = (key, value, extra = {}) => ({ label: t(`masterStatus.${key}`), value, hidden: value === null || value === undefined || value === "", ...extra });
  if (type === "user") {
    const roles = Array.isArray(record?.roleNames) ? record.roleNames.join(", ") : textOf(record?.assignedRole);
    return [fact("name", textOf(record?.displayName)), fact("username", textOf(record?.userName || record?.username)), fact("roles", roles)];
  }
  if (type === "role") return [fact("name", textOf(record?.roleName) || name)];
  if (type === "exchange-rate") {
    const from = textOf(record?.CurrencyCode);
    const to = textOf(record?.ToCurrencyCode);
    return [
      fact("currencies", from && to ? `${from} → ${to}` : from),
      fact("rate", textOf(record?.ExchangeRate)),
      fact("effectiveFrom", record?.EffectiveFrom || null, { type: "date" }),
      fact("effectiveTo", record?.EffectiveTo || null, { type: "date" }),
    ];
  }
  return [fact("name", name), { ...fact("code", code), hidden: !code || code === name }];
};

/**
 * Active / Inactive switch for a master record (same look as components/ToggleButton).
 * Persists through PATCH /masters/<type>/<id>/status, or through `onToggle` when given. Switching a record off asks
 * first (it is no longer offered on new transactions; a role or user loses access), naming the record.
 */
const MasterStatusToggle = ({ type, record, onToggle, onChanged, onError }) => {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(isActiveRecord(record));
  const [saving, setSaving] = useState(false);

  useEffect(() => setChecked(isActiveRecord(record)), [record]);

  const save = (next) => (onToggle ? onToggle(record, next) : mastersService.setStatus(type, record.id, next));

  const confirmDeactivation = () => {
    const kind = t(`masterStatus.types.${type}`, { defaultValue: humanize(type) });
    const note = ["role", "user"].includes(type) ? t(`masterStatus.note.${type}`) : t("masterStatus.note.default");
    return openConfirm({
      title: t("masterStatus.deactivateTitle", { kind }),
      severity: "warning",
      message: t("masterStatus.deactivateMessage", { kind: kind.toLowerCase() }),
      facts: [
        { label: t("masterStatus.recordType"), value: kind },
        ...identityFacts(type, record, t),
      ],
      note,
      confirmLabel: t("masterStatus.deactivateAction", { kind }),
    });
  };

  const handleToggle = async () => {
    if (!record?.id || saving) return;
    const next = !checked;
    if (!next && !(await confirmDeactivation())) return;
    setSaving(true);
    setChecked(next);
    try {
      const saved = await save(next);
      if (onChanged) onChanged(saved || { ...record, status: next ? "Active" : "Inactive", isActive: next });
    } catch (error) {
      setChecked(!next);
      if (onError) onError(error);
    } finally {
      setSaving(false);
    }
  };

  const inputId = `toggle-${type}-${record?.id}`;
  return (
    <div className="toggle__container">
      <label htmlFor={inputId} className="toggle">
        <input type="checkbox" id={inputId} className="input" checked={checked} onChange={handleToggle} />
        <div className="toggle-wrapper">
          <span className={`inactive-text ${!checked ? "active" : ""}`}>{t("masterStatus.active")}</span>
          <span className={`active-text ${checked ? "active" : ""}`}>{t("masterStatus.inactive")}</span>
          <span className="selector"></span>
        </div>
      </label>
    </div>
  );
};

export default MasterStatusToggle;
