import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import quotationService from "../../../services/quotationService";

export const SIGNATORY_MASTER_PATH = "/master/generals/insurancemanagement/signatories";

/**
 * Authorised signatories for the order summary, from the Signatories master (Master > Insurance Management >
 * Signatories) through GET /master/signatory/get-all-signatory (active records, the configured default first, see
 * documents.default_signatory). The quotation keeps the signatory name, and the printed quotation shows that
 * signatory's name, designation and signature. A name saved on an older quote that is no longer in the master is kept
 * as an option so the saved value still shows. The returned array also carries `loaded` and `defaultValue`.
 */
const useSignatoryOptions = (currentValue) => {
  const [signatories, setSignatories] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    quotationService
      .getSignatories()
      .then((rows) => active && setSignatories(Array.isArray(rows) ? rows : []))
      .catch(() => active && setSignatories([]))
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, []);

  return useMemo(() => {
    const options = signatories
      .filter((s) => s.name)
      .map((s) => ({ label: s.designation ? `${s.name} (${s.designation})` : s.name, value: s.name, isDefault: Boolean(s.isDefault) }));
    if (currentValue && !options.some((o) => o.value === currentValue)) {
      options.push({ label: currentValue, value: currentValue });
    }
    options.loaded = loaded;
    options.defaultValue = (options.find((o) => o.isDefault) || options[0])?.value || "";
    return options;
  }, [signatories, currentValue, loaded]);
};

/** Shown under the signature dropdown when the master has no active signatory yet. */
export const NoSignatoryHint = ({ options }) => {
  const { t } = useTranslation();
  if (!options?.loaded || options.length) return null;
  return (
    <small className="block mt-1 text-color-secondary">
      {t("agent.noSignatories")} <Link to={SIGNATORY_MASTER_PATH}>{t("agent.openSignatoryMaster")}</Link>
    </small>
  );
};

export default useSignatoryOptions;
