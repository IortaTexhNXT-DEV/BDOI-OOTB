/**
 * One column layout for every table: numbers right-aligned, dates on one line, row actions at the right edge.
 *
 * Screens build their tables in many different ways, so instead of touching every column definition this watches the
 * DOM and classifies each column of each table from its cells:
 *  - "bv-num": most non-empty cells are numbers (amounts, counts, percentages): right-aligned, tabular digits;
 *  - "bv-date": most non-empty cells are dates (or date ranges, with or without a time): never wrap;
 *  - "bv-code": most non-empty cells are document numbers or codes (POL-2026-00001): never wrap;
 *  - "bv-actions": every cell holds only buttons or icons and no text: narrow, at the right, on one line.
 * It also marks a new table that is still waiting for its first rows ("bv-awaiting", below).
 * theme/bdoi/enterprise.scss styles those classes.
 */
const NUMERIC = /^[-+(]?\s*(?:[₱$€£¥฿]|PHP|USD|THB|EUR)?\s*-?[\d,]+(?:\.\d+)?\s*%?\)?$/i;
const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?";
const ONE_DATE = `(?:\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2} ${MONTH},? \\d{4}|${MONTH} \\d{1,2},? \\d{4})(?:,?\\s+\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s*[AP]M)?)?`;
const DATE = new RegExp(`^${ONE_DATE}(?:\\s*(?:-|–|to)\\s*${ONE_DATE})?(?:\\s*\\(\\d+\\))?$`, "i");
// document numbers and codes: POL-2026-00001, OR-2026-00006, CL-2026-00019, JV01
const CODE = /^[A-Z][A-Z0-9]{0,7}(?:[-/][A-Z0-9]{1,10}){1,4}$/;
// mobile and landline numbers (09171234567, +639171234567) are text, not amounts
const PHONE = /^(?:\+?63|0)\d{9,10}$/;
const MIN_SHARE = 0.6;

const cellText = (td) => (td.innerText || "").replace(/\s+/g, " ").trim();
const onlyControls = (td) => !cellText(td) && !!td.querySelector("button, a, .pi, svg");

/** Classify one cell text: "num", "date", "code" or null. */
export const kindOfText = (text) => {
  if (!text) return null;
  if (DATE.test(text)) return "date";
  if (PHONE.test(text)) return null;
  if (NUMERIC.test(text)) return "num";
  if (CODE.test(text)) return "code";
  return null;
};

const markTable = (table) => {
  const rows = table.querySelectorAll(":scope > tbody > tr:not(.p-datatable-emptymessage)");
  if (!rows.length) return;
  const stats = [];
  rows.forEach((tr) => {
    Array.from(tr.children).forEach((td, i) => {
      stats[i] = stats[i] || { filled: 0, num: 0, date: 0, code: 0, controls: 0, cells: 0 };
      const s = stats[i];
      s.cells += 1;
      if (onlyControls(td)) s.controls += 1;
      const text = cellText(td);
      if (!text) return;
      s.filled += 1;
      const kind = kindOfText(text);
      if (kind) s[kind] += 1;
    });
  });
  const headCells = table.querySelectorAll(":scope > thead > tr:last-child > th");
  stats.forEach((s, i) => {
    const numeric = !!s && s.filled > 0 && s.num / s.filled >= MIN_SHARE;
    const date = !!s && !numeric && s.filled > 0 && s.date / s.filled >= MIN_SHARE;
    const code = !!s && !numeric && !date && s.filled > 0 && s.code / s.filled >= MIN_SHARE;
    // the last column of buttons only (not a selection checkbox column at the start)
    const actions = !!s && i > 0 && s.filled === 0 && s.controls === s.cells && i === stats.length - 1;
    const mark = (el) => {
      if (!el) return;
      el.classList.toggle("bv-num", numeric);
      el.classList.toggle("bv-date", date);
      el.classList.toggle("bv-code", code);
      el.classList.toggle("bv-actions", actions);
    };
    rows.forEach((tr) => mark(tr.children[i]));
    mark(headCells[i]);
  });
};

// How long a new, still empty table waits for its first rows before it shows its headings and "No records".
export const FIRST_LOAD_MS = 1500;

let scheduled = false;

/**
 * First load of a table: while a new table has no rows yet (for at most FIRST_LOAD_MS), it carries "bv-awaiting":
 * its headings (whose widths change with the data), the "No records" line and the paginator stay invisible, and a
 * paged list holds the height its rows will need, so the table appears once, complete, instead of being drawn empty
 * and then re-laid out under the user's eyes.
 */
const markFirstLoad = (dt, now) => {
  const hasRows = !!dt.querySelector(":scope > .p-datatable-wrapper > table > tbody > tr:not(.p-datatable-emptymessage)");
  if (hasRows || dt.dataset.bvLoaded) {
    dt.dataset.bvLoaded = "1";
    dt.classList.remove("bv-awaiting");
    return;
  }
  if (!dt.dataset.bvSince) {
    dt.dataset.bvSince = String(now);
    // look again when the wait is over, even if nothing else changes on the page
    window.setTimeout(() => window.requestAnimationFrame(scan), FIRST_LOAD_MS + 20);
  }
  const waiting = now - Number(dt.dataset.bvSince) < FIRST_LOAD_MS;
  if (!waiting) dt.dataset.bvLoaded = "1";
  dt.classList.toggle("bv-awaiting", waiting);
};

function scan() {
  scheduled = false;
  const now = Date.now();
  document.querySelectorAll(".main__content .p-datatable").forEach((dt) => markFirstLoad(dt, now));
  document.querySelectorAll(".main__content table").forEach(markTable);
}

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
