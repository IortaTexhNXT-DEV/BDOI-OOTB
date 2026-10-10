import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { formatInstant } from "../../utility/dateFormat";
import { currentUser, displayNameOf } from "../../utility/userIdentity";
import { useLetterhead } from "./letterhead";

/**
 * A page printed from the browser, on the letterhead of the documents theme (Master > System Configuration > Documents
 * and Reports Layout): logo, company, address, TIN and licence, contact; then the title and number, the content, and
 * the footer line of the theme with who printed it and when.
 *
 *   printView(<PrintableDocument title={adviceTitle} number={r.remittanceNo}>
 *     <KeyValueGrid columns={3} items={...} />
 *   </PrintableDocument>);
 */
const PrintableDocument = ({ title, number, letterhead, children }) => {
  const { t } = useTranslation();
  const lh = useLetterhead(letterhead);
  const docs = lh?.documents || {};
  // the colours of the documents theme, read by print.scss
  const colours = Object.fromEntries(
    Object.entries({
      "--bv-doc-accent": docs.accent,
      "--bv-doc-heading": docs.headingColor,
      "--bv-doc-heading-bg": docs.headingBg,
      "--bv-doc-table-head-bg": docs.tableHeaderBg,
      "--bv-doc-table-head-text": docs.tableHeaderText,
    }).filter(([, v]) => v)
  );
  const registration = [lh?.tin ? t("print.tin", { tin: lh.tin }) : null, lh?.licence].filter(Boolean).join(" · ");
  const contact = [lh?.phone, lh?.email, lh?.website].filter(Boolean).join(" · ");
  return (
    <article className="bv-print-doc" style={colours}>
      {lh ? (
        <header className="bv-print-doc__letterhead">
          {lh.logo && docs.showLogo !== false ? <img className="bv-print-doc__logo" src={lh.logo} alt={lh.name} style={{ height: docs.logoHeight || undefined }} /> : null}
          <div className="bv-print-doc__company">
            <strong>{lh.name}</strong>
            {(lh.addressLines || []).map((line) => <span key={line}>{line}</span>)}
            {registration ? <span>{registration}</span> : null}
            {contact ? <span>{contact}</span> : null}
          </div>
        </header>
      ) : null}
      <div className="bv-print-doc__title">
        <h1>{title}</h1>
        {number ? <span>{t("print.number", { number })}</span> : null}
      </div>
      <div className="bv-print-doc__content">{children}</div>
      <footer className="bv-print-doc__footer">
        <span>{docs.footerText || ""}</span>
        <span>{t("print.printedBy", { at: formatInstant(new Date()), name: displayNameOf(currentUser()) })}</span>
      </footer>
    </article>
  );
};

PrintableDocument.propTypes = {
  title: PropTypes.node.isRequired,
  number: PropTypes.string,
  /** the letterhead when the screen has it; else printView's, else loaded */
  letterhead: PropTypes.shape({
    name: PropTypes.string,
    addressLines: PropTypes.arrayOf(PropTypes.string),
    tin: PropTypes.string,
    licence: PropTypes.string,
    phone: PropTypes.string,
    email: PropTypes.string,
    website: PropTypes.string,
    logo: PropTypes.string,
    documents: PropTypes.object,
  }),
  children: PropTypes.node,
};

PrintableDocument.defaultProps = { number: null, letterhead: undefined, children: null };

export default PrintableDocument;
