import React, { useEffect, useState } from "react";
import "../../../components/ToggleButton/index.scss";
import mastersService from "../../../services/mastersService";

export const isActiveRecord = (record) =>
  record?.isActive ?? String(record?.status || "Active").toLowerCase() === "active";

/**
 * Active / Inactive switch for a master record (same look as components/ToggleButton).
 * Persists through PATCH /masters/<type>/<id>/status, or through `onToggle` when given.
 */
const MasterStatusToggle = ({ type, record, onToggle, onChanged, onError }) => {
  const [checked, setChecked] = useState(isActiveRecord(record));
  const [saving, setSaving] = useState(false);

  useEffect(() => setChecked(isActiveRecord(record)), [record]);

  const handleToggle = async () => {
    if (!record?.id || saving) return;
    const next = !checked;
    setSaving(true);
    setChecked(next);
    try {
      const saved = onToggle ? await onToggle(record, next) : await mastersService.setStatus(type, record.id, next);
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
          <span className={`inactive-text ${!checked ? "active" : ""}`}>Active</span>
          <span className={`active-text ${checked ? "active" : ""}`}>Inactive</span>
          <span className="selector"></span>
        </div>
      </label>
    </div>
  );
};

export default MasterStatusToggle;
