import { formatCurrency } from "../../utility/currencyConverter";

/**
 * Period choice, amounts and files of Accounts > Period End > Financial Statements.
 *
 * A choice is { fiscalYear, period, view, from, to } over the fiscal calendar of GET /period-end/statements/periods.
 * Income statement and trial balance cover a range (view month, quarter, ytd or custom: from / to); the balance sheet
 * is as of a date (the end of the period, or the custom date `to`).
 */
export const RANGE_VIEWS = ["month", "quarter", "ytd", "custom"];
export const DATE_VIEWS = ["periodEnd", "custom"];

export const fiscalYearOf = (calendar, code) => (calendar?.fiscalYears || []).find((f) => f.code === code) || null;
export const periodOf = (calendar, code, period) => (fiscalYearOf(calendar, code)?.periods || []).find((p) => p.period === period) || null;

/** The choice a screen starts with: the current period of the calendar, month view. */
export const defaultChoice = (calendar) => {
  const fy = calendar?.current?.fiscalYear || calendar?.fiscalYears?.[0]?.code || null;
  const year = fiscalYearOf(calendar, fy);
  const period = calendar?.current?.period || year?.periods?.[year.periods.length - 1]?.period || null;
  return { fiscalYear: fy, period, view: "month", from: null, to: null };
};

/**
 * Dates of a choice for a statement type: { from, to } (from null for the balance sheet), with `quarter` (1-4) for the
 * quarter view; { error: "required" | "range" } when a custom range is incomplete or ends before it starts.
 * Quarter: from the first day of the fiscal quarter of the period to the end of the period.
 */
export function rangeOf(calendar, choice, type) {
  const asOf = type === "balance-sheet";
  if (choice.view === "custom") {
    if (asOf) return choice.to ? { from: null, to: choice.to } : { error: "required" };
    if (!choice.from || !choice.to) return { error: "required" };
    if (choice.from > choice.to) return { error: "range" };
    return { from: choice.from, to: choice.to };
  }
  const year = fiscalYearOf(calendar, choice.fiscalYear);
  const p = periodOf(calendar, choice.fiscalYear, choice.period);
  if (!p) return { error: "required" };
  if (asOf) return { from: null, to: p.endDate };
  if (choice.view === "quarter") {
    const quarter = Math.ceil(p.periodNo / 3);
    const first = year.periods.find((x) => x.periodNo === quarter * 3 - 2) || p;
    return { from: first.startDate, to: p.endDate, quarter };
  }
  if (choice.view === "ytd") return { from: year.periods[0]?.startDate || year.startDate, to: p.endDate };
  return { from: p.startDate, to: p.endDate };
}

/** "October 2026" for a period code 2026-10, in the language of the screen (Gregorian years). */
export const monthName = (period, language = "en") => {
  const [y, m] = String(period || "").split("-").map(Number);
  if (!y || !m) return "";
  try {
    return new Intl.DateTimeFormat(`${language}-u-ca-gregory`, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  } catch {
    return period;
  }
};

const monthEnd = (iso) => {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/**
 * Short text of a range of whole months: "October 2026", "Apr – Oct 2026", "Oct 2025 – Mar 2026"; null when the range
 * does not start on the first day of a month and end on the last day of one.
 */
export const monthsText = (from, to, language = "en") => {
  if (!from || !to || from.slice(8) !== "01" || monthEnd(to) !== to) return null;
  if (from.slice(0, 7) === to.slice(0, 7)) return monthName(to.slice(0, 7), language);
  const fmt = (iso, opts) => {
    try {
      return new Intl.DateTimeFormat(`${language}-u-ca-gregory`, { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
    } catch {
      return iso.slice(0, 7);
    }
  };
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${fmt(from, sameYear ? { month: "short" } : { month: "short", year: "numeric" })} – ${fmt(to, { month: "short", year: "numeric" })}`;
};

/** An amount of a statement: the peso format, a negative amount in parentheses. */
export const statementAmount = (value) => {
  const n = Number(value) || 0;
  return n < 0 ? `(${formatCurrency(-n)})` : formatCurrency(n);
};

/** A ledger balance with its side: "₱6,826.35 Cr" (debit-positive input). */
export const sidedAmount = (value, { dr = "Dr", cr = "Cr" } = {}) => {
  const n = Math.round((Number(value) || 0) * 100) / 100;
  if (!n) return formatCurrency(0);
  return `${formatCurrency(Math.abs(n))} ${n > 0 ? dr : cr}`;
};

/** Save a file the browser received. */
export const saveBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

/** Open the browser's print dialog for a PDF without leaving the page (a hidden frame); a new tab when that is blocked. */
export const printBlob = (blob) => {
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.title = "print";
  Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };
  frame.src = url;
  document.body.appendChild(frame);
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 120000);
};
