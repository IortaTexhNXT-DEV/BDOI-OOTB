import React from "react";
import { useTranslation } from "react-i18next";
import { passwordChecks } from "./passwordRules";

/** Live checklist of the password policy. */
const PasswordRules = ({ policy, password }) => {
  const { t } = useTranslation();
  const checks = passwordChecks(policy, password);
  return (
    <ul className="bv-security__rules" aria-live="polite">
      {checks.map((c) => (
        <li key={c.key} className={c.ok ? "is-ok" : ""}>
          <i className={`pi ${c.ok ? "pi-check-circle" : "pi-circle"}`} aria-hidden="true" />
          <span>{t(`security.rules.${c.key}`, c.params)}</span>
          <span className="p-hidden-accessible">{c.ok ? t("security.ruleMet") : t("security.ruleNotMet")}</span>
        </li>
      ))}
      {policy?.historyCount > 0 && (
        <li className="bv-security__rules-note">
          <i className="pi pi-history" aria-hidden="true" />
          <span>{t("security.rules.history", { count: policy.historyCount })}</span>
        </li>
      )}
    </ul>
  );
};

export default PasswordRules;
