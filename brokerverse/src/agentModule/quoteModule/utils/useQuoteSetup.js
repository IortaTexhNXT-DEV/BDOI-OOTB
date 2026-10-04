import { useEffect, useState } from "react";
import salesActivityService from "../../../services/salesActivityService";

const EMPTY = { templateCode: null, covers: [], riskFields: [], requireRuleFields: false, loaded: false };

/**
 * Quote set-up of the product template governing a line (GET /product-configurator/quote-setup): the covers of its
 * Coverage Builder (mandatory / optional, the quotation premium each is priced on) and the risk fields its acceptance
 * rules and rating factors test. The server prices and evaluates with the same template.
 */
const useQuoteSetup = (params = { lob: "MOTOR" }) => {
  const [setup, setSetup] = useState(EMPTY);
  const key = JSON.stringify(params || {});
  useEffect(() => {
    let alive = true;
    salesActivityService
      .quoteSetup(JSON.parse(key))
      .then((s) => alive && setSetup({ ...EMPTY, ...(s || {}), loaded: true }))
      .catch(() => alive && setSetup({ ...EMPTY, loaded: true }));
    return () => {
      alive = false;
    };
  }, [key]);
  return setup;
};

/** Fields the wizard captures elsewhere (sum insured, vehicle class, model year, vehicle use). */
export const CAPTURED_ELSEWHERE = ["sumInsured", "vehicleAge", "vehicleType", "vehicleUse"];

/** Age in full years on a day from an ISO date of birth; null when unknown. */
export const ageOn = (dob, on = new Date()) => {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(String(dob))) return null;
  const b = String(dob).slice(0, 10);
  const d = `${on.getFullYear()}-${String(on.getMonth() + 1).padStart(2, "0")}-${String(on.getDate()).padStart(2, "0")}`;
  return Number(d.slice(0, 4)) - Number(b.slice(0, 4)) - (d.slice(5) < b.slice(5) ? 1 : 0);
};

/** The risk fields of a template the wizard asks for, and the ones still missing (acceptance rule fields only). */
export const riskFieldsToAsk = (setup) => (setup?.riskFields || []).filter((f) => !CAPTURED_ELSEWHERE.includes(f.field));
export const missingRiskFields = (setup, facts = {}) =>
  riskFieldsToAsk(setup)
    .filter((f) => f.acceptanceRule)
    .filter((f) => {
      if (f.field === "driverAge") return !facts.driverDateOfBirth && (facts.driverAge === undefined || facts.driverAge === null || facts.driverAge === "");
      const v = facts[f.field];
      return v === undefined || v === null || v === "";
    })
    .map((f) => f.field);

export default useQuoteSetup;
