import { useEffect, useState } from "react";
import claimsService from "../../../services/claimsService";

// Loaded once per session; the masters change rarely and every claim screen needs them.
let cached = null;
let pending = null;

const EMPTY = { statusLabels: {}, settlementTypes: [], lossCauses: {}, lobFields: {}, makerChecker: true, loaded: false };

const load = () => {
  if (!pending) {
    pending = claimsService.getConfig().then((result) => {
      if (result.success) {
        cached = { ...EMPTY, ...result.data, loaded: true };
        return cached;
      }
      pending = null; // try again on the next screen
      return { ...EMPTY, loaded: true, error: result.error };
    });
  }
  return pending;
};

/**
 * Claim masters (GET /claims/config): status labels, settlement types, causes of loss per line of business and the
 * claim sections that apply to each line (claims.lob_fields).
 */
const useClaimsConfig = () => {
  const [config, setConfig] = useState(cached || EMPTY);
  useEffect(() => {
    if (cached) return undefined;
    let active = true;
    load().then((c) => {
      if (active) setConfig(c);
    });
    return () => {
      active = false;
    };
  }, []);
  return config;
};

export default useClaimsConfig;
