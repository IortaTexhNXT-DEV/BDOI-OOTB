import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Password } from "primereact/password";
import authService from "../../../services/authService";
import PasswordRules from "./PasswordRules";
import { apiError, meetsPolicy } from "./passwordRules";
import "./security.scss";

/**
 * Forgot password: 1) username or e-mail -> POST /auth/forgot-password (a code is e-mailed; the answer is the same
 * whether or not the account exists); 2) code + new password -> POST /auth/reset-password; 3) back to sign-in.
 */
const ForgotPassword = ({ initialUser = "", onBack, onDone, onStepChange, showIntro = true }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState("request");
  const [user, setUser] = useState(initialUser);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [policy, setPolicy] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authService.getPasswordPolicy().then(setPolicy).catch(() => setPolicy({}));
  }, []);

  // The sign-in page shows the step's title and helper text above the form
  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  const run = async (fn) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(apiError(err, t("security.requestFailed")));
    } finally {
      setBusy(false);
    }
  };

  const requestCode = (e) => {
    e?.preventDefault();
    if (!user.trim()) return setError(t("security.enterUserOrEmail"));
    return run(async () => {
      const r = await authService.requestPasswordReset(user);
      setInfo(r.message || t("security.codeSent"));
      setStep("reset");
    });
  };

  const reset = (e) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) return setError(t("security.codeSixDigits"));
    if (!meetsPolicy(policy, password)) return setError(t("security.policyNotMet"));
    if (password !== confirm) return setError(t("security.passwordsDoNotMatch"));
    return run(async () => {
      await authService.resetPassword({ usernameOrEmail: user, code, newPassword: password });
      setStep("done");
    });
  };

  const alert = error && (
    <div className="bv-security__alert" role="alert">
      {error}
    </div>
  );

  if (step === "done") {
    return (
      <div className="bv-security__form">
        <div className="bv-security__success" role="status">
          <i className="pi pi-check-circle" aria-hidden="true" />
          <span>{t("security.passwordResetDone")}</span>
        </div>
        <div className="bv-security__actions">
          <Button type="button" label={t("security.backToSignIn")} onClick={() => (onDone || onBack)?.(user)} />
        </div>
      </div>
    );
  }

  if (step === "request") {
    return (
      <form className="bv-security__form" onSubmit={requestCode} noValidate>
        {showIntro && <p className="bv-security__intro">{t("security.forgotIntro")}</p>}
        <div className="bv-security__field">
          <label htmlFor="bv-forgot-user">{t("security.userOrEmail")}</label>
          <InputText id="bv-forgot-user" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoFocus className="w-full" />
        </div>
        {alert}
        <div className="bv-security__actions">
          <Button type="button" label={t("security.backToSignIn")} className="p-button-text" onClick={() => onBack?.()} disabled={busy} />
          <Button type="submit" label={t("security.sendCode")} loading={busy} disabled={busy} />
        </div>
      </form>
    );
  }

  return (
    <form className="bv-security__form" onSubmit={reset} noValidate>
      {showIntro && info && <p className="bv-security__intro">{info}</p>}
      <div className="bv-security__field">
        <label htmlFor="bv-reset-code">{t("security.verificationCode")}</label>
        <InputText
          id="bv-reset-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className="bv-security__code"
        />
      </div>
      <div className="bv-security__field">
        <label htmlFor="bv-reset-new">{t("security.newPassword")}</label>
        <Password inputId="bv-reset-new" value={password} onChange={(e) => setPassword(e.target.value)} feedback={false} toggleMask autoComplete="new-password" className="w-full" inputClassName="w-full" />
      </div>
      <PasswordRules policy={policy} password={password} />
      <div className="bv-security__field">
        <label htmlFor="bv-reset-confirm">{t("security.confirmPassword")}</label>
        <Password
          inputId="bv-reset-confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          feedback={false}
          toggleMask
          autoComplete="new-password"
          className="w-full"
          inputClassName={confirm && confirm !== password ? "w-full p-invalid" : "w-full"}
        />
        {confirm && confirm !== password && <small className="bv-security__error">{t("security.passwordsDoNotMatch")}</small>}
      </div>
      {alert}
      <div className="bv-security__actions">
        <Button type="button" label={t("security.sendNewCode")} className="p-button-text" onClick={requestCode} disabled={busy} />
        <Button type="submit" label={t("security.resetPassword")} loading={busy} disabled={busy} />
      </div>
    </form>
  );
};

export default ForgotPassword;
