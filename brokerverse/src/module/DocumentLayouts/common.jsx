/**
 * Shared parts of the layout screens of Master > System Configuration (E-mail Layout, Documents and Reports Layout,
 * Document Signatures): the page frame, a section, a colour field with its contrast badge, and the branding theme of
 * the environment. The look of the screens and the sign-in page is fixed by the deployment's brand pack (BRAND_PACK);
 * these screens change only the e-mail and document sections of the theme, through the same save (PUT /branding/theme)
 * and its server checks.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BreadCrumb } from "primereact/breadcrumb";
import { InputText } from "primereact/inputtext";
import { ColorPicker } from "primereact/colorpicker";
import { Message } from "primereact/message";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import brandingService from "../../services/brandingService";
import { contrastRatio, isHex } from "../../theme/runtime/themeEngine";
import "./index.scss";

const clone = (o) => JSON.parse(JSON.stringify(o || {}));

/** One colour: picker + hex field + contrast badge against `against` (optional). */
export const ColorField = ({ id, label, value, onChange, against, allowEmpty, emptyLabel }) => {
  const [text, setText] = useState(value || "");
  useEffect(() => setText(value || ""), [value]);
  const ratio = against && isHex(value) && isHex(against) ? contrastRatio(value, against) : null;
  return (
    <div className="bv-dl__color">
      <label htmlFor={id}>{label}</label>
      <div className="bv-dl__color-row">
        <ColorPicker value={(isHex(value) ? value : "#ffffff").replace("#", "")} onChange={(e) => onChange(`#${e.value}`)} aria-label={label} />
        <InputText id={id} value={text} placeholder={allowEmpty ? emptyLabel : "#000000"} maxLength={7}
          onChange={(e) => { const v = e.target.value.trim(); setText(v); if (isHex(v) || (allowEmpty && v === "")) onChange(v.toLowerCase()); }} />
        {ratio !== null && <Tag severity={ratio >= 4.5 ? "success" : "danger"} value={`${ratio}:1`} title="WCAG contrast" />}
      </div>
    </div>
  );
};

export const Section = ({ title, children }) => (
  <section className="bv-dl__section">
    <h3>{title}</h3>
    {children}
  </section>
);

/** Page frame: breadcrumb (Master > System > title), title, lead text, actions and the blocking errors of the draft. */
export const LayoutPage = ({ title, lead, actions, errors = [], toast, children }) => {
  const { t } = useTranslation();
  return (
    <div className="bv-dl">
      <Toast ref={toast} />
      <BreadCrumb model={[{ label: t("sidebar.System Configuration", "System") }, { label: title }]} home={{ label: t("documentLayouts.master", "Master") }} />
      <div className="bv-dl__top">
        <div>
          <h1 className="page-title">{title}</h1>
          {lead && <p className="bv-dl__lead">{lead}</p>}
        </div>
        {actions && <div className="bv-dl__actions">{actions}</div>}
      </div>
      {errors.length > 0 && (
        <Message severity="error" className="bv-dl__msg" text={`${t("documentLayouts.cannotSave", "Cannot save")}: ${errors.map((e) => e.message).join("; ")}`} />
      )}
      <div className="bv-dl__card">{children}</div>
    </div>
  );
};

/** Toast helper of a page: notify(severity, summary, detail). */
export const useNotify = () => {
  const toast = useRef(null);
  const notify = useCallback((severity, summary, detail) => toast.current?.show({ severity, summary, detail, life: severity === "error" ? 6000 : 3000 }), []);
  return { toast, notify };
};

/**
 * The branding theme in force, a draft of it and its server check (the same rules as Save). `set(section, key, value)`
 * changes one value of the draft; `save()` stores the draft with the preset and the other sections unchanged.
 */
export const useBrandingTheme = (notify) => {
  const { t } = useTranslation();
  const [editor, setEditor] = useState(null);
  const [theme, setTheme] = useState(null);
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    brandingService.getEditor()
      .then((data) => { setEditor(data); setTheme(clone(data.theme)); })
      .catch((e) => notify("error", t("common.error", "Error"), e.message));
  }, [notify, t]);

  useEffect(() => {
    if (!theme) return undefined;
    const timer = setTimeout(() => {
      brandingService.validate(theme).then((r) => setErrors(r.errors || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [theme]);

  const set = (section, key, value) => setTheme((prev) => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  const discard = () => setTheme(clone(editor.theme));
  const save = async () => {
    setSaving(true);
    try {
      const data = await brandingService.save(theme);
      setEditor(data);
      setTheme(clone(data.theme));
      notify("success", t("common.success", "Success"), t("documentLayouts.saved", "Saved. Documents, reports and e-mails use it from now on."));
      if (data.warnings?.length) notify("warn", t("documentLayouts.contrastWarnings", "Contrast warnings"), data.warnings.map((w) => w.message).join("; "));
    } catch (e) {
      notify("error", t("documentLayouts.notSaved", "Not saved"), [e.message, ...(e.errors || []).map((x) => `${x.path}: ${x.message}`)].join(" | "));
    } finally {
      setSaving(false);
    }
  };
  return { editor, theme, errors, saving, set, discard, save };
};
