/**
 * Access catalogue: every permission code in business words, for Role Permissions (Master > Users and Access).
 *
 * A code belongs to a module of the menu (Receipts, Payables...), inside an area ordered like the side menu, at one
 * level: view, edit (create and edit), approve or special. `checked: false` marks a code no route checks (it is left
 * out of the business view); `baseline` is Basic access, held by every role and never removed.
 *
 * A permission added by a later migration needs its entry here; until then it is shown under "Other" with the
 * description of the database (describe), and test/role-permissions.test.js fails.
 */

export const LEVELS = ['view', 'edit', 'approve', 'special'];
export const LEVEL_NAMES = { view: 'View', edit: 'Create and edit', approve: 'Approve', special: 'Special' };

export const AREAS = [
  { code: 'sales', name: 'Sales & Marketing' },
  { code: 'operations', name: 'Operations' },
  { code: 'accounts', name: 'Accounts' },
  { code: 'commission', name: 'Commission' },
  { code: 'reports', name: 'Reports' },
  { code: 'products', name: 'Product Configurator' },
  { code: 'masters', name: 'Master data and configuration' },
  { code: 'access', name: 'Users and access' },
  { code: 'basic', name: 'Basic and special access' },
  { code: 'other', name: 'Other' },
].map((a, i) => ({ ...a, order: i + 1 }));

/** [code, area, name, screens of the menu] in menu order. */
const MODULE_LIST = [
  ['leads', 'sales', 'Prospects and leads', ['Prospects', 'Quick Quote']],
  ['quotations', 'sales', 'Quotations and placement', ['Quick Quote', 'Request for Quotation', 'Quotations', 'Placement Slips', 'Comparison Reports']],
  ['lead-assignment', 'sales', 'Lead assignment', ['Lead Assignment']],
  ['motor-programmes', 'sales', 'Dealer programmes', ['Dealer Programmes']],
  ['campaigns', 'sales', 'Marketing campaigns', ['Campaigns']],
  ['sales-activities', 'sales', 'Sales activities', ['Sales Activities']],
  ['clients', 'operations', 'Clients', ['Clients']],
  ['policies', 'operations', 'Policies', ['Policy', 'Payments', 'CTPL Authentication', 'Cover Notes']],
  ['endorsements', 'operations', 'Endorsements and cancellations', ['Endorsements', 'Policy Cancellation']],
  ['renewals', 'operations', 'Renewals', ['Renewals']],
  ['claims', 'operations', 'Claims', ['Claims', 'Claim Documents', 'Motor Claim Repairs']],
  ['fleet', 'operations', 'Fleet schedules', ['Fleet Schedules']],
  ['marine', 'operations', 'Marine open covers', ['Marine Open Covers']],
  ['receipts', 'accounts', 'Receipts', ['Receipts', 'Post-Dated Cheques', 'Claims Settlements']],
  ['collections', 'accounts', 'Collections and credit control', ['Collections', 'Credit Control']],
  ['disbursements', 'accounts', 'Disbursements and petty cash', ['Disbursement', 'Petty Cash', 'Bank Payment Files']],
  ['payables', 'accounts', 'Payables', ['Payables', 'Suppliers']],
  ['fixed-assets', 'accounts', 'Fixed assets', ['Fixed Assets']],
  ['journal-vouchers', 'accounts', 'Journal vouchers', ['Journal Voucher', 'Correction JV', 'Reversal JV', 'SAP GL Export']],
  ['remittance', 'accounts', 'Remittance and insurer reconciliation', ['Remittance', 'Insurer Reconciliation']],
  ['bank-reconciliation', 'accounts', 'Bank reconciliation', ['Bank Reconciliation']],
  ['period-end', 'accounts', 'Period end and tax', ['Period End', 'Tax']],
  ['incentive', 'accounts', 'Incentives', ['Incentive']],
  ['commission', 'commission', 'Commission', ['Commission Dashboard', 'Agents/Referrer Accounts', 'Insurer Overrides']],
  ['reports', 'reports', 'Reports', ['All Reports', 'Operational Reports', 'Financial Reports', 'Report Builder']],
  ['products', 'products', 'Products', ['Product Configurator']],
  ['masters', 'masters', 'Reference masters', ['Organization', 'Insurance Management', 'Location', 'Employee Management', 'Finance masters']],
  ['channels', 'masters', 'Distribution channels', ['Distribution Channels']],
  ['premium-charges', 'masters', 'Premium taxes and LGU rates', ['Premium Taxes & LGU Rates']],
  ['posting-rules', 'masters', 'Posting rules and account determination', ['Posting Rules', 'Account Determination', 'Configuration Approvals']],
  ['settings', 'masters', 'System settings', ['Configuration']],
  ['schedules', 'masters', 'Schedules', ['Schedules']],
  ['integrations', 'masters', 'Integrations', ['Integrations', 'Message Templates', 'Insurer Integration']],
  ['audit', 'masters', 'Audit trail', ['Audit Trail']],
  ['data-load', 'masters', 'Go-live data load', ['Go-Live Data Load']],
  ['users', 'access', 'Users', ['User', 'User Access Matrix']],
  ['roles', 'access', 'Roles', ['Role', 'Role Permissions']],
  ['access-control', 'access', 'Access control', ['Authority Matrix', 'Delegations', 'Segregation of Duties', 'Access Reviews']],
  ['profile', 'basic', 'Basic access', ['My Profile']],
  ['notifications', 'basic', 'Notifications', ['Notifications']],
  ['pii', 'basic', 'Full personal data', []],
];
export const MODULES = MODULE_LIST.map(([code, area, name, screens], i) => ({ code, area, name, screens, order: i + 1 }));

/** code: [module, level, meaning, options] (options: checked false = no route checks it; baseline = Basic access). */
const PERMISSION_LIST = {
  'read:leads': ['leads', 'view', 'See prospects and leads'],
  'write:leads': ['leads', 'edit', 'Create and edit prospects and leads'],
  'read:quotations': ['quotations', 'view', 'See quotations, requests for quotation, placement slips and comparison reports'],
  'write:quotations': ['quotations', 'edit', 'Create quotations (Quick Quote too), send requests for quotation, prepare placement slips'],
  'approve:quotations': ['quotations', 'approve', 'Approve a quotation created by another user'],
  'read:lead-assignment': ['lead-assignment', 'view', 'See assignment rules, the reassignment queue and every team\'s prospects'],
  'write:lead-assignment': ['lead-assignment', 'edit', 'Maintain assignment rules and reassign prospects'],
  'read:motor-programmes': ['motor-programmes', 'view', 'See brand-new vehicle programmes and dealer sales uploads; print bank endorsement letters'],
  'write:motor-programmes': ['motor-programmes', 'edit', 'Maintain programmes and upload dealer vehicle sales'],
  'read:campaigns': ['campaigns', 'view', 'See campaigns, segments, templates and results'],
  'write:campaigns': ['campaigns', 'edit', 'Prepare and send campaigns; maintain segments and templates'],
  'read:sales-activities': ['sales-activities', 'view', 'See activity timelines and the activity report'],
  'write:sales-activities': ['sales-activities', 'edit', 'Log, change and cancel calls, meetings, e-mails and visits'],
  'read:clients': ['clients', 'view', 'See clients'],
  'write:clients': ['clients', 'edit', 'Create and edit clients'],
  'read:policies': ['policies', 'view', 'See policies, cover notes, payments and CTPL authentication'],
  'write:policies': ['policies', 'edit', 'Record and issue policies, cover notes and CTPL certificates'],
  'approve:policies': ['policies', 'approve', 'Decide the check of a placement against the slip, and complete the cancellations and return premiums of another user'],
  'read:endorsements': ['endorsements', 'view', 'See endorsements and cancellations'],
  'write:endorsements': ['endorsements', 'edit', 'Request and process endorsements and cancellations'],
  'read:renewals': ['renewals', 'view', 'See renewals'],
  'write:renewals': ['renewals', 'edit', 'Prepare renewals and renewal terms'],
  'approve:renewals': ['renewals', 'approve', 'Approve or return renewal terms of another user'],
  'read:claims': ['claims', 'view', 'See claims'],
  'write:claims': ['claims', 'edit', 'Register and follow up claims, claim documents and repairs'],
  'approve:claims': ['claims', 'approve', 'Claim decisions: review, reject, settle, approve a settlement, close'],
  'read:fleet': ['fleet', 'view', 'See fleet schedules and print the schedule of vehicles'],
  'write:fleet': ['fleet', 'edit', 'Prepare and issue fleet schedules; add or delete vehicles by endorsement'],
  'read:marine': ['marine', 'view', 'See open covers, certificates and declarations; print certificates'],
  'write:marine': ['marine', 'edit', 'Set up open covers, issue certificates, submit and bill declarations'],
  'read:receipts': ['receipts', 'view', 'See receipts and post-dated cheques'],
  'write:receipts': ['receipts', 'edit', 'Issue official receipts, post cash, verify payments, handle post-dated cheques'],
  'read:collections': ['collections', 'view', 'See collections, instalment plans and credit limits'],
  'write:collections': ['collections', 'edit', 'Record collections and adjustments'],
  'approve:credit-control': ['collections', 'approve', 'Approve premium warranty extensions and client credit limits (not the requester)'],
  'read:disbursements': ['disbursements', 'view', 'See payment vouchers, petty cash and bank payment files'],
  'write:disbursements': ['disbursements', 'edit', 'Prepare payment vouchers, petty cash and bank payment files'],
  'read:payables': ['payables', 'view', 'See suppliers, supplier invoices and payments, AP ageing'],
  'write:payables': ['payables', 'edit', 'Enter supplier invoices and payments; maintain suppliers'],
  'approve:payables': ['payables', 'approve', 'Approve supplier invoices (not the preparer)'],
  'read:fixed-assets': ['fixed-assets', 'view', 'See the fixed asset register and depreciation'],
  'write:fixed-assets': ['fixed-assets', 'edit', 'Register assets and run the monthly depreciation'],
  'read:journal-vouchers': ['journal-vouchers', 'view', 'See journal vouchers and the SAP GL export'],
  'write:journal-vouchers': ['journal-vouchers', 'edit', 'Enter, correct and reverse journal vouchers; run the SAP GL export'],
  'read:remittance': ['remittance', 'view', 'See remittances to insurers and insurer statements'],
  'write:remittance': ['remittance', 'edit', 'Prepare remittances and insurer statement reconciliations'],
  'approve:remittance': ['remittance', 'approve', 'Approve or reject remittances, settlements, adjustments and transfers within the Authority Matrix limit (not the preparer or submitter)'],
  'approve:insurer-reconciliation': ['remittance', 'approve', 'Approve insurer statement reconciliations and post their adjustments (not the preparer)'],
  'read:bank-reconciliation': ['bank-reconciliation', 'view', 'See bank reconciliations'],
  'write:bank-reconciliation': ['bank-reconciliation', 'edit', 'Prepare bank reconciliations'],
  'approve:bank-reconciliation': ['bank-reconciliation', 'approve', 'Approve and reopen bank reconciliations (not the preparer)'],
  'read:period-end': ['period-end', 'view', 'See period status, the close checklist and BIR tax'],
  'write:period-end': ['period-end', 'edit', 'Run the month-end and year-end steps and BIR tax returns'],
  'approve:period-end': ['period-end', 'approve', 'Approve the close, post into soft-closed periods, reopen periods, reverse a year-end close'],
  'read:incentive': ['incentive', 'view', 'See incentive programmes, calculations and statements'],
  'write:incentive': ['incentive', 'edit', 'Calculate, submit and pay incentives'],
  'approve:incentive': ['incentive', 'approve', 'Approve or reject an incentive calculation batch submitted by another user'],
  'read:commission': ['commission', 'view', 'See commission, referrer accounts and insurer overrides'],
  'write:commission': ['commission', 'edit', 'Process commission and insurer overrides'],
  'read:reports': ['reports', 'view', 'Run and download reports'],
  'write:reports': ['reports', 'edit', 'Build and schedule reports (Report Builder)'],
  'read:products': ['products', 'view', 'See products and product templates'],
  'write:products': ['products', 'edit', 'Configure products, covers, rating and rules'],
  'read:masters': ['masters', 'view', 'See reference masters'],
  'write:masters': ['masters', 'edit', 'Maintain reference masters'],
  'read:channels': ['channels', 'view', 'See dealers, financing banks, affinity partners and their production'],
  'write:channels': ['channels', 'edit', 'Maintain distribution channels'],
  'write:premium-charges': ['premium-charges', 'edit', 'Maintain premium taxes and charges and the LGU tax rates'],
  'write:posting-rules': ['posting-rules', 'edit', 'Propose changes to posting rules and account determination'],
  'approve:posting-rules': ['posting-rules', 'approve', 'Approve changes to posting rules and account determination (not the requester)'],
  'read:settings': ['settings', 'view', 'See system settings'],
  'write:settings': ['settings', 'edit', 'Change system settings'],
  'read:schedules': ['schedules', 'view', 'See scheduled jobs and their runs'],
  'write:schedules': ['schedules', 'edit', 'Run, switch on or off and reschedule jobs'],
  'read:integrations': ['integrations', 'view', 'See connectors and the integration outbox and inbox'],
  'write:integrations': ['integrations', 'edit', 'Configure connectors and message templates; resend or cancel messages'],
  'read:audit': ['audit', 'view', 'See the audit trail'],
  'write:audit': ['audit', 'edit', 'Not used by any screen', { checked: false }],
  'read:data-load': ['data-load', 'view', 'Download go-live workbooks, read the load history, compare environments'],
  'write:data-load': ['data-load', 'edit', 'Upload, validate and load the go-live workbooks'],
  'read:users': ['users', 'view', 'See users and their sign-in history'],
  'write:users': ['users', 'edit', 'Create users, change their roles, reset passwords, lock and unlock'],
  'read:roles': ['roles', 'view', 'Not used by any screen (every signed-in user sees the list of roles)', { checked: false }],
  'write:roles': ['roles', 'edit', 'Create roles and request changes to their access'],
  'read:access-control': ['access-control', 'view', 'See access matrices, role permissions, authority limits, delegations, segregation of duties and access reviews'],
  'write:access-control': ['access-control', 'edit', 'Propose authority limits, record delegations, maintain segregation of duties, run access reviews'],
  'approve:access-control': ['access-control', 'approve', 'Approve role access changes and authority limits of another administrator'],
  'read:profile': ['profile', 'view', 'Own profile and the look-up lists of every form', { baseline: true }],
  'write:profile': ['profile', 'edit', 'Not used by any screen', { checked: false }],
  'read:notifications': ['notifications', 'view', 'Not used by any screen (every user sees their notifications)', { checked: false }],
  'write:notifications': ['notifications', 'edit', 'Not used by any screen', { checked: false }],
  'view:pii': ['pii', 'special', 'See TIN, government ID numbers, mobile, e-mail, bank account and birth date unmasked on screens and exports'],
};

const moduleByCode = new Map(MODULES.map((m) => [m.code, m]));
const LEVEL_OF_PREFIX = { read: 'view', write: 'edit', approve: 'approve' };

export const PERMISSIONS = Object.entries(PERMISSION_LIST).map(([code, [module, level, meaning, opts = {}]]) => ({
  code, area: moduleByCode.get(module).area, module, level, meaning, checked: opts.checked !== false, baseline: !!opts.baseline,
}));
const permissionByCode = new Map(PERMISSIONS.map((p) => [p.code, p]));

/** Codes every role holds (Basic access): never removed from a role. */
export const BASELINE = PERMISSIONS.filter((p) => p.baseline).map((p) => p.code);

/**
 * The catalogue entry of a code; a code without one (a later migration) is placed under Other, in a module named
 * after its database module, at the level of its prefix, with the database description as its meaning.
 */
export function describe(code, row = {}) {
  const known = permissionByCode.get(code);
  if (known) return known;
  const [prefix, rest = code] = String(code).split(':');
  return { code, area: 'other', module: `other:${row.module || rest}`, level: LEVEL_OF_PREFIX[prefix] || 'special', meaning: row.description || code, checked: true, baseline: false };
}

/** The catalogue for the database's permissions: areas, modules (with the levels they have) and every code. */
export function catalogue(rows) {
  const permissions = rows.map((r) => describe(r.code, r));
  const extra = [...new Map(permissions.filter((p) => !moduleByCode.has(p.module))
    .map((p) => [p.module, { code: p.module, area: 'other', name: p.module.slice(6).replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()), screens: [] }])).values()];
  const modules = [...MODULES, ...extra.map((m, i) => ({ ...m, order: MODULES.length + i + 1 }))]
    .map((m) => ({ ...m, levels: LEVELS.filter((l) => permissions.some((p) => p.module === m.code && p.level === l && p.checked)) }))
    .filter((m) => permissions.some((p) => p.module === m.code));
  const areas = AREAS.filter((a) => modules.some((m) => m.area === a.code));
  return { areas, modules, permissions, levels: LEVELS.map((code) => ({ code, name: LEVEL_NAMES[code] })) };
}

/** "Accounts › Bank reconciliation › Approve" */
export function businessName(code, cat = null) {
  const p = cat ? cat.permissions.find((x) => x.code === code) || describe(code) : describe(code);
  const m = (cat?.modules || MODULES).find((x) => x.code === p.module);
  const a = AREAS.find((x) => x.code === p.area);
  return [a?.name || 'Other', m?.name || p.module, LEVEL_NAMES[p.level]].join(' › ');
}

/** "1 user", "3 users": a count with its noun. */
export const countOf = (n, noun) => `${n} ${noun}${Number(n) === 1 ? '' : 's'}`;
