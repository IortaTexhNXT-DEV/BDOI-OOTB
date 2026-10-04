import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Password } from "primereact/password";
import authService from "../../../services/authService";
import PasswordRules from "./PasswordRules";
import { apiError, meetsPolicy } from "./passwordRules";
import "./security.scss";

/**
 * Change password: current, new and confirmation, with the policy from GET /auth/password-policy.
 * `token` is the restricted token of a sign-in that requires a new password; without it the signed-in session is used.
 * onDone receives the authService result ({ step, data }).
 */
const ChangePasswordForm = ({ token, onDone, onCancel, intro, submitLabel, cancelLabel }) => {
  const { t } = useTranslation();
  const [policy, setPolicy] = useState(null);
  const [values, setValues] = useState({ current: "", next: "", confirm: "" });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    authService
      .getPasswordPolicy()
      .then((p) => live && setPolicy(p))
      .catch(() => live && setPolicy({}));
    return () => {
      live = false;
    };
  }, []);

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));
  const mismatch = values.confirm !== "" && values.next !== values.confirm;
  const sameAsCurrent = values.next !== "" && values.next === values.current;

  const submit = async (e) => {
    e?.preventDefault();
    setTouched(true);
    setError("");
    if (!values.current || !values.next || !values.confirm) return setError(t("security.fillAllFields"));
    if (!meetsPolicy(policy, values.next)) return setError(t("security.policyNotMet"));
    if (values.next !== values.confirm) return setError(t("security.passwordsDoNotMatch"));
    if (sameAsCurrent) return setError(t("security.sameAsCurrent"));
    setBusy(true);
    try {
      const result = await authService.changePassword({ currentPassword: values.current, newPassword: values.next }, token);
      setValues({ current: "", next: "", confirm: "" });
      onDone?.(result);
    } catch (err) {
      setError(apiError(err, t("security.changeFailed")));
    } finally {
      setBusy(false);
    }
  };

  const field = (id, label, value, onChange, extra = {}) => (
    <div className="bv-security__field">
      <label htmlFor={id}>{label}</label>
      <Password
        inputId={id}
        value={value}
        onChange={onChange}
        feedback={false}
        toggleMask
        autoComplete={extra.autoComplete}
        inputClassName={extra.invalid ? "w-full p-invalid" : "w-full"}
        className="w-full"
        aria-invalid={extra.invalid || undefined}
      />
      {extra.message && <small className="bv-security__error">{extra.message}</small>}
    </div>
  );

  return (
    <form className="bv-security__form" onSubmit={submit} noValidate>
      {intro && <p className="bv-security__intro">{intro}</p>}
      {field("bv-current-password", t("security.currentPassword"), values.current, set("current"), {
        autoComplete: "current-password",
        invalid: touched && !values.current,
      })}
      {field("bv-new-password", t("security.newPassword"), values.next, set("next"), {
        autoComplete: "new-password",
        invalid: touched && (!values.next || !meetsPolicy(policy, values.next)),
        message: sameAsCurrent ? t("security.sameAsCurrent") : "",
      })}
      <PasswordRules policy={policy} password={values.next} />
      {field("bv-confirm-password", t("security.confirmPassword"), values.confirm, set("confirm"), {
        autoComplete: "new-password",
        invalid: mismatch || (touched && !values.confirm),
        message: mismatch ? t("security.passwordsDoNotMatch") : "",
      })}
      {error && (
        <div className="bv-security__alert" role="alert">
          {error}
        </div>
      )}
      <div className="bv-security__actions">
        {onCancel && <Button type="button" label={cancelLabel || t("security.cancel")} className="p-button-text" onClick={onCancel} disabled={busy} />}
        <Button type="submit" label={submitLabel || t("security.changePassword")} loading={busy} disabled={busy} />
      </div>
    </form>
  );
};

export default ChangePasswordForm;
