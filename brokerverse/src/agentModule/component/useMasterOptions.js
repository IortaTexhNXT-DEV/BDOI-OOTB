import { useEffect, useState } from "react";
import opsAccountingService from "../../services/opsAccountingService";

/**
 * Active records of an operational master (lead-source, reason-code ...) as { label, value } dropdown options, in the
 * master's sort order. `filter` keeps some records (a reason code's context, for example); `value` picks the stored
 * value (the code by default).
 */
const useMasterOptions = (type, { filter, value = (r) => r.code } = {}) => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let active = true;
    opsAccountingService
      .masterRecords(type, { status: "Active" })
      .then(({ rows: list }) => active && setRows(list))
      .catch(() => active && setRows([]));
    return () => {
      active = false;
    };
  }, [type]);

  return rows
    .filter((r) => String(r.status || "Active").toLowerCase() === "active" && (!filter || filter(r)))
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
    .map((r) => ({ label: r.name, value: value(r), record: r }));
};

export default useMasterOptions;
