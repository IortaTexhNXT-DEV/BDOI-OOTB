import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import auditService from "../../services/auditService";
import ActivityLog from "./ActivityLog";
import { fromAuditEvents } from "./adapters";

/**
 * The audit trail of one record (GET /audit/records/:entity/:id) as activity log entries: { entries, loading, error,
 * reload }. `entity` is the record type of the audit trail: remittance, receipt, journal_voucher, supplier_invoice ...
 */
export const useRecordActivity = (entity, recordId) => {
  const [state, setState] = useState({ entries: [], loading: !!(entity && recordId), error: null });
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!entity || !recordId) return;
    latest.current += 1;
    const call = latest.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { events } = await auditService.getRecordHistory(entity, recordId);
      if (call === latest.current) setState({ entries: fromAuditEvents(events), loading: false, error: null });
    } catch (e) {
      if (call === latest.current) setState({ entries: [], loading: false, error: e?.message || true });
    }
  }, [entity, recordId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
};

/** ActivityLog of one record, loaded from its audit trail. */
const RecordActivityLog = ({ entity, recordId, emptyText, className }) => {
  const { entries, loading, error, reload } = useRecordActivity(entity, recordId);
  return <ActivityLog entries={entries} loading={loading} error={error} onRetry={reload} emptyText={emptyText} className={className} />;
};

RecordActivityLog.propTypes = {
  entity: PropTypes.string.isRequired,
  recordId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  emptyText: PropTypes.string,
  className: PropTypes.string,
};

RecordActivityLog.defaultProps = { recordId: null, emptyText: null, className: null };

export default RecordActivityLog;
