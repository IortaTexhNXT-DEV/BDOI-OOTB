/**
 * Master > System Configuration > E-mail Layout: the layout every e-mail of the system is sent in (quotation links,
 * notices, receipts, reminders, debit notes): branded layout on or off, header colours, logo and footer line, with a
 * sample e-mail drawn by the server in the layout being edited.
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputSwitch } from "primereact/inputswitch";
import brandingService from "../../services/brandingService";
import { ColorField, LayoutPage, Section, useBrandingTheme, useNotify } from "./common";

const EmailLayoutPage = () => {
  const { t } = useTranslation();
  const { toast, notify } = useNotify();
  const { theme, errors, saving, set, discard, save } = useBrandingTheme(notify);
  const [html, setHtml] = useState("");

  const preview = async () => {
    try {
      setHtml((await brandingService.previewEmail(theme)).html);
    } catch (e) {
      notify("error", t("common.error", "Error"), e.message);
    }
  };

  const title = t("documentLayouts.email.title", "E-mail Layout");
  const lead = t("documentLayouts.email.lead", "Every e-mail the system sends (quotation links, notices, receipts, reminders, debit notes) uses this layout, with the logo and the details of the primary company.");
  if (!theme) return <LayoutPage title={title} lead={lead} toast={toast}><p>{t("common.loading", "Loading...")}</p></LayoutPage>;
  const mail = theme.email || {};
  const actions = (
    <>
      <Button label={t("documentLayouts.discard", "Discard changes")} icon="pi pi-undo" className="p-button-text" onClick={discard} />
      <Button label={t("common.save", "Save")} icon="pi pi-check" onClick={save} loading={saving} disabled={errors.length > 0} data-testid="save-email-layout" />
    </>
  );
  return (
    <LayoutPage title={title} lead={lead} actions={actions} errors={errors} toast={toast}>
      <Section title={t("documentLayouts.email.section", "E-mail layout")}>
        <div className="bv-dl__field bv-dl__switch"><InputSwitch inputId="mail-on" checked={mail.enabled !== false} onChange={(e) => set("email", "enabled", e.value)} />
          <label htmlFor="mail-on">{t("documentLayouts.email.enabled", "Send e-mails in the branded layout (header with the logo, footer line)")}</label></div>
        <div className="bv-dl__grid">
          <ColorField id="mail-bg" label={t("documentLayouts.email.headerBg", "Header background")} value={mail.headerBg} onChange={(v) => set("email", "headerBg", v)} />
          <ColorField id="mail-text" label={t("documentLayouts.email.headerText", "Header text")} value={mail.headerText} against={mail.headerBg} onChange={(v) => set("email", "headerText", v)} />
          <ColorField id="mail-accent" label={t("documentLayouts.email.accent", "Line under the header")} value={mail.accentColor} onChange={(v) => set("email", "accentColor", v)} />
        </div>
        <div className="bv-dl__field bv-dl__switch"><InputSwitch inputId="mail-logo" checked={mail.showLogo !== false} onChange={(e) => set("email", "showLogo", e.value)} />
          <label htmlFor="mail-logo">{t("documentLayouts.email.logo", "Logo in the header")}</label></div>
        <div className="bv-dl__field"><label htmlFor="mail-footer">{t("documentLayouts.email.footer", "Footer ({{companyName}}, {{address}}, {{licence}}, {{tin}})")}</label>
          <InputText id="mail-footer" value={mail.footerText || ""} maxLength={400} onChange={(e) => set("email", "footerText", e.target.value)} /></div>
        <Button type="button" label={t("documentLayouts.email.preview", "Show a sample e-mail")} icon="pi pi-envelope" className="p-button-outlined" onClick={preview} />
        {html && <iframe title="e-mail" className="bv-dl__email" sandbox="" srcDoc={html} />}
      </Section>
    </LayoutPage>
  );
};

export default EmailLayoutPage;
