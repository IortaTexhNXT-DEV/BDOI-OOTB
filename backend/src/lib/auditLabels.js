/**
 * Business labels of the audit trail: record types, actions and field keys as an insurance broker reads them
 * ("insuranceCompanyClaimNumber" -> "Insurer claim number", "pending-approval" -> "Pending approval").
 *
 * FIELD_LABELS.common applies to every record type; FIELD_LABELS[<entity>] overrides it for one type. A key that is in
 * neither is turned into sentence case (fieldLabel / sentenceCase). Master records use the labels of their master
 * type definition (passed in by the caller).
 */

/** Short words that stay upper case in a label. */
const ACRONYMS = new Set(['id', 'tin', 'sss', 'gsis', 'vat', 'dst', 'lgt', 'ewt', 'lob', 'or', 'ar', 'ap', 'jv', 'gl', 'iar', 'ctpl', 'ipa',
  'url', 'sms', 'otp', 'ip', 'bir', 'umid', 'rfq', 'pdf', 'csv', 'cv', 'cr', 'dr', 'po', 'swift', 'iso', 'ic', 'ph', 'php', 'usd', 'sec', 'atm',
  'faq', 'kyc', 'aml', 'amla', 'cmp', 'sla', 'ccy', 'fx', 'nb', 'rn', 'pc', 'si', 'bdo', 'vin', 'mv']);

/** "insuranceCompanyClaimNumber" / "loss_date" / "LOSS-DATE" -> "Insurance company claim number" / "Loss date"; acronyms stay upper case. */
export function sentenceCase(key) {
  const s = String(key ?? '').trim();
  if (!s) return '';
  if (/\s/.test(s) && /[a-z]/.test(s)) {
    // a phrase ("Settlement Submitted"): first word capitalised, the others in lower case unless acronyms
    return s.split(/\s+/).map((w, i) => {
      if (/^[A-Z0-9]{2,}$/.test(w)) return w;
      return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w.charAt(0).toLowerCase() + w.slice(1);
    }).join(' ');
  }
  const words = s.replace(/[_\-.]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/\s+/).filter(Boolean);
  return words.map((w, i) => {
    const lower = w.toLowerCase();
    if (ACRONYMS.has(lower)) return lower.toUpperCase();
    if (/^[A-Z0-9]{2,5}$/.test(w) && /[A-Z]/.test(w) && words.length > 1) return w;
    return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
  }).join(' ');
}

/** Record types. A master record (entity "master:<type>") is labelled by its master type. */
export const ENTITY_LABELS = {
  policy: 'Policy', quotation: 'Quotation', quote: 'Quotation', claim: 'Claim', client: 'Client', lead: 'Prospect', endorsement: 'Endorsement',
  receipt: 'Receipt', renewal: 'Renewal', 'renewal-batch': 'Renewal batch', user: 'User', role: 'Role', session: 'Sign-in session',
  journal_voucher: 'Journal voucher', journal: 'Journal', placement: 'Placement slip', broker_slip: 'Broker slip', insurer_statement: 'Insurer statement',
  disbursement: 'Disbursement', collection: 'Collection', commission_referrer: 'Referrer', commission_debit_note: 'Commission debit note',
  commission_line: 'Commission line', commission_rate: 'Commission rate', remittance: 'Remittance', remittance_item: 'Remittance item',
  remittance_batch: 'Remittance batch', remittance_statement: 'Remittance statement', data_subject_request: 'Data subject request',
  privacy_consent: 'Privacy consent', 'system-settings': 'System setting', settings: 'Configuration', risk_mapping: 'Risk mapping',
  product_template: 'Product template', checkbook: 'Checkbook', authority_limit: 'Authority limit', report_schedule: 'Report schedule',
  premium_warranty_extension: 'Premium warranty extension', petty_cash_request: 'Petty cash request', petty_cash_fund: 'Petty cash fund',
  payment_link: 'Payment link', package_quote: 'Package quotation', package_bundle: 'Package', data_load_batch: 'Data load batch',
  bank_reconciliation: 'Bank reconciliation', accounting_config_change: 'Accounting configuration change', sod_rule: 'Segregation of duties rule',
  recurring_journal: 'Recurring journal', receivable: 'Receivable', premium_charge_rule: 'Premium charge rule', period_close_run: 'Month-end close',
  period_close_checklist: 'Month-end checklist', lgu_tax_rate: 'LGU tax rate', insurer_rate_table: 'Insurer rate table', gl_account: 'GL account',
  bank_transaction_type: 'Bank transaction type', bank_statement_line: 'Bank statement line', bank_statement_format: 'Bank statement format',
  bank_statement: 'Bank statement', access_review: 'Access review', year_end_run: 'Year-end close', write_off_reason: 'Write-off reason',
  user_delegation: 'Delegation', tax_code: 'Tax code', scheduled_job: 'Scheduled job', posting_rule: 'Posting rule',
  insurer_statement_format: 'Insurer statement format', instalment_plan: 'Instalment plan', incentive_calculation: 'Incentive calculation',
  generated_report: 'Report', entry_match: 'Entry match', document_numbering: 'Document numbering', direct_bill_client_payment: 'Direct bill payment',
  bank_rec_match: 'Bank reconciliation match', agent_event: 'Agent event', accounting_period: 'Accounting period', account_map: 'Account mapping',
  master_type: 'Master type', document: 'Document', database: 'Database', item: 'Item', task: 'Task',
};

/** "master:insurance-company" -> "Insurance company" (or the master type label when given). */
export function entityLabel(entity, masterLabels = {}) {
  const e = String(entity || '');
  if (e.startsWith('master:')) return sentenceCase(masterLabels[e.slice(7)] || e.slice(7));
  return ENTITY_LABELS[e] || sentenceCase(e);
}

/** Verbs of the generic action codes ("create" -> "created"); claim actions are already words ("Settlement Submitted"). */
const ACTION_VERBS = {
  create: 'created', update: 'updated', delete: 'deleted', remove: 'removed', approve: 'approved', reject: 'rejected', cancel: 'cancelled',
  submit: 'submitted', issue: 'issued', close: 'closed', reopen: 'reopened', settle: 'settled', post: 'posted', reverse: 'reversed', void: 'voided',
  activate: 'activated', deactivate: 'deactivated', restore: 'restored', send: 'sent', resend: 'sent again', upload: 'uploaded', replace: 'replaced',
  'bulk-create': 'created by bulk upload', 'go-live-migration': 'loaded at go-live', convert: 'converted', 'convert-lead': 'created from a prospect',
  login: 'signed in', logout: 'signed out', 'reset-password': 'password reset', lock: 'locked', unlock: 'unlocked', provision: 'provisioned',
  run: 'run', status: 'status changed', assign: 'assigned', renew: 'renewed', lapse: 'lapsed', endorse: 'endorsed', print: 'printed', email: 'e-mailed',
  'payment-capture': 'payment captured', 'pay-later': 'set to pay later', 'payment-confirm': 'payment confirmed', 'payment-reject': 'payment rejected',
  'payment-status': 'payment status changed', 'funds-received': 'funds received from the insurer', 'paid-to-claimant': 'paid to the claimant',
  purge: 'purged', reset: 'reset', complete: 'completed', reassign: 'reassigned', 'access-change': 'access changed',
};

/** Sign-in events read as what the user did. */
const SESSION_TITLES = { login: 'Signed in', logout: 'Signed out', 'refresh-token-reuse': 'Session token reused (session ended)', 'login-failed': 'Sign-in failed' };

/**
 * The headline of an event: "Policy updated", "Claim registered", "Settlement submitted", "Insurance company deactivated".
 * Claim trail actions are already business phrases and are only put in sentence case.
 */
export function actionTitle(entity, action, masterLabels = {}) {
  const a = String(action || '').trim();
  const label = entityLabel(entity, masterLabels);
  if (!a) return `${label} changed`;
  if (/\s/.test(a) || /^[A-Z]/.test(a)) return sentenceCase(a);
  const status = /^status:(.+)$/.exec(a);
  if (status) {
    const s = status[1].toLowerCase();
    if (s === 'active') return `${label} activated`;
    if (s === 'inactive') return `${label} deactivated`;
    if (s === 'deleted') return `${label} deleted`;
    return `Status changed to ${sentenceCase(s).toLowerCase()}`;
  }
  const key = a.toLowerCase();
  if (entity === 'session' && SESSION_TITLES[key]) return SESSION_TITLES[key];
  if (ACTION_VERBS[key]) return `${label} ${ACTION_VERBS[key]}`;
  const words = sentenceCase(a);
  return words.toLowerCase().startsWith(label.toLowerCase()) ? words : `${label}: ${words.charAt(0).toLowerCase()}${words.slice(1)}`;
}

/** An action without its record type, for filter lists: "create" -> "Created", "status:inactive" -> "Deactivated". */
export function actionText(action) {
  const a = String(action || '').trim();
  if (!a) return '';
  if (/\s/.test(a) || /^[A-Z]/.test(a)) return sentenceCase(a);
  const status = /^status:(.+)$/.exec(a);
  if (status) {
    const s = status[1].toLowerCase();
    return { active: 'Activated', inactive: 'Deactivated', deleted: 'Deleted' }[s] || `Status changed to ${sentenceCase(s).toLowerCase()}`;
  }
  const verb = ACTION_VERBS[a.toLowerCase()];
  return verb ? verb.charAt(0).toUpperCase() + verb.slice(1) : sentenceCase(a);
}

/** Field labels shared by every record type. Keys are matched exactly, then without case / separators. */
const COMMON = {
  status: 'Status', remarks: 'Remarks', notes: 'Notes', note: 'Note', reason: 'Reason', description: 'Description', name: 'Name', code: 'Code',
  displayName: 'Name', firstName: 'First name', lastName: 'Last name', middleName: 'Middle name', companyName: 'Company name',
  email: 'E-mail', emailId: 'E-mail', phone: 'Phone', mobile: 'Mobile number', mobileNumber: 'Mobile number', address: 'Address',
  tin: 'TIN', birthDate: 'Date of birth', dateOfBirth: 'Date of birth', gender: 'Gender', civilStatus: 'Civil status',
  clientId: 'Client', clientName: 'Client', clientCode: 'Client code', leadId: 'Prospect', policyId: 'Policy', policyNumber: 'Policy number',
  quoteId: 'Quotation', quotationId: 'Quotation', quotationNumber: 'Quotation number', quoteNumber: 'Quotation number', claimId: 'Claim',
  claimNumber: 'Claim number', endorsementNumber: 'Endorsement number', receiptNumber: 'Receipt number', billNumber: 'Bill number',
  invoiceNumber: 'Invoice number', referenceNo: 'Reference number', referenceNumber: 'Reference number',
  insurerId: 'Insurer', insurerName: 'Insurer', insuranceCompanyId: 'Insurer', insuranceCompanyName: 'Insurer', insurer: 'Insurer',
  productId: 'Product', productName: 'Product', product: 'Product', productType: 'Product', lob: 'Line of business', line: 'Line of business',
  lineOfBusiness: 'Line of business', branchCode: 'Branch', branch: 'Branch', currency: 'Currency', exchangeRate: 'Exchange rate',
  sumInsured: 'Sum insured', totalSumInsured: 'Total sum insured', netPremium: 'Net premium', grossPremium: 'Gross premium',
  basicPremium: 'Basic premium', premium: 'Premium', totalPremium: 'Total premium', amount: 'Amount', totalAmount: 'Total amount',
  documentaryStampTax: 'Documentary stamp tax', dst: 'Documentary stamp tax', vat: 'VAT', localGovernmentTax: 'Local government tax',
  premiumTax: 'Premium tax', commissionRate: 'Commission rate', commissionAmount: 'Commission', commission: 'Commission',
  inceptionDate: 'Inception date', expiryDate: 'Expiry date', effectiveDate: 'Effective date', issuedDate: 'Issue date', issueDate: 'Issue date',
  dueDate: 'Due date', paymentStatus: 'Payment status', paymentMethod: 'Payment method', paymentMode: 'Payment mode', paymentId: 'Payment',
  ownerUserId: 'Account officer', handlerUserId: 'Handler', assignedTo: 'Assigned to', agentUserId: 'Agent', userId: 'User',
  approvedBy: 'Approved by', approvedAt: 'Approved on', rejectedReason: 'Rejection reason', rejectionReason: 'Rejection reason',
  isActive: 'Active', active: 'Active', enabled: 'Enabled', priority: 'Priority', changeNote: 'Change note', version: 'Version',
  contactPerson: 'Contact person', contactEmail: 'Contact e-mail', contactPhone: 'Contact phone', shortName: 'Short name',
  quoteRefId: 'Quotation', premiumDelta: 'Premium adjustment', arNumber: 'Acknowledgement receipt number', proofFileName: 'Proof of payment',
  submittedById: 'Submitted by', receivableId: 'Receivable', creditTermDays: 'Credit term (days)', defaultBillingMode: 'Default billing mode', billingMode: 'Billing mode',
};

/** Labels of one record type (override COMMON). */
const BY_ENTITY = {
  claim: {
    claimStatus: 'Claim status', insuranceCompanyClaimNumber: 'Insurer claim number', insurerClaimNumber: 'Insurer claim number',
    dateOfIncident: 'Date of loss', timeOfIncident: 'Time of loss', addressOfIncident: 'Place of loss', cityOfIncident: 'City / municipality of loss',
    provinceOfIncident: 'Province of loss', typeOfIncident: 'Cause of loss', lossType: 'Cause of loss', reportedDate: 'Date reported',
    estimatedClaimAmount: 'Estimated loss', estimateAmount: 'Estimated loss', approvedAmount: 'Approved amount', settledAmount: 'Settled amount',
    claimPriority: 'Priority', claimType: 'Claim type', handlerUserId: 'Claims handler', policyInfo: 'Policy information',
    driverDetails: 'Driver', driverName: 'Driver name', licenseNumber: 'Driver licence number', thirdPartyDetails: 'Third party',
    adjuster: 'Adjuster report', adjusterName: 'Adjuster', adjusterStatus: 'Adjuster report status', adjusterReportDate: 'Adjuster report date',
    settlement: 'Settlement', settlementAmount: 'Settlement amount', settlementType: 'Settlement type', settlementDate: 'Settlement date',
    payee: 'Payee', payeeName: 'Payee', chequeNumber: 'Cheque number', deductible: 'Deductible', depreciation: 'Depreciation', salvage: 'Salvage',
    note: 'Note',
  },
  policy: {
    policyStatus: 'Policy status', coverType: 'Cover type', planType: 'Plan', vehicleDetails: 'Vehicle', plateNumber: 'Plate number',
    chassisNumber: 'Chassis number', engineNumber: 'Engine number', mvFileNumber: 'MV file number', receiptNumber: 'Official receipt number',
    capture: 'Payment', option: 'Payment option',
  },
  quotation: {
    quotationStatus: 'Quotation status', validUntil: 'Valid until', insuredName: 'Insured', customerInfo: 'Customer',
    participantDetails: 'Insurer quotations', approvalSentTo: 'Sent for approval to',
  },
  client: { clientType: 'Client type', preferredName: 'Preferred name', houseNo: 'House / unit number', road: 'Street', barangay: 'Barangay',
    city: 'City / municipality', state: 'Province', postalCode: 'ZIP code', leadCategory: 'Category', source: 'Source', extra: 'Additional details' },
  endorsement: { endorsementType: 'Endorsement type', premiumChange: 'Premium adjustment', effectiveDate: 'Effective date' },
  receipt: { receiptDate: 'Receipt date', payerName: 'Received from', bankCode: 'Bank', chequeNo: 'Cheque number', chequeDate: 'Cheque date', modeOfPayment: 'Mode of payment' },
  user: { username: 'User name', roles: 'Roles', designation: 'Designation', department: 'Department', employeeCode: 'Employee code', reportingTo: 'Reports to' },
};

const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
const NORM_COMMON = new Map(Object.entries(COMMON).map(([k, v]) => [norm(k), v]));
const NORM_BY_ENTITY = Object.fromEntries(Object.entries(BY_ENTITY).map(([e, m]) => [e, new Map(Object.entries(m).map(([k, v]) => [norm(k), v]))]));

/**
 * The business label of one field key of a record type. `extra` holds labels known at run time (a master type's field
 * definitions). Unknown keys fall back to sentence case.
 */
export function fieldLabel(entity, key, extra = {}) {
  const k = String(key ?? '');
  const e = entity === 'quote' ? 'quotation' : String(entity || '');
  if (extra[k]) return sentenceCase(extra[k]);
  const own = BY_ENTITY[e];
  if (own?.[k]) return own[k];
  if (COMMON[k]) return COMMON[k];
  const n = norm(k);
  const extraNorm = Object.entries(extra).find(([x]) => norm(x) === n);
  if (extraNorm) return sentenceCase(extraNorm[1]);
  return NORM_BY_ENTITY[e]?.get(n) || NORM_COMMON.get(n) || sentenceCase(k);
}

/**
 * Label of a flattened key ("adjuster.adjusterName"): the child label alone when it already names its parent
 * ("Adjuster report" + "Adjuster" -> "Adjuster"), else "Parent – child".
 */
export function pathLabel(entity, path, extra = {}) {
  const parts = String(path).split('.');
  if (parts.length === 1) return fieldLabel(entity, parts[0], extra);
  const labels = parts.map((p) => (/^\d+$/.test(p) ? `#${Number(p) + 1}` : fieldLabel(entity, p, extra)));
  let out = labels[0];
  for (const child of labels.slice(1)) {
    const firstWord = out.split(/[\s–-]+/)[0].toLowerCase();
    if (child.startsWith('#')) out = `${out} ${child}`;
    else if (child.toLowerCase().split(/\s+/).includes(firstWord)) out = child;
    else out = `${out} – ${child.charAt(0).toLowerCase()}${child.slice(1)}`;
  }
  // keep acronyms upper case after lower-casing the first letter of a child label
  return out.replace(/– ([a-z]+)\b/g, (m, w) => (ACRONYMS.has(w) ? `– ${w.toUpperCase()}` : m));
}

/** Status codes as shown in lists ("pending-approval" -> "Pending approval", "CustomerAccepted" -> "Customer accepted"). */
export function statusText(code, labels = {}) {
  if (code === null || code === undefined || code === '') return null;
  const s = String(code);
  return labels[s] || labels[s.toLowerCase()] || sentenceCase(s);
}
