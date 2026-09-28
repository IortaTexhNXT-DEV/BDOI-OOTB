import React, { useRef, useState } from "react";
// Import SvgWhiteLogo from your SVG component
import "../Login/index.scss"; // Import your custom styles
// import SvgWhiteLogo from '../../../assets/icons/SvgWhiteLogo';
import { Button } from "primereact/button";
import { useFormik } from "formik";
import CustomToast from "../../../components/Toast";
import InputTextField from "../../component/inputText";
import authService from "../../../services/authService";
import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import { useSelector } from "react-redux";
import i18n from "../../../i18n";
import SvgFinalLogo from "../../../assets/icons/SvgFinalLogo";
import { DEFAULT_SYSTEM_SETTINGS } from "../../../utility/systemCurrencies";

const getLanguageOptions = (t) => [
  { label: t("common.english"), value: "en" },
  { label: t("common.thai"), value: "th" },
];

const bdoBannerImage = "/bdoi/login-photo.jpg";
const initialValue = {
  EmailAddress: "",
  Password: "",
};

const Login = () => {
  const toastRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { t } = useTranslation();
  const currentLanguage = (i18n.language && i18n.language.startsWith("th")) ? "th" : "en";
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
    } else if (values.Password.length < 6) {
      errors.Password = t("login.passwordMinLength");
    }

    return errors;
  };

  const handleSubmit = async (values) => {
    const startTime = performance.now();

    setIsLoading(true);
    setErrorMessage("");

    try {
      // Single login call - handles both API and fallback credentials
      const loginResult = await authService.login(
        values.EmailAddress,
        values.Password
      );

      if (loginResult.success) {
        // Login successful - tokens are already stored in localStorage by authService
        toastRef.current.showToast();

        // // Immediate navigation without delay
        window.location.href = "/";
      } else {
        // Login failed
        setErrorMessage(loginResult.error || t("login.invalidCredentials"));
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Login error:", error);
      setErrorMessage(t("login.loginFailed"));
      setIsLoading(false);
    }

    const totalTime = performance.now() - startTime;
    console.log(`Login component total time: ${totalTime.toFixed(2)}ms`);
  };
  // Removed useEffect to prevent infinite loops
  // App.js handles authentication routing

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });
  return (
    <div className="grid m-0 agent__container__login">
      <CustomToast ref={toastRef} message={t("login.loginSuccess")} />
      <div className="login__lang_dropdown">
        <Dropdown
          value={currentLanguage}
          options={getLanguageOptions(t)}
          onChange={(e) => i18n.changeLanguage(e.value)}
          className="login-language-dropdown"
          placeholder={t("common.language")}
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
          <div className="login__header">{t("login.title")}</div>
          <div className="login__subtitle">{t("login.subtitle")}</div>
        </div>

        <div className="col-12 md:col-12 lg:col-12  ">
          <InputTextField
            label={t("login.userId")}
            value={formik.values.EmailAddress}
            onChange={formik.handleChange("EmailAddress")}
          />
          {formik.touched.EmailAddress && formik.errors.EmailAddress && (
            <div style={{ fontSize: 12, color: "red" }} className="mt-1">
              {formik.errors.EmailAddress}
            </div>
          )}
        </div>
        <div className="col-12 md:col-12 lg:col-12  ">
          <InputTextField
            label={t("login.password")}
            value={formik.values.Password}
            onChange={formik.handleChange("Password")}
          />
          {formik.touched.Password && formik.errors.Password && (
            <div style={{ fontSize: 12, color: "red" }} className="mt-1">
              {formik.errors.Password}
            </div>
          )}
        </div>
        <div className="col-12 md:col-12 lg:col-12  ">
          {errorMessage && (
            <div style={{ fontSize: 12, color: "red" }} className="mb-2">
              {errorMessage}
            </div>
          )}
          <Button
            className="login__button bdo-login-btn"
            onClick={() => formik.handleSubmit()}
            disabled={isLoading}
            loading={isLoading}
          >
            {isLoading ? t("login.loggingIn") : t("login.login")}
          </Button>
        </div>
        <div className="col-12 md:col-12 lg:col-12  ">
          <div className="forget__text cursor-pointer">{t("login.forgotPassword")}</div>
        </div>
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
