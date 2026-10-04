import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { apiError } from "./passwordRules";
import "./security.scss";

/** Six-digit authenticator code. onSubmit(code) may throw; its message is shown. */
const TwoFactorCodeForm = ({ onSubmit, onBack, intro, submitLabel, backLabel }) => {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) return setError(t("security.codeSixDigits"));
    setBusy(true);
    try {
      await onSubmit(code);
    } catch (err) {
      setError(apiError(err, t("security.invalidCode")));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="bv-security__form" onSubmit={submit} noValidate>
      {intro && <p className="bv-security__intro">{intro}</p>}
      <div className="bv-security__field">
        <label htmlFor="bv-2fa-code">{t("security.authenticatorCode")}</label>
        <InputText
          id="bv-2fa-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className={`bv-security__code${error ? " p-invalid" : ""}`}
          aria-describedby="bv-2fa-code-help"
        />
        <small id="bv-2fa-code-help" className="bv-security__help">
          {t("security.codeHelp")}
        </small>
      </div>
      {error && (
        <div className="bv-security__alert" role="alert">
          {error}
        </div>
      )}
      <div className="bv-security__actions">
        {onBack && <Button type="button" label={backLabel || t("security.back")} className="p-button-text" onClick={onBack} disabled={busy} />}
        <Button type="submit" label={submitLabel || t("security.verify")} loading={busy} disabled={busy} />
      </div>
    </form>
  );
};

export default TwoFactorCodeForm;
