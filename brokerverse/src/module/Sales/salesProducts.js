import { useEffect, useState } from "react";
import placementService from "../../services/placementService";
import { notifyError } from "../../utility/dialogs";

/** The new Request for Quotation (broker slip). */
export const RFQ_PATH = "/placement/broker-slips/new";

/**
 * The products Sales & Marketing offers are the active products of the Product master (Master > Product): a product
 * switched off there is not offered on any prospect or quotation chooser. Each product opens the screen it is quoted
 * on: motor products the prospect form and the motor quote wizard; Fire and Allied Perils, Industrial All Risks and
 * Employee Benefits their own forms (while those products are active); every other product a Request for Quotation
 * (broker slip), where the Processing Team gets the terms from the insurers.
 */
export const entryOf = (product) => {
  const lob = String(product?.lob || "").toUpperCase();
  if (lob === "MOTOR") return "motor";
  if (lob === "IAR") return "iar";
  if (lob === "EB") return "eb";
  if (String(product?.code || "").toUpperCase() === "FIRE") return "fire";
  return "rfq";
};

/**
 * Active products (null while loading); businessType "package" or "non_package" narrows them. enabled=false skips the
 * request for a user who is offered no product (the list stays empty).
 */
export const useSalesProducts = ({ businessType, enabled = true } = {}) => {
  const [products, setProducts] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    placementService
      .options(businessType ? { businessType } : {})
      .then((o) => alive && setProducts(o.products || []))
      .catch((e) => {
        notifyError(e.message);
        if (alive) setProducts([]);
      });
    return () => {
      alive = false;
    };
  }, [businessType, enabled]);
  return products;
};

const leadName = (lead) => lead?.companyName || [lead?.firstName, lead?.lastName].filter(Boolean).join(" ") || lead?.fullName || "";

/**
 * Router state of a new Request for Quotation for a product ({ id, name }; null: chosen on the request), with the
 * prospect (lead) or the existing client when known; newProspect opens the request on a new prospect's details.
 */
export const rfqState = (product, { lead = null, client = null, newProspect = false } = {}) => {
  const prefill = { productId: product?.id, productType: product?.name };
  if (lead) Object.assign(prefill, { leadRefId: lead.leadId || lead.id, leadName: leadName(lead) });
  else if (client) Object.assign(prefill, { clientId: client.clientId, clientName: client.displayName, clientCode: client.generatedClientId });
  else if (newProspect) prefill.newProspect = true;
  return { prefill };
};
