import React, { useCallback } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import { Accordion, AccordionTab } from "primereact/accordion";
import { Sidebar } from "primereact/sidebar";
import { Skeleton } from "primereact/skeleton";
import { Tag } from "primereact/tag";
import KeyValueGrid from "../../components/KeyValueGrid";
import StatusChip from "../../components/StatusChip";
import { useStableLoad } from "../../hooks/useStableLoad";
import accessControlService from "../../services/accessControlService";
import { limitValue } from "./authorityFormat";
import { DELEGATION_WORDS } from "./delegations";
import { ConflictChip, EmptyState, LoadError, dateTime, severityOf, shortDate, useAccessNames, useLabels } from "./common";

const ROLE_PERMISSIONS = "/master/generals/usermanagement/role-permissions";
const DELEGATIONS = "/master/generals/usermanagement/delegations";
const REVIEWS = "/master/generals/usermanagement/access-reviews";

const Section = ({ title, children, action }) => (
  <section className="access-panel__section">
    <div className="access-panel__section-head">
      <h3>{title}</h3>
      {action || null}
    </div>
    {children}
  </section>
);

Section.propTypes = { title: PropTypes.node.isRequired, children: PropTypes.node, action: PropTypes.node };

/**
 * Access panel of one person (read only, on the right): roles with the roles they include, what the person can do by
 * area and module, approval authority today, delegations given and received, segregation-of-duties conflicts, the
 * last access review and the changes of access waiting for approval. `userId` null: closed.
 */
const UserAccessPanel = ({ userId, technical = false, onHide }) => {
  const k = useLabels();
  const names = useAccessNames();
  const loader = useCallback(() => accessControlService.userAccess(userId), [userId]);
  const { data, loading, error, reload } = useStableLoad(loader, { enabled: !!userId });
  const shown = data && data.user.id === userId ? data : null;
  const u = shown?.user;
  const statusWords = { active: k("status.active", "Active"), inactive: k("status.inactive", "Inactive"), locked: k("status.locked", "Locked") };
  const level = (code) => names.level(code);
  const authorityText = (a) => (a.set ? limitValue(a.measure, a.limit, a.unlimited, k("noLimit", "No limit")) : k("uam.notRestricted", "No limit set: not restricted"));

  return (
    <Sidebar visible={!!userId} position="right" onHide={onHide} className="access-panel" blockScroll
      header={<span className="access-panel__title">{u ? u.displayName : k("uam.accessTitle", "Access")}</span>} aria-label={k("uam.accessTitle", "Access")}>
      <LoadError error={error} onRetry={reload} />
      {!shown && loading ? <div role="status" aria-busy="true">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} height="3rem" className="mb-3" />)}</div> : null}
      {shown ? (
        <div className="access-panel__body">
          <div className="access-panel__facts">
            <StatusChip code={u.status} severity={severityOf(u.status)} label={statusWords[u.status] || u.status} />
            <KeyValueGrid columns={2} items={[
              { key: "username", label: k("uam.username", "Username"), value: u.username },
              { key: "department", label: k("colDepartment", "Department"), value: u.department || u.hrDepartment || null },
              { key: "designation", label: k("uam.designation", "Designation"), value: u.designation },
              { key: "branch", label: k("colBranch", "Branch"), value: u.branchName || u.branch },
              { key: "signin", label: k("colLastSignIn", "Last sign-in"), value: u.lastLoginAt ? dateTime(u.lastLoginAt) : k("never", "Never") },
              { key: "twostep", label: k("uam.colTwoStep", "Two-step"), value: u.twoFactor ? k("on", "On") : k("off", "Off") },
            ]} />
          </div>

          {u.pending.length ? (
            <Section title={k("uam.pendingTitle", "Waiting for approval")}>
              <ul className="access-lines">
                {u.pending.map((p) => <li key={p.ref}><Link to={p.link}>{`${p.ref} · ${p.kindLabel}: ${p.title}`}</Link></li>)}
              </ul>
            </Section>
          ) : null}

          <Section title={k("colRoles", "Roles")}>
            {shown.roles.length ? shown.roles.map((r) => (
              <div key={r.code} className="access-panel__role">
                <div className="access-panel__role-head">
                  <Link to={`${ROLE_PERMISSIONS}?view=role&role=${encodeURIComponent(r.code)}`}>{r.name}</Link>
                  <span className="rp-muted">{r.platform ? k("basePlatformRoles", "Base platform roles") : r.department || k("otherRoles", "Other roles")}</span>
                  {technical ? <span className="rp-code">{r.code}</span> : null}
                </div>
                {r.summary ? <span className="rp-muted">{r.summary}</span> : null}
                {r.included.length ? <span className="rp-muted">{k("uam.includes", "Includes {{roles}}", { roles: r.included.map((x) => x.name).join(", ") })}</span> : null}
              </div>
            )) : <EmptyState text={k("uam.noRoles", "No role")} />}
          </Section>

          <Section title={k("uam.canDo", "What this person can do")}>
            {shown.fullAccess ? <Tag severity="info" value={k("uam.fullAccess", "Full access: every screen and every action")} /> : null}
            {!shown.fullAccess && !shown.access.length ? <EmptyState text={k("uam.noAccess", "No access")} /> : null}
            {!shown.fullAccess && shown.access.length ? (
              <Accordion multiple className="access-panel__areas">
                {shown.access.map((a) => (
                  <AccordionTab key={a.code} header={`${names.area(a)} (${a.modules.length})`}>
                    <table className="access-panel__levels">
                      <tbody>
                        {a.modules.map((m) => (
                          <tr key={m.code}>
                            <th scope="row">{names.module(m)}{technical ? <span className="rp-code">{m.codes.join(", ")}</span> : null}</th>
                            <td>{m.levels.map(level).join(" · ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </AccordionTab>
                ))}
              </Accordion>
            ) : null}
          </Section>

          <Section title={k("uam.authority", "Approval authority today")}>
            {shown.authority.length ? (
              <table className="access-panel__levels">
                <tbody>
                  {shown.authority.map((a) => (
                    <tr key={a.transactionType}>
                      <th scope="row">{a.name}</th>
                      <td>
                        <span className="rp-cell-stack">
                          <span>{authorityText(a)}</span>
                          {a.source ? <span className="rp-muted">{a.source}</span> : null}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <span className="rp-muted">{k("uam.noApprovals", "Approves no transaction checked by the Authority Matrix")}</span>}
          </Section>

          <Section title={k("uam.delegations", "Delegations")} action={<Link to={DELEGATIONS}>{k("uam.openDelegations", "Open Delegations")}</Link>}>
            {[...shown.delegations.given, ...shown.delegations.received].length ? (
              <ul className="access-lines">
                {shown.delegations.given.map((d) => (
                  <li key={d.key}>{k("uam.coveredBy", "Covered by {{name}}", { name: d.delegateName })} · {shortDate(d.dateFrom)} – {shortDate(d.dateTo)} · {k(`delegation.status.${d.status}`, DELEGATION_WORDS[d.status])}</li>
                ))}
                {shown.delegations.received.map((d) => (
                  <li key={d.key}>{k("uam.covers", "Covers for {{name}}", { name: d.delegatorName })} · {shortDate(d.dateFrom)} – {shortDate(d.dateTo)} · {k(`delegation.status.${d.status}`, DELEGATION_WORDS[d.status])}</li>
                ))}
              </ul>
            ) : <span className="rp-muted">{k("uam.noDelegations", "No delegation in effect or planned")}</span>}
          </Section>

          <Section title={k("colSod", "Segregation of duties")}>
            {u.sodConflicts.length ? <div className="access-chips">{u.sodConflicts.map((c) => <ConflictChip key={c.ruleId} conflict={c} />)}</div>
              : <span className="rp-muted">{k("uam.noConflicts", "No conflict")}</span>}
          </Section>

          <Section title={k("uam.lastReview", "Last access review")}>
            {u.lastReview ? (
              <span className="rp-cell-stack">
                <Link to={`${REVIEWS}?review=${u.lastReview.reviewId}`}>{u.lastReview.name}</Link>
                <span>{k(`review.outcome.${u.lastReview.decision}`, u.lastReview.outcome)}{u.lastReview.remarks ? ` · ${u.lastReview.remarks}` : ""}</span>
                <span className="rp-muted">{`${u.lastReview.decidedBy || ""} · ${dateTime(u.lastReview.decidedAt)}`}</span>
              </span>
            ) : <span className="rp-muted">{k("uam.notReviewed", "Not reviewed yet")}</span>}
          </Section>
        </div>
      ) : null}
    </Sidebar>
  );
};

UserAccessPanel.propTypes = { userId: PropTypes.string, technical: PropTypes.bool, onHide: PropTypes.func.isRequired };

export default UserAccessPanel;
