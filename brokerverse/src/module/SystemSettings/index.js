import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { ColorPicker } from "primereact/colorpicker";
import { FileUpload } from "primereact/fileupload";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import SvgDot from "../../assets/icons/SvgDot";
import {
  fetchSystemSettings,
  saveSystemSettings,
  uploadSystemAsset,
  addLogoPreset,
  removeLogoPreset,
} from "./store/systemSettingsSlice";
import {
  LOGO_PRESETS,
  SYSTEM_CURRENCY_OPTIONS,
} from "../../utility/systemCurrencies";
import { getUserData } from "../../utility/tokenManager";
import { getDisplayCurrencyConfig } from "../../utility/currencyConverter";
import "./index.scss";

const LANGUAGE_OPTIONS = [
  { label: "English", value: "en" },
];

/** Preset theme colors — label includes hex so users can pick or type a code */
const THEME_COLOR_PRESETS = [
  { label: "Classic Blue — #0072d8", value: "#0072d8" },
  { label: "Navy — #004ea8", value: "#004ea8" },
  { label: "Indigo — #6366f1", value: "#6366f1" },
  { label: "Deep Indigo — #4f46e5", value: "#4f46e5" },
  { label: "Teal — #0d9488", value: "#0d9488" },
  { label: "Emerald — #059669", value: "#059669" },
  { label: "Sky — #0284c7", value: "#0284c7" },
  { label: "Slate — #334155", value: "#334155" },
  { label: "Rose — #e11d48", value: "#e11d48" },
  { label: "Amber — #d97706", value: "#d97706" },
  { label: "Custom (enter hex below)", value: "custom" },
];

const SystemSettingsPage = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const toast = useRef(null);
  const settings = useSelector((state) => state.systemSettingsReducer);
  const userData = getUserData();
  const userName = userData?.displayName || userData?.username || "User";

  const [form, setForm] = useState({
    logoUrl: "",
    displayCurrency: getDisplayCurrencyConfig().currency,
    primaryColor: "#0072d8",
    secondaryColor: "#004ea8",
    defaultLanguage: "en",
    faviconUrl: "/favicon.ico",
    systemName: "BrokerVerse",
  });
  const [addLogoVisible, setAddLogoVisible] = useState(false);
  const [newLogoLabel, setNewLogoLabel] = useState("");
  const [newLogoUrl, setNewLogoUrl] = useState("");
  const [newLogoFile, setNewLogoFile] = useState(null);

  useEffect(() => {
    dispatch(fetchSystemSettings({ authenticated: true, userName }));
  }, [dispatch, userName]);

  useEffect(() => {
    if (settings.loaded) {
      setForm({
        logoUrl: settings.logoUrl,
        displayCurrency: settings.displayCurrency,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
        defaultLanguage: settings.defaultLanguage,
        faviconUrl: settings.faviconUrl,
        systemName: settings.systemName,
      });
    }
  }, [
    settings.loaded,
    settings.logoUrl,
    settings.displayCurrency,
    settings.primaryColor,
    settings.secondaryColor,
    settings.defaultLanguage,
    settings.faviconUrl,
    settings.systemName,
  ]);

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

  const logoPresetOptions = (
    settings.logoPresets?.length
      ? settings.logoPresets
      : LOGO_PRESETS.map((p, i) => ({
          id: `local-${i}`,
          label: p.label,
          url: p.value,
          builtIn: true,
        }))
  ).map((p) => ({
    label: p.label,
    value: p.url,
    id: p.id,
    builtIn: p.builtIn,
  }));

  const selectedLogoPreset = (settings.logoPresets || []).find(
    (p) => p.url === form.logoUrl
  );

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const normalizeColor = (value) => {
    if (!value) return "#0072d8";
    const v = String(value).replace(/^#/, "").trim();
    return `#${v}`;
  };

  /** Allow free typing in hex field; only prefix # when needed */
  const handleHexInput = (field, raw) => {
    const trimmed = String(raw || "").trim();
    if (!trimmed) {
      updateField(field, "");
      return;
    }
    updateField(field, trimmed.startsWith("#") ? trimmed : `#${trimmed}`);
  };

  const getPresetValue = (hex) => {
    if (!hex || !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/i.test(String(hex).trim())) {
      return "custom";
    }
    const normalized = normalizeColor(hex).toLowerCase();
    const match = THEME_COLOR_PRESETS.find(
      (p) => p.value !== "custom" && p.value.toLowerCase() === normalized
    );
    return match ? match.value : "custom";
  };

  const handlePresetChange = (field, value) => {
    if (value === "custom") return;
    updateField(field, normalizeColor(value));
  };

  const handleSave = async () => {
    try {
      await dispatch(
        saveSystemSettings({
          payload: {
            ...form,
            primaryColor: normalizeColor(form.primaryColor),
            secondaryColor: normalizeColor(form.secondaryColor),
          },
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

  const handleUpload = async (field, file) => {
    if (!file) return;
    try {
      await dispatch(
        uploadSystemAsset({
          field,
          file,
          applyOptions: { authenticated: true, userName },
        })
      ).unwrap();
      toast.current?.show({
        severity: "success",
        summary: t("common.success", "Success"),
        detail: t("systemSettings.uploadSuccess", "File uploaded"),
        life: 3000,
      });
    } catch (err) {
      toast.current?.show({
        severity: "error",
        summary: t("common.error", "Error"),
        detail: err || t("systemSettings.uploadFailed", "Upload failed"),
        life: 4000,
      });
    }
  };

  const resetAddLogoDialog = () => {
    setAddLogoVisible(false);
    setNewLogoLabel("");
    setNewLogoUrl("");
    setNewLogoFile(null);
  };

  const handleAddCompanyLogo = async () => {
    const label = newLogoLabel.trim();
    if (!label) {
      toast.current?.show({
        severity: "warn",
        summary: t("common.error", "Error"),
        detail: t(
          "systemSettings.companyNameRequired",
          "Company / client name is required"
        ),
        life: 3000,
      });
      return;
    }
    if (!newLogoFile && !newLogoUrl.trim()) {
      toast.current?.show({
        severity: "warn",
        summary: t("common.error", "Error"),
        detail: t(
          "systemSettings.logoFileOrUrlRequired",
          "Upload a logo file or enter a logo URL"
        ),
        life: 3000,
      });
      return;
    }

    try {
      const data = await dispatch(
        addLogoPreset({
          label,
          url: newLogoUrl.trim() || undefined,
          file: newLogoFile || undefined,
          setActive: true,
          applyOptions: { authenticated: true, userName },
        })
      ).unwrap();
      setForm((prev) => ({
        ...prev,
        logoUrl: data.logoUrl || prev.logoUrl,
      }));
      resetAddLogoDialog();
      toast.current?.show({
        severity: "success",
        summary: t("common.success", "Success"),
        detail: t(
          "systemSettings.companyLogoAdded",
          "Company logo added to the list"
        ),
        life: 3000,
      });
    } catch (err) {
      toast.current?.show({
        severity: "error",
        summary: t("common.error", "Error"),
        detail: err || t("systemSettings.companyLogoAddFailed", "Failed to add logo"),
        life: 4000,
      });
    }
  };

  const handleRemoveSelectedLogo = async () => {
    if (!selectedLogoPreset || selectedLogoPreset.builtIn) {
      toast.current?.show({
        severity: "warn",
        summary: t("common.error", "Error"),
        detail: t(
          "systemSettings.cannotRemoveBuiltIn",
          "Built-in logos cannot be removed"
        ),
        life: 3000,
      });
      return;
    }
    try {
      await dispatch(
        removeLogoPreset({
          id: selectedLogoPreset.id,
          applyOptions: { authenticated: true, userName },
        })
      ).unwrap();
      toast.current?.show({
        severity: "success",
        summary: t("common.success", "Success"),
        detail: t(
          "systemSettings.companyLogoRemoved",
          "Company logo removed from the list"
        ),
        life: 3000,
      });
    } catch (err) {
      toast.current?.show({
        severity: "error",
        summary: t("common.error", "Error"),
        detail:
          err ||
          t("systemSettings.companyLogoRemoveFailed", "Failed to remove logo"),
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
            {t("systemSettings.branding", "Branding")}
          </div>
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-3 field">
              <label htmlFor="system-name">{t("systemSettings.applicationName", "Application name")}</label>
              <InputText
                id="system-name"
                value={form.systemName}
                onChange={(e) => updateField("systemName", e.target.value)}
                maxLength={80}
              />
              <small className="block mt-1">{t("systemSettings.applicationNameHint", "Shown on the sign-in page, the side bar and the browser tab.")}</small>
            </div>
            <div className="col-12 md:col-6 lg:col-3 field">
              <label>{t("systemSettings.logoPreset", "Application logo (screen)")}</label>
              <Dropdown
                value={
                  logoPresetOptions.some((p) => p.value === form.logoUrl)
                    ? form.logoUrl
                    : null
                }
                options={logoPresetOptions}
                onChange={(e) => updateField("logoUrl", e.value)}
                placeholder={t("systemSettings.selectLogo", "Select logo")}
                className="w-full"
              />
              <InputText
                className="mt-2"
                value={form.logoUrl}
                onChange={(e) => updateField("logoUrl", e.target.value)}
                placeholder="/bdoi/iorta-technxt.png"
              />
              <small className="block mt-1">
                {t("systemSettings.applicationLogoHint", "Shown on screen. Printed documents use the logo of the primary company in Master > Company.")}
              </small>
              <div className="logo-preset-actions mt-2">
                <Button
                  type="button"
                  label={t("systemSettings.addCompanyLogo", "Add Company Logo")}
                  icon="pi pi-plus"
                  className="p-button-sm add-logo-btn"
                  onClick={() => setAddLogoVisible(true)}
                />
                {selectedLogoPreset && !selectedLogoPreset.builtIn && (
                  <Button
                    type="button"
                    label={t("systemSettings.removeLogo", "Remove")}
                    icon="pi pi-trash"
                    className="p-button-sm p-button-outlined p-button-danger"
                    loading={settings.saving}
                    onClick={handleRemoveSelectedLogo}
                  />
                )}
              </div>
            </div>
            <div className="col-12 md:col-6 lg:col-3 field">
              <label>{t("systemSettings.logoPreview", "Logo Preview")}</label>
              <div className="logo-preview">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Logo preview" />
                ) : (
                  <span>—</span>
                )}
              </div>
              <FileUpload
                mode="basic"
                name="file"
                accept="image/*"
                maxFileSize={5000000}
                chooseLabel={t("systemSettings.uploadLogo", "Upload Logo")}
                auto
                customUpload
                className="mt-2"
                uploadHandler={(e) => {
                  const file = e.files?.[0];
                  handleUpload("logo", file);
                  e.options?.clear?.();
                }}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-3 field">
              <label>{t("systemSettings.favicon", "Favicon")}</label>
              <div className="favicon-preview">
                {form.faviconUrl ? (
                  <img src={form.faviconUrl} alt="Favicon preview" />
                ) : (
                  <span>—</span>
                )}
              </div>
              <FileUpload
                mode="basic"
                name="file"
                accept="image/*"
                maxFileSize={2000000}
                chooseLabel={t("systemSettings.uploadFavicon", "Upload Favicon")}
                auto
                customUpload
                className="mt-2"
                uploadHandler={(e) => {
                  const file = e.files?.[0];
                  handleUpload("favicon", file);
                  e.options?.clear?.();
                }}
              />
            </div>
          </div>

          <div className="main__tabel__title mb-3 mt-4">
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

          <div className="main__tabel__title mb-3 mt-4 flex align-items-center justify-content-between flex-wrap gap-2">
            {t("systemSettings.theme", "Theme")}
            <Link to="/master/configuration/theme-branding" className="p-button p-button-sm p-button-outlined no-underline" data-testid="open-theme-branding">
              <i className="pi pi-palette mr-2" />
              {t("systemSettings.openThemeBranding", "Theme and Branding (full theme, sign-in page, documents, e-mail, signatures, brand packs)")}
            </Link>
          </div>
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-4 field">
              <label>
                {t("systemSettings.primaryColor", "Primary Color")}
              </label>
              <Dropdown
                value={getPresetValue(form.primaryColor)}
                options={THEME_COLOR_PRESETS}
                onChange={(e) => handlePresetChange("primaryColor", e.value)}
                placeholder={t(
                  "systemSettings.selectColor",
                  "Select color or use hex"
                )}
                className="w-full mb-2"
              />
              <div className="color-row">
                <ColorPicker
                  value={String(form.primaryColor || "").replace("#", "")}
                  onChange={(e) =>
                    updateField("primaryColor", normalizeColor(e.value))
                  }
                />
                <InputText
                  value={form.primaryColor || ""}
                  onChange={(e) => handleHexInput("primaryColor", e.target.value)}
                  placeholder="#0072d8"
                  maxLength={7}
                  className="hex-input"
                />
                <span
                  className="color-swatch"
                  style={{
                    background: form.primaryColor
                      ? normalizeColor(form.primaryColor)
                      : "#ccc",
                  }}
                  title={form.primaryColor || ""}
                />
              </div>
              <small className="hex-hint">
                {t(
                  "systemSettings.hexHint",
                  "Hex code, for example #0072d8. The picker and the presets stay in sync."
                )}
              </small>
            </div>
            <div className="col-12 md:col-6 lg:col-4 field">
              <label>
                {t("systemSettings.secondaryColor", "Secondary Color")}
              </label>
              <Dropdown
                value={getPresetValue(form.secondaryColor)}
                options={THEME_COLOR_PRESETS}
                onChange={(e) => handlePresetChange("secondaryColor", e.value)}
                placeholder={t(
                  "systemSettings.selectColor",
                  "Select color or use hex"
                )}
                className="w-full mb-2"
              />
              <div className="color-row">
                <ColorPicker
                  value={String(form.secondaryColor || "").replace("#", "")}
                  onChange={(e) =>
                    updateField("secondaryColor", normalizeColor(e.value))
                  }
                />
                <InputText
                  value={form.secondaryColor || ""}
                  onChange={(e) =>
                    handleHexInput("secondaryColor", e.target.value)
                  }
                  placeholder="#004ea8"
                  maxLength={7}
                  className="hex-input"
                />
                <span
                  className="color-swatch"
                  style={{
                    background: form.secondaryColor
                      ? normalizeColor(form.secondaryColor)
                      : "#ccc",
                  }}
                  title={form.secondaryColor || ""}
                />
              </div>
              <small className="hex-hint">
                {t(
                  "systemSettings.hexHint",
                  "Hex code, for example #0072d8. The picker and the presets stay in sync."
                )}
              </small>
            </div>
            <div className="col-12">
              <div
                className="theme-preview"
                style={{
                  background: `linear-gradient(135deg, ${normalizeColor(
                    form.primaryColor
                  )} 0%, ${normalizeColor(form.secondaryColor)} 100%)`,
                }}
              >
                {t("systemSettings.themePreview", "Theme preview")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        header={t("systemSettings.addCompanyLogo", "Add Company Logo")}
        visible={addLogoVisible}
        style={{ width: "28rem" }}
        modal
        onHide={resetAddLogoDialog}
        footer={
          <div className="dialog-footer-actions">
            <Button
              label={t("common.cancel", "Cancel")}
              className="p-button-text"
              onClick={resetAddLogoDialog}
            />
            <Button
              label={t("common.save", "Save")}
              icon="pi pi-check"
              loading={settings.saving}
              onClick={handleAddCompanyLogo}
            />
          </div>
        }
      >
        <div className="add-logo-dialog-body">
          <div className="field">
            <label>
              {t("systemSettings.companyName", "Company / Client Name")}
            </label>
            <InputText
              value={newLogoLabel}
              onChange={(e) => setNewLogoLabel(e.target.value)}
              placeholder={t(
                "systemSettings.companyNamePlaceholder",
                "e.g. Acme Insurance"
              )}
              maxLength={80}
              className="w-full"
            />
          </div>
          <div className="field mt-3">
            <label>{t("systemSettings.logoUrlOptional", "Logo URL (optional)")}</label>
            <InputText
              value={newLogoUrl}
              onChange={(e) => setNewLogoUrl(e.target.value)}
              placeholder="/path/or/https://..."
              className="w-full"
              disabled={Boolean(newLogoFile)}
            />
          </div>
          <div className="field mt-3">
            <label>{t("systemSettings.logoFile", "Logo File")}</label>
            <FileUpload
              mode="basic"
              name="file"
              accept="image/*"
              maxFileSize={5000000}
              chooseLabel={t("systemSettings.chooseLogoFile", "Choose Image")}
              auto
              customUpload
              uploadHandler={(e) => {
                const file = e.files?.[0];
                setNewLogoFile(file || null);
                if (file) setNewLogoUrl("");
                e.options?.clear?.();
              }}
            />
            {newLogoFile && (
              <small className="hex-hint mt-1">
                {newLogoFile.name}
                {" · "}
                <button
                  type="button"
                  className="link-clear-file"
                  onClick={() => setNewLogoFile(null)}
                >
                  {t("common.clear", "Clear")}
                </button>
              </small>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default SystemSettingsPage;
