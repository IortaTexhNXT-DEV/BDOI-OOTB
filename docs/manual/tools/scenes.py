"""Screens captured for the BrokerVerse user manual (read by capture.py).

Each scene signs in as one user (None = signed out) and runs its steps. Steps:
  ['goto', path]                 open a screen; {q:QT-..} {pol:POL-..} {clm:CLM-..} {lead:LD-..} {client:CL-..}
                                 {end:END-..} {pv:PV-..} {jv:JV-..} {token:QT-..} are replaced by record ids
  ['btn', regex], ['text', exact text], ['click', css]    click (refused when the text looks like a saving action)
  ['fill', label, value], ['choose', label, option], ['open', label], ['type', css, value]
  ['scroll', dy], ['scrollto', text], ['viewport', height], ['wait', ms], ['key', key], ['eval', js]
  ['shot', name, {full, clip}]   write docs/manual/images/<name>.jpg
Options go in a trailing dict, e.g. {'nth': 1, 'wait': 2500}.
Only screens, tabs, menus and dialogs are opened; nothing is saved, submitted, approved or sent.
"""


def S(name, user, *steps):
    return {'name': name, 'user': user, 'steps': list(steps)}


def rowmenu(policy):
    """Open the '...' actions menu of a policy row on Operations > Policy."""
    js = ("(() => { const b = [...document.querySelectorAll('tr')].find(r => r.innerText.includes('%s'))"
          "?.querySelector('button[aria-label=\"More Actions\"]'); b.scrollIntoView({block:'center', inline:'center'});"
          " b.click(); })()") % policy
    return ['eval', js]


def rowbtn(text, css):
    """Click a button in the table row that contains text (view / edit icons)."""
    js = ("(() => { const r = [...document.querySelectorAll('tbody tr')].find(r => r.innerText.includes('%s'));"
          " const b = r.querySelector('%s'); b.scrollIntoView({block:'center', inline:'center'}); b.click(); })()") % (text, css)
    return ['eval', js]


SCENES = [
    # ------------------------------------------------------------ 1 Introduction
    S('intro-login', None, ['goto', '/login'], ['shot', 'intro-login']),
    S('intro-layout', 'BrokerVerse', ['goto', '/executive/dashboard'], ['shot', 'intro-layout']),
    S('intro-menu-search', 'BrokerVerse', ['goto', '/executive/dashboard'],
      ['type', 'input[placeholder="Search menu..."]', 'receipt'], ['wait', 800], ['shot', 'intro-menu-search']),
    S('intro-notifications', 'liza.finance', ['goto', '/agent/collections'],
      ['click', '.notification-badge-container button'], ['wait', 800], ['shot', 'intro-notifications']),
    S('intro-notification-page', 'maria.sales', ['goto', '/agent/notification'], ['shot', 'intro-notification-page']),
    S('intro-profile-menu', 'maria.sales', ['goto', '/agent/leadlisting'],
      ['click', '.navbar__container__profile__image'], ['wait', 800], ['shot', 'intro-profile-menu']),
    S('intro-not-authorised', 'carmela.morfe', ['goto', '/accounts/receipts'], ['shot', 'intro-not-authorised']),

    # persona landing pages (menu per role)
    *[S(f'persona-{u}', u, ['goto', '/'], ['wait', 1500], ['shot', f'persona-{u}'])
      for u in ('BrokerVerse', 'bea.admin', 'maria.sales', 'ramon.agent', 'jose.uw', 'ana.cs', 'carlo.claims',
                'lisa.claims2', 'liza.finance', 'fe.approver', 'carmela.morfe')],

    # ------------------------------------------------------------ Dashboards
    S('dash-exec', 'bea.admin', ['goto', '/executive/dashboard', {'wait': 3000}], ['shot', 'dash-exec'],
      ['scroll', 900], ['shot', 'dash-exec-2']),
    S('dash-claims', 'carlo.claims', ['goto', '/claims/dashboard', {'wait': 3000}], ['shot', 'dash-claims']),
    S('dash-uw', 'jose.uw', ['goto', '/underwriting/dashboard', {'wait': 3000}], ['shot', 'dash-uw']),
    S('dash-agent', 'ramon.agent', ['goto', '/agent/home', {'wait': 3000}], ['shot', 'dash-agent']),

    # ------------------------------------------------------------ Leads
    S('lead-list', 'ramon.agent', ['goto', '/agent/leadlisting'], ['shot', 'lead-list']),
    S('lead-create-line', 'ramon.agent', ['goto', '/agent/leadlisting'], ['btn', '^Create Lead$'], ['wait', 600],
      ['shot', 'lead-create-line']),
    S('lead-create-form', 'ramon.agent', ['goto', '/agent/leadlisting'], ['btn', '^Create Lead$'], ['wait', 600],
      ['click', '.p-dropdown-panel:visible li >> text=/^\\s*Motor\\s*$/'], ['wait', 1500],
      ['fill', 'First Name', 'Juan'], ['fill', 'Last Name', 'Dela Paz'], ['fill', 'Preferred Name', 'Juan'],
      ['fill', 'Contact Number', '0917 555 0142'], ['wait', 500], ['fill', 'Email ID', 'juan.delapaz@example.ph'], ['wait', 500],
      ['shot', 'lead-create-form']),
    S('lead-detail', 'ramon.agent', ['goto', '/agent/leaddetail/{lead:LD-2026-00002}'], ['shot', 'lead-detail']),
    S('lead-report', 'maria.sales', ['goto', '/agent/leadlisting'], ['btn', '^Generate Report$', {'force': True}], ['wait', 800],
      ['shot', 'lead-report']),

    # ------------------------------------------------------------ Clients
    S('client-list', 'ana.cs', ['goto', '/agent/clientlisting'], ['shot', 'client-list']),
    S('client-view', 'ana.cs', ['goto', '/agent/clientview/{client:CL-2026-00001}'], ['shot', 'client-view']),

    # ------------------------------------------------------------ Quotation (wizard walked without saving)
    S('quote-list', 'ramon.agent', ['goto', '/agent/Quotation'], ['shot', 'quote-list']),
    S('quote-wizard', 'ramon.agent',
      ['goto', '/agent/leaddetail/{lead:LD-2026-00002}'], ['btn', '^Create Quote$'], ['wait', 1500],
      ['choose', 'Insurance Company Name', 'Malayan Insurance'], ['choose', 'Insurance Policy Type', 'Comprehensive'],
      ['choose', 'Account Code', 'Ramon Dela Cruz'], ['choose', 'Payment Type', 'Cash'],
      ['choose', 'Vehicle Type', 'Private cars'], ['choose', 'Vehicle Brand', 'Honda'], ['choose', 'Model Year', '2024'],
      ['choose', 'Vehicle Model', 'City'], ['choose', 'Model Variant', '1.5 S CVT'], ['choose', 'Vehicle Color', 'White'],
      ['shot', 'quote-1-policy-details'],
      ['btn', '^Next$', {'wait': 2500}], ['shot', 'quote-2-recommendation'],
      ['btn', '^Next$', {'wait': 2500}],
      ['fill', 'Own Damage coverage', '1000000'], ['fill', 'Own Damage coverage Rate', '2'],
      ['choose', 'Bodily Injury', '100,000'], ['choose', 'Property Damage', '100,000'],
      ['choose', 'Auto Passenger PA - limit per person', '50,000'], ['btn', '^Calculate$'],
      ['viewport', 1450], ['shot', 'quote-3-coverage'], ['viewport', 1000],
      ['btn', '^Next$', {'wait': 2000}], ['fill', 'Deductible', '3000'], ['shot', 'quote-4-accessories'],
      ['btn', '^Next$', {'wait': 2500}],
      ['click', '.cr-referrer-dd'], ['click', '.p-dropdown-panel:visible li >> text=Ramon Dela Cruz'], ['wait', 1000],
      ['viewport', 1500], ['shot', 'quote-5-order-summary'], ['viewport', 1000]),
    S('quote-detail-draft', 'ramon.agent', ['goto', '/agent/quotedetailview/{q:QT-2026-00007}'], ['viewport', 1400],
      ['shot', 'quote-detail-draft']),
    S('quote-share', 'ramon.agent', ['goto', '/agent/quotedetailview/{q:QT-2026-00007}'], ['btn', '^Share$'],
      ['wait', 800], ['shot', 'quote-share']),
    S('quote-audit', 'ramon.agent', ['goto', '/agent/quotedetailview/{q:QT-2026-00006}'], ['text', 'Audit Trail'],
      ['wait', 1500], ['shot', 'quote-audit']),
    S('quote-approval-page', None, ['goto', '/approve-quote?token={token:QT-2026-00006}', {'wait': 3000}],
      ['viewport', 1400], ['shot', 'quote-approval-page']),

    # ------------------------------------------------------------ Policy conversion and policy
    S('policy-convert', 'ramon.agent',
      ['goto', '/agent/convertpolicy/customerinfo/new/{q:QT-2026-00006}', {'wait': 2500}], ['viewport', 1700],
      ['shot', 'policy-1-customer-info'], ['viewport', 1000],
      ['goto', '/agent/convertpolicy/uploadvehiclephotos/{q:QT-2026-00006}', {'wait': 3000}], ['viewport', 1300],
      ['shot', 'policy-2-vehicle-photos'], ['viewport', 1000],
      ['goto', '/agent/coveragedetailedview/{q:QT-2026-00006}', {'wait': 3000}], ['scrollto', 'Participant Details'],
      ['shot', 'policy-3-review-billing'],
      ['goto', '/agent/convertpolicy/uploadpolicy/{q:QT-2026-00006}', {'wait': 2500}], ['shot', 'policy-4-upload-policy']),
    S('policy-payment', 'jose.uw', ['goto', '/agent/policy/paymentoptions/{pol:POL-2026-90003}', {'wait': 2500}],
      ['text', 'Bank transfer'], ['wait', 600], ['type', '#pay-ref', 'INSTAPAY-20260929-0001'], ['wait', 400],
      ['viewport', 1300], ['shot', 'policy-5-payment-capture']),
    S('policy-payment-direct', 'ramon.agent',
      ['goto', '/agent/policy/paymentoptions/{pol:POL-2026-00003}', {'wait': 2500}], ['shot', 'policy-6-payment-direct']),
    S('policy-list', 'ana.cs', ['goto', '/agent/policy'], ['shot', 'policy-list']),
    S('policy-row-menu', 'ana.cs', ['goto', '/agent/policy'], rowmenu('POL-2026-00001'), ['wait', 700],
      ['shot', 'policy-row-menu']),
    S('policy-detail', 'ana.cs', ['goto', '/agent/policydetail/{pol:POL-2026-00003}', {'wait': 2500}],
      ['shot', 'policy-detail'], ['scrollto', 'Coverage Details'], ['shot', 'policy-detail-2']),
    S('policy-accounting', 'liza.finance', ['goto', '/agent/premium-accounting-entries/{pol:POL-2026-00001}'],
      ['shot', 'policy-accounting']),

    # ------------------------------------------------------------ Endorsements
    S('end-dialog', 'ana.cs', ['goto', '/agent/policy'], rowmenu('POL-2026-00001'), ['wait', 700],
      ['click', '.p-menu .p-menuitem >> text=Endorsement'], ['wait', 800], ['text', 'Coverage Change'],
      ['shot', 'end-dialog']),
    S('end-coverage', 'ana.cs', ['goto', '/agent/policy'], rowmenu('POL-2026-00001'), ['wait', 700],
      ['click', '.p-menu .p-menuitem >> text=Endorsement'], ['wait', 800], ['text', 'Coverage Change'],
      ['btn', '^Proceed$', {'wait': 2500}], ['viewport', 1500], ['shot', 'end-coverage']),
    S('end-personal', 'ana.cs', ['goto', '/agent/policy'], rowmenu('POL-2026-00001'), ['wait', 700],
      ['click', '.p-menu .p-menuitem >> text=Endorsement'], ['wait', 800], ['text', 'Personal Details Change'],
      ['btn', '^Proceed$', {'wait': 2500}], ['viewport', 1400], ['shot', 'end-personal']),
    S('end-client-tab', 'ana.cs', ['goto', '/agent/clientview/{client:CL-2026-00001}'], ['text', 'Endorsement'],
      ['wait', 1500], ['shot', 'end-client-tab']),
    S('end-view', 'ana.cs', ['goto', '/agent/endorsementdetailedviewonly/{end:END-2026-00003}', {'wait': 2500}],
      ['shot', 'end-view']),

    # ------------------------------------------------------------ Claims
    S('claim-list', 'carlo.claims', ['goto', '/agent/claim'], ['shot', 'claim-list']),
    S('claim-request', 'carlo.claims', ['goto', '/agent/policy'], rowmenu('POL-2026-00001'), ['wait', 700],
      ['click', '.p-menu .p-menuitem >> text=Claim'], ['wait', 2500], ['viewport', 1700], ['shot', 'claim-request']),
    S('claim-waiting', 'carlo.claims', ['goto', '/agent/claim'], rowbtn('CLM-2026-00001', 'button.view__btn'),
      ['wait', 2500], ['shot', 'claim-waiting']),
    S('claim-adjuster', 'carlo.claims', ['goto', '/agent/claimrequest/adjustersubmission/{clm:CLM-2026-00001}', {'wait': 2500}],
      ['viewport', 1300], ['shot', 'claim-adjuster']),
    S('claim-settlement', 'carlo.claims', ['goto', '/agent/claimrequest/settlementdetails/{clm:CLM-2026-00001}', {'wait': 2500}],
      ['shot', 'claim-settlement']),
    S('claim-approval', 'lisa.claims2', ['goto', '/agent/claim'], ['click', '.p-paginator-next'], ['wait', 1200],
      rowbtn('CLM-2026-90007', 'button.view__btn'), ['wait', 2500], ['shot', 'claim-approval']),
    S('claim-detail', 'carlo.claims', ['goto', '/agent/claimdetail/{clm:CLM-2026-00002}', {'wait': 2500}],
      ['viewport', 1600], ['shot', 'claim-detail']),
    S('claim-documents', 'carlo.claims', ['goto', '/agent/claim'], rowbtn('CLM-2026-00002', 'button.view__btn'),
      ['wait', 2500], ['shot', 'claim-documents']),
    S('claim-audit', 'carlo.claims', ['goto', '/agent/claimaudittrail/{clm:CLM-2026-00002}', {'wait': 2500}],
      ['shot', 'claim-audit']),

    # ------------------------------------------------------------ Renewals
    S('renew-policy', 'jose.uw', ['goto', '/agent/expired-policies'], ['shot', 'renew-policy']),
    S('renew-menu', 'jose.uw', ['goto', '/agent/expired-policies'], rowmenu('POL-2025-90022'), ['wait', 700],
      ['shot', 'renew-menu']),
    S('renew-queue', 'jose.uw', ['goto', '/renewal/queue'], ['shot', 'renew-queue']),
    S('renew-batch', 'jose.uw', ['goto', '/agent/renewal-batch'], ['shot', 'renew-batch']),
    S('renew-atrisk', 'maria.sales', ['goto', '/renewal/at-risk'], ['shot', 'renew-atrisk']),
    S('renew-negotiations', 'maria.sales', ['goto', '/renewal/negotiations'], ['shot', 'renew-negotiations']),
    S('renew-lapse', 'maria.sales', ['goto', '/renewal/lapse-management'], ['shot', 'renew-lapse']),
    S('renew-performance', 'maria.sales', ['goto', '/renewal/performance'], ['shot', 'renew-performance']),

    # ------------------------------------------------------------ Open items and payments
    S('open-items', 'ana.cs', ['goto', '/agent/openitemslistdata'], ['shot', 'open-items']),
    S('payments', 'ana.cs', ['goto', '/agent/payments'], ['shot', 'payments']),

    # ------------------------------------------------------------ Accounts
    S('acc-receipts', 'liza.finance', ['goto', '/accounts/receipts'], ['shot', 'acc-receipts']),
    S('acc-receipt-add', 'liza.finance', ['goto', '/accounts/receipts/addreceipts'],
      ['choose', 'Branch Code', 'Head Office'], ['choose', 'Customer Code', 'CL-2026-90003', {'wait': 1500}],
      ['choose', 'Policy Number', 'POL-2026-90003', {'wait': 1500}], ['choose', 'Receipt Mode', 'Direct Credit'],
      ['viewport', 1300], ['shot', 'acc-receipt-add']),
    S('acc-collections', 'liza.finance', ['goto', '/agent/collections'], ['shot', 'acc-collections']),
    S('acc-ageing', 'liza.finance', ['goto', '/agent/collections/aging-report', {'wait': 2500}], ['shot', 'acc-ageing']),
    S('acc-query', 'liza.finance', ['goto', '/agent/accounting/query'], ['shot', 'acc-query']),
    S('acc-all-clients', 'liza.finance', ['goto', '/agent/accounting/all-clients-details'], ['shot', 'acc-all-clients']),
    S('acc-open-entry', 'liza.finance', ['goto', '/accounts/open-entry-matching'], ['shot', 'acc-open-entry']),
    S('acc-disb', 'liza.finance', ['goto', '/accounts/paymentvoucher'], ['shot', 'acc-disb']),
    S('acc-disb-create', 'liza.finance', ['goto', '/accounts/paymentvoucher/createvoucher'], ['shot', 'acc-disb-create']),
    S('acc-disb-detail', 'fe.approver', ['goto', '/accounts/paymentvoucher/detailview/{pv:PV-2026-00023}', {'wait': 2500}],
      ['shot', 'acc-disb-detail']),
    S('acc-jv', 'liza.finance', ['goto', '/accounts/journalvoucher'], ['shot', 'acc-jv']),
    S('acc-jv-add', 'liza.finance', ['goto', '/accounts/journalvoucher/addjournalvoucture'], ['shot', 'acc-jv-add']),
    S('acc-jv-line', 'liza.finance', ['goto', '/accounts/journalvoucher/addjournalvoucture'], ['text', 'Add Data'],
      ['wait', 1000], ['shot', 'acc-jv-line']),
    S('acc-jv-detail', 'fe.approver', ['goto', '/accounts/journalvoucher/detailsjournalvocture/{jv:JV-2026-00117}'],
      ['shot', 'acc-jv-detail']),
    S('acc-correction', 'liza.finance', ['goto', '/accounts/correctionsjv/correctionsjvdetails'], ['shot', 'acc-correction']),
    S('acc-pettycash', 'liza.finance', ['goto', '/accounts/pettycash/pettycashrequest'], ['shot', 'acc-pettycash']),
    S('acc-pettycash-init', 'liza.finance', ['goto', '/accounts/pettycash/pettycashcodeinitiate'], ['shot', 'acc-pettycash-init']),

    # ------------------------------------------------------------ Commission
    S('comm-dashboard', 'liza.finance', ['goto', '/commission/dashboard', {'wait': 2500}], ['shot', 'comm-dashboard']),
    S('comm-referrers', 'liza.finance', ['goto', '/commission/referrer-accounts'], ['shot', 'comm-referrers']),
    S('comm-referrer', 'liza.finance', ['goto', '/commission/referrer-accounts'], ['text', 'Ramon Dela Cruz'],
      ['wait', 2000], ['shot', 'comm-referrer']),

    # ------------------------------------------------------------ Remittance and direct bill
    S('rem-tracking', 'liza.finance', ['goto', '/finance/remittance/tracking/status'], ['shot', 'rem-tracking']),
    S('rem-approval', 'fe.approver', ['goto', '/finance/remittance/approval'], ['shot', 'rem-approval']),
    S('rem-settlement', 'liza.finance', ['goto', '/finance/remittance/settlement/process'], ['shot', 'rem-settlement']),
    S('rem-db-raise', 'liza.finance', ['goto', '/finance/remittance/directbill', {'wait': 2500}], ['shot', 'rem-db-raise']),
    S('rem-db-notes', 'liza.finance', ['goto', '/finance/remittance/directbill', {'wait': 2500}], ['text', '2. Debit Notes'],
      ['wait', 1500], ['shot', 'rem-db-notes']),
    S('rem-db-mode', 'liza.finance', ['goto', '/finance/remittance/directbill', {'wait': 2500}], ['text', '3. Billing Mode'],
      ['wait', 1500], ['shot', 'rem-db-mode']),
    S('rem-statements', 'liza.finance', ['goto', '/finance/remittance/statements/generate'], ['shot', 'rem-statements']),
    S('rem-history', 'liza.finance', ['goto', '/finance/remittance/history'], ['shot', 'rem-history']),
    S('rem-exceptions', 'liza.finance', ['goto', '/finance/remittance/exceptions'], ['shot', 'rem-exceptions']),
    S('rem-eft', 'liza.finance', ['goto', '/finance/remittance/electronictransfer'], ['shot', 'rem-eft']),
    S('rem-automated', 'liza.finance', ['goto', '/finance/remittance/automated/execute'], ['shot', 'rem-automated']),
    S('rem-agencybill', 'liza.finance', ['goto', '/finance/remittance/agencybill'], ['shot', 'rem-agencybill']),
    S('rem-reconciliation', 'liza.finance', ['goto', '/finance/remittance/reconciliation'], ['shot', 'rem-reconciliation']),
    S('rem-analytics', 'liza.finance', ['goto', '/finance/remittance/analytics'], ['shot', 'rem-analytics']),

    # ------------------------------------------------------------ Reinsurance
    S('ri-treaties', 'jose.uw', ['goto', '/reinsurance/treaties'], ['shot', 'ri-treaties']),
    S('ri-cessions', 'jose.uw', ['goto', '/reinsurance/cessions'], ['shot', 'ri-cessions']),
    S('ri-recovery', 'carlo.claims', ['goto', '/reinsurance/claims'], ['shot', 'ri-recovery']),
    S('ri-reconciliation', 'jose.uw', ['goto', '/reinsurance/reconciliation'], ['shot', 'ri-reconciliation']),
    S('ri-analytics', 'jose.uw', ['goto', '/reinsurance/analytics'], ['shot', 'ri-analytics']),
    S('ri-treaty-master', 'bea.admin', ['goto', '/master/reinsurance/treaty'], ['shot', 'ri-treaty-master']),

    # ------------------------------------------------------------ Incentive
    S('inc-programs', 'bea.admin', ['goto', '/master/incentive/programs/view'], ['shot', 'inc-programs']),
    S('inc-calculations', 'bea.admin', ['goto', '/incentive/calculations'], ['shot', 'inc-calculations']),
    S('inc-approvals', 'bea.admin', ['goto', '/incentive/approvals'], ['shot', 'inc-approvals']),
    S('inc-statement', 'bea.admin', ['goto', '/incentive/statement'], ['shot', 'inc-statement']),

    # ------------------------------------------------------------ Product Configurator
    S('pc-dashboard', 'bea.admin', ['goto', '/product-configurator/dashboard'], ['shot', 'pc-dashboard']),
    S('pc-templates', 'bea.admin', ['goto', '/product-configurator/templates'], ['shot', 'pc-templates']),
    S('pc-template-open', 'bea.admin', ['goto', '/product-configurator/templates'],
      rowbtn('MOT-003-2025', 'button:has(.pi-pencil)'), ['wait', 3000], ['viewport', 1300], ['shot', 'pc-template']),
    S('pc-template-ctpl', 'bea.admin', ['goto', '/product-configurator/templates'],
      rowbtn('MOT-003-2025', 'button:has(.pi-pencil)'), ['wait', 3000], ['text', 'CTPL & Auto PA'], ['wait', 1500],
      ['viewport', 1500], ['shot', 'pc-template-ctpl']),
    S('pc-template-rates', 'bea.admin', ['goto', '/product-configurator/templates'],
      rowbtn('MOT-003-2025', 'button:has(.pi-pencil)'), ['wait', 3000], ['text', 'Taxes and fees', {'exact': False}],
      ['wait', 1500], ['shot', 'pc-template-taxes']),
    S('pc-coverages', 'jose.uw', ['goto', '/product-configurator/coverages'], ['shot', 'pc-coverages']),
    S('pc-rating', 'jose.uw', ['goto', '/product-configurator/rating'], ['shot', 'pc-rating']),
    S('pc-uwrules', 'jose.uw', ['goto', '/product-configurator/underwriting'], ['shot', 'pc-uwrules']),
    S('pc-workflows', 'bea.admin', ['goto', '/product-configurator/workflows'], ['shot', 'pc-workflows']),
    S('pc-risk-mapping', 'bea.admin', ['goto', '/product-configurator/risk-mapping'], ['shot', 'pc-risk-mapping']),

    # ------------------------------------------------------------ Masters
    S('m-insurer', 'bea.admin', ['goto', '/master/generals/insurancemanagement/insurancecompany'], ['shot', 'm-insurer']),
    S('m-product', 'bea.admin', ['goto', '/master/generals/insurancemanagement/productmaster'], ['shot', 'm-product']),
    S('m-vehicle', 'bea.admin', ['goto', '/master/generals/insurancemanagement/vehicle'], ['shot', 'm-vehicle']),
    S('m-signatories', 'bea.admin', ['goto', '/master/generals/insurancemanagement/signatories'], ['shot', 'm-signatories']),
    S('m-commission', 'bea.admin', ['goto', '/master/generals/commission'], ['shot', 'm-commission']),
    S('m-branch', 'bea.admin', ['goto', '/master/generals/organization/branchmaster'], ['shot', 'm-branch']),
    S('m-taxation', 'bea.admin', ['goto', '/master/finance/taxation'], ['shot', 'm-taxation']),
    S('m-bank', 'bea.admin', ['goto', '/master/finance/bank'], ['shot', 'm-bank']),
    S('m-mainaccount', 'bea.admin', ['goto', '/master/finance/mainaccount'], ['shot', 'm-mainaccount']),
    S('m-subaccount', 'bea.admin', ['goto', '/master/finance/subaccount'], ['shot', 'm-subaccount']),
    S('m-remittance', 'bea.admin', ['goto', '/master/finance/remittance'], ['shot', 'm-remittance']),
    S('m-users', 'carmela.morfe', ['goto', '/master/generals/usermanagement/user'], ['shot', 'm-users']),
    S('m-user-add', 'carmela.morfe', ['goto', '/master/generals/usermanagement/user/add'],
      ['fill', 'Username', 'juan.cruz'], ['fill', 'E-mail', 'juan.cruz@brokerverse.example'],
      ['fill', 'Display Name', 'Juan Cruz'], ['text', 'Sales / Relationship Manager'], ['shot', 'm-user-add']),
    S('m-roles', 'carmela.morfe', ['goto', '/master/generals/usermanagement/role'], ['shot', 'm-roles']),
    S('m-audit', 'carmela.morfe', ['goto', '/master/configuration/audit-trail'], ['shot', 'm-audit']),
    S('m-system-settings', 'BrokerVerse', ['goto', '/master/configuration/system-settings'], ['viewport', 1300],
      ['shot', 'm-system-settings']),
    S('m-config', 'BrokerVerse', ['goto', '/master/configuration/settings'], ['shot', 'm-config']),
    S('m-config-security', 'BrokerVerse', ['goto', '/master/configuration/settings'], ['text', 'security'],
      ['wait', 1000], ['shot', 'm-config-security']),
    S('m-config-direct-bill', 'BrokerVerse', ['goto', '/master/configuration/settings'], ['text', 'direct_bill'],
      ['wait', 1000], ['shot', 'm-config-direct-bill']),
    S('m-schedules', 'BrokerVerse', ['goto', '/master/configuration/schedules'], ['shot', 'm-schedules']),

    # ------------------------------------------------------------ Reports
    S('rep-production', 'bea.admin', ['goto', '/reports/operationalreports/production'], ['open', 'Report Criteria'],
      ['shot', 'rep-production']),
    S('rep-claims', 'bea.admin', ['goto', '/reports/operationalreports/claims'], ['open', 'Report Criteria'],
      ['shot', 'rep-claims']),
    S('rep-trial-balance', 'liza.finance', ['goto', '/reports/financialreports/trailbalance'], ['shot', 'rep-trial-balance']),
]
