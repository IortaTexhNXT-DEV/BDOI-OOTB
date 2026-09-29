import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import authService from "../../../services/authService";
import TwoFactorCodeForm from "./TwoFactorCodeForm";
import { apiError } from "./passwordRules";
import "./security.scss";

/** "JBSWY3DP..." -> "JBSW Y3DP ..." (easier to type into an authenticator app). */
const grouped = (secret) => String(secret || "").replace(/(.{4})/g, "$1 ").trim();

/**
 * Two-factor enrolment: a new secret from POST /auth/2fa/setup, shown as text and as an otpauth:// link (no QR code
 * library is bundled; authenticator apps accept the key typed in or the link opened on the phone), then confirmed
 * with a code. `token` is the restricted token of a forced enrolment at sign-in. onEnabled receives the authService
 * result ({ step, data }).
 */
const TwoFactorEnrolment = ({ token, onEnabled, onCancel, intro }) => {
  const { t } = useTranslation();
  const [setup, setSetup] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    authService
      .twoFactorSetup(token)
      .then((data) => live && setSetup(data))
      .catch((err) => live && setError(apiError(err, t("security.setupFailed"))));
    return () => {
      live = false;
    };
  }, [token, t]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (error) {
    return (
      <div className="bv-security__form">
        <div className="bv-security__alert" role="alert">
          {error}
        </div>
        {onCancel && (
          <div className="bv-security__actions">
            <Button type="button" label={t("security.back")} className="p-button-text" onClick={onCancel} />
          </div>
        )}
      </div>
    );
  }
  if (!setup) return <p className="bv-security__intro">{t("security.preparing")}</p>;

  return (
    <div className="bv-security__enrol">
      {intro && <p className="bv-security__intro">{intro}</p>}
      <ol className="bv-security__steps">
        <li>{t("security.enrolStep1")}</li>
        <li>
          {t("security.enrolStep2")}
          <div className="bv-security__secret">
            <code aria-label={t("security.setupKey")}>{grouped(setup.secret)}</code>
            <Button
              type="button"
              icon={copied ? "pi pi-check" : "pi pi-copy"}
              className="p-button-text p-button-sm"
              aria-label={t("security.copyKey")}
              tooltip={copied ? t("security.copied") : t("security.copyKey")}
              onClick={copy}
            />
          </div>
          <small className="bv-security__help">
            {t("security.accountLabel", { issuer: setup.issuer, account: setup.account })}{" "}
            <a href={setup.otpauthUrl}>{t("security.openInApp")}</a>
          </small>
        </li>
        <li>{t("security.enrolStep3")}</li>
      </ol>
      <TwoFactorCodeForm
        onSubmit={async (code) => {
          const result = await authService.twoFactorEnable(code, token);
          onEnabled?.(result);
        }}
        onBack={onCancel}
        backLabel={t("security.cancel")}
        submitLabel={t("security.turnOn")}
      />
    </div>
  );
};

export default TwoFactorEnrolment;
