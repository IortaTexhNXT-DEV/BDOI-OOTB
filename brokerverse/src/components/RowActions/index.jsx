import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import "./index.scss";

/**
 * The buttons of a list row (view, edit, activate / deactivate and any other given as children): icon buttons of one
 * size, with their tooltip and accessible name, side by side in the Actions column. Every master list uses it, so the
 * column looks the same.
 */
const RowActions = ({ onView, onEdit, onStatus, active, statusDisabled = false, viewLabel, editLabel, children }) => {
  const { t } = useTranslation();
  const view = viewLabel || t("common.view", "View");
  const edit = editLabel || t("common.edit", "Edit");
  const status = active ? t("common.deactivate", "Deactivate") : t("common.activate", "Activate");
  return (
    <div className="bv-row-actions">
      {onView ? <Button type="button" icon="pi pi-eye" text rounded aria-label={view} tooltip={view} tooltipOptions={{ position: "top" }} onClick={onView} /> : null}
      {onEdit ? <Button type="button" icon="pi pi-pencil" text rounded aria-label={edit} tooltip={edit} tooltipOptions={{ position: "top" }} onClick={onEdit} /> : null}
      {onStatus ? (
        <Button type="button" icon={active ? "pi pi-ban" : "pi pi-check-circle"} text rounded aria-label={status} tooltip={status} tooltipOptions={{ position: "top" }}
          disabled={statusDisabled} onClick={onStatus} />
      ) : null}
      {children}
    </div>
  );
};

/** Column properties of the Actions column: as wide as its buttons, never wrapped (so no button is cut off). */
export const actionsColumn = { headerClassName: "bv-row-actions-head", bodyClassName: "bv-row-actions-cell" };

export default RowActions;
