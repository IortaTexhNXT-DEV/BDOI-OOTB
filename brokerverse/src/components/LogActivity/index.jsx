import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";

/**
 * Logging an interaction on a record, one verb and one form shape everywhere (review D-10): "Log activity" opens the
 * Log Activity dialog, whose first field is the activity type (Call, E-mail, Note, Meeting, or the types of the record's
 * own register), followed by the fields of that register. Each record keeps its own back end and rules: the sales
 * activities of prospects, quotations and clients (LEAD-07), the communication log of a claim (CLAIM-06) and the
 * follow-ups of a collection (CANC-02); this component only gives them the same entry point and dialog.
 */

/** Label key of a common activity type (logActivity.types.*); other codes show as given. */
export const activityTypeLabel = (t, code) => t(`logActivity.types.${String(code || "").toLowerCase()}`, String(code || ""));

/** The "Log activity" button of a record (outlined unless it is the page's primary action). */
export const LogActivityButton = ({ onClick, primary, disabled, size }) => {
  const { t } = useTranslation();
  return <Button type="button" icon="pi pi-plus" label={t("logActivity.button")} outlined={!primary} size={size} disabled={disabled} onClick={onClick} />;
};
LogActivityButton.propTypes = { onClick: PropTypes.func.isRequired, primary: PropTypes.bool, disabled: PropTypes.bool, size: PropTypes.string };
LogActivityButton.defaultProps = { primary: false, disabled: false, size: undefined };

/**
 * The Log Activity dialog: the activity type (`types`: [{ value, label }]), then `children` (the fields of the record's
 * register), Cancel and Save. `title` overrides the heading (for example when an activity is changed).
 */
export const LogActivityDialog = ({ visible, onHide, title, types, type, onTypeChange, typePlaceholder, children, onSave, saving, saveDisabled, saveLabel, saveIcon, width }) => {
  const { t } = useTranslation();
  return (
    <Dialog className="pe-dialog bv-log-activity" header={title || t("logActivity.title")} visible={visible} onHide={onHide} style={{ width }} breakpoints={{ "768px": "95vw" }}
      footer={(
        <>
          <Button type="button" label={t("logActivity.cancel")} text onClick={onHide} disabled={saving} />
          <Button type="button" label={saveLabel || t("logActivity.save")} icon={saveIcon} onClick={onSave} loading={saving} disabled={saveDisabled} />
        </>
      )}>
      <div className="grid">
        {types ? (
          <div className="col-12 md:col-6">
            <label htmlFor="log-activity-type" className="block mb-1">{t("logActivity.type")} *</label>
            <Dropdown inputId="log-activity-type" value={type} options={types} onChange={(e) => onTypeChange(e.value)} className="w-full"
              placeholder={typePlaceholder || t("logActivity.chooseType")} />
          </div>
        ) : null}
        {children}
      </div>
    </Dialog>
  );
};
LogActivityDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  onHide: PropTypes.func.isRequired,
  title: PropTypes.node,
  types: PropTypes.arrayOf(PropTypes.shape({ value: PropTypes.any, label: PropTypes.node })),
  type: PropTypes.any,
  onTypeChange: PropTypes.func,
  typePlaceholder: PropTypes.string,
  children: PropTypes.node,
  onSave: PropTypes.func.isRequired,
  saving: PropTypes.bool,
  saveDisabled: PropTypes.bool,
  saveLabel: PropTypes.string,
  saveIcon: PropTypes.string,
  width: PropTypes.string,
};
LogActivityDialog.defaultProps = {
  title: null, types: null, type: null, onTypeChange: () => {}, typePlaceholder: null, children: null, saving: false, saveDisabled: false, saveLabel: null,
  saveIcon: "pi pi-check", width: "min(760px, 96vw)",
};

export default LogActivityDialog;
