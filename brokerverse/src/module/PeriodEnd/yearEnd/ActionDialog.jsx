import React from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import Facts from "./Facts";

/**
 * Confirmation pop-up of a year-end action: what is acted on (facts), the fields of the decision, one line on what
 * follows, and a button that names the action.
 */
const ActionDialog = ({ visible, title, facts = [], consequence, children, cancelLabel, confirmLabel, confirmIcon, severity, busy = false, disabled = false, onConfirm, onHide, width = 560 }) => (
  <Dialog className="pe-dialog ye-dialog" header={title} visible={visible} onHide={onHide} style={{ width: `min(${width}px, 95vw)` }} draggable={false}
    footer={(
      <div className="ye-dialog__footer">
        <Button type="button" label={cancelLabel} text onClick={onHide} disabled={busy} />
        <Button type="button" label={confirmLabel} icon={confirmIcon} severity={severity} loading={busy} disabled={disabled} onClick={onConfirm} />
      </div>
    )}>
    {facts.length > 0 && <Facts items={facts} className="ye-dialog__facts" />}
    {children}
    {consequence && <p className="ye-consequence"><i className="pi pi-info-circle" aria-hidden="true" /> {consequence}</p>}
  </Dialog>
);

ActionDialog.propTypes = {
  visible: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  facts: PropTypes.array,
  consequence: PropTypes.node,
  children: PropTypes.node,
  cancelLabel: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string.isRequired,
  confirmIcon: PropTypes.string,
  severity: PropTypes.string,
  busy: PropTypes.bool,
  disabled: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onHide: PropTypes.func.isRequired,
  width: PropTypes.number,
};

export default ActionDialog;
