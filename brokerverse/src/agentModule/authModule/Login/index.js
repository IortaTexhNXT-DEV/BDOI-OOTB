import React, { useEffect, useRef, useState } from "react";
import EnvironmentBadge from "../../../components/EnvironmentBadge";
import "../Login/index.scss";
import "../security/security.scss";
import { Button } from "primereact/button";
import { useFormik } from "formik";
import CustomToast from "../../../components/Toast";
import { InputText } from "primereact/inputtext";
import authService from "../../../services/authService";
import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import { useSelector } from "react-redux";
import i18n from "../../../i18n";
import { DEFAULT_SYSTEM_SETTINGS } from "../../../utility/systemCurrencies";
import { showLanguagePicker, useLanguageOptions } from "../../../utility/languages";
import TwoFactorCodeForm from "../security/TwoFactorCodeForm";
import TwoFactorEnrolment from "../security/TwoFactorEnrolment";
import ChangePasswordForm from "../security/ChangePasswordForm";
import ForgotPassword from "../security/ForgotPassword";
import LoginArt from "../../../theme/runtime/LoginArt";
import { useBranding } from "../../../theme/runtime/BrandingProvider";

const initialValue = {
  EmailAddress: "",
  Password: "",
};

/**
 * Sign-in. Steps after the password, as the API answers:
 * - twoFactor: the 6-digit authenticator code (POST /auth/login/2fa);
 * - enrol2fa: the role requires two-factor authentication and the user has none yet (forced enrolment);
 * - changePassword: new user, password reset by an administrator, or password older than the maximum age;
 * - forgot: request a reset code by e-mail and choose a new password.
 * "Sign in with Microsoft" (Entra ID, when the environment has it) leaves for the Microsoft sign-in page, which sends
 * the browser back here with ?code=&state=; the API then answers like the password sign-in. When the password
 * sign-in is switched off the form stays behind a link, for the administrators who keep it.
 * Only a complete session is stored; the intermediate tokens stay in this screen's memory.
 */
const Login = () => {
  const toastRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState("signin");
  const [stepData, setStepData] = useState(null);
  // sub-step of the password reset: request | reset | done
  const [forgotStep, setForgotStep] = useState("request");
  const [notice, setNotice] = useState(() =>
    new URLSearchParams(window.location.search).get("session") === "ended" ? "sessionEnded" : ""
  );
  const [signInOptions, setSignInOptions] = useState({ passwordSignIn: true, sso: { enabled: false } });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [microsoftBusy, setMicrosoftBusy] = useState(false);
  const { t } = useTranslation();
  const languageOptions = useLanguageOptions();
  const currentLanguage =
    languageOptions.find((o) => i18n.language && i18n.language.startsWith(o.value))?.value || languageOptions[0]?.value || "en";
  // Branding (Theme and Branding, GET /api/branding) first, then the System Settings values
  const { branding, ready: brandingReady } = useBranding();
  const login = branding?.theme?.login || {};
  const storedSystemName = useSelector(
    (state) => state.systemSettingsReducer?.systemName || DEFAULT_SYSTEM_SETTINGS.systemName
  );
  const systemName = branding?.systemName || storedSystemName;
  const storedLogoUrl = useSelector(
    (state) =>
      state.systemSettingsReducer?.logoUrl || DEFAULT_SYSTEM_SETTINGS.logoUrl
  );
  const logoUrl = branding?.logoUrl || storedLogoUrl;
  const primaryColor = useSelector(
    (state) =>
      state.systemSettingsReducer?.primaryColor ||
      DEFAULT_SYSTEM_SETTINGS.primaryColor
  );
  const secondaryColor = useSelector(
    (state) =>
      state.systemSettingsReducer?.secondaryColor ||
      DEFAULT_SYSTEM_SETTINGS.secondaryColor
  );

  useEffect(() => {
    let active = true;
    authService
      .signInOptions()
      .then((options) => active && setSignInOptions((current) => ({ ...current, ...options })))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // back from the Microsoft sign-in page: finish the sign-in once and take the code out of the address bar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const failure = params.get("error");
    if (!(code && state) && !failure) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (failure) {
      setErrorMessage(t("login.microsoftCancelled"));
      return;
    }
    setMicrosoftBusy(true);
    authService
      .completeMicrosoftSignIn(code, state)
      .then(handleResult)
      .catch((error) => setErrorMessage(error.message || t("login.microsoftFailed")))
      .finally(() => setMicrosoftBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithMicrosoft = async () => {
    setErrorMessage("");
    setNotice("");
    setMicrosoftBusy(true);
    try {
      await authService.startMicrosoftSignIn();
    } catch (error) {
      setErrorMessage(error.message || t("login.microsoftFailed"));
      setMicrosoftBusy(false);
    }
  };

  const validate = (values) => {
    const errors = {};
    if (!values.EmailAddress) {
      errors.EmailAddress = t("login.userIdRequired");
    }
    if (!values.Password) {
      errors.Password = t("login.passwordRequired");
    }
    return errors;
  };

  /** Next step of the sign-in, or into the application when the session is complete. */
  const handleResult = (result) => {
    if (result.step === "done") {
      toastRef.current?.showToast();
      window.location.href = "/";
      return;
    }
    setStepData(result.data);
    setStep(result.step);
  };

  const handleSubmit = async (values) => {
    setIsLoading(true);
    setErrorMessage("");
    setNotice("");
    try {
      const loginResult = await authService.login(values.EmailAddress, values.Password);
      if (loginResult.success) {
        formik.setFieldValue("Password", "", false);
        handleResult(loginResult);
      } else {
        setErrorMessage(loginResult.error || t("login.invalidCredentials"));
      }
    } catch (error) {
      setErrorMessage(t("login.loginFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  const backToSignIn = (message) => {
    setStep("signin");
    setStepData(null);
    setErrorMessage("");
    setNotice(message || "");
  };

  const headings = {
    twoFactor: [t("security.twoFactorTitle"), t("security.twoFactorIntro")],
    enrol2fa: [t("security.enrolTitle"), t("security.enrolRequiredSubtitle")],
    changePassword: [
      t("security.changePassword"),
      stepData?.passwordExpired ? t("security.passwordExpiredSubtitle") : t("security.mustChangeSubtitle"),
    ],
    forgot: {
      request: [t("security.forgotTitle"), t("security.forgotIntro")],
      reset: [t("security.resetTitle"), t("security.resetIntro")],
      done: [t("security.resetDoneTitle"), ""],
    }[forgotStep] || [t("security.forgotTitle"), ""],
  };

  const fieldError = (field) =>
    formik.touched[field] && formik.errors[field] ? (
      <small id={`bv-login-${field}-error`} className="bv-security__error">
        {formik.errors[field]}
      </small>
    ) : null;

  const passwordForm = (
    <form
      className="bv-security__form"
      onSubmit={(e) => {
        e.preventDefault();
        formik.handleSubmit();
      }}
      noValidate
    >
      {notice && (
        <div className="bv-security__success" role="status">
          {t(`security.notice.${notice}`)}
        </div>
      )}
      <div className="bv-security__field">
        <label htmlFor="bv-login-user">{t("login.userId")}</label>
        <InputText
          id="bv-login-user"
          value={formik.values.EmailAddress}
          onChange={formik.handleChange("EmailAddress")}
          autoComplete="username"
          name="username"
          autoFocus
          className={`w-full${formik.touched.EmailAddress && formik.errors.EmailAddress ? " p-invalid" : ""}`}
          aria-invalid={formik.touched.EmailAddress && formik.errors.EmailAddress ? true : undefined}
          aria-describedby={formik.touched.EmailAddress && formik.errors.EmailAddress ? "bv-login-EmailAddress-error" : undefined}
        />
        {fieldError("EmailAddress")}
      </div>
      <div className="bv-security__field">
        <div className="bv-auth__label-row">
          <label htmlFor="bv-login-password">{t("login.password")}</label>
          <button
            type="button"
            className="bv-auth__link"
            onClick={() => {
              setErrorMessage("");
              setNotice("");
              setStep("forgot");
            }}
          >
            {t("login.forgotPassword")}
          </button>
        </div>
        <div className="login__password__wrapper">
          <InputText
            id="bv-login-password"
            value={formik.values.Password}
            onChange={formik.handleChange("Password")}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            name="password"
            className={`w-full${formik.touched.Password && formik.errors.Password ? " p-invalid" : ""}`}
            aria-invalid={formik.touched.Password && formik.errors.Password ? true : undefined}
            aria-describedby={formik.touched.Password && formik.errors.Password ? "bv-login-Password-error" : undefined}
          />
          <Button
            type="button"
            icon={showPassword ? "pi pi-eye-slash" : "pi pi-eye"}
            className="p-button-text p-button-rounded login__password__toggle"
            aria-label={showPassword ? t("security.hidePassword") : t("security.showPassword")}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)}
          />
        </div>
        {fieldError("Password")}
      </div>
      {errorMessage && (
        <div className="bv-security__alert" role="alert">
          {errorMessage}
        </div>
      )}
      <div className="bv-security__actions">
        <Button type="submit" label={isLoading ? t("login.loggingIn") : t("login.login")} disabled={isLoading || microsoftBusy} loading={isLoading} />
      </div>
    </form>
  );

  const ssoEnabled = !!signInOptions.sso?.enabled;
  const passwordVisible = !ssoEnabled || signInOptions.passwordSignIn !== false || showPasswordForm;
  const microsoftButton = ssoEnabled && (
    <Button
      type="button"
      className="p-button-outlined bv-auth__sso"
      onClick={signInWithMicrosoft}
      disabled={isLoading || microsoftBusy}
      loading={microsoftBusy}
      label={microsoftBusy ? t("login.microsoftSigningIn") : t("login.signInWithMicrosoft")}
      icon={
        <svg className="bv-auth__sso-logo" viewBox="0 0 21 21" aria-hidden="true">
          <rect x="1" y="1" width="9" height="9" fill="#f25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
          <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
          <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
        </svg>
      }
    />
  );

  const signInForm = (
    <>
      {passwordVisible ? (
        passwordForm
      ) : (
        <>
          {notice && (
            <div className="bv-security__success" role="status">
              {t(`security.notice.${notice}`)}
            </div>
          )}
          {errorMessage && (
            <div className="bv-security__alert" role="alert">
              {errorMessage}
            </div>
          )}
        </>
      )}
      {microsoftButton && (
        <div className="bv-auth__sso-block">
          {passwordVisible && <div className="bv-auth__divider">{t("login.or")}</div>}
          {microsoftButton}
          {!passwordVisible && (
            <button type="button" className="bv-auth__link bv-auth__sso-local" onClick={() => setShowPasswordForm(true)}>
              {t("login.useLocalAccount")}
            </button>
          )}
        </div>
      )}
    </>
  );

  let stepBody = null;
  if (step === "twoFactor") {
    stepBody = (
      <TwoFactorCodeForm
        onSubmit={async (code) => handleResult(await authService.verifyTwoFactor(stepData.challengeToken, code))}
        onBack={() => backToSignIn()}
        backLabel={t("security.backToSignIn")}
      />
    );
  } else if (step === "enrol2fa") {
    stepBody = <TwoFactorEnrolment token={stepData.accessToken} onEnabled={handleResult} onCancel={() => backToSignIn()} />;
  } else if (step === "changePassword") {
    stepBody = (
      <ChangePasswordForm
        token={stepData.accessToken}
        submitLabel={t("security.changeAndContinue")}
        cancelLabel={t("security.backToSignIn")}
        onDone={handleResult}
        onCancel={() => backToSignIn()}
      />
    );
  } else if (step === "forgot") {
    stepBody = (
      <ForgotPassword
        initialUser={formik.values.EmailAddress}
        showIntro={false}
        onStepChange={setForgotStep}
        onBack={() => backToSignIn()}
        onDone={(user) => {
          formik.setFieldValue("EmailAddress", user || formik.values.EmailAddress, false);
          backToSignIn("passwordReset");
        }}
      />
    );
  }

  const title = step === "signin" ? login.headline || t("login.title", { name: systemName }) : headings[step][0];
  const subtitle =
    step === "signin" ? (passwordVisible ? t("login.subtitle") : t("login.subtitleMicrosoft")) : headings[step][1];
  const tagline = step === "signin" ? login.tagline : "";

  // the page waits for the branding of the environment instead of painting the default logo and colours first
  if (!brandingReady) return <div className="agent__container__login bv-auth" aria-busy="true" />;

  return (
    <div className="agent__container__login bv-auth">
      <CustomToast ref={toastRef} message={t("login.loginSuccess")} />
      <LoginArt theme={branding?.theme} fallback={{ primaryColor, secondaryColor }} />
      <main className="bv-auth__panel">
        {showLanguagePicker(languageOptions) && (
          <div className="bv-auth__lang">
            <Dropdown
              value={currentLanguage}
              options={languageOptions}
              onChange={(e) => i18n.changeLanguage(e.value)}
              className="login-language-dropdown"
              aria-label={t("common.language")}
            />
          </div>
        )}
        <div className="bv-auth__center">
          <div className="bv-auth__card" data-step={step}>
            <div className="bv-auth__brand">
              <img src={logoUrl} alt={systemName} className="bv-auth__logo" />
              <EnvironmentBadge />
            </div>
            <h1 className="bv-auth__title">{title}</h1>
            {subtitle && <p className="bv-auth__subtitle">{subtitle}</p>}
            {tagline && <p className="bv-auth__tagline">{tagline}</p>}
            <div className="bv-auth__body">{step === "signin" ? signInForm : stepBody}</div>
          </div>
        </div>
        {login.showPoweredBy !== false && (
          <footer className="bv-auth__footer">
            <span>{t("login.poweredBy")}</span>
            <img src="/bdoi/iorta-technxt.png" alt="iorta TechNXT" />
          </footer>
        )}
      </main>
    </div>
  );
};

export default Login;
