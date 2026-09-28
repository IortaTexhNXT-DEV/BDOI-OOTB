import React, { useEffect, useRef } from "react";
import "../Login/index.scss";
import InputField from "../../../components/InputField";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { isAuthenticated } from "../../../utility/tokenManager";
import Cookies from "js-cookie";
import { useFormik } from "formik";
import CustomToast from "../../../components/Toast";
import authService from "../../../services/authService";
import { useTranslation } from "react-i18next";
import i18n from "../../../i18n";

const initialValue = {
  EmailAddress: "",
  Password: "",
};

const getLanguageOptions = (t) => [
  { label: t("common.english"), value: "en" },
  { label: t("common.thai"), value: "th" },
];

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toastRef = useRef(null);
  const { t } = useTranslation();
  const currentLanguage = (i18n.language && i18n.language.startsWith("th")) ? "th" : "en";

  const validate = (values) => {
    const errors = {};

    if (!values.EmailAddress) {
      errors.EmailAddress = t("login.emailAddressRequired");
    }

    if (!values.Password) {
      errors.Password = t("login.passwordRequired");
    } else if (values.Password.length < 6) {
      errors.Password = t("login.passwordMinLength");
    }

    return errors;
  };

  const handleNavigate = () => {
    navigate("register");
  };

  const handleSubmit = async (values) => {
    const startTime = performance.now();

    try {
      // Use the optimized authService for consistent behavior
      const loginResult = await authService.login(
        values.EmailAddress,
        values.Password
      );

      if (loginResult.success) {
        // Set cookies for compatibility
        const user = loginResult.data.user;
        Cookies.set("USER_ROLE", user.roles.join(", ") || "user");
        Cookies.set("USER_ROLES", JSON.stringify(user.roles || ["user"]));
        Cookies.set("USER_NAME", user.displayName);
        Cookies.set("USER_EMAIL", user.email);
        Cookies.set(
          "USER_PERMISSIONS",
          JSON.stringify(user.permissions || []),
          { expires: 7 }
        );

        // Store in localStorage as well
        localStorage.setItem("USER_ROLE", user.roles.join(", ") || "user");
        localStorage.setItem(
          "USER_ROLES",
          JSON.stringify(user.roles || ["user"])
        );
        localStorage.setItem("USER_NAME", user.displayName);
        localStorage.setItem("USER_EMAIL", user.email);
        localStorage.setItem(
          "USER_PERMISSIONS",
          JSON.stringify(user.permissions || [])
        );
        localStorage.setItem("USER_ID", user.userId);
        localStorage.setItem("USERNAME", user.username);
        localStorage.setItem("ACCESS_TOKEN", loginResult.data.accessToken);
        localStorage.setItem("REFRESH_TOKEN", loginResult.data.refreshToken);

        // Log stored data for debugging
        console.log("🔐 Stored user data in localStorage:");
        console.log("USER_ROLE:", user.roles[0]);
        console.log("USER_NAME:", user.displayName);
        console.log("USER_EMAIL:", user.email);
        console.log("USER_PERMISSIONS:", user.permissions);
        console.log("USER_ID:", user.userId);
        console.log("USERNAME:", user.username);
        console.log(
          "ACCESS_TOKEN:",
          loginResult.data.accessToken ? "✓ Stored" : "✗ Missing"
        );

        toastRef.current.showToast();
        navigate("/");
        // Remove the setTimeout delay and page reload for faster navigation
      } else {
        // Invalid credentials - could add error handling here
        console.error("Login failed:", loginResult.error);
      }
    } catch (error) {
      console.error("Login error:", error);
    }

    const totalTime = performance.now() - startTime;
    console.log(`Login component total time: ${totalTime.toFixed(2)}ms`);
  };
  useEffect(() => {
    document.title = t("login.pageTitle");
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.content = t("login.metaDescription");
    }
    if (location.pathname === "/login" && isAuthenticated()) {
      navigate("/");
    }
    if (location.pathname === "/" && !isAuthenticated()) {
      navigate("/login");
    }
  }, [location, navigate, t]);

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <div className="grid m-0 container__login">
            <CustomToast ref={toastRef} message={t("login.loginSuccess")} />
            <div className="col-12 md:col-8 left__side__login">
              <div>
                <div className="p-mt-5 side__logo">
                  <div className="p-mt-1 welcome__text">{t("login.welcomeTo")}</div>
                  <img src="/BDO_insure_logo.png.png" alt="BDO" />
                </div>

                <div className="welcome__content mt-2">
                  {t("login.productiveDashboard")}
                </div>
              </div>
            </div>
            <div className="col-12 md:col-4 login__side__screen p-5">
              <div className="col-12 md:col-12 lg:col-12 login__lang_dropdown">
                <Dropdown
                  value={currentLanguage}
                  options={getLanguageOptions(t)}
                  onChange={(e) => i18n.changeLanguage(e.value)}
                  className="login-language-dropdown"
                  placeholder={t("common.language")}
                />
              </div>
              <div className="col-12 md:col-12 lg:col-12  ">
                <div className="logo__icon">
                  <img src="/BDO_insure_logo.png.png" alt="BDO" />
                </div>
              </div>
              <div className="col-12 md:col-12 lg:col-12  ">
                <div className="login__header">{t("login.logIn")}</div>
              </div>
              <div className="col-12 md:col-12 lg:col-12   ">
                <div
                  className="dont__have__text"
                  onClick={() => handleNavigate()}
                >
                  {t("login.dontHaveAccount")}
                  <span className="register">{t("login.register")}</span>
                </div>
              </div>
              <div className="col-12 md:col-12 lg:col-12  ">
                <InputField
                  classNames="input__filed"
                  placeholder={t("login.emailAddress")}
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
                <InputField
                  classNames="input__filed"
                  placeholder={t("login.password")}
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
                <Button
                  className="login__button"
                  label={t("login.login")}
                  onClick={() => formik.handleSubmit()}
                />
              </div>
              <div className="col-12 md:col-12 lg:col-12  ">
                <div className="forget__text">{t("login.forgotPassword")}</div>
              </div>
            </div>
          </div>
        }
      />
    </Routes>
  );
};

export default Login;
