import React, { createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import StatusChip from "../../components/StatusChip";
import { formatValue } from "../../components/KeyValueGrid";
import { hasPermission } from "../../utils/canOpen";
import { currentUser } from "../../utility/userIdentity";
import { saveFile } from "../../services/goLiveService";

/** Address of the workspace; each tab is a route under it. */
export const ROOT = "/master/configuration/go-live";

/** What every tab of the workspace shares: the toast, the overview of the shell (cutover date, lock, current run) and its reload. */
export const WorkspaceContext = createContext({ notify: () => {}, overview: null, reloadOverview: () => {} });
export const useWorkspace = () => useContext(WorkspaceContext);

/** What the signed-in user may do in the workspace (the server checks the same permissions on every call). */
export const useAccess = () => ({
  canWrite: hasPermission("write:data-load"),
  canApprove: hasPermission("approve:data-load"),
  canViewPii: hasPermission("view:pii"),
});

/**
 * Whether the migration imports are open (not locked, or an unlock reopens them): from the overview of the shell. With
 * the lock on, the actions the server refuses are shown disabled with the reason.
 */
export const useMigrationOpen = () => {
  const { t } = useTranslation();
  const { overview } = useWorkspace();
  const open = !overview?.locked || !!overview?.unlock?.scope?.includes("migration");
  return { open, reason: open ? null : t("goLive.header.lockedReason") };
};

export const myId = () => currentUser().userId;
/** Role codes of the signed-in user (a sign-off slot named for roles). */
export const myRoles = () => currentUser().roles || [];
/** The maker id of a record that is the signed-in user (for ApprovalActions), or null: the user may decide. */
export const makerOf = (ids) => ((ids || []).map(String).includes(String(myId())) ? myId() : null);

/** Column of figures: right-aligned, tabular digits. */
export const num = { className: "bv-num", headerClassName: "bv-num" };

export const amount = (v) => formatValue(v, { type: "amount" });
export const count = (v) => formatValue(v, { type: "number", decimals: 0 });
export const dateOf = (v) => formatValue(v, { type: "date" });
export const dateTimeOf = (v) => formatValue(v, { type: "datetime" });

/** A duration in milliseconds as "2 h 05 min", "4 min 10 s" or "12 s"; "—" when unknown. */
export const duration = (ms) => {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return "—";
  const s = Math.round(Number(ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  return `${s} s`;
};

const SEVERITY = {
  batch: {
    validating: "info", validated: "info", failed: "danger", "pending-approval": "warning", rejected: "danger", withdrawn: "secondary", expired: "secondary",
    running: "info", loaded: "success", "undo-pending": "warning", undoing: "info", undone: "secondary",
  },
  result: { new: "info", changed: "warning", unchanged: "secondary", duplicate: "warning", error: "danger", skipped: "secondary" },
  line: { matched: "success", difference: "danger", accepted: "info", missing: "warning", "no-legacy": "secondary" },
  difference: { open: "danger", explained: "warning", accepted: "success", fixed: "success" },
  recon: { open: "warning", signed: "success", superseded: "secondary" },
  run: { planned: "secondary", running: "info", completed: "success", failed: "danger", cancelled: "secondary" },
  runResult: { passed: "success", "passed-with-issues": "warning", failed: "danger" },
  step: { "not-started": "secondary", "in-progress": "info", done: "success", blocked: "danger", skipped: "secondary", failed: "danger" },
  defect: { open: "danger", fixed: "info", retest: "warning", closed: "success", deferred: "secondary" },
  decision: { draft: "secondary", voting: "warning", go: "success", "no-go": "danger", withdrawn: "secondary" },
  criterion: { open: "secondary", met: "success", "not-met": "danger", waived: "warning" },
  vote: { go: "success", "no-go": "danger" },
  lock: { pending: "warning", approved: "success", rejected: "danger", withdrawn: "secondary" },
  phase: { "not-started": "secondary", "in-progress": "info", done: "success" },
};

/** StatusChip props of a status ({ code, label, severity }), for DetailHeader. */
export const chipOf = (t, kind, code) => (code ? { code, label: t(`goLive.status.${kind}.${code}`, { defaultValue: code }), severity: SEVERITY[kind]?.[code] || "secondary" } : null);

/** Status of a workspace record as a StatusChip, in words of the goLive.status.<kind> list. */
export const Chip = ({ kind, code }) => {
  const { t } = useTranslation();
  if (!code) return null;
  return <StatusChip code={code} label={t(`goLive.status.${kind}.${code}`, { defaultValue: code })} severity={SEVERITY[kind]?.[code] || "secondary"} />;
};

/** Download a file of the API and put it on the user's computer; a failure goes to the toast. */
export const useDownload = () => {
  const { notify } = useWorkspace();
  return async (loader) => {
    try {
      const f = await loader();
      saveFile(f);
      return f;
    } catch (e) {
      notify("error", e.message);
      return null;
    }
  };
};
