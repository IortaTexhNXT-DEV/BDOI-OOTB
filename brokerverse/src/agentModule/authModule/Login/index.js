import React, { useRef, useState } from "react";
import "../Login/index.scss";
import "../security/security.scss";
import { Button } from "primereact/button";
import { useFormik } from "formik";
import CustomToast from "../../../components/Toast";
import InputTextField from "../../component/inputText";
import authService from "../../../services/authService";
import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import { useSelector } from "react-redux";
import i18n from "../../../i18n";
import { DEFAULT_SYSTEM_SETTINGS } from "../../../utility/systemCurrencies";
import { useLanguageOptions } from "../../../utility/languages";
import TwoFactorCodeForm from "../security/TwoFactorCodeForm";
import TwoFactorEnrolment from "../security/TwoFactorEnrolment";
import ChangePasswordForm from "../security/ChangePasswordForm";
import ForgotPassword from "../security/ForgotPassword";

const bdoBannerImage = "/bdoi/login-photo.jpg";
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
 * Only a complete session is stored; the intermediate tokens stay in this screen's memory.
 */
const Login = () => {
  const toastRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState("signin");
  const [stepData, setStepData] = useState(null);
  const [notice, setNotice] = useState(() =>
    new URLSearchParams(window.location.search).get("session") === "ended" ? "sessionEnded" : ""
  );
  const { t } = useTranslation();
  const languageOptions = useLanguageOptions();
  const currentLanguage =
    languageOptions.find((o) => i18n.language && i18n.language.startsWith(o.value))?.value || languageOptions[0]?.value || "en";
  const systemName = useSelector(
    (state) => state.systemSettingsReducer?.systemName || DEFAULT_SYSTEM_SETTINGS.systemName
  );
  const logoUrl = useSelector(
    (state) =>
      state.systemSettingsReducer?.logoUrl || DEFAULT_SYSTEM_SETTINGS.logoUrl
  );
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
    twoFactor: [t("security.twoFactorTitle"), t("security.twoFactorSubtitle")],
    enrol2fa: [t("security.enrolTitle"), t("security.enrolRequiredSubtitle")],
    changePassword: [
      t("security.changePassword"),
      stepData?.passwordExpired ? t("security.passwordExpiredSubtitle") : t("security.mustChangeSubtitle"),
    ],
    forgot: [t("security.forgotTitle"), ""],
  };

  const signInForm = (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        formik.handleSubmit();
      }}
      noValidate
    >
      <div className="col-12 md:col-12 lg:col-12  ">
        <InputTextField
          label={t("login.userId")}
          value={formik.values.EmailAddress}
          onChange={formik.handleChange("EmailAddress")}
          autoComplete="username"
          name="username"
        />
        {formik.touched.EmailAddress && formik.errors.EmailAddress && (
          <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-1">
            {formik.errors.EmailAddress}
          </div>
        )}
      </div>
      <div className="col-12 md:col-12 lg:col-12  ">
        <div className="login__password__wrapper">
          <InputTextField
            label={t("login.password")}
            value={formik.values.Password}
            onChange={formik.handleChange("Password")}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            name="password"
          />
          <Button
            type="button"
            icon={showPassword ? "pi pi-eye-slash" : "pi pi-eye"}
            className="p-button-text p-button-rounded login__password__toggle"
            aria-label={showPassword ? t("security.hidePassword") : t("security.showPassword")}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((v) => !v)} tooltip={showPassword ? t("security.hidePassword") : t("security.showPassword")} tooltipOptions={{ position: "top" }}
          />
        </div>
        {formik.touched.Password && formik.errors.Password && (
          <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-1">
            {formik.errors.Password}
          </div>
        )}
      </div>
      <div className="col-12 md:col-12 lg:col-12  ">
        {notice && (
          <div className="bv-security__success mb-2" role="status">
            {t(`security.notice.${notice}`)}
          </div>
        )}
        {errorMessage && (
          <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mb-2" role="alert">
            {errorMessage}
          </div>
        )}
        <Button type="submit" className="login__button bdo-login-btn" disabled={isLoading} loading={isLoading}>
          {isLoading ? t("login.loggingIn") : t("login.login")}
        </Button>
      </div>
      <div className="col-12 md:col-12 lg:col-12  ">
        <button
          type="button"
          className="forget__text cursor-pointer login__link__button"
          onClick={() => {
            setErrorMessage("");
            setNotice("");
            setStep("forgot");
          }}
        >
          {t("login.forgotPassword")}
        </button>
      </div>
    </form>
  );

  let stepBody = null;
  if (step === "twoFactor") {
    stepBody = (
      <TwoFactorCodeForm
        intro={t("security.twoFactorIntro")}
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
        intro={t("security.changeAtSignInIntro")}
        submitLabel={t("security.changeAndContinue")}
        onDone={handleResult}
        onCancel={() => backToSignIn()}
      />
    );
  } else if (step === "forgot") {
    stepBody = (
      <ForgotPassword
        initialUser={formik.values.EmailAddress}
        onBack={() => backToSignIn()}
        onDone={(user) => {
          formik.setFieldValue("EmailAddress", user || formik.values.EmailAddress, false);
          backToSignIn("passwordReset");
        }}
      />
    );
  }

  return (
    <div className="grid m-0 agent__container__login">
      <CustomToast ref={toastRef} message={t("login.loginSuccess")} />
      <div className="login__lang_dropdown">
        <Dropdown
          value={currentLanguage}
          options={languageOptions}
          onChange={(e) => i18n.changeLanguage(e.value)}
          className="login-language-dropdown"
          placeholder={t("common.language")}
          aria-label={t("common.language")}
        />
      </div>
      <div
        className="col-12 md:col-8 left__side__login bdo-theme"
        style={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
        }}
      >
        <div className="bdo-banner-container">
          <img src={bdoBannerImage} alt="" className="bdo-banner-image" />
        </div>
      </div>
      <div className="col-12 md:col-4 login__side__screen p-5">
        <div className="col-12 md:col-12 lg:col-12 bdo-logo-container">
          <img src={logoUrl} alt="Logo" className="bdo-logo" />
        </div>
        <div className="col-12 md:col-12 lg:col-12  ">
          <div className="login__header">{step === "signin" ? t("login.title", { name: systemName }) : headings[step][0]}</div>
          <div className="login__subtitle">{step === "signin" ? t("login.subtitle") : headings[step][1]}</div>
        </div>
        {step === "signin" ? signInForm : <div className="col-12 md:col-12 lg:col-12">{stepBody}</div>}
        <div className="col-12 md:col-12 lg:col-12 tech-footer">
          <div className="tech-powered-text">
            <span>{t("login.poweredBy")}</span>
            <img src="/bdoi/iorta-technxt.png" alt="iorta TechNXT" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
