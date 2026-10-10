/**
 * Accounting Flow: the rules of the screen, without React. The data is GET /posting-rules/flow: the business events
 * (and the other system journals) grouped by module, each with its lines and the account every line resolves to.
 */

/** The events and the other system journals, in module order. */
export const allEvents = (data) => [...(data?.events || []), ...(data?.systemJournals || [])];

const fold = (text) => String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Every GL account a line of the event may post to: its own, its fallback and the accounts of its map. */
export const eventAccounts = (event) => {
  const codes = new Set();
  for (const l of event.lines || []) {
    const a = l.account || {};
    [a.glCode, a.fallback?.glCode, ...(a.options || []).map((o) => o.glCode)].filter(Boolean).forEach((c) => codes.add(c));
  }
  return codes;
};

/** Options of the Account filter: every account a line posts to, as "210245 Accounts Payable - Insurance Company". */
export const accountOptions = (data) => {
  const names = new Map();
  for (const e of allEvents(data)) {
    for (const l of e.lines || []) {
      const a = l.account || {};
      [[a.glCode, a.glName], [a.fallback?.glCode, a.fallback?.glName], ...(a.options || []).map((o) => [o.glCode, o.glName])]
        .filter(([code]) => code)
        .forEach(([code, name]) => { if (!names.get(code)) names.set(code, name || ""); });
    }
  }
  return [...names.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([code, name]) => ({ value: code, label: name ? `${code} ${name}` : code }));
};

/** The words an event is found by: name, when, where, approval, accounts and amounts; the event code matches too. */
const searchText = (e) => fold([e.label, e.eventCode, e.summary, e.when, e.where, e.approval,
  ...(e.lines || []).flatMap((l) => [l.amount, l.account?.source, l.account?.glCode, l.account?.glName, l.account?.fallback?.glCode,
    ...(l.account?.options || []).flatMap((o) => [o.name, o.glCode, o.glName])])].filter(Boolean).join(" "));

/** True when a line of the event posts to an account still to be mapped (provisional, outside the chart or inactive). */
export const hasMappingPending = (e) => !!e.mappingPending;

/** Events matching the filters: search text, modules, an account posted to, mapping pending only. */
export const filterEvents = (data, { q = "", modules = [], account = null, pending = false } = {}) => {
  const words = fold(q).split(/\s+/).filter(Boolean);
  return allEvents(data).filter((e) => (!modules.length || modules.includes(e.area))
    && (!account || eventAccounts(e).has(account))
    && (!pending || hasMappingPending(e))
    && (!words.length || words.every((w) => searchText(e).includes(w))));
};

/** The events grouped under their module, in the order of the accounting cycle; modules without an event are left out. */
export const groupByArea = (data, events) => (data?.areas || [])
  .map((area) => ({ area, events: events.filter((e) => e.area === area.code) }))
  .filter((g) => g.events.length);

/** Filters from the address (?q, module, account, pending). */
export const readFilters = (params) => ({
  q: params.get("q") || "",
  modules: (params.get("module") || "").split(",").map((m) => m.trim()).filter(Boolean),
  account: params.get("account") || null,
  pending: params.get("pending") === "1",
});

/** The address parameters of the filters (empty ones removed). */
export const filterParams = ({ q, modules, account, pending }) => ({
  q: q || null, module: modules?.length ? modules.join(",") : null, account: account || null, pending: pending ? "1" : null,
});

/** True when any filter is set. */
export const isFiltered = (f) => !!(f.q || f.modules.length || f.account || f.pending);

/** Debit and credit lines in journal order: debits first, then credits. */
export const journalLines = (event) => [...(event.lines || [])].sort((a, b) => (a.side === b.side ? 0 : a.side === "Dr" ? -1 : 1));

/** The mapping state of a line: the account it posts to, else the worst of its map entries. */
export const lineMapping = (account) => account?.mapping || (account?.options || []).find((o) => o.mapping)?.mapping || null;
