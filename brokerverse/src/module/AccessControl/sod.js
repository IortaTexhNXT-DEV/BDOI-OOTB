/**
 * Segregation of Duties: the rules of the screen, without React. The data is GET /access-control/sod-rules (rules
 * with the users breaking each and the change waiting) and /sod-conflicts (users x rules with the state of each
 * conflict: open, pending, accepted, expired).
 */
import { addDays } from "./delegations";

export const TABS = ["conflicts", "rules", "pending"];
export const STATES = ["open", "pending", "accepted", "expired"];
export const DEFAULT_STATES = ["open", "pending", "accepted", "expired"];
export const STATE_WORDS = { open: "Open", pending: "Exception waiting for approval", accepted: "Accepted", expired: "Exception expired" };

/** Rules of the list: those between two base platform roles only with `base`. */
export const visibleRules = (rules = [], base = false) => rules.filter((r) => base || !r.platform);

/** The conflicts the filters keep: a user (search or id), a rule, a department, states. */
export const filterConflicts = (rows = [], { search = "", userId = null, ruleId = null, department = null, states = DEFAULT_STATES } = {}) => {
  const q = String(search || "").trim().toLowerCase();
  return rows.filter((c) => (!userId || c.userId === userId) && (!ruleId || c.ruleId === Number(ruleId)) && (!department || c.department === department)
    && (!states.length || states.includes(c.state))
    && (!q || [c.userName, c.username].some((v) => String(v || "").toLowerCase().includes(q))));
};

/**
 * Figures of the stat cards: users with a conflict (and how many have one open), exceptions in force, exceptions
 * ending within 30 days of `asOf`, rules on (TISPH) and rules on between base platform roles.
 */
export const sodStats = (conflicts = [], rules = [], asOf = null) => {
  const users = new Set(conflicts.map((c) => c.userId));
  const open = new Set(conflicts.filter((c) => c.state === "open" || c.state === "expired").map((c) => c.userId));
  const accepted = conflicts.filter((c) => c.state === "accepted");
  const soon = asOf ? addDays(asOf, 30) : null;
  return {
    users: users.size,
    openUsers: open.size,
    accepted: accepted.length,
    endingSoon: soon ? accepted.filter((c) => c.exception?.validUntil && c.exception.validUntil <= soon).length : 0,
    rulesOn: rules.filter((r) => r.active && !r.platform).length,
    platformOn: rules.filter((r) => r.active && r.platform).length,
  };
};

/** What is missing in a rule: name, the two sides (two different roles, or access on both sides without overlap). */
export const ruleProblems = (form) => {
  const out = {};
  if (!String(form.name || "").trim()) out.name = "required";
  if (form.kind === "access") {
    if (!form.accessA?.length) out.accessA = "required";
    if (!form.accessB?.length) out.accessB = "required";
    else if (form.accessA?.some((c) => form.accessB.includes(c))) out.accessB = "overlap";
  } else {
    if (!form.roleA) out.roleA = "required";
    if (!form.roleB) out.roleB = "required";
    else if (form.roleA === form.roleB) out.roleB = "same";
  }
  return out;
};
