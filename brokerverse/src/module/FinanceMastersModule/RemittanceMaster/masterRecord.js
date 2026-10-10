import React, { useEffect, useState } from "react";
import { Dropdown } from "primereact/dropdown";
import i18n from "../../../i18n";
import { masterService } from "../../../services/remittanceService";
import { openConfirm } from "../../../components/ConfirmDialog";
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

/**
 * Ask before deleting the record open on the screen, delete it from the confirmation (an error stays in the dialog)
 * and go back to the Remittance Master list. `kind` names the record type (remittanceMasters.kinds.<kind>) and `facts`
 * identify the record ([{ label, value }]).
 */
export const confirmDeleteAndReturn = async ({ type, id, kind, facts, toast, navigate }) => {
  if (!id) {
    navigate(MASTER_HOME);
    return;
  }
  const what = i18n.t(`remittanceMasters.kinds.${kind}`);
  const deleted = await openConfirm({
    title: i18n.t("remittanceMasters.delete.title", { what }),
    severity: "danger",
    message: i18n.t("remittanceMasters.delete.message", { what: what.toLowerCase() }),
    facts,
    note: i18n.t("remittanceMasters.delete.note"),
    confirmLabel: i18n.t("remittanceMasters.delete.action", { what }),
    onConfirm: () => masterService.remove(type, id),
  });
  if (!deleted) return;
  showSuccess(toast, i18n.t("remittanceMasters.delete.done", { what }));
  setTimeout(() => navigate(MASTER_HOME), 800);
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
