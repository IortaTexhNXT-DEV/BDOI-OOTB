import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Message } from "primereact/message";
import ReasonPicker, { reasonPayload, reasonProblem } from "../../components/ReasonPicker";
import accessControlService from "../../services/accessControlService";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { stagedDelta } from "./roleAccess";
import { accessLine } from "./RoleAccessChanges";
import { useAccessNames, useLabels } from "./common";

/** One segregation-of-duties warning in words: the rule, the two duties, the reason, the role or the users concerned. */
export const SodWarning = ({ warning, idx }) => {
  const k = useLabels();
  const names = useAccessNames();
  const side = (codes) => codes.map((c) => accessLine(idx, names, c)).join(", ");
  const who = warning.scope === "role" ? k("rolePermissions.sodForRole", "for the role itself")
    : k("rolePermissions.sodForUsers", "for {{users}}", { users: `${warning.users.join(", ")}${warning.more ? ` +${warning.more}` : ""}` });
  return (
    <li className={`rp-sod rp-sod--${warning.action}`}>
      <span className="rp-sod__head">
        <strong>{warning.name}</strong>
        <span className="rp-sod__action">{warning.action === "block" ? k("rolePermissions.sodBlocks", "Not allowed") : k("rolePermissions.sodWarns", "Warning")}</span>
      </span>
      <span>{k("rolePermissions.sodCombines", "{{a}} with {{b}}, {{who}}", { a: side(warning.sideA), b: side(warning.sideB), who })}</span>
      {warning.reason ? <span className="rp-muted">{warning.reason}</span> : null}
    </li>
  );
};

SodWarning.propTypes = { warning: PropTypes.object.isRequired, idx: PropTypes.object };

/**
 * Side panel "Review and submit": the change in business words grouped by area, who is affected, the
 * segregation-of-duties warnings (a blocking rule refuses it) and the reason. Submit sends it for approval, or applies
 * it when the approval of access changes is switched off.
 */
const RoleAccessReview = ({ visible, role, idx, staged, implied, check, approval, onHide, onSubmitted }) => {
  const k = useLabels();
  const names = useAccessNames();
  const [reason, setReason] = useState(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const delta = useMemo(() => stagedDelta(staged), [staged]);

  const byArea = useMemo(() => {
    const lines = [...delta.grant.map((c) => ["added", c]), ...delta.revoke.map((c) => ["removed", c])];
    return idx.areas.map((a) => ({ area: a, lines: lines.filter(([, c]) => idx.permission(c)?.area === a.code) })).filter((g) => g.lines.length);
  }, [delta, idx]);
  const blocked = !!check?.blocked;

  const submit = async () => {
    setTried(true);
    if (reasonProblem(reason)) return;
    setSaving(true);
    try {
      const r = await accessControlService.proposeRoleAccess(role.code, { ...delta, ...reasonPayload(reason) });
      notifySuccess(r.message);
      setReason(null);
      setTried(false);
      onSubmitted(r.data);
    } catch (e) {
      notifyError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const throughRoles = check?.affected?.throughRoles || [];
  const footer = (
    <>
      <Button label={k("cancel", "Cancel")} text onClick={onHide} disabled={saving} />
      <Button label={approval ? k("submitForApproval", "Submit for approval") : k("rolePermissions.apply", "Apply")} icon="pi pi-send" loading={saving} disabled={blocked}
        onClick={submit} />
    </>
  );
  return (
    <Dialog header={k("rolePermissions.reviewTitle", "Review the access of {{role}}", { role: role.name })} visible={visible} onHide={onHide} footer={footer}
      style={{ width: "40rem" }} modal className="rp-review">
      <section className="rp-review__section">
        <h3>{k("rolePermissions.changes", "Changes")}</h3>
        {byArea.map(({ area, lines }) => (
          <div key={area.code} className="rp-review__area">
            <h4>{names.area(area)}</h4>
            <ul className="rp-change__lines">
              {lines.map(([kind, code]) => (
                <li key={code} className={`is-${kind}`}>
                  <i className={`pi ${kind === "added" ? "pi-plus-circle" : "pi-minus-circle"}`} aria-hidden="true" />
                  <span>
                    {kind === "added" ? k("rolePermissions.lineAdded", "Added: {{line}}", { line: accessLine(idx, names, code, { area: false }) })
                      : k("rolePermissions.lineRemoved", "Removed: {{line}}", { line: accessLine(idx, names, code, { area: false }) })}
                    {implied.includes(code) ? <span className="rp-muted">{k("rolePermissions.impliedView", "(added because the other levels need View)")}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <section className="rp-review__section">
        <h3>{k("rolePermissions.affected", "Who is affected")}</h3>
        <p className="rp-review__text">
          {k("rolePermissions.affectedUsers", "{{count}} active users of this role", { count: check?.affected?.users ?? role.users.active })}
          {throughRoles.length ? ` · ${k("rolePermissions.affectedThrough", "{{count}} more through {{roles}}", { count: check.affected.throughUsers, roles: throughRoles.join(", ") })}` : ""}
        </p>
        {role.status !== "active" ? <p className="rp-muted">{k("rolePermissions.inactiveApplies", "The role is inactive: the change applies when it is active again.")}</p> : null}
      </section>
      {check?.warnings?.length ? (
        <section className="rp-review__section">
          <h3>{k("rolePermissions.sodTitle", "Segregation of duties")}</h3>
          {blocked ? <Message severity="error" text={k("rolePermissions.sodBlocked", "A rule does not allow this change. Change the selection or the rule first.")} /> : null}
          <ul className="rp-sod-list">{check.warnings.map((w) => <SodWarning key={`${w.code}-${w.scope}`} warning={w} idx={idx} />)}</ul>
        </section>
      ) : null}
      <section className="rp-review__section">
        <ReasonPicker context="access_change" value={reason} onChange={setReason} showErrors={tried} disabled={saving} />
      </section>
      {!approval ? <p className="rp-muted">{k("rolePermissions.appliesAtOnce", "The approval of access changes is switched off: the change applies at once.")}</p> : null}
    </Dialog>
  );
};

RoleAccessReview.propTypes = {
  visible: PropTypes.bool,
  role: PropTypes.object.isRequired,
  idx: PropTypes.object.isRequired,
  staged: PropTypes.object.isRequired,
  implied: PropTypes.arrayOf(PropTypes.string).isRequired,
  check: PropTypes.object,
  approval: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  onSubmitted: PropTypes.func.isRequired,
};

export default RoleAccessReview;
