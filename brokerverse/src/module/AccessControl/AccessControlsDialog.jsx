import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { hasPermission } from "../../utils/canOpen";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { PendingBlock } from "./AccessChanges";
import { LoadError, useLabels } from "./common";

/**
 * Access controls (Role Permissions > More options): whether changes of access wait for a second administrator,
 * whether segregation of duties and the approval limits are enforced, and what happens to an approver without a
 * limit. A change always waits for another administrator, whatever the first switch says; while one waits, its
 * approval block replaces the form.
 */
const AccessControlsDialog = ({ visible, onHide, onChanged }) => {
  const k = useLabels();
  const loader = useCallback(() => accessControlService.accessControls(), []);
  const { data, error, reload } = useStableLoad(loader, { enabled: visible });
  const [values, setValues] = useState({});
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const edit = hasPermission("write:access-control");

  useEffect(() => {
    if (!visible || !data) return;
    setValues(Object.fromEntries(data.items.map((i) => [i.key, i.value])));
    setReason(null);
    setTried(false);
  }, [visible, data]);

  const words = {
    "access.change_approval": k("controls.changeApproval", "Changes of access wait for a second administrator"),
    "access.sod_enforced": k("controls.sodEnforced", "Segregation of duties is checked when roles are given"),
    "access.authority_enforced": k("controls.authorityEnforced", "Approvals are checked against the approval limits"),
    "access.authority_without_limit": k("controls.withoutLimit", "An approver without a limit for the transaction"),
  };
  const optionWords = { allow: k("controls.mayApprove", "May approve"), refuse: k("controls.isRefused", "Is refused") };
  const changed = (data?.items || []).filter((i) => values[i.key] !== undefined && values[i.key] !== i.value);
  const pending = data?.pending || null;
  const canForm = edit && !pending;

  const submit = async () => {
    setTried(true);
    if (!changed.length || reasonProblem(reason)) return;
    setSaving(true);
    try {
      const r = await accessControlService.proposeAccessControls({ values: Object.fromEntries(changed.map((i) => [i.key, values[i.key]])), ...reasonPayload(reason) });
      notifySuccess(r.message);
      await reload();
      await onChanged?.();
    } catch (e) {
      notifyError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const decided = async () => {
    await reload();
    await onChanged?.();
  };

  const footer = canForm ? (
    <div className="am-panel__footer">
      <span />
      <span className="rp-actions">
        <Button label={k("cancel", "Cancel")} text onClick={onHide} disabled={saving} />
        <Button label={k("submitForApproval", "Submit for approval")} icon="pi pi-send" onClick={submit} loading={saving} disabled={!changed.length} />
      </span>
    </div>
  ) : <Button label={k("authority.close", "Close")} text onClick={onHide} />;

  return (
    <Dialog visible={visible} onHide={onHide} modal className="am-panel access-form" style={{ width: "min(36rem, 96vw)" }} footer={footer}
      header={k("controls.title", "Access controls")}>
      <LoadError error={error} onRetry={reload} />
      {data ? (
        <div className="am-panel__body">
          {pending ? <PendingBlock change={pending} onDone={decided} /> : null}
          <ul className="access-controls">
            {data.items.map((i) => (
              <li key={i.key}>
                <label htmlFor={`ctl-${i.key}`}>{words[i.key] || i.name}</label>
                {i.type === "boolean" ? (
                  <InputSwitch inputId={`ctl-${i.key}`} checked={!!values[i.key]} disabled={!canForm} onChange={(e) => setValues((v) => ({ ...v, [i.key]: !!e.value }))} />
                ) : (
                  <Dropdown inputId={`ctl-${i.key}`} value={values[i.key]} disabled={!canForm} className="access-controls__choice"
                    options={(i.options || []).map((o) => ({ value: o.value, label: optionWords[o.value] || o.name }))}
                    onChange={(e) => setValues((v) => ({ ...v, [i.key]: e.value }))} />
                )}
              </li>
            ))}
          </ul>
          {canForm && changed.length ? <ReasonPicker context="access_change" value={reason} onChange={setReason} showErrors={tried} disabled={saving} /> : null}
        </div>
      ) : null}
    </Dialog>
  );
};

AccessControlsDialog.propTypes = { visible: PropTypes.bool, onHide: PropTypes.func.isRequired, onChanged: PropTypes.func };

export default AccessControlsDialog;
