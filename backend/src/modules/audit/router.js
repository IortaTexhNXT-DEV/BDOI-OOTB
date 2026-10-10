import { moduleRouter } from '../../lib/registry.js';
import { hasPermission } from '../../lib/auth.js';
import { forbidden } from '../../lib/errors.js';
import { assertVisible } from '../../lib/scope.js';
import { ok } from '../../lib/respond.js';
import { today } from '../../lib/dates.js';
import { EXPORT_COLUMNS, exportRows } from '../../lib/auditEvents.js';
import { sendSheet } from '../claims/docs.js';
import * as svc from './service.js';

/**
 * History of one record as business events, for the History / Audit trail tab of its detail screen. Readable by
 * whoever may read the record (and by holders of read:audit); a user limited to their own book only sees the history of
 * records they may open.
 */
const { router, define } = moduleRouter('Audit Trail', '/audit');

/** Module permission that opens the history of a record type (read or write); master records need read:masters. */
const MODULE_OF = {
  policy: 'policies', quotation: 'quotations', quote: 'quotations', claim: 'claims', client: 'clients', lead: 'leads', endorsement: 'endorsements',
  receipt: 'receipts', renewal: 'renewals', placement: 'quotations', broker_slip: 'quotations', journal_voucher: 'journal-vouchers',
  disbursement: 'disbursements', collection: 'collections', remittance: 'remittance', user: 'users',
  // the records of the finance and operations screens, readable with the permission of the screen that shows them
  remittance_item: 'remittance', remittance_approval: 'remittance', commission_debit_note: 'remittance', direct_bill_client_payment: 'remittance',
  supplier_invoice: 'payables', supplier_payment: 'payables', fixed_asset: 'fixed-assets', post_dated_cheque: 'receipts',
  petty_cash_request: 'disbursements', petty_cash_fund: 'disbursements', commission_line: 'commission', override_computation: 'commission',
  incentive_calculation: 'incentive', sales_invoice: 'period-end', bir_return_filing: 'period-end', cas_book_print: 'period-end',
  period_close_run: 'period-end', year_end_run: 'period-end', recurring_journal: 'period-end', bank_reconciliation: 'bank-reconciliation',
  fleet_schedule: 'fleet', open_cover: 'marine', marine_declaration: 'marine', marine_certificate: 'marine',
  product_template: 'products', risk_mapping: 'products', posting_rule: 'masters', accounting_config_change: 'masters',
  authority_limit: 'access-control', scheduled_job: 'schedules',
};

const event = {
  id: '812', at: '2026-10-02T01:49:37.774Z', day: '2026-10-02', date: '02/10/2026', time: '09:49', atText: '02/10/2026 09:49',
  entity: 'claim', entityLabel: 'Claim', entityId: 'clm_0123456789abcdef', reference: 'CLM-2026-00012', action: 'Settlement Submitted',
  title: 'Settlement submitted', note: null, user: { username: 'j.claims', displayName: 'Jasmine Cruz', roles: ['Claims Officer'] },
  source: { channel: 'screen', label: 'Screen', name: 'Operations > Claims > Request approval' },
  changes: [{ key: 'claimStatus', label: 'Claim status', from: 'Processing', to: 'Pending approval' },
    { key: 'settlement.settlementAmount', label: 'Settlement amount', from: null, to: 'PHP 85,000.00' }],
};

define({
  method: 'GET', path: '/records/:entity/:id',
  summary: 'History of one record as business events, newest first (sort=asc for oldest first): who (display name and roles), when (date and time in general.timezone, general.date_format), from where (screen / API / system job), the event and its changed fields as label, old value, new value (formatted; secrets never shown; ID numbers masked without view:pii). :id is the id or the record number. export=csv | excel downloads the history, one row per changed field',
  screen: 'Detail screens > History (policy, quotation, claim, client, endorsement, receipt, master records)',
  query: { sort: 'desc', export: 'excel' }, response: { success: true, data: [event], total: 1, today: '2026-10-04' },
  handler: async (req, res) => {
    const entity = String(req.params.entity);
    const module = entity.startsWith('master:') ? 'masters' : MODULE_OF[entity];
    const allowed = hasPermission(req.user, 'read:audit') || (module && (hasPermission(req.user, `read:${module}`) || hasPermission(req.user, `write:${module}`)));
    if (!allowed) throw forbidden('You do not have access to the history of this record');
    const scopeKey = svc.SCOPE_ENTITY[entity === 'quote' ? 'quotation' : entity];
    if (scopeKey) await assertVisible(req, scopeKey, req.params.id);
    const events = await svc.recordHistory(entity, req.params.id, { viewer: req.user, sort: req.query.sort });
    const format = String(req.query.export || '').toLowerCase();
    if (format === 'csv' || format === 'excel' || format === 'xlsx') {
      const name = String(events[0]?.reference || req.params.id).replace(/[^A-Za-z0-9._-]+/g, '-');
      return sendSheet(res, { fileName: `history-${entity.replace(/[^a-z0-9-]+/gi, '-')}-${name}`, format: format === 'csv' ? 'csv' : 'excel',
        sheets: [{ name: 'History', columns: EXPORT_COLUMNS, rows: exportRows(events) }] });
    }
    return ok(res, events, 'OK', { total: events.length, today: await today() });
  },
});

export default router;
export const mount = '/audit';
