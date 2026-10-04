"""Screens captured for the BrokerVerse user manual (read by capture.py).

Each scene signs in as one user (None = signed out) and runs its steps. Steps:
  ['goto', path]                 open a screen; {q:QT-..} {pol:POL-..} {clm:CLM-..} {lead:LD-..} {client:CL-..}
                                 {end:END-..} {pv:PV-..} {jv:JV-..} {bs:BS-..} {ps:PS-..} {mec:2026-08}
                                 {brc:ACC-..} {token:QT-..} are replaced by record ids
  ['btn', regex], ['text', exact text], ['click', css]    click (refused when the text looks like a saving action)
  ['fill', label, value], ['choose', label, option], ['open', label], ['type', css, value]
  ['scroll', dy], ['scrollto', text], ['viewport', height], ['wait', ms], ['key', key], ['eval', js]
  ['mock', url-glob, json-text]  answer that API call in the browser (the server is not called): used to show the
                                 sign-in steps (two-factor code, forced password change, enrolment) without changing data
  ['shot', name, {full, clip}]   write docs/manual/images/<name>.jpg
Options go in a trailing dict, e.g. {'nth': 1, 'wait': 2500}. {'force': True} opens a dialog whose button text looks
like a saving action (Upload, Import statement, Record response): the dialog is opened and photographed, never
submitted.

Users (one per role): beatriz.lacson (System Administrator), maria.rivera (Sales & Marketing), jose.bernardo (Processing Team),
ana.buenaventura (Operations), carlo.estrada (Claims), liza.quiambao (Accounting), teresa.villaroman (Accounting Manager).
"""


def S(name, user, *steps):
    return {'name': name, 'user': user, 'steps': list(steps)}


def rowmenu(policy):
    """Open the '...' actions menu of a policy row on Operations > Policy."""
    js = ("(() => { const b = [...document.querySelectorAll('tr')].find(r => r.innerText.includes('%s'))"
          "?.querySelector('button[aria-label=\"More Actions\"]'); b.scrollIntoView({block:'center', inline:'center'});"
          " b.click(); })()") % policy
    return ['eval', js]


def findpolicy(policy):
    """Type a policy number into the search box of Operations > Policy so its row is on the first page."""
    return ['type', '.main__content input[placeholder="Search"]', policy]


def rowbtn(text, css):
    """Click a button in the table row that contains text (view / edit icons)."""
    js = ("(() => { const r = [...document.querySelectorAll('tbody tr')].find(r => r.innerText.includes('%s'));"
          " const b = r.querySelector('%s'); b.scrollIntoView({block:'center', inline:'center'}); b.click(); })()") % (text, css)
    return ['eval', js]


def rowicon(text, nth=0):
    """Click the nth clickable icon (button, svg or i) in the last cell of the row that contains text."""
    js = ("(() => { const r = [...document.querySelectorAll('tbody tr')].find(r => r.innerText.includes('%s'));"
          " const c = r.querySelectorAll('td'); const cell = c[c.length - 1];"
          " const els = cell.querySelectorAll('button, svg, i, a'); const b = els[%d] || els[0];"
          " b.scrollIntoView({block:'center'}); b.dispatchEvent(new MouseEvent('click', {bubbles: true})); })()") % (text, nth)
    return ['eval', js]


def pagedrowbtn(text, css):
    """Page through a list until a row contains text, then click a button of that row."""
    js = ("async () => { for (let i = 0; i < 10; i++) {"
          " const r = [...document.querySelectorAll('tbody tr')].find(r => r.innerText.includes('%s'));"
          " if (r) { const b = r.querySelector('%s'); b.scrollIntoView({block:'center'}); b.click(); return; }"
          " document.querySelector('.p-paginator-next').click(); await new Promise(f => setTimeout(f, 1500)); } }") % (text, css)
    return ['eval', js]


def rowtext(text):
    """Click the first cell of the table row that contains text (lists that open a record on a row click)."""
    js = ("(() => { const r = [...document.querySelectorAll('tbody tr')].find(r => r.innerText.includes('%s'));"
          " r.scrollIntoView({block:'center'}); (r.querySelector('td') || r).click(); })()") % text
    return ['eval', js]


# Canned API answers for the sign-in screens (see the 'mock' step): nothing is sent to the server.
MOCK_FORGOT = '{"success": true, "message": "If the account exists, a verification code has been sent."}'
MOCK_LOGIN_2FA = ('{"success": true, "message": "Enter the code from your authenticator app", "twoFactorRequired": true,'
                  ' "challengeToken": "example", "expiresIn": 300}')
MOCK_LOGIN_CHANGE = ('{"success": true, "message": "Choose a new password to continue", "passwordChangeRequired": true,'
                     ' "mustChangePassword": true, "accessToken": "example", "expiresIn": 900, "user": {"username": "juan.cruz"}}')
MOCK_LOGIN_ENROL = ('{"success": true, "message": "Two-factor authentication must be set up for your role",'
                    ' "twoFactorSetupRequired": true, "accessToken": "example", "expiresIn": 900, "user": {"username": "juan.cruz"}}')
MOCK_2FA_SETUP = ('{"success": true, "data": {"secret": "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", "issuer": "BrokerVerse",'
                  ' "account": "juan.cruz", "otpauthUrl": "otpauth://totp/BrokerVerse:juan.cruz?secret=JBSWY3DPEHPK3PXP&issuer=BrokerVerse"}}')

ROLE_USERS = ('beatriz.lacson', 'maria.rivera', 'jose.bernardo', 'ana.buenaventura', 'carlo.estrada', 'liza.quiambao', 'teresa.villaroman')

SCENES = [
    # ------------------------------------------------------------ Getting started
    S('intro-login', None, ['goto', '/login'], ['type', '#bv-login-user', 'maria.rivera'],
      ['type', '#bv-login-password', 'example-password'], ['wait', 400], ['shot', 'intro-login']),
    S('sec-forgot-request', None, ['goto', '/login'], ['text', 'Forgot password?'], ['wait', 800],
      ['type', '#bv-forgot-user', 'maria.rivera'], ['shot', 'sec-forgot-request']),
    S('sec-forgot-reset', None, ['goto', '/login'], ['mock', '**/auth/forgot-password', MOCK_FORGOT],
      ['text', 'Forgot password?'], ['wait', 800], ['type', '#bv-forgot-user', 'maria.rivera'],
      ['btn', '^Send code$', {'force': True}], ['wait', 1000], ['type', '#bv-reset-code', '482913'],
      ['type', '#bv-reset-new', 'Example#2026'], ['type', '#bv-reset-confirm', 'Example#2026'], ['wait', 500],
      ['shot', 'sec-forgot-reset']),
    S('sec-signin-2fa', None, ['goto', '/login'], ['mock', '**/auth/login', MOCK_LOGIN_2FA],
      ['type', '#bv-login-user', 'maria.rivera'], ['type', '#bv-login-password', 'example-password'],
      ['btn', '^Sign in$'], ['wait', 1000], ['type', '#bv-2fa-code', '123456'], ['shot', 'sec-signin-2fa']),
    S('sec-signin-change', None, ['goto', '/login'], ['mock', '**/auth/login', MOCK_LOGIN_CHANGE],
      ['type', '#bv-login-user', 'juan.cruz'], ['type', '#bv-login-password', 'example-password'],
      ['btn', '^Sign in$'], ['wait', 1500], ['type', '#bv-current-password', 'Temporary-1'],
      ['type', '#bv-new-password', 'Example#2026'], ['wait', 500], ['shot', 'sec-signin-change']),
    S('sec-signin-enrol', None, ['goto', '/login'], ['mock', '**/auth/login', MOCK_LOGIN_ENROL],
      ['mock', '**/auth/2fa/setup', MOCK_2FA_SETUP],
      ['type', '#bv-login-user', 'juan.cruz'], ['type', '#bv-login-password', 'example-password'],
      ['btn', '^Sign in$'], ['wait', 1500], ['viewport', 1150], ['shot', 'sec-signin-enrol']),
    S('sec-change-password', 'maria.rivera', ['goto', '/agent/leadlisting'],
      ['click', '[aria-label^="Account menu"]'], ['wait', 600], ['text', 'Change password'], ['wait', 1200],
      ['type', '#bv-current-password', 'current-password'], ['type', '#bv-new-password', 'Example#2026'],
      ['type', '#bv-confirm-password', 'Example#2026'], ['wait', 500], ['shot', 'sec-change-password']),
    S('sec-2fa-status', 'maria.rivera', ['goto', '/agent/leadlisting'],
      ['click', '[aria-label^="Account menu"]'], ['wait', 600], ['text', 'Two-step verification'], ['wait', 1500],
      ['shot', 'sec-2fa-status']),
    S('sec-2fa-enrol', 'maria.rivera', ['goto', '/agent/leadlisting'], ['mock', '**/auth/2fa/setup', MOCK_2FA_SETUP],
      ['click', '[aria-label^="Account menu"]'], ['wait', 600], ['text', 'Two-step verification'], ['wait', 1500],
      ['btn', '^Turn on$'], ['wait', 1200], ['shot', 'sec-2fa-enrol']),
    S('intro-layout', 'beatriz.lacson', ['goto', '/executive/dashboard', {'wait': 3000}], ['shot', 'intro-layout']),
    S('intro-menu-search', 'beatriz.lacson', ['goto', '/executive/dashboard'],
      ['type', 'input[placeholder="Search menu..."]', 'reconcil'], ['wait', 800], ['shot', 'intro-menu-search']),
    S('intro-notifications', 'jose.bernardo', ['goto', '/placement/broker-slips'],
      ['click', '.notification-badge-container button'], ['wait', 800], ['shot', 'intro-notifications']),
    S('intro-notification-page', 'jose.bernardo', ['goto', '/agent/notification'], ['shot', 'intro-notification-page']),
    S('intro-profile-menu', 'maria.rivera', ['goto', '/agent/leadlisting'],
      ['click', '[aria-label^="Account menu"]'], ['wait', 800], ['shot', 'intro-profile-menu']),
    S('intro-not-authorised', 'carlo.estrada', ['goto', '/accounts/receipts'], ['shot', 'intro-not-authorised']),

    # landing page and menu of each role
    *[S(f'persona-{u}', u, ['goto', '/'], ['wait', 2500], ['shot', f'persona-{u}']) for u in ROLE_USERS],
    S('persona-menu-accounting', 'liza.quiambao', ['goto', '/accounts/receipts'], ['viewport', 1500],
      ['text', 'Period End'], ['wait', 500], ['text', 'Tax'], ['wait', 500], ['text', 'Bank Reconciliation'], ['wait', 800],
      ['shot', 'persona-menu-accounting', {'clip': {'x': 0, 'y': 0, 'width': 330, 'height': 1500}}], ['viewport', 1000]),

    # ------------------------------------------------------------ Dashboards
    S('dash-exec', 'beatriz.lacson', ['goto', '/executive/dashboard', {'wait': 3500}], ['shot', 'dash-exec'],
      ['scroll', 900], ['shot', 'dash-exec-2']),
    S('dash-sales', 'maria.rivera', ['goto', '/agent/home', {'wait': 3500}], ['shot', 'dash-sales']),
    S('dash-processing', 'jose.bernardo', ['goto', '/processing/dashboard', {'wait': 3500}], ['shot', 'dash-processing']),
    S('dash-claims', 'carlo.estrada', ['goto', '/claims/dashboard', {'wait': 3500}], ['shot', 'dash-claims']),

    # ------------------------------------------------------------ Leads and clients
    S('lead-list', 'maria.rivera', ['goto', '/agent/leadlisting'], ['shot', 'lead-list']),
    S('lead-create-line', 'maria.rivera', ['goto', '/agent/leadlisting'], ['btn', '^Create Lead$'], ['wait', 600],
      ['shot', 'lead-create-line']),
    S('lead-create-form', 'maria.rivera', ['goto', '/agent/leadlisting'], ['btn', '^Create Lead$'], ['wait', 600],
      ['click', '.p-dropdown-panel:visible li >> text=/^\\s*Motor\\s*$/'], ['wait', 1500],
      ['fill', 'First Name', 'Juan'], ['fill', 'Last Name', 'Dela Paz'], ['fill', 'Preferred Name', 'Juan'],
      ['fill', 'Contact Number', '0917 555 0142'], ['wait', 500], ['fill', 'Email ID', 'juan.delapaz@example.ph'], ['wait', 500],
      ['shot', 'lead-create-form']),
    S('lead-detail', 'maria.rivera', ['goto', '/agent/leaddetail/{lead:LD-2026-95015}'], ['shot', 'lead-detail']),
    S('lead-upload', 'maria.rivera', ['goto', '/agent/leadlisting'], ['btn', '^Bulk Upload$', {'force': True}], ['wait', 1000],
      ['shot', 'lead-upload']),
    S('client-list', 'ana.buenaventura', ['goto', '/agent/clientlisting'], ['shot', 'client-list']),
    S('client-view', 'ana.buenaventura', ['goto', '/agent/clientview/{client:CL-2026-95001}'], ['shot', 'client-view']),

    # ------------------------------------------------------------ Placement journey
    S('bs-list', 'jose.bernardo', ['goto', '/placement/broker-slips'], ['shot', 'bs-list']),
    S('bs-new', 'jose.bernardo', ['goto', '/placement/broker-slips/new', {'wait': 2500}], ['viewport', 1400], ['shot', 'bs-new']),
    S('bs-responses', 'jose.bernardo', ['goto', '/placement/broker-slips/{bs:BS-2026-90001}', {'wait': 2500}],
      ['text', 'Market responses (3)'], ['wait', 1000], ['shot', 'bs-responses']),
    S('bs-offer', 'jose.bernardo', ['goto', '/placement/broker-slips/{bs:BS-2026-90001}', {'wait': 2500}],
      ['text', 'Market responses (3)'], ['wait', 1000], ['btn', '^Edit$', {'force': True}], ['wait', 1200],
      ['shot', 'bs-offer']),
    S('bs-compare', 'jose.bernardo', ['goto', '/placement/broker-slips/{bs:BS-2026-90001}', {'wait': 2500}],
      ['text', 'Compare offers'], ['wait', 1000], ['click', 'tbody tr >> nth=0 >> .p-checkbox'], ['wait', 400],
      ['click', 'tbody tr >> nth=1 >> .p-checkbox'], ['wait', 400], ['click', 'tbody tr >> nth=0 >> .p-radiobutton'],
      ['wait', 800], ['shot', 'bs-compare']),
    S('bs-risk', 'jose.bernardo', ['goto', '/placement/broker-slips/{bs:BS-2026-90001}', {'wait': 2500}],
      ['text', 'Risk and covers'], ['wait', 1000], ['shot', 'bs-risk']),
    S('bs-closed', 'jose.bernardo', ['goto', '/placement/broker-slips/{bs:BS-2026-90002}', {'wait': 2500}], ['shot', 'bs-closed']),
    S('ps-list', 'jose.bernardo', ['goto', '/placement/placement-slips'], ['shot', 'ps-list']),
    S('ps-sent', 'jose.bernardo', ['goto', '/placement/placement-slips/{ps:PS-2026-90001}', {'wait': 2500}], ['shot', 'ps-sent']),
    S('ps-confirm', 'jose.bernardo', ['goto', '/placement/placement-slips/{ps:PS-2026-90001}', {'wait': 2500}],
      ['btn', '^Confirm$', {'force': True}], ['wait', 1200], ['shot', 'ps-confirm']),
    S('ps-issued', 'jose.bernardo', ['goto', '/placement/placement-slips/{ps:PS-2026-00001}', {'wait': 2500}], ['shot', 'ps-issued']),
    S('ps-direct', 'jose.bernardo', ['goto', '/placement/placement-slips/new', {'wait': 2500}], ['viewport', 1400], ['shot', 'ps-direct']),
    S('ps-record-policy', 'jose.bernardo', ['goto', '/placement/record-issued-policy', {'wait': 2500}], ['viewport', 1400],
      ['shot', 'ps-record-policy']),
    S('m-config-placement', 'beatriz.lacson', ['goto', '/master/configuration/settings'], ['text', 'Placement'], ['wait', 1200],
      ['shot', 'm-config-placement']),

    # ------------------------------------------------------------ Quotation (wizard walked without saving)
    S('quote-list', 'maria.rivera', ['goto', '/agent/Quotation'], ['shot', 'quote-list']),
    S('quote-wizard', 'maria.rivera',
      ['goto', '/agent/leaddetail/{lead:LD-2026-95015}'], ['btn', '^Create Quote$'], ['wait', 1500],
      ['choose', 'Insurance Company Name', 'Malayan Insurance'], ['choose', 'Insurance Policy Type', 'Comprehensive'],
      ['choose', 'Payment Type', 'Cash'],
      ['choose', 'Vehicle Type', 'Private cars'], ['choose', 'Vehicle Brand', 'Honda'], ['choose', 'Model Year', '2024'],
      ['choose', 'Vehicle Model', 'City'], ['choose', 'Model Variant', '1.5'], ['choose', 'Vehicle Color', 'White'],
      ['shot', 'quote-1-policy-details'],
      ['btn', '^Next$', {'wait': 2500}], ['shot', 'quote-2-recommendation'],
      ['btn', '^Next$', {'wait': 2500}],
      ['fill', 'Own Damage coverage', '1000000'], ['fill', 'Own Damage coverage Rate', '2'],
      ['choose', 'Bodily Injury', '100,000'], ['choose', 'Property Damage', '100,000'],
      ['choose', 'Auto Passenger PA - limit per person', '50,000'], ['btn', '^Calculate$'],
      ['viewport', 1450], ['shot', 'quote-3-coverage'], ['viewport', 1000],
      ['btn', '^Next$', {'wait': 2000}], ['fill', 'Deductible', '3000'], ['shot', 'quote-4-accessories'],
      ['btn', '^Next$', {'wait': 2500}],
      ['viewport', 1500], ['shot', 'quote-5-order-summary'], ['viewport', 1000]),
    S('quote-detail-draft', 'maria.rivera', ['goto', '/agent/quotedetailview/{q:QT-2026-95009}'], ['viewport', 1400],
      ['shot', 'quote-detail-draft']),
    S('quote-detail-accepted', 'jose.bernardo', ['goto', '/agent/quotedetailview/{q:QT-2026-95011}', {'wait': 2500}],
      ['shot', 'quote-detail-accepted']),
    S('quote-share', 'maria.rivera', ['goto', '/agent/quotedetailview/{q:QT-2026-95009}'], ['btn', '^Share$'],
      ['wait', 800], ['shot', 'quote-share']),
    S('quote-audit', 'maria.rivera', ['goto', '/agent/quotedetailview/{q:QT-2026-95009}'], ['text', 'Audit Trail'],
      ['wait', 1500], ['shot', 'quote-audit']),

    # ------------------------------------------------------------ Policy
    S('policy-convert', 'jose.bernardo',
      ['goto', '/agent/convertpolicy/customerinfo/new/{q:QT-2026-95013}', {'wait': 2500}], ['viewport', 1700],
      ['shot', 'policy-1-customer-info'], ['viewport', 1000],
      ['goto', '/agent/convertpolicy/uploadvehiclephotos/{q:QT-2026-95013}', {'wait': 3000}], ['viewport', 1300],
      ['shot', 'policy-2-vehicle-photos'], ['viewport', 1000],
      ['goto', '/agent/coveragedetailedview/{q:QT-2026-95013}', {'wait': 3000}], ['scrollto', 'Participant Details'],
      ['shot', 'policy-3-review-billing']),
    S('policy-upload-page', 'jose.bernardo', ['goto', '/agent/convertpolicy/uploadpolicy/{q:QT-2026-95001}', {'wait': 3000}],
      ['shot', 'policy-4-upload-policy']),
    S('policy-payment', 'ana.buenaventura', ['goto', '/agent/policy/paymentoptions/{pol:POL-2026-95007}', {'wait': 2500}],
      ['text', 'Bank transfer'], ['wait', 600], ['type', '#pay-ref', 'INSTAPAY-20260929-0001'], ['wait', 400],
      ['viewport', 1300], ['shot', 'policy-5-payment-capture']),
    S('policy-list', 'ana.buenaventura', ['goto', '/agent/policy'], ['shot', 'policy-list']),
    S('policy-row-menu', 'ana.buenaventura', ['goto', '/agent/policy'], findpolicy('POL-2026-95001'), ['wait', 2500], rowmenu('POL-2026-95001'), ['wait', 700],
      ['shot', 'policy-row-menu']),
    S('policy-detail', 'ana.buenaventura', ['goto', '/agent/policydetail/{pol:POL-2026-95001}', {'wait': 2500}],
      ['shot', 'policy-detail'], ['scrollto', 'Coverage Details'], ['shot', 'policy-detail-2']),
    S('policy-coins', 'jose.bernardo', ['goto', '/agent/policydetail/{pol:POL-2026-00001}', {'wait': 2500}],
      ['scrollto', 'Co-insurance', {'exact': False}], ['wait', 600], ['shot', 'policy-coins']),
    S('policy-accounting', 'liza.quiambao', ['goto', '/agent/premium-accounting-entries/{pol:POL-2026-00001}'],
      ['shot', 'policy-accounting']),
    S('policy-upload', 'jose.bernardo', ['goto', '/agent/policy'], ['btn', '^Bulk Upload$', {'force': True}], ['wait', 1000],
      ['shot', 'policy-upload']),

    # ------------------------------------------------------------ Endorsements
    S('end-dialog', 'ana.buenaventura', ['goto', '/agent/policy'], findpolicy('POL-2026-95001'), ['wait', 2500], rowmenu('POL-2026-95001'), ['wait', 700],
      ['click', '.p-menu .p-menuitem >> text=Endorsement'], ['wait', 800], ['text', 'Coverage Change'],
      ['shot', 'end-dialog']),
    S('end-coverage', 'ana.buenaventura', ['goto', '/agent/policy'], findpolicy('POL-2026-95001'), ['wait', 2500], rowmenu('POL-2026-95001'), ['wait', 700],
      ['click', '.p-menu .p-menuitem >> text=Endorsement'], ['wait', 800], ['text', 'Coverage Change'],
      ['btn', '^Proceed$', {'wait': 2500}], ['viewport', 1500], ['shot', 'end-coverage']),
    S('end-personal', 'ana.buenaventura', ['goto', '/agent/policy'], findpolicy('POL-2026-95001'), ['wait', 2500], rowmenu('POL-2026-95001'), ['wait', 700],
      ['click', '.p-menu .p-menuitem >> text=Endorsement'], ['wait', 800], ['text', 'Personal Details Change'],
      ['btn', '^Proceed$', {'wait': 2500}], ['viewport', 1400], ['shot', 'end-personal']),
    S('end-client-tab', 'ana.buenaventura', ['goto', '/agent/clientview/{client:CL-2026-95001}'], ['text', 'Endorsement'],
      ['wait', 1500], ['shot', 'end-client-tab']),
    S('end-view', 'jose.bernardo', ['goto', '/agent/endorsementdetailedviewonly/{end:END-2026-95001}', {'wait': 2500}],
      ['shot', 'end-view']),

    # ------------------------------------------------------------ Claims
    S('claim-list', 'carlo.estrada', ['goto', '/agent/claim'], ['shot', 'claim-list']),
    S('claim-request', 'carlo.estrada', ['goto', '/agent/policy'], findpolicy('POL-2026-95001'), ['wait', 2500], rowmenu('POL-2026-95001'), ['wait', 700],
      ['click', '.p-menu .p-menuitem >> text=Claim'], ['wait', 2500], ['viewport', 1700], ['shot', 'claim-request']),
    S('claim-adjuster', 'carlo.estrada', ['goto', '/agent/claimrequest/adjustersubmission/{clm:CLM-2026-90002}', {'wait': 2500}],
      ['viewport', 1300], ['shot', 'claim-adjuster']),
    S('claim-settlement', 'carlo.estrada', ['goto', '/agent/claimrequest/settlementdetails/{clm:CLM-2026-90005}', {'wait': 2500}],
      ['viewport', 1300], ['shot', 'claim-settlement']),
    S('claim-approval', 'carlo.estrada', ['goto', '/agent/claimrequest/settlementapproval/{clm:CLM-2026-90008}', {'wait': 2500}],
      ['shot', 'claim-approval']),
    S('claim-detail', 'carlo.estrada', ['goto', '/agent/claimdetail/{clm:CLM-2026-90007}', {'wait': 2500}],
      ['viewport', 1600], ['shot', 'claim-detail']),
    S('claim-cash', 'beatriz.lacson', ['goto', '/agent/claimdetailedview/{clm:CLM-2026-90007}', {'wait': 3000}],
      ['scrollto', 'Settlement cash', {'exact': False}], ['wait', 600], ['shot', 'claim-cash']),
    S('claim-audit', 'carlo.estrada', ['goto', '/agent/claimaudittrail/{clm:CLM-2026-90007}', {'wait': 2500}],
      ['shot', 'claim-audit']),

    # ------------------------------------------------------------ Renewals, open items, payments
    S('renew-policy', 'ana.buenaventura', ['goto', '/agent/expired-policies'], ['shot', 'renew-policy']),
    S('renew-queue', 'ana.buenaventura', ['goto', '/renewal/queue'], ['shot', 'renew-queue']),
    S('renew-batch', 'ana.buenaventura', ['goto', '/agent/renewal-batch'], ['shot', 'renew-batch']),
    S('renew-atrisk', 'maria.rivera', ['goto', '/renewal/at-risk'], ['shot', 'renew-atrisk']),
    S('renew-analytics', 'maria.rivera', ['goto', '/renewal/analytics', {'wait': 3000}], ['shot', 'renew-analytics']),
    S('renew-negotiations', 'maria.rivera', ['goto', '/renewal/negotiations'], ['shot', 'renew-negotiations']),
    S('renew-lapse', 'ana.buenaventura', ['goto', '/renewal/lapse-management'], ['shot', 'renew-lapse']),
    S('renew-performance', 'maria.rivera', ['goto', '/renewal/performance'], ['shot', 'renew-performance']),
    S('open-items', 'ana.buenaventura', ['goto', '/agent/openitemslistdata'], ['shot', 'open-items']),
    S('payments', 'ana.buenaventura', ['goto', '/agent/payments'], ['shot', 'payments']),

    # ------------------------------------------------------------ Accounts
    S('acc-receipts', 'liza.quiambao', ['goto', '/accounts/receipts'], ['shot', 'acc-receipts']),
    S('acc-receipt-add', 'liza.quiambao', ['goto', '/accounts/receipts/addreceipts', {'wait': 2500}], ['viewport', 1300],
      ['shot', 'acc-receipt-add']),
    S('acc-collections', 'liza.quiambao', ['goto', '/agent/collections'], ['shot', 'acc-collections']),
    S('acc-open-items-import', 'liza.quiambao', ['goto', '/agent/collections'],
      ['btn', '^Import open items$', {'force': True}], ['wait', 1000], ['shot', 'acc-open-items-import']),
    S('acc-ageing', 'liza.quiambao', ['goto', '/agent/collections/aging-report', {'wait': 2500}], ['shot', 'acc-ageing']),
    S('acc-query', 'liza.quiambao', ['goto', '/agent/accounting/query'], ['shot', 'acc-query']),
    S('acc-all-clients', 'liza.quiambao', ['goto', '/agent/accounting/all-clients-details'], ['shot', 'acc-all-clients']),
    S('acc-open-entry', 'liza.quiambao', ['goto', '/accounts/open-entry-matching'], ['shot', 'acc-open-entry']),
    S('acc-disb', 'liza.quiambao', ['goto', '/accounts/paymentvoucher'], ['shot', 'acc-disb']),
    S('acc-disb-create', 'liza.quiambao', ['goto', '/accounts/paymentvoucher/createvoucher'], ['shot', 'acc-disb-create']),
    S('acc-jv', 'liza.quiambao', ['goto', '/accounts/journalvoucher'], ['shot', 'acc-jv']),
    S('acc-jv-add', 'liza.quiambao', ['goto', '/accounts/journalvoucher/addjournalvoucture'], ['shot', 'acc-jv-add']),
    S('acc-jv-line', 'liza.quiambao', ['goto', '/accounts/journalvoucher/addjournalvoucture'], ['text', 'Add Data'],
      ['wait', 1000], ['shot', 'acc-jv-line']),
    S('acc-correction', 'liza.quiambao', ['goto', '/accounts/correctionsjv/correctionsjvdetails'], ['shot', 'acc-correction']),
    S('acc-pettycash', 'liza.quiambao', ['goto', '/accounts/pettycash/pettycashrequest'], ['shot', 'acc-pettycash']),

    # ------------------------------------------------------------ Commission, remittance, direct bill
    S('comm-dashboard', 'liza.quiambao', ['goto', '/commission/dashboard', {'wait': 2500}], ['shot', 'comm-dashboard']),
    S('comm-referrers', 'liza.quiambao', ['goto', '/commission/referrer-accounts'], ['shot', 'comm-referrers']),
    S('comm-referrer', 'liza.quiambao', ['goto', '/commission/referrer-accounts'], ['text', 'Juan Dela Cruz'],
      ['wait', 2000], ['shot', 'comm-referrer']),
    S('rem-automated', 'liza.quiambao', ['goto', '/finance/remittance/automated/execute'], ['shot', 'rem-automated']),
    S('rem-tracking', 'liza.quiambao', ['goto', '/finance/remittance/tracking/status'], ['shot', 'rem-tracking']),
    S('rem-approval', 'teresa.villaroman', ['goto', '/finance/remittance/approval'], ['shot', 'rem-approval']),
    S('rem-settlement', 'liza.quiambao', ['goto', '/finance/remittance/settlement/process'], ['shot', 'rem-settlement']),
    S('rem-db-raise', 'liza.quiambao', ['goto', '/finance/remittance/directbill', {'wait': 2500}], ['shot', 'rem-db-raise']),
    S('rem-db-mode', 'liza.quiambao', ['goto', '/finance/remittance/directbill', {'wait': 2500}], ['text', '3. Billing Mode'],
      ['wait', 1500], ['shot', 'rem-db-mode']),
    S('rem-reconciliation', 'liza.quiambao', ['goto', '/finance/remittance/reconciliation'], ['shot', 'rem-reconciliation']),
    S('rem-history', 'liza.quiambao', ['goto', '/finance/remittance/history'], ['shot', 'rem-history']),

    # ------------------------------------------------------------ Period end
    S('pe-periods', 'liza.quiambao', ['goto', '/accounts/period-end/periods', {'wait': 2500}], ['shot', 'pe-periods']),
    S('pe-opening', 'liza.quiambao', ['goto', '/accounts/period-end/periods', {'wait': 2500}],
      ['btn', '^Import opening balances$', {'force': True}], ['wait', 1000], ['shot', 'pe-opening']),
    S('pe-close-list', 'liza.quiambao', ['goto', '/accounts/period-end/close', {'wait': 2500}], ['shot', 'pe-close-list']),
    S('pe-close-run', 'liza.quiambao', ['goto', '/accounts/period-end/close/{mec:MEC-2026-00001}', {'wait': 3000}],
      ['viewport', 1500], ['shot', 'pe-close-run'], ['viewport', 1000]),
    S('pe-year-end', 'liza.quiambao', ['goto', '/accounts/period-end/year-end', {'wait': 2500}], ['shot', 'pe-year-end']),
    S('pe-recurring', 'liza.quiambao', ['goto', '/accounts/period-end/recurring', {'wait': 2500}], ['shot', 'pe-recurring']),
    S('pe-statements', 'liza.quiambao', ['goto', '/accounts/period-end/statements', {'wait': 3000}], ['shot', 'pe-statements']),
    S('pe-checklist', 'liza.quiambao', ['goto', '/master/finance/close-checklist'], ['shot', 'pe-checklist']),
    S('pe-periods-mgr', 'teresa.villaroman', ['goto', '/accounts/period-end/periods', {'wait': 2500}], ['shot', 'pe-periods-mgr']),

    # ------------------------------------------------------------ Tax
    S('tax-2307', 'liza.quiambao', ['goto', '/accounts/tax/2307', {'wait': 3000}], ['shot', 'tax-2307']),
    S('tax-vat', 'liza.quiambao', ['goto', '/accounts/tax/reports/bir-vat-summary', {'wait': 3000}], ['btn', '^Preview$', {'wait': 3000}], ['shot', 'tax-vat']),
    S('tax-sawt', 'liza.quiambao', ['goto', '/accounts/tax/reports/bir-sawt', {'wait': 3000}], ['btn', '^Preview$', {'wait': 3000}], ['shot', 'tax-sawt']),
    S('tax-qap', 'liza.quiambao', ['goto', '/accounts/tax/reports/bir-qap', {'wait': 3000}], ['btn', '^Preview$', {'wait': 3000}], ['shot', 'tax-qap']),
    S('tax-slsp', 'liza.quiambao', ['goto', '/accounts/tax/reports/bir-slsp-sales', {'wait': 3000}], ['btn', '^Preview$', {'wait': 3000}], ['shot', 'tax-slsp']),
    S('tax-codes', 'liza.quiambao', ['goto', '/master/finance/taxation'], ['shot', 'tax-codes']),

    # ------------------------------------------------------------ Bank reconciliation
    S('br-workspace', 'liza.quiambao', ['goto', '/accounts/bank-reconciliation?account=ACC-BDO-001&period=2026-08', {'wait': 3000}],
      ['viewport', 1300], ['shot', 'br-workspace'], ['viewport', 1000]),
    S('br-import', 'liza.quiambao', ['goto', '/accounts/bank-reconciliation?account=ACC-BDO-001&period=2026-08', {'wait': 3000}],
      ['btn', '^Import statement$', {'force': True}], ['wait', 1200], ['shot', 'br-import']),
    S('br-stale', 'liza.quiambao', ['goto', '/accounts/bank-reconciliation?account=ACC-BDO-001&period=2026-08', {'wait': 3000}],
      ['btn', '^Stale cheques$'], ['wait', 1500], ['shot', 'br-stale']),
    S('br-recs', 'liza.quiambao', ['goto', '/accounts/bank-reconciliation/reconciliations', {'wait': 2500}], ['shot', 'br-recs']),
    S('br-rec', 'teresa.villaroman', ['goto', '/accounts/bank-reconciliation/reconciliations/{brc:BRC-2026-00001}', {'wait': 3000}],
      ['viewport', 1300], ['shot', 'br-rec'], ['viewport', 1000]),
    S('br-statement', 'liza.quiambao', ['goto', '/accounts/bank-reconciliation/reports/bank-reconciliation-statement', {'wait': 2500}],
      ['shot', 'br-statement']),
    S('br-formats', 'liza.quiambao', ['goto', '/master/finance/bank-statement-formats', {'wait': 2500}], ['shot', 'br-formats']),
    S('br-types', 'liza.quiambao', ['goto', '/master/finance/bank-transaction-types', {'wait': 2500}], ['shot', 'br-types']),

    # ------------------------------------------------------------ Reinsurance and incentives
    S('ri-treaties', 'jose.bernardo', ['goto', '/reinsurance/treaties'], ['shot', 'ri-treaties']),
    S('ri-cessions', 'jose.bernardo', ['goto', '/reinsurance/cessions'], ['shot', 'ri-cessions']),
    S('ri-recovery', 'carlo.estrada', ['goto', '/reinsurance/claims'], ['shot', 'ri-recovery']),
    S('ri-reconciliation', 'liza.quiambao', ['goto', '/reinsurance/reconciliation'], ['shot', 'ri-reconciliation']),
    S('ri-treaty-master', 'beatriz.lacson', ['goto', '/master/reinsurance/treaty'], ['shot', 'ri-treaty-master']),
    S('inc-programs', 'beatriz.lacson', ['goto', '/master/incentive/programs/view'], ['shot', 'inc-programs']),
    S('inc-calculations', 'liza.quiambao', ['goto', '/incentive/calculations'], ['shot', 'inc-calculations']),
    S('inc-approvals', 'teresa.villaroman', ['goto', '/incentive/approvals'], ['shot', 'inc-approvals']),
    S('inc-statement', 'liza.quiambao', ['goto', '/incentive/statement', {'wait': 8000}], ['shot', 'inc-statement']),

    # ------------------------------------------------------------ Product Configurator
    S('pc-dashboard', 'jose.bernardo', ['goto', '/product-configurator/dashboard'], ['shot', 'pc-dashboard']),
    S('pc-templates', 'jose.bernardo', ['goto', '/product-configurator/templates'], ['shot', 'pc-templates']),
    S('pc-template-ctpl', 'jose.bernardo', ['goto', '/product-configurator/templates'],
      pagedrowbtn('MOT-003-2025', 'button'), ['wait', 3000], ['text', 'CTPL & Auto PA'], ['wait', 1500],
      ['viewport', 1500], ['shot', 'pc-template-ctpl']),
    S('pc-rating', 'jose.bernardo', ['goto', '/product-configurator/rating'], ['shot', 'pc-rating']),
    S('pc-uwrules', 'jose.bernardo', ['goto', '/product-configurator/underwriting'], ['shot', 'pc-uwrules']),

    # ------------------------------------------------------------ Masters and administration
    S('m-company', 'beatriz.lacson', ['goto', '/master/generals/organization/companymaster'],
      ['type', '.main__content input[placeholder^="Search"]', 'iorta'], ['wait', 2500], ['shot', 'm-company']),
    S('m-company-edit', 'beatriz.lacson', ['goto', '/master/generals/organization/companymaster'],
      ['type', '.main__content input[placeholder^="Search"]', 'iorta'], ['wait', 2500], rowicon('ITX', 1), ['wait', 2500],
      ['viewport', 760], ['shot', 'm-company-edit'], ['viewport', 1000]),
    S('m-insurer', 'beatriz.lacson', ['goto', '/master/generals/insurancemanagement/insurancecompany'], ['shot', 'm-insurer']),
    S('m-insurer-edit', 'beatriz.lacson', ['goto', '/master/generals/insurancemanagement/insurancecompany/edit/2', {'wait': 2500}],
      ['viewport', 800], ['shot', 'm-insurer-edit'], ['viewport', 1000]),
    S('m-upload', 'beatriz.lacson', ['goto', '/master/generals/location/city'], ['btn', '^Upload$', {'force': True}], ['wait', 1200],
      ['shot', 'm-upload']),
    S('m-branch', 'beatriz.lacson', ['goto', '/master/generals/organization/branchmaster'], ['shot', 'm-branch']),
    S('m-docnum', 'beatriz.lacson', ['goto', '/master/configuration/document-numbering', {'wait': 2500}], ['shot', 'm-docnum']),
    S('m-crm', 'beatriz.lacson', ['goto', '/master/finance/commission-rate-matrix', {'wait': 2500}], ['shot', 'm-crm']),
    S('m-posting-rules', 'beatriz.lacson', ['goto', '/master/finance/posting-rules', {'wait': 2500}], ['shot', 'm-posting-rules']),
    S('m-posting-rule', 'beatriz.lacson', ['goto', '/master/finance/posting-rules', {'wait': 2500}],
      ['text', 'Policy issued – broker billed'], ['wait', 2000], ['viewport', 1400], ['shot', 'm-posting-rule'], ['viewport', 1000]),
    S('m-acct-det', 'beatriz.lacson', ['goto', '/master/finance/account-determination', {'wait': 2500}], ['shot', 'm-acct-det']),
    S('m-writeoff', 'beatriz.lacson', ['goto', '/master/finance/account-determination', {'wait': 2500}],
      ['text', 'Write-off reasons'], ['wait', 1500], ['shot', 'm-writeoff']),
    S('m-mainaccount', 'beatriz.lacson', ['goto', '/master/finance/mainaccount'], ['shot', 'm-mainaccount']),
    S('m-bank', 'beatriz.lacson', ['goto', '/master/finance/bank'], ['shot', 'm-bank']),
    S('m-users', 'beatriz.lacson', ['goto', '/master/generals/usermanagement/user'], ['shot', 'm-users']),
    S('m-user-add', 'beatriz.lacson', ['goto', '/master/generals/usermanagement/user/add'],
      ['fill', 'Username', 'juan.cruz'], ['fill', 'E-mail', 'juan.cruz@brokerverse.example'],
      ['fill', 'Display Name', 'Juan Cruz'], ['text', 'Sales & Marketing (Account Executive)'], ['shot', 'm-user-add']),
    S('m-user-actions', 'beatriz.lacson', ['goto', '/master/generals/usermanagement/user'],
      pagedrowbtn('maria.rivera', 'button.user__actions__btn'), ['wait', 800], ['shot', 'm-user-actions']),
    S('m-roles', 'beatriz.lacson', ['goto', '/master/generals/usermanagement/role'], ['shot', 'm-roles']),
    S('m-system-settings', 'beatriz.lacson', ['goto', '/master/configuration/system-settings'],
      ['shot', 'm-system-settings', {'clip': {'x': 0, 'y': 0, 'width': 1600, 'height': 700}}]),
    S('m-config', 'beatriz.lacson', ['goto', '/master/configuration/settings'], ['shot', 'm-config']),
    S('m-config-security', 'beatriz.lacson', ['goto', '/master/configuration/settings'], ['text', 'Security'],
      ['wait', 1000], ['shot', 'm-config-security']),
    S('m-schedules', 'beatriz.lacson', ['goto', '/master/configuration/schedules'], ['shot', 'm-schedules']),
    S('m-audit', 'beatriz.lacson', ['goto', '/master/configuration/audit-trail'], ['shot', 'm-audit']),

    # ------------------------------------------------------------ Reports
    S('rep-catalogue', 'beatriz.lacson', ['goto', '/reports/catalogue', {'wait': 2500}], ['viewport', 1250], ['shot', 'rep-catalogue']),
    S('rep-catalogue-acc', 'liza.quiambao', ['goto', '/reports/catalogue', {'wait': 2500}], ['shot', 'rep-catalogue-acc']),
    S('rep-preview', 'maria.rivera', ['goto', '/reports/run/production-register', {'wait': 2500}],
      ['choose', 'Report Criteria', 'Overall'], ['btn', '^Preview$', {'wait': 3000}], ['viewport', 1300], ['shot', 'rep-preview']),
    S('rep-income', 'liza.quiambao', ['goto', '/reports/financialreports/pe/income-statement', {'wait': 3000}], ['shot', 'rep-income']),
    S('rep-coins', 'liza.quiambao', ['goto', '/reports/financialreports/coinsuranceregister', {'wait': 3000}], ['shot', 'rep-coins']),
    S('rep-due-insurers', 'liza.quiambao', ['goto', '/reports/financialreports/duetoinsurers', {'wait': 3000}],
      ['shot', 'rep-due-insurers']),
]

# Scenes run after the data change in the README (a draft quotation sent for customer approval).
LATE_SCENES = [
    S('quote-approval-page', None, ['goto', '/approve-quote?token={token:QT-2026-95009}', {'wait': 3000}],
      ['viewport', 1400], ['shot', 'quote-approval-page']),
]
