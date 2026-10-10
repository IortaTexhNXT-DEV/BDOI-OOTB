import React, { useCallback } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog } from "primereact/dialog";
import { ActivityLog, toEntry } from "../../../components/ActivityLog";
import periodEndService from "../../../services/periodEndService";
import { useStableLoad } from "../../../hooks/useStableLoad";

const ACTIONS = { open: "reopened", soft_closed: "softClosed", closed: "closed", locked: "locked" };
const SOURCES = { manual: "screen", job: "job" };

/** Status history rows of GET /period-end/periods/:period/history as activity log entries. */
export const historyEntries = (rows, t) => (rows || []).map((h, i) => toEntry({
  id: h.id ?? `${h.changedAt}-${i}`,
  at: h.changedAt,
  actionCode: `period-${h.to}`,
  actionLabel: t(`periodManagement.historyAction.${ACTIONS[h.to] || "changed"}`),
  user: { displayName: h.changedByName || null, username: h.changedByName ? null : h.changedBy, role: (h.changedByRoles || []).join(", ") || null },
  fromStatus: h.from ? t(`periodEnd.status.${h.from}`) : null,
  toStatus: h.to ? t(`periodEnd.status.${h.to}`) : null,
  remarks: h.remarks,
  source: h.source ? { channel: SOURCES[h.source] || "screen", label: t(`periodManagement.source.${h.source}`, { defaultValue: h.source }) } : null,
}, i));

/** Status history of a period: who moved it, when, from which status to which, and why. */
const HistoryPanel = ({ period, onHide }) => {
  const { t } = useTranslation();
  const loader = useCallback(() => periodEndService.periodHistory(period), [period]);
  const { data, loading, error, reload } = useStableLoad(loader, { enabled: !!period });
  return (
    <Dialog className="pe-dialog" visible={!!period} onHide={onHide} style={{ width: "min(720px, 96vw)" }} draggable={false}
      header={t("periodManagement.historyTitle", { period })}>
      <ActivityLog entries={historyEntries(data, t)} loading={loading} error={error} onRetry={reload} emptyText={t("periodManagement.noHistory")} />
    </Dialog>
  );
};

HistoryPanel.propTypes = { period: PropTypes.string, onHide: PropTypes.func.isRequired };

export default HistoryPanel;
