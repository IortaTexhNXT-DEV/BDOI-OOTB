import { useEffect, useMemo, useState } from "react";
import mastersService from "../../../services/mastersService";

/**
 * Authorised signatories for the order summary, from the Signatories master (Master > Insurance Management >
 * Signatories) through GET /masters/signatory/options (active records only). The quotation keeps the signatory
 * name. A name saved on an older quote that is no longer in the master is kept as an option so the saved value
 * still shows.
 */
const useSignatoryOptions = (currentValue) => {
  const [signatories, setSignatories] = useState([]);

  useEffect(() => {
    let active = true;
    mastersService
      .options("signatory")
      .then((rows) => active && setSignatories(rows || []))
      .catch(() => active && setSignatories([]));
    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    const options = signatories
      .filter((s) => s.label)
      .map((s) => ({ label: s.label, value: s.label }));
    if (currentValue && !options.some((o) => o.value === currentValue)) {
      options.push({ label: currentValue, value: currentValue });
    }
    return options;
  }, [signatories, currentValue]);
};

export default useSignatoryOptions;
