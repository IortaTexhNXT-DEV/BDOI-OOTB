import { useCallback, useState } from "react";

/** Field messages of an API validation error ({ errors: [{ path, message }] }) as { field: message }. */
export const apiFieldErrors = (e) => Object.fromEntries((e?.errors || []).filter((x) => x.path).map((x) => [String(x.path).split(".")[0], x.message]));

/** Whether a form value is empty (nothing chosen or only spaces typed). */
export const blank = (v) => v === null || v === undefined || String(v).trim() === "" || (Array.isArray(v) && !v.length);

/**
 * Messages of a form under its fields. check({ field: message or null }) keeps the messages of the failed rules and
 * says whether every rule passed; fromApi(error) puts the messages of an API validation error on their fields.
 */
const useFieldErrors = () => {
  const [errors, setErrors] = useState({});
  const check = useCallback((rules) => {
    const out = Object.fromEntries(Object.entries(rules).filter(([, message]) => message));
    setErrors(out);
    return !Object.keys(out).length;
  }, []);
  const fromApi = useCallback((e) => setErrors(apiFieldErrors(e)), []);
  const clear = useCallback(() => setErrors({}), []);
  return { errors, check, fromApi, clear };
};

export default useFieldErrors;
