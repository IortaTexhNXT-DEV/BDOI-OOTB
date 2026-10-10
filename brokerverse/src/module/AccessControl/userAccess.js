/**
 * User Access Matrix: the rules of the screen, without React. The data is GET /access-control/user-matrix (every
 * user with roles, department, sign-in facts, conflicts with their state, pending changes and the last review).
 */

export const STATUSES = ["active", "inactive", "locked", "all"];
export const FLAGS = ["dormant", "conflicts", "twoStep", "pending"];

/** An open conflict: no exception in force (an expired exception opens it again). */
export const isOpenConflict = (c) => c.state === "open" || c.state === "expired";

/** Does a user match the flag of a stat card? */
export const hasFlag = (u, flag) => {
  if (flag === "dormant") return !!u.dormant;
  if (flag === "conflicts") return u.status === "active" && u.sodConflicts.some(isOpenConflict);
  if (flag === "twoStep") return u.status === "active" && !u.twoFactor;
  if (flag === "pending") return (u.pending || []).length > 0;
  return true;
};

/** Figures of the stat cards: active users, dormant, open conflicts, without two-step, concerned by a pending change. */
export const matrixStats = (rows = []) => ({
  active: rows.filter((u) => u.status === "active").length,
  dormant: rows.filter((u) => hasFlag(u, "dormant")).length,
  conflicts: rows.filter((u) => hasFlag(u, "conflicts")).length,
  twoStep: rows.filter((u) => hasFlag(u, "twoStep")).length,
  pending: rows.filter((u) => hasFlag(u, "pending")).length,
});

const fold = (v) => String(v || "").toLowerCase();

/**
 * The users the filters keep: search (name, username, designation, branch), departments, a role (held directly or
 * through another role), status (all = every status) and a stat card flag.
 */
export const filterUsers = (rows = [], { search = "", departments = [], role = null, status = "active", flag = null } = {}) => {
  const q = fold(search).trim();
  return rows.filter((u) => (status === "all" || u.status === status)
    && (!departments.length || departments.includes(u.department))
    && (!role || (u.effectiveRoles || u.roles).includes(role))
    && (!flag || hasFlag(u, flag))
    && (!q || [u.displayName, u.username, u.designation, u.branchName, u.branch].some((v) => fold(v).includes(q))));
};
