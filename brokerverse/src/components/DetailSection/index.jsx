/**
 * A titled section of a detail view: a card with its heading and, at the right, the section's own actions. Detail
 * pop-ups stack sections in one view rather than spreading a few lines over tabs; a list says how many rows it has
 * itself, so the heading carries no count.
 *
 *   <DetailSection title={t("remittance.policies")} flush actions={<Button label={t("remittance.export")} text />}>
 *     <DataTable value={r.policies} ... />
 *   </DetailSection>
 */
import React, { useId } from "react";
import PropTypes from "prop-types";
import "./detailSection.scss";

const DetailSection = ({ title, actions, flush, className, children }) => {
  const headingId = useId();
  return (
    <section className={["bv-section", className].filter(Boolean).join(" ")} aria-labelledby={title ? headingId : undefined}>
      {title || actions ? (
        <header className="bv-section__head">
          {title ? <h3 id={headingId} className="bv-section__title">{title}</h3> : <span />}
          {actions ? <div className="bv-section__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={flush ? "bv-section__body bv-section__body--flush" : "bv-section__body"}>{children}</div>
    </section>
  );
};

DetailSection.propTypes = {
  title: PropTypes.node,
  actions: PropTypes.node,
  /** no padding around the content (a table that runs edge to edge) */
  flush: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

DetailSection.defaultProps = { title: null, actions: null, flush: false, className: null, children: null };

export default DetailSection;
