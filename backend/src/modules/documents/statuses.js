/**
 * Status vocabularies. The database keeps the lower-case codes used by the shared schema and the scheduled jobs
 * (policy-expiry, renewal notices, quote expiry); the API speaks the values the screens switch on
 * (utils/statusHelpers.js: Draft, PendingCustomer, CustomerAccepted ... Active, Expired ...).
 */
const QUOTE = {
  draft: 'Draft', sent: 'PendingCustomer', accepted: 'CustomerAccepted', submitted: 'SubmittedToInsurer', approved: 'Approved',
  converted: 'ConvertedToPolicy', rejected: 'Rejected', dropped: 'Dropped', expired: 'Expired', quoted: 'Draft',
};
const POLICY = { active: 'Active', issued: 'Active', expired: 'Expired', cancelled: 'Cancelled', renewed: 'Renewed', suspended: 'Suspended', draft: 'Draft' };
const ENDORSEMENT = {
  draft: 'Draft', submitted: 'PendingCustomer', 'cancel-initiated': 'InitiateCancel', approved: 'Approved', completed: 'Completed',
  cancelled: 'Cancelled', rejected: 'Rejected',
};

const invert = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => !['quoted', 'issued'].includes(k)).map(([k, v]) => [v.toLowerCase(), k]));
const QUOTE_IN = invert(QUOTE);
const POLICY_IN = invert(POLICY);
const ENDORSEMENT_IN = invert(ENDORSEMENT);

export const quoteStatusOut = (s) => QUOTE[s] || s;
export const policyStatusOut = (s) => POLICY[s] || s;
export const endorsementStatusOut = (s) => ENDORSEMENT[s] || s;
/** Accept either the API label (PendingCustomer) or the stored code (sent); returns the stored code or null. */
export const quoteStatusIn = (s) => (s ? (QUOTE_IN[String(s).toLowerCase()] || (QUOTE[s] ? s : null)) : null);
export const policyStatusIn = (s) => (s ? (POLICY_IN[String(s).toLowerCase()] || (POLICY[s] ? s : null)) : null);
export const endorsementStatusIn = (s) => (s ? (ENDORSEMENT_IN[String(s).toLowerCase()] || (ENDORSEMENT[s] ? s : null)) : null);
