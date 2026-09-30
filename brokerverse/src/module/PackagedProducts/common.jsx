import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import placementService from "../../services/placementService";
import packagesService from "../../services/packagesService";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";

/** Product lines of the product master (the lines a tax rule can be limited to). */
export const PRODUCT_LINES = ["motor", "fire", "marine", "casualty", "accident", "engineering", "eb"];
export const TAX_REGIMES = ["vat", "premium_tax", "exempt"];
export const RULE_KINDS = ["vat", "premium_tax", "dst", "fst", "lgt", "other"];
export const RULE_METHODS = ["percent", "per_unit", "flat"];
export const RATE_BASES = ["percent", "per_mille", "flat"];
export const PAYMENT_METHODS = ["card", "gcash", "maya", "grabpay", "online_banking", "otc", "qrph"];

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Tag severity of package quotation, policy and payment link statuses. */
export const severityOf = (status) => {
  const s = String(status || "").toLowerCase();
  if (["issued", "paid", "applied", "active", "accepted"].includes(s)) return "success";
  if (["failed", "cancelled", "error", "expired"].includes(s)) return "danger";
  if (["pending", "review", "awaiting_issue", "draft"].includes(s)) return "warning";
  return "info";
};

export const StatusTag = ({ status, prefix = "packagedProducts.status" }) => {
  const { t } = useTranslation();
  return <Tag value={t(`${prefix}.${status}`, { defaultValue: status })} severity={severityOf(status)} />;
};

/** Insurers and products (Product master; package products when packageOnly) and active LGU tax rates, loaded once. */
export const usePackageOptions = ({ packageOnly = false } = {}) => {
  const [options, setOptions] = useState({ insurers: [], products: [], lgus: [], loaded: false });
  useEffect(() => {
    let alive = true;
    Promise.all([
      placementService.options(packageOnly ? { businessType: "package" } : {}).catch(() => ({ insurers: [], products: [] })),
      packagesService.listLguRates({ active: "true" }).catch(() => []),
    ]).then(([o, lgus]) => alive && setOptions({ insurers: o.insurers || [], products: o.products || [], lgus: lgus || [], loaded: true }));
    return () => {
      alive = false;
    };
  }, [packageOnly]);
  return options;
};

export const lguOptions = (lgus) => (lgus || []).map((l) => ({ label: `${l.name} (${l.rate}%)`, value: l.code }));

/**
 * Premium, the taxes and charges line by line and the total, as the tax engine computed them (charge lines from the
 * server: { code, name, rate, amount }).
 */
export const ChargesBreakdown = ({ premium, discount, lines, total, basePremium, discountPercent }) => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  return (
    <table className="pkg-breakdown">
      <tbody>
        {discount ? (
          <>
            <tr><td>{t("packagedProducts.breakdown.basePremium")}</td><td className="num">{formatCurrency(basePremium)}</td></tr>
            <tr><td>{t("packagedProducts.breakdown.discount", { percent: discountPercent })}</td><td className="num">-{formatCurrency(discount)}</td></tr>
          </>
        ) : null}
        <tr><td>{t("packagedProducts.breakdown.premium")}</td><td className="num">{formatCurrency(premium)}</td></tr>
        {(lines || []).map((l) => (
          <tr key={l.code}>
            <td>{l.name}{l.rate ? <span className="muted"> ({l.rate}%)</span> : null}</td>
            <td className="num">{formatCurrency(l.amount)}</td>
          </tr>
        ))}
        <tr className="total"><td>{t("packagedProducts.breakdown.total")}</td><td className="num">{formatCurrency(total)}</td></tr>
      </tbody>
    </table>
  );
};

/** Copy text to the clipboard (payment links). */
export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
