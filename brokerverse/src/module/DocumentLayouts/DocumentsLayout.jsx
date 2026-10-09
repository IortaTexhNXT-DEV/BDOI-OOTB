/**
 * Master > System Configuration > Documents and Reports Layout: the print colours, logo, footer lines and Excel header
 * of every printed document (quotation, policy schedule, slips, endorsement, receipts, billing statements, vouchers,
 * debit notes, claim letters) and every report file, with a sample PDF printed with the values being edited.
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { InputSwitch } from "primereact/inputswitch";
import { InputNumber } from "primereact/inputnumber";
import brandingService from "../../services/brandingService";
import { ColorField, LayoutPage, Section, useBrandingTheme, useNotify } from "./common";

const DocumentsLayoutPage = () => {
  const { t } = useTranslation();
  const { toast, notify } = useNotify();
  const { editor, theme, errors, saving, set, discard, save } = useBrandingTheme(notify);
  const [printing, setPrinting] = useState(false);

  const sample = async () => {
    setPrinting(true);
    try {
      const pdf = await brandingService.previewDocument(theme);
      window.open(URL.createObjectURL(pdf), "_blank", "noopener");
    } catch (e) {
      notify("error", t("common.error", "Error"), e.message);
    } finally {
      setPrinting(false);
    }
  };

  const title = t("documentLayouts.documents.title", "Documents and Reports Layout");
  const lead = t("documentLayouts.documents.lead", "Every printed document (quotation, policy schedule, slips, endorsement, receipts, billing statements, vouchers, debit notes, claim letters) and every report PDF / Excel file uses these values, with the logo, legal name, TIN, licence and address of the primary company (Master > Company). Empty colours follow the document accent.");
  if (!theme) return <LayoutPage title={title} lead={lead} toast={toast}><p>{t("common.loading", "Loading...")}</p></LayoutPage>;
  const doc = theme.documents || {};
  const actions = (
    <>
      <Button label={t("documentLayouts.documents.sample", "Sample document")} icon="pi pi-file-pdf" className="p-button-outlined" onClick={sample} loading={printing} />
      <Button label={t("documentLayouts.discard", "Discard changes")} icon="pi pi-undo" className="p-button-text" onClick={discard} />
      <Button label={t("common.save", "Save")} icon="pi pi-check" onClick={save} loading={saving} disabled={errors.length > 0} data-testid="save-documents-layout" />
    </>
  );
  return (
    <LayoutPage title={title} lead={lead} actions={actions} errors={errors} toast={toast}>
      <Section title={t("documentLayouts.documents.colours", "Print colours")}>
        <div className="bv-dl__grid">
          <ColorField id="doc-accent" label={t("documentLayouts.documents.accent", "Accent (rules, marker)")} value={doc.accentColor} allowEmpty emptyLabel={editor.documentBranding?.accent} onChange={(v) => set("documents", "accentColor", v)} />
          <ColorField id="doc-heading" label={t("documentLayouts.documents.heading", "Titles and section headings")} value={doc.headingColor} allowEmpty emptyLabel="=" against={doc.headingBg} onChange={(v) => set("documents", "headingColor", v)} />
          <ColorField id="doc-heading-bg" label={t("documentLayouts.documents.headingBg", "Section heading band")} value={doc.headingBg} onChange={(v) => set("documents", "headingBg", v)} />
          <ColorField id="doc-th" label={t("documentLayouts.documents.tableHeader", "Table header")} value={doc.tableHeaderBg} allowEmpty emptyLabel="=" onChange={(v) => set("documents", "tableHeaderBg", v)} />
          <ColorField id="doc-th-text" label={t("documentLayouts.documents.tableHeaderText", "Table header text")} value={doc.tableHeaderText} against={doc.tableHeaderBg || doc.accentColor} onChange={(v) => set("documents", "tableHeaderText", v)} />
          <div className="bv-dl__field"><label htmlFor="doc-logo-height">{t("documentLayouts.documents.logoHeight", "Logo height on documents (pt)")}</label>
            <InputNumber inputId="doc-logo-height" value={theme.logo?.documentHeight} min={24} max={80} onValueChange={(e) => set("logo", "documentHeight", e.value)} showButtons /></div>
        </div>
        <div className="bv-dl__field bv-dl__switch"><InputSwitch inputId="doc-logo" checked={doc.showLogo !== false} onChange={(e) => set("documents", "showLogo", e.value)} />
          <label htmlFor="doc-logo">{t("documentLayouts.documents.showLogo", "Print the logo on documents")}</label></div>
      </Section>
      <Section title={t("documentLayouts.documents.footers", "Footer lines")}>
        <div className="bv-dl__field"><label htmlFor="doc-footer">{t("documentLayouts.documents.footerText", "Footer on every document and report ({{licence}}, {{tin}}, {{companyName}})")}</label>
          <InputTextarea id="doc-footer" rows={2} value={doc.footerText || ""} maxLength={300} onChange={(e) => set("documents", "footerText", e.target.value)} autoResize /></div>
        <div className="bv-dl__field"><label htmlFor="doc-report-footer">{t("documentLayouts.documents.reportFooterText", "Extra line on report files (optional)")}</label>
          <InputText id="doc-report-footer" value={doc.reportFooterText || ""} maxLength={300} onChange={(e) => set("documents", "reportFooterText", e.target.value)} /></div>
      </Section>
      <Section title={t("documentLayouts.documents.excel", "Excel report files")}>
        <div className="bv-dl__grid">
          <ColorField id="xl-bg" label={t("documentLayouts.documents.excelHeaderBg", "Header row")} value={doc.excelHeaderBg} onChange={(v) => set("documents", "excelHeaderBg", v)} />
          <ColorField id="xl-text" label={t("documentLayouts.documents.excelHeaderText", "Header row text")} value={doc.excelHeaderText} against={doc.excelHeaderBg} onChange={(v) => set("documents", "excelHeaderText", v)} />
        </div>
        <div className="bv-dl__field bv-dl__switch"><InputSwitch inputId="xl-logo" checked={!!doc.excelLogo} onChange={(e) => set("documents", "excelLogo", e.value)} />
          <label htmlFor="xl-logo">{t("documentLayouts.documents.excelLogo", "Logo and company banner above the table (the header row moves down)")}</label></div>
      </Section>
    </LayoutPage>
  );
};

export default DocumentsLayoutPage;
