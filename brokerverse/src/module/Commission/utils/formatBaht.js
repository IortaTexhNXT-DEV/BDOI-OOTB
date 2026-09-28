/** Format amounts as ฿-prefixed values to match commission mockups. */
export const formatBaht = (amount, { decimals } = {}) => {
  const n = Number(amount);
  if (Number.isNaN(n)) return "฿0";
  const fractionDigits =
    decimals !== undefined ? decimals : Number.isInteger(n) ? 0 : 2;
  return (
    "฿" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  );
};
