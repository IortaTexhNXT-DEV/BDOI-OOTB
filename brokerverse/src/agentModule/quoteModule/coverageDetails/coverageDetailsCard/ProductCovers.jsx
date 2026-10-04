import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Checkbox } from "primereact/checkbox";
import { Tag } from "primereact/tag";

/**
 * Covers of the product template governing the quotation (Product Configurator > Coverage Builder): mandatory covers
 * are always included; optional covers are added or removed here, and each is priced on the quotation premium of its
 * "Priced on quotation as" setting. The server prices the quotation on the same choice (selectedCovers).
 */
const ProductCovers = ({ setup, isSelected, onToggle }) => {
  const { t } = useTranslation();
  const covers = setup?.covers || [];
  if (!covers.length) return null;
  return (
    <div className="mb-3">
      <div className="coverage__details__card__container__sub__title mt-2 mb-1">{t("quoteRisk.coversTitle")}</div>
      <p className="mt-0 mb-2" style={{ fontSize: 13 }}>{t("quoteRisk.coversIntro", { template: setup.templateName || setup.templateCode })}</p>
      <div className="grid m-0">
        {covers.map((c) => {
          const mandatory = c.type === "Mandatory";
          const id = `cover-${c.code}`;
          return (
            <div key={c.code} className="col-12 md:col-6 lg:col-4 flex align-items-center gap-2">
              <Checkbox inputId={id} checked={mandatory || isSelected(c)} disabled={mandatory} onChange={(e) => onToggle(c, e.checked)} />
              <label htmlFor={id} className="m-0">{c.name}</label>
              <Tag severity={mandatory ? "info" : "secondary"} value={mandatory ? t("quoteRisk.mandatory") : t("quoteRisk.optional")} />
              {!c.quoteField && <Tag severity="warning" value={t("quoteRisk.notPriced")} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

ProductCovers.propTypes = {
  setup: PropTypes.object,
  isSelected: PropTypes.func.isRequired,
  onToggle: PropTypes.func.isRequired,
};

export default ProductCovers;
