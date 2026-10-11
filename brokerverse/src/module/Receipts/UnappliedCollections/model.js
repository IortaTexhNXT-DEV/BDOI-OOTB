/** Unapplied collections: the row actions a user may take and the checks of an allocation. */

/** Actions of a row for a user with `perms` (write:receipts, reverse:receipts). */
export const unappliedActions = (row, perms = []) => {
  const can = (p) => perms.includes(p);
  const open = row.status === "open" && row.balance > 0;
  return [
    { code: "view", allowed: true },
    { code: "allocate", allowed: open && can("write:receipts") },
    { code: "refund", allowed: open && !!row.clientId && can("write:receipts") },
    { code: "reverse", allowed: open && !row.receiptId && row.balance === row.amount && can("reverse:receipts") },
  ].filter((a) => a.allowed);
};

/** null when the allocation can be sent, else the message key: nothing chosen, an amount above a bill or above the balance. */
export const allocationProblem = (lines, balance) => {
  const chosen = lines.filter((l) => Number(l.amount) > 0);
  if (!chosen.length) return "chooseBill";
  if (chosen.some((l) => Number(l.amount) > Number(l.billBalance) + 0.005)) return "aboveBill";
  const total = chosen.reduce((s, l) => s + Number(l.amount), 0);
  if (total > Number(balance) + 0.005) return "aboveBalance";
  return null;
};
