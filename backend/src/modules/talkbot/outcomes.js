/**
 * Talkbot outcomes (FRS LEAD-09 FR-TBT-012): every call attempt of a call list line is classified with the outcome rules
 * (setting talkbot.outcome_rules, in rank order; the first rule that fits gives the attempt its outcome) and the line
 * takes the best-ranked attempt. A rule fits when one of its conditions holds:
 *   callStatus / callResult / result   the Talkbot column equals one of the values (case, spaces and punctuation ignored)
 *   anyCallStatus / anyCallResult      the column has a value
 *   callbackDate                       the attempt has a Date of Callback
 *   anyResult                          always (the last rule)
 * noneConnected limits a rule to lines on which no attempt connected (Invalid Number or Out of Service counts as a wrong
 * contact only when the client was never reached).
 */

export const OUTCOMES = ['not-called', 'willing', 'not-willing', 'already-renewed', 'call-back', 'wrong-contact', 'uncontacted', 'missed-call'];
export const OUTCOME_LABELS = {
  'not-called': 'Not called', willing: 'Willing to renew', 'not-willing': 'Not willing to renew', 'already-renewed': 'Already renewed',
  'call-back': 'Call back', 'wrong-contact': 'Wrong contact', uncontacted: 'Uncontacted', 'missed-call': 'Missed call',
};
/** The outcome that makes an account Talkbot-confirmed. */
export const CONFIRMED = 'willing';
/** Outcomes of the accounts not reached, put on the next call list (FR-TBT-015); call-back on request. */
export const NOT_REACHED = ['missed-call', 'uncontacted'];

export const DEFAULT_RULES = [
  { rank: 1, outcome: 'already-renewed', callStatus: ['Already Renewed'] },
  { rank: 2, outcome: 'willing', callResult: ['Will Renew'] },
  { rank: 3, outcome: 'not-willing', callResult: ['Will not Renew', 'Not Interested'], callStatus: ['Stop Calling/Already Called'] },
  { rank: 4, outcome: 'wrong-contact', callStatus: ['Wrong PIC', 'Wrong Number/Deny Car Loan'] },
  { rank: 5, outcome: 'call-back', anyCallResult: true, anyCallStatus: true, callbackDate: true },
  { rank: 6, outcome: 'uncontacted', result: ['Connected(200)', 'Connected(202)'] },
  { rank: 7, outcome: 'wrong-contact', result: ['Invalid Number(1)', 'Out of Service(5)'], noneConnected: true },
  { rank: 8, outcome: 'missed-call', anyResult: true },
];

const norm = (v) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const present = (v) => String(v ?? '').trim() !== '';
const oneOf = (list, v) => Array.isArray(list) && present(v) && list.some((x) => norm(x) === norm(v));

/** The rules in rank order, each with its rank; the delivered rules when the setting is empty or not a list. */
export function rulesOf(setting) {
  const list = Array.isArray(setting) && setting.length ? setting : DEFAULT_RULES;
  return list.filter((r) => r && OUTCOMES.includes(r.outcome)).map((r, i) => ({ ...r, rank: Number(r.rank) || i + 1 })).sort((a, b) => a.rank - b.rank);
}

/** Whether a Talkbot Result means the call connected (a rule on Connected(...) results). */
const connectedValues = (rules) => rules.filter((r) => r.outcome === 'uncontacted').flatMap((r) => r.result || []);
export const isConnected = (attempt, rules) => oneOf(connectedValues(rules), attempt.result) || present(attempt.callStatus) || present(attempt.callResult);

/** The rule that classifies one attempt ({ result, callStatus, callResult, callbackDate }); lineConnected: an attempt of the line connected. */
export function classify(attempt, rules, { lineConnected = false } = {}) {
  for (const r of rules) {
    if (r.noneConnected && lineConnected) continue;
    const fits = oneOf(r.callStatus, attempt.callStatus) || oneOf(r.callResult, attempt.callResult) || oneOf(r.result, attempt.result)
      || (r.anyCallStatus && present(attempt.callStatus)) || (r.anyCallResult && present(attempt.callResult))
      || (r.callbackDate && present(attempt.callbackDate)) || r.anyResult === true;
    if (fits) return { outcome: r.outcome, rank: r.rank };
  }
  return { outcome: 'missed-call', rank: Number.MAX_SAFE_INTEGER };
}

const ddmmyyyy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

/** The Talkbot values behind an outcome, as the call list shows them ("Will Renew (Closing)", "Undecided, call back 12/10/2026"). */
export function detailOf(a, outcome) {
  if (outcome === 'call-back') {
    const what = a.callResult || a.callStatus || 'Call back';
    return a.callbackDate ? `${what}, call back ${ddmmyyyy(a.callbackDate)}` : what;
  }
  if (a.callResult || a.callStatus) return `${a.callResult || a.callStatus}${a.dropOffPoint ? ` (${a.dropOffPoint})` : ''}`;
  return a.result || '';
}

/**
 * The outcome of a line from all its attempts: { outcome, rank, attempt (the deciding one), detail }, or not-called
 * without attempts. Each attempt is returned with its own outcome and rank in `classified`.
 */
export function deriveLine(attempts, rules) {
  if (!attempts.length) return { outcome: 'not-called', rank: null, attempt: null, detail: null, classified: [] };
  const lineConnected = attempts.some((a) => isConnected(a, rules));
  const classified = attempts.map((a) => ({ ...a, ...classify(a, rules, { lineConnected }) }));
  // best rank first; the later call wins a tie
  const best = [...classified].sort((x, y) => x.rank - y.rank || String(y.callTime || '').localeCompare(String(x.callTime || '')))[0];
  return { outcome: best.outcome, rank: best.rank, attempt: best, detail: detailOf(best, best.outcome), classified };
}

/** The best rank an outcome can have under the rules (a manual outcome keeps the line until a better-ranked attempt comes). */
export const rankOf = (outcome, rules) => Math.min(...rules.filter((r) => r.outcome === outcome).map((r) => r.rank), Number.MAX_SAFE_INTEGER);
