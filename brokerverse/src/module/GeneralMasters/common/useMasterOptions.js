import { useEffect, useRef, useState } from "react";
import mastersService from "../../../services/mastersService";
import systemSettingsService from "../../../services/systemSettingsService";

/**
 * Dropdown options of a master type from GET /masters/<type>/options.
 * Returns [{ label, value, code, id }]; `valueKey` picks what the form stores ("value" = label text, or "code")
 * and `labelKey` what the dropdown shows ("label" = name, or "code").
 */
const useMasterOptions = (type, { filter, valueKey = "value", labelKey = "label", enabled = true } = {}) => {
  const [options, setOptions] = useState([]);
  const filterKey = JSON.stringify(filter || {});

  useEffect(() => {
    if (!type || !enabled) return undefined;
    let cancelled = false;
    mastersService
      .options(type, JSON.parse(filterKey))
      .then((rows) => {
        if (!cancelled) {
          setOptions(rows.map((row) => ({ ...row, label: row[labelKey] ?? row.label, value: row[valueKey] ?? row.value })));
        }
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [type, filterKey, valueKey, labelKey, enabled]);

  return options;
};

export default useMasterOptions;

/**
 * Dropdown options built from the active records of a master type (GET /masters/<type>?status=Active),
 * for dropdowns whose value is a field other than the code / label (e.g. hierarchy level numbers).
 */
export const useMasterRecordOptions = (type, toOption) => {
  const [options, setOptions] = useState([]);
  const mapRef = useRef(toOption);
  mapRef.current = toOption;

  useEffect(() => {
    let cancelled = false;
    mastersService
      .list(type, { status: "Active" })
      .then((rows) => {
        if (!cancelled) setOptions(rows.map((row) => mapRef.current(row)));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  return options;
};

/** Options of a "select" field in a master type definition (GET /masters/<type>/definition). */
export const useFieldOptions = (type, fieldName) => {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    mastersService
      .definition(type)
      .then((definition) => {
        const field = (definition?.fields || []).find((f) => f.name === fieldName);
        if (!cancelled) setOptions((field?.options || []).map((option) => ({ label: option, value: option })));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [type, fieldName]);

  return options;
};

/** ISO currency codes supported by the system (GET /system-settings -> currencies) as dropdown options. */
export const useCurrencyCodeOptions = () => {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    systemSettingsService
      .getSettings()
      .then((settings) => {
        const codes = (settings?.currencies || []).map((currency) => currency.code);
        if (!cancelled) setOptions(codes.map((code) => ({ label: code, name: code, value: code, code })));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
};

/** All records of a master type (active and inactive) mapped with `toRow`, for simple list screens. */
export const useMasterRecords = (type, toRow = (row) => row) => {
  const [rows, setRows] = useState([]);
  const mapRef = useRef(toRow);
  mapRef.current = toRow;

  useEffect(() => {
    let cancelled = false;
    mastersService
      .list(type)
      .then((records) => {
        if (!cancelled) setRows(records.map((record) => mapRef.current(record)));
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  return rows;
};
