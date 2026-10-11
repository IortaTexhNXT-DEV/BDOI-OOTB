/**
 * Footer of a dialog by the UI standard (docs/developer-guide/ui-standard.md):
 * Close / Cancel as a text button on the left; on the right the destructive actions (red outlined, set apart), the
 * secondary actions (outlined; three or more collapse into one "More actions" menu) and one primary (filled) action.
 *
 *   <DialogFooter onClose={close} primary={{ label: "Submit", icon: "pi pi-send", onClick: submit }}
 *     secondary={[{ label: "Edit", icon: "pi pi-pencil", onClick: edit }]} destructive={[{ label: "Withdraw", onClick: withdraw }]} />
 *
 * Actions: { label, icon, onClick, loading, disabled, tooltip, hidden }. A hidden action is left out.
 */
import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import RowActions from "../RowActions";
import StatusChip from "../StatusChip";
import "./index.scss";

const shown = (list) => (list || []).filter((a) => a && !a.hidden);
const tip = (a) => (a.tooltip ? { tooltip: a.tooltip, tooltipOptions: { position: "top", showOnDisabled: true } } : {});

/** Number of secondary actions from which they collapse into the "More actions" menu. */
export const MORE_AT = 3;

const DialogFooter = ({ onClose, closeLabel, primary, secondary, destructive, children }) => {
  const { t } = useTranslation();
  const others = shown(secondary);
  const danger = shown(destructive);
  const main = primary && !primary.hidden ? primary : null;
  return (
    <div className="bv-dialog-footer">
      <div className="bv-dialog-footer__start">
        {onClose ? <Button type="button" label={closeLabel || t("common.close", "Close")} text onClick={onClose} /> : null}
      </div>
      <div className="bv-dialog-footer__end">
        {danger.length ? (
          <span className="bv-dialog-footer__danger">
            {danger.map((a) => (
              <Button key={a.label} type="button" label={a.label} icon={a.icon} severity="danger" outlined onClick={a.onClick} loading={a.loading} disabled={a.disabled} {...tip(a)} />
            ))}
          </span>
        ) : null}
        {others.length >= MORE_AT ? (
          <RowActions label={t("common.moreActions", "More actions")}
            actions={others.map((a, i) => ({ code: `a${i}`, label: a.label, allowed: !a.disabled, blockedReason: a.tooltip }))}
            onAction={(a) => others[Number(a.code.slice(1))].onClick()} />
        ) : others.map((a) => (
          <Button key={a.label} type="button" label={a.label} icon={a.icon} outlined onClick={a.onClick} loading={a.loading} disabled={a.disabled} {...tip(a)} />
        ))}
        {children}
        {main ? <Button type="button" label={main.label} icon={main.icon} onClick={main.onClick} loading={main.loading} disabled={main.disabled} {...tip(main)} /> : null}
      </div>
    </div>
  );
};

const action = PropTypes.shape({
  label: PropTypes.string.isRequired, icon: PropTypes.string, onClick: PropTypes.func, loading: PropTypes.bool, disabled: PropTypes.bool, tooltip: PropTypes.string, hidden: PropTypes.bool,
});

DialogFooter.propTypes = {
  onClose: PropTypes.func,
  closeLabel: PropTypes.string,
  primary: action,
  secondary: PropTypes.arrayOf(action),
  destructive: PropTypes.arrayOf(action),
  children: PropTypes.node,
};

/** Title of a record dialog: the record number, its version and its status chip (descriptions go in the body). */
export const RecordTitle = ({ number, version, status, statusLabel }) => (
  <span className="bv-record-title">
    <span className="bv-record-title__number">{number}</span>
    {version !== undefined && version !== null ? <span className="bv-record-title__version">v{version}</span> : null}
    {status || statusLabel ? <StatusChip code={status} label={statusLabel} /> : null}
  </span>
);

RecordTitle.propTypes = {
  number: PropTypes.node.isRequired,
  version: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  status: PropTypes.string,
  statusLabel: PropTypes.string,
};

export default DialogFooter;
