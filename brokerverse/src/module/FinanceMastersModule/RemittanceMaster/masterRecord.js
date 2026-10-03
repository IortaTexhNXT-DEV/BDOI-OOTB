import React, { useEffect, useState } from "react";
import { Dropdown } from "primereact/dropdown";
import { masterService } from "../../../services/remittanceService";
import { showError, showSuccess } from "../../Remittance/shared";

export const MASTER_HOME = "/master/finance/remittance";

/**
 * Remittance Master records live in the generic master store (/masters/<type>). Each screen saves the typed fields
 * the backend uses plus its whole form under `form`, so re-opening the record restores every field of the screen.
 */
export const saveRecord = (type, id, record) => (id ? masterService.update(type, id, record) : masterService.create(type, record));

export const saveAndReturn = async ({ type, id, record, toast, navigate }) => {
  try {
    const saved = await saveRecord(type, id, record);
    showSuccess(toast, `${saved?.code || record.code} saved`);
    setTimeout(() => navigate(MASTER_HOME), 800);
    return saved;
  } catch (error) {
    showError(toast, error, "Save failed");
    return null;
  }
};

export const deleteAndReturn = async ({ type, id, toast, navigate }) => {
  if (!id) {
    navigate(MASTER_HOME);
    return;
  }
  try {
    await masterService.remove(type, id);
    showSuccess(toast, "Record deleted");
    setTimeout(() => navigate(MASTER_HOME), 800);
  } catch (error) {
    showError(toast, error, "Delete failed");
  }
};

/** Loads { label: "CODE - name", value: code, name } options of a master type once. */
export const useMasterOptions = (type, toast) => {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    masterService.options(type)
      .then((rows) => setOptions((rows || []).map((r) => ({ label: `${r.code} - ${r.label}`, value: r.code, name: r.label }))))
      .catch((error) => showError(toast, error));
  }, [type, toast]);
  return options;
};

/** Account / master lookup: a filterable dropdown over a master type that still accepts a typed value. */
export const MasterLookup = ({ type, value, onChange, disabled, placeholder, toast, className = "full-width" }) => {
  const options = useMasterOptions(type, toast);
  return (
    <Dropdown
      value={value}
      options={options}
      onChange={(e) => onChange(e.value)}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      filter
      editable
    />
  );
};
