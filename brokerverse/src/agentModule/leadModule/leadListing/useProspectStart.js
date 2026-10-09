import { useNavigate } from "react-router-dom";
import { RFQ_PATH, entryOf, rfqState, useProductRequired } from "../../../module/Sales/salesProducts";

/** The prospect forms of the products that have one; any other product is quoted through a Request for Quotation. */
const FORMS = {
  motor: "/agent/createlead",
  fire: "/agent/createlead/fire-allied-perils",
  iar: "/agent/createlead/iar",
  eb: "/agent/createlead/employee-benefit",
};

/** Router state of a prospect form opened from the Create prospect choice (the gate of the forms lets it through). */
export const prospectFormState = ({ product = null, client = null, untagged = false } = {}) => ({
  ...(client ? { existingClient: client } : {}),
  ...(product ? { product: { lob: product.lob, productId: product.id } } : {}),
  ...(untagged ? { untagged: true } : {}),
});

/** Whether a prospect form was opened with the Create prospect choice made, or for an existing prospect. */
export const prospectChosen = (state) =>
  Boolean(state && (state.product || state.untagged || state.leadId || state.leadRefId || state.lead || state.isEdit));

/**
 * Every new prospect starts the same way (Create prospect: new customer or existing client, then the line of business
 * and product, or Skip - tag product later unless leads.product_required): openProduct opens the screen the product
 * is quoted on, skipProduct the prospect form without a product.
 */
const useProspectStart = () => {
  const navigate = useNavigate();
  const productRequired = useProductRequired();
  const openProduct = (product, client = null, options = {}) => {
    const form = FORMS[entryOf(product)];
    if (form) navigate(form, { ...options, state: prospectFormState({ product, client }) });
    else navigate(RFQ_PATH, { ...options, state: rfqState(product, { client, newProspect: !client }) });
  };
  const skipProduct = (client = null, options = {}) => navigate(FORMS.motor, { ...options, state: prospectFormState({ client, untagged: true }) });
  return { openProduct, skipProduct, productRequired };
};

export default useProspectStart;
