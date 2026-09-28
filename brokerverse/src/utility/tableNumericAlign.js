/**
 * Right-align numeric table columns everywhere (amounts, counts, percentages, dates stay left).
 *
 * Screens build their tables in many different ways, so instead of touching every column definition
 * this watches the DOM: in each table, a column where most non-empty cells are numbers gets the class
 * "bv-num" on its cells and header. theme/bdoi/enterprise.scss aligns those right with tabular digits.
 */
const NUMERIC = /^[-+(]?\s*(?:[₱$€£¥฿]|PHP|USD|THB|EUR)?\s*-?[\d,]+(?:\.\d+)?\s*%?\)?$/i;
const MIN_SHARE = 0.6;

const cellText = (td) => (td.innerText || "").replace(/\s+/g, " ").trim();

const markTable = (table) => {
  const rows = table.querySelectorAll(":scope > tbody > tr:not(.p-datatable-emptymessage)");
  if (!rows.length) return;
  const stats = [];
  rows.forEach((tr) => {
    Array.from(tr.children).forEach((td, i) => {
      const text = cellText(td);
      if (!text) return;
      stats[i] = stats[i] || { filled: 0, numeric: 0 };
      stats[i].filled += 1;
      if (NUMERIC.test(text)) stats[i].numeric += 1;
    });
  });
  const headCells = table.querySelectorAll(":scope > thead > tr:last-child > th");
  stats.forEach((s, i) => {
    const numeric = s && s.filled > 0 && s.numeric / s.filled >= MIN_SHARE;
    rows.forEach((tr) => tr.children[i]?.classList.toggle("bv-num", numeric));
    headCells[i]?.classList.toggle("bv-num", numeric);
  });
};

let scheduled = false;
const scan = () => {
  scheduled = false;
  document.querySelectorAll(".main__content table").forEach(markTable);
};

export const startTableNumericAlign = () => {
  if (typeof window === "undefined" || !window.MutationObserver) return;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(scan);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  scan();
};
