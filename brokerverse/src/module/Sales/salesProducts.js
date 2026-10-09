import { useEffect, useState } from "react";
import placementService from "../../services/placementService";
import systemSettingsService from "../../services/systemSettingsService";
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

/**
 * Products grouped by line of business for the product pickers (null while loading): the active lines of the Line of
 * Business master that have active products, Motor first, each with its active products ({ id, code, name, line, lob,
 * businessType, customerSegment }). businessType "package" or "non_package" narrows the products.
 */
export const useProductLines = ({ businessType, enabled = true } = {}) => {
  const [lines, setLines] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    placementService
      .productLines(businessType ? { businessType } : {})
      .then((l) => alive && setLines(l))
      .catch((e) => {
        notifyError(e.message);
        if (alive) setLines([]);
      });
    return () => {
      alive = false;
    };
  }, [businessType, enabled]);
  return lines;
};

/** The product of the lines with this id (null when none). */
export const productOf = (lines, id) =>
  id === null || id === undefined ? null : (lines || []).flatMap((l) => l.products).find((p) => String(p.id) === String(id)) || null;

/**
 * The line a { lob, productId } value belongs to: the line of its product, else the line whose code is the lob, else
 * the line with a product quoted under that lob (IAR is a product of the fire line).
 */
export const lineOf = (lines, { lob, productId } = {}) => {
  const all = lines || [];
  const byProduct = all.find((l) => l.products.some((p) => productId !== null && productId !== undefined && String(p.id) === String(productId)));
  if (byProduct || !lob) return byProduct || null;
  const code = String(lob).toUpperCase();
  return all.find((l) => l.code === code) || all.find((l) => l.products.some((p) => p.lob === code)) || null;
};

/** Lines narrowed to the products a screen offers (lines left without a product are dropped). */
export const narrowLines = (lines, keep) =>
  !lines || !keep ? lines : lines.map((l) => ({ ...l, products: l.products.filter(keep) })).filter((l) => l.products.length);

/**
 * Line of business choices of the screens that match prospects by line (lead assignment rules, campaign segments):
 * each line, then the quoting line of a product that differs from its line (Industrial All Risks: IAR).
 */
export const lobChoices = (lines) => {
  const out = (lines || []).map((l) => ({ value: l.code, label: l.name }));
  for (const l of lines || []) {
    for (const p of l.products) if (p.lob && !out.some((o) => o.value === p.lob)) out.push({ value: p.lob, label: `${l.name} - ${p.name}` });
  }
  return out;
};

/** Whether a prospect still waits for its product (Create Prospect > Skip - tag product later). */
export const isUntagged = (lead) => Boolean(lead?.leadId || lead?.id) && !lead.lob;

/** leads.product_required (System Settings, group leads): a new prospect must name its product (no Skip). */
export const useProductRequired = () => {
  const [required, setRequired] = useState(false);
  useEffect(() => {
    let alive = true;
    systemSettingsService
      .getConfiguration("leads")
      .then((rows) => alive && setRequired((rows || []).some((r) => r.key === "leads.product_required" && String(r.value) === "true")))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return required;
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
