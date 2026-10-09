import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import SvgDot from "../../assets/icons/SvgDot";
import { fetchSystemSettings, saveSystemSettings } from "./store/systemSettingsSlice";
import { SYSTEM_CURRENCY_OPTIONS } from "../../utility/systemCurrencies";
import { getUserData } from "../../utility/tokenManager";
import { getDisplayCurrencyConfig } from "../../utility/currencyConverter";
import "./index.scss";

const LANGUAGE_OPTIONS = [
  { label: "English", value: "en" },
];

/**
 * Master > System Configuration > System Settings: the display currency and the default language. The application
 * name, logo, favicon and colours come from the deployment's brand pack (BRAND_PACK); the layouts of e-mails and
 * documents and the document signatures have their own screens under System Configuration.
 */
const SystemSettingsPage = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const toast = useRef(null);
  const settings = useSelector((state) => state.systemSettingsReducer);
  const userData = getUserData();
  const userName = userData?.displayName || userData?.username || "User";

  const [form, setForm] = useState({
    displayCurrency: getDisplayCurrencyConfig().currency,
    defaultLanguage: "en",
  });

  useEffect(() => {
    dispatch(fetchSystemSettings({ authenticated: true, userName }));
  }, [dispatch, userName]);

  useEffect(() => {
    if (settings.loaded) {
      setForm({
        displayCurrency: settings.displayCurrency,
        defaultLanguage: settings.defaultLanguage,
      });
    }
  }, [settings.loaded, settings.displayCurrency, settings.defaultLanguage]);

  const home = { label: t("systemSettings.masters", "Master") };
  const items = [
    { label: t("systemSettings.title", "System Settings") },
  ];

  const currencyOptions =
    settings.currencies?.length > 0
      ? settings.currencies.map((c) => ({
          label: `${c.code} — ${c.name}`,
          value: c.code,
        }))
      : SYSTEM_CURRENCY_OPTIONS;

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      await dispatch(
        saveSystemSettings({
          payload: form,
          applyOptions: { authenticated: true, userName },
        })
      ).unwrap();
      toast.current?.show({
        severity: "success",
        summary: t("common.success", "Success"),
        detail: t("systemSettings.saved", "System settings saved"),
        life: 3000,
      });
    } catch (err) {
      toast.current?.show({
        severity: "error",
        summary: t("common.error", "Error"),
        detail: err || t("systemSettings.saveFailed", "Failed to save settings"),
        life: 4000,
      });
    }
  };

  return (
    <div className="grid container__system__settings">
      <Toast ref={toast} />
      <div className="col-12 md:col-6 lg:col-6 mb-1">
        <div className="add__icon__title">
          {t("systemSettings.title", "System Settings")}
        </div>
        <div className="mt-3">
          <BreadCrumb
            home={home}
            className="breadCrums__view__reversal"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="col-12 md:col-6 lg:col-6 add__icon__alighn mb-1">
        <div className="btn__container">
          <Button
            label={t("common.save", "Save")}
            icon="pi pi-check"
            className="save__btn"
            loading={settings.saving}
            onClick={handleSave}
          />
        </div>
      </div>

      <div className="col-12 m-0">
        <div className="sub__account__sub__container p-3">
          <div className="main__tabel__title mb-3">
            {t("systemSettings.localization", "Localization")}
          </div>
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-3 field">
              <label>
                {t("systemSettings.displayCurrency", "Display Currency")}
              </label>
              <Dropdown
                value={form.displayCurrency}
                options={currencyOptions}
                onChange={(e) => updateField("displayCurrency", e.value)}
                filter
                filterBy="label"
                placeholder={t(
                  "systemSettings.selectCurrency",
                  "Select currency"
                )}
                className="w-full"
              />
              {settings.baseCurrency && (
                <small className="block mt-1">
                  {t("systemSettings.baseCurrencyHint", {
                    defaultValue:
                      "Accounts are kept in the base currency {{base}} (Master > Finance > Currency); the display currency only changes how amounts are labelled.",
                    base: settings.baseCurrency,
                  })}
                </small>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-3 field">
              <label>
                {t("systemSettings.defaultLanguage", "Default Language")}
              </label>
              <Dropdown
                value={form.defaultLanguage}
                options={LANGUAGE_OPTIONS}
                onChange={(e) => updateField("defaultLanguage", e.value)}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsPage;
