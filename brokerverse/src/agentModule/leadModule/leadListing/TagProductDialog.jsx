import React, { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import leadService from "../../../services/leadService";
import { ProductPickerDialog } from "../../../module/Sales/ProductPicker";
import { notifyError, notifySuccess } from "../../../utility/dialogs";

const nameOf = (lead) => lead?.fullName || [lead?.firstName, lead?.lastName].filter(Boolean).join(" ") || lead?.companyName || lead?.generatedLeadId || "";

/**
 * Tag product: the line of business and product of a prospect, tagged later or changed (each change is kept in the
 * audit trail). forQuote asks for the product before the first quotation of a prospect that has none.
 * onTagged(lead, product) receives the updated prospect.
 */
const TagProductDialog = ({ lead, visible, onHide, onTagged, forQuote = false }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const name = nameOf(lead);

  const save = async (product, lob) => {
    setBusy(true);
    const r = await leadService.tagProduct(lead.leadId || lead.id, { lob, productId: product.id });
    setBusy(false);
    if (!r.success) {
      notifyError(r.error);
      return;
    }
    notifySuccess(t("productPicker.tagged", { product: product.name }));
    onTagged(r.data?.data || r.data, product);
  };

  return (
    <ProductPickerDialog
      visible={visible && Boolean(lead)}
      onHide={onHide}
      onSelect={save}
      busy={busy}
      header={forQuote ? `${t("productPicker.quoteTitle")} · ${name}` : t("productPicker.tagTitle", { name })}
      confirmLabel={forQuote ? t("productPicker.continue") : t("productPicker.tagProduct")}
      value={lead ? { lob: lead.lob || null, productId: lead.productId ?? null } : null}
    />
  );
};

TagProductDialog.propTypes = {
  /** the prospect ({ leadId, lob, productId, firstName ... }) */
  lead: PropTypes.object,
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  onTagged: PropTypes.func.isRequired,
  forQuote: PropTypes.bool,
};

export default TagProductDialog;
