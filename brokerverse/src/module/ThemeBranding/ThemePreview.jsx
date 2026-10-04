/**
 * Live preview of a theme that is not saved yet: application header, side bar, a list with its table header,
 * buttons and a link, the header of a printed document and the sign-in page. The theme's CSS variables are set on
 * the preview box only (themeEngine.previewStyle), not on the page.
 */
import React from "react";
import { previewStyle } from "../../theme/runtime/themeEngine";
import LoginArt from "../../theme/runtime/LoginArt";

const ROWS = [
  ["MC-2026-00045", "Juan Dela Cruz", "Motor", "22,721.25"],
  ["FI-2026-00012", "Santos Trading Corp.", "Fire", "148,300.00"],
  ["PA-2026-00007", "Maria Reyes", "Personal accident", "3,450.00"],
];

const ThemePreview = ({ theme, fontStack, logoUrl, systemName, companyName, documentBranding, t }) => {
  const style = { ...previewStyle(theme, fontStack), fontFamily: "var(--bv-font-family)" };
  const doc = theme.documents || {};
  const accent = doc.accentColor || documentBranding?.accent || "#1f4e79";
  const headingColor = doc.headingColor || accent;
  const docTable = doc.tableHeaderBg || accent;
  const login = theme.login || {};
  return (
    <div className="bv-tp" style={style} data-testid="theme-preview" data-density={theme.layout?.density || "comfortable"}>
      <div className="bv-tp__app">
        <aside className="bv-tp__sidebar">
          {logoUrl ? <img src={logoUrl} alt="" className="bv-tp__logo" /> : <strong>{systemName}</strong>}
          {["Dashboard", "My Work", "Policies", "Claims", "Accounts"].map((m, i) => (
            <div key={m} className={`bv-tp__menu${i === 2 ? " bv-tp__menu--active" : ""}`}>{m}</div>
          ))}
        </aside>
        <div className="bv-tp__main">
          <header className="bv-tp__header">
            <span>{t("themeBranding.preview.pageTitle", "Policies")}</span>
            <span className="bv-tp__user">AB</span>
          </header>
          <div className="bv-tp__content">
            <h3 className="bv-tp__h">{t("themeBranding.preview.listTitle", "Policy list")}</h3>
            <table className="bv-tp__table">
              <thead><tr><th>Policy no.</th><th>Insured</th><th>Product</th><th className="num">Premium</th></tr></thead>
              <tbody>{ROWS.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={c} className={i === 3 ? "num" : ""}>{c}</td>)}</tr>)}</tbody>
            </table>
            <div className="bv-tp__buttons">
              <button type="button" className="bv-tp__btn">{t("themeBranding.preview.primary", "Save")}</button>
              <button type="button" className="bv-tp__btn bv-tp__btn--outline">{t("themeBranding.preview.secondary", "Cancel")}</button>
              <span className="bv-tp__link">{t("themeBranding.preview.link", "View details")}</span>
              <span className="bv-tp__focus">{t("themeBranding.preview.focus", "Focused field")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bv-tp__row">
        <div className="bv-tp__doc" aria-label={t("themeBranding.preview.document", "Document header")}>
          <div className="bv-tp__doc-head">
            <div className="bv-tp__doc-co">
              {doc.showLogo !== false && logoUrl && <img src={logoUrl} alt="" style={{ height: Math.round((theme.logo?.documentHeight || 46) * 0.6) }} />}
              <div>
                <strong>{companyName || systemName}</strong>
                <small>TIN 000-000-000-000 | IC Licence No. 0000</small>
              </div>
            </div>
            <div className="bv-tp__doc-title" style={{ color: headingColor }}>Policy Schedule<br /><small>No. MC-2026-00045</small></div>
          </div>
          <div className="bv-tp__doc-rule" style={{ background: accent }} />
          <div className="bv-tp__doc-section" style={{ background: doc.headingBg || "#e9eff5", color: headingColor, borderLeftColor: accent }}>Premium (PHP)</div>
          <div className="bv-tp__doc-th" style={{ background: docTable, color: doc.tableHeaderText || "#ffffff" }}><span>Item</span><span>Amount</span></div>
          <div className="bv-tp__doc-foot">{(doc.footerText || "").replace(/\{\{\s*licen[cs]e\s*\}\}/g, "0000").replace(/\{\{\s*\w+\s*\}\}/g, "")}</div>
        </div>
        <div className="bv-tp__login" aria-label={t("themeBranding.preview.login", "Sign-in page")}>
          <LoginArt theme={theme} preview />
          <div className="bv-tp__login-form">
            {logoUrl && <img src={logoUrl} alt="" />}
            <strong>{login.headline || `Sign in to ${systemName || "BrokerVerse"}`}</strong>
            {login.tagline && <small>{login.tagline}</small>}
            <span className="bv-tp__field" />
            <span className="bv-tp__field" />
            <button type="button" className="bv-tp__btn">Sign in</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemePreview;
