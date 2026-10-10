/**
 * Feature catalogue: every function of the platform, the release tier it belongs to and what it controls. The single
 * place a screen, an API, a job, a connector, a setting or a section of a screen is tied to a release.
 *
 * Tiers:
 *   PHASE_1   core TISPH scope (BRD v2.2, FRS); always on, never switched off from the tenant
 *   PHASE_2   built and delivered off; switched on by the iorta TechNXT platform administrator ("Enable Phase 2")
 *   FUTURE    available in the platform but outside the BRD and FRS; off until enabled for a later release
 *   PLATFORM  supporting functions (users, configuration, audit, jobs); always on
 *
 * A feature: { key, name, description, module, tier, requirements, dependsOn, decision?, controls }.
 * controls:
 *   menus        side-menu entries, as the names of the menu from the top-level group down ("Accounts > Payables > AP Ageing")
 *   routes       other front-end addresses of the feature (wizard steps, public pages), matched as prefixes
 *   api          API paths (after /api) refused with 403 FEATURE_NOT_ENABLED while the feature is off; matched as
 *                prefixes on whole segments, `*` stands for one segment and a trailing `$` asks for the exact path
 *   jobs         scheduled job codes the scheduler skips while the feature is off
 *   connectors   integration connectors that cannot be enabled (and hold their messages) while the feature is off
 *   settings     setting keys refused on Master > Configuration while the feature is off
 *   sections     parts of in-scope screens (<Feature name="key"> on the screen), described for the impact preview
 *   documents    user manual sections (heading ids) left out of the help while the feature is off
 *   reports      report codes of Reports > All Reports left out while the feature is off
 *   data         tables whose records make a disable read-only (view and export) instead of removing the feature
 *   permissions  permission codes used to list the roles that gain access when the feature is enabled
 *
 * A new screen registers here: add its menu path to `menus` of the feature of its module (PHASE_1 by default), or add
 * a feature. test/feature-catalogue.test.js fails while a menu entry belongs to no feature or to two.
 */

export const TIERS = Object.freeze({
  PHASE_1: { code: 'PHASE_1', name: 'Phase 1', alwaysOn: true, order: 1 },
  PLATFORM: { code: 'PLATFORM', name: 'Platform', alwaysOn: true, order: 2 },
  PHASE_2: { code: 'PHASE_2', name: 'Phase 2', alwaysOn: false, order: 3 },
  FUTURE: { code: 'FUTURE', name: 'Future release', alwaysOn: false, order: 4 },
});

const CONTROL_KEYS = ['menus', 'routes', 'api', 'jobs', 'connectors', 'settings', 'sections', 'documents', 'reports', 'data', 'permissions'];

const feature = ({ key, name, description, module, tier, requirements = [], dependsOn = [], decision = null, ...controls }) => Object.freeze({
  key, name, description, module, tier, requirements, dependsOn, decision,
  controls: Object.freeze(Object.fromEntries(CONTROL_KEYS.map((k) => [k, Object.freeze([...(controls[k] || [])])]))),
});

const P1 = 'PHASE_1';
const P2 = 'PHASE_2';
const FUT = 'FUTURE';
const PLAT = 'PLATFORM';

export const FEATURES = Object.freeze([
  // ---------------------------------------------------------------- platform
  feature({
    key: 'my-work', name: 'My Work and notifications', module: 'Platform', tier: PLAT,
    description: 'Daily work queue by role, notifications, own profile, global search and the on-screen help',
    requirements: ['TIS-BRD-RPT-01', 'PBSM-M16-NOTIFICATIONS'],
    menus: ['My Work'], jobs: ['my-work-reminders'],
  }),
  feature({
    key: 'user-management', name: 'Users and roles', module: 'Platform', tier: PLAT,
    description: 'Users, roles, the user access matrix and role permissions with maker-checker',
    requirements: ['TIS-BRD-SEC-01', 'TIS-BRD-SEC-02', 'TIS-BRD-SEC-05', 'PBSM-M17v4-RBAC'],
    menus: ['Master > User Management > User', 'Master > User Management > Role', 'Master > User Management > User Access Matrix',
      'Master > User Management > Role Permissions'],
    jobs: ['dormant-users'],
  }),
  feature({
    key: 'access-governance', name: 'Access governance', module: 'Platform', tier: PLAT,
    description: 'Approval limits, segregation of duties, delegations and periodic access reviews',
    requirements: ['TIS-BRD-SEC-01', 'TIS-BRD-SEC-03', 'TIS-BRD-NFR-02'],
    menus: ['Master > User Management > Authority Matrix', 'Master > User Management > Segregation of Duties', 'Master > User Management > Delegations',
      'Master > User Management > Access Reviews'],
  }),
  feature({
    key: 'audit-trail', name: 'Audit trail', module: 'Platform', tier: PLAT,
    description: 'Record of every change with who, when, from where and the values before and after',
    requirements: ['PBSM-M17v4-AUDIT', 'TIS-BRD-NFR-14.7', 'BRD-5.14'],
    menus: ['Master > System Configuration > Audit Trail'],
  }),
  feature({
    key: 'system-configuration', name: 'System configuration', module: 'Platform', tier: PLAT,
    description: 'Settings, document numbering, job schedules, e-mail and document layouts, signatures and the e-mail outbox',
    requirements: ['TIS-BRD-PROD-01', 'TIS-BRD-NFR-08.1', 'TIS-BRD-DOC-01', 'PBSM-M17v4-IFMON', 'TIS-BRD-NOTIF-01', 'TIS-BRD-NFR-10.6', 'TIS-BRD-QUOT-07', 'TIS-BRD-INTG-01'],
    menus: ['Master > System Configuration > E-mail Layout', 'Master > System Configuration > Documents and Reports Layout',
      'Master > System Configuration > Document Signatures', 'Master > System Configuration > Configuration', 'Master > System Configuration > Document Numbering',
      'Master > System Configuration > Schedules', 'Master > System Configuration > E-mail Outbox'],
    jobs: ['housekeeping', 'daily-reports', 'email-outbox', 'integration-outbox'],
  }),
  feature({
    key: 'organisation-masters', name: 'Organisation and location masters', module: 'Platform', tier: PLAT,
    description: 'Company, branch, reporting hierarchy, designations, locations with holidays, and the peso as base currency',
    requirements: ['TIS-BRD-MAS-01', 'TIS-BRD-MAS-02', 'TIS-BRD-MAS-03', 'TIS-BRD-MAS-08', 'PBSM-M01-M03-ORG'],
    menus: ['Master > Organization > Company', 'Master > Organization > Branch', 'Master > Employee Management > Hierarchy', 'Master > Employee Management > Designation',
      'Master > Location > Country', 'Master > Location > Province', 'Master > Location > City / Municipality', 'Master > Finance > Currency'],
  }),
  feature({
    key: 'product-configurator-home', name: 'Product Configurator home', module: 'Platform', tier: PLAT,
    description: 'Entry point to the configuration studio',
    requirements: ['TIS-BRD-PROD-01'],
    menus: ['Product Configurator > Dashboard'],
  }),
  feature({
    key: 'configuration-promotion', name: 'Configuration promotion', module: 'Platform', tier: PLAT,
    description: 'Configuration workbook, master data load at cutover and comparison of environments (Dev, UAT, Production)',
    requirements: ['TIS-BRD-NFR-08', 'PBSM-MIG-MASTERS'],
  }),
  feature({
    key: 'features-releases', name: 'Features and releases', module: 'Platform', tier: PLAT,
    description: 'Catalogue of the functions of the platform with their release tier and status; enabling by the iorta TechNXT platform administrator',
    requirements: ['TIS-BRD-NFR-8.2'],
    menus: ['Master > Platform > Features & Releases', 'Master > System Configuration > Features & Releases'],
  }),

  // ---------------------------------------------------------------- dashboards
  feature({
    key: 'dashboards', name: 'Executive, processing and claims dashboards', module: 'Dashboard', tier: P1,
    description: 'Landing dashboards by department: book of business, items awaiting approval, processing and claims work',
    requirements: ['TIS-BRD-RPT-01', 'TIS-BRD-RPT-03', 'TIS-BRD-NFR-10.1'],
    menus: ['Dashboard > Executive Dashboard', 'Dashboard > Claims Dashboard', 'Dashboard > Processing Dashboard'],
  }),
  feature({
    key: 'sales-dashboard', name: 'Sales dashboard', module: 'Dashboard', tier: P2,
    description: 'Conversion, figures by sales person, premium and policies by product and the monthly trend; agent performance on the executive dashboard',
    requirements: ['TIS-BRD-RPT-DSH-05', 'TIS-BRD-RPT-DSH-06', 'TIS-BRD-RPT-DSH-07', 'CR-17', 'FGA-SD-01', 'FGA-SD-02'],
    decision: { question: 'TIS-BRD-RPT-02 (Phase 1) names the same measures as the Phase 2 dashboards DSH-05 to DSH-07. Is the Sales Dashboard the Phase 1 delivery of RPT-02 (always on) or a Phase 2 dashboard?',
      options: ['Phase 1 (RPT-02 delivery, always on)', 'Phase 2 (enable with Phase 2)'] },
    menus: ['Dashboard > Sales Dashboard'], api: ['/dashboard/sales'],
    sections: ['Executive Dashboard: agent performance'], documents: ['sales-dashboard', 'tis-sales-unit-head-dashboard'],
    permissions: ['read:leads', 'read:quotations'],
  }),
  feature({
    key: 'executive-satisfaction', name: 'Customer satisfaction indicator', module: 'Dashboard', tier: FUT,
    description: 'Customer satisfaction figure among the renewal performance targets (no survey data is captured)',
    sections: ['Renewals > Performance: customer satisfaction'],
  }),
  feature({
    key: 'executive-regional', name: 'Regional performance', module: 'Dashboard', tier: FUT,
    description: 'Production and collections by region on the executive dashboard',
    sections: ['Executive Dashboard: regional performance'],
  }),

  // ---------------------------------------------------------------- sales and placement
  feature({
    key: 'prospects', name: 'Prospects and lead assignment', module: 'Sales & Marketing', tier: P1,
    description: 'Prospect capture and import, duplicate check, quick quote, assignment rules and reassignment, lead sources',
    requirements: ['TIS-BRD-LEAD-01', 'TIS-BRD-LEAD-02', 'TIS-BRD-LEAD-03', 'TIS-BRD-LEAD-04', 'TIS-BRD-LEAD-05', 'TIS-BRD-LEAD-06', 'TIS-BRD-LEAD-07', 'TIS-BRD-LEAD-08', 'TIS-BRD-LEAD-09'],
    menus: ['Operations > Sales & Marketing > Prospects', 'Operations > Sales & Marketing > Quick Quote', 'Operations > Sales & Marketing > Lead Assignment',
      'Master > Insurance Management > Lead Sources'],
  }),
  feature({
    key: 'sales-activities', name: 'Sales activities', module: 'Sales & Marketing', tier: P1,
    description: 'Calls, meetings, e-mails and visits against prospects and clients, with their types and outcomes',
    requirements: ['TIS-BRD-LEAD-10'],
    menus: ['Operations > Sales & Marketing > Sales Activities', 'Master > Organization > Sales Activity Types', 'Master > Organization > Sales Activity Outcomes'],
  }),
  feature({
    key: 'quotations', name: 'Quotations and placement', module: 'Sales & Marketing', tier: P1,
    description: 'Motor, personal accident and credit life quotations with maker-checker, requests for quotation and placement slips to the insurer',
    requirements: ['TIS-BRD-QUOT-01', 'TIS-BRD-QUOT-02', 'TIS-BRD-QUOT-03', 'TIS-BRD-QUOT-04', 'TIS-BRD-QUOT-05', 'TIS-BRD-QUOT-06', 'TIS-BRD-QUOT-08',
      'TIS-BRD-PJRN-05', 'TIS-BRD-ISSUE-01', 'TIS-BRD-ISSUE-02', 'MOM-S2-PLACEMENT-DIRECT'],
    menus: ['Operations > Sales & Marketing > Request for Quotation', 'Operations > Sales & Marketing > Quotations', 'Operations > Sales & Marketing > Placement Slips'],
  }),
  feature({
    key: 'dealer-programmes', name: 'Dealer programmes', module: 'Sales & Marketing', tier: P1,
    description: 'Scheme 1 and 2 programmes of brand-new vehicles, dealer sales uploads and bank endorsement letters',
    requirements: ['TIS-BRD-SCHM-01', 'TIS-BRD-SCHM-02', 'TIS-BRD-SCHM-03', 'TIS-BRD-MAS-05', 'TIS-BRD-PROD-15'],
    menus: ['Operations > Sales & Marketing > Dealer Programmes'],
  }),
  feature({
    key: 'comparison-reports', name: 'Comparison reports', module: 'Sales & Marketing', tier: FUT,
    description: 'Client report comparing the offers of several insurers with a recommendation',
    decision: { question: 'Placement is one insurer per client (MOM s.4) but TIS-BRD-PJRN-05 shares the PA quotation with every partner. Are comparison reports wanted, for PA only?',
      options: ['Not wanted', 'Personal Accident only', 'Every line'] },
    dependsOn: ['rfq-multi-insurer'],
    menus: ['Operations > Sales & Marketing > Comparison Reports'], api: ['/comparison-reports'], data: ['comparison_reports'],
    documents: ['comparison-reports'], permissions: ['read:quotations'],
  }),
  feature({
    key: 'rfq-multi-insurer', name: 'Requests for quotation to several insurers', module: 'Sales & Marketing', tier: FUT,
    description: 'Submitting one request to several insurers, comparing their offers and checking the insurers approached against market mapping',
    decision: { question: 'Placement is one insurer per client (MOM s.4). Keep multi-insurer requests for quotation for Personal Accident only?',
      options: ['Not wanted', 'Personal Accident only'] },
    sections: ['Request for Quotation: several insurers and offer comparison'],
    api: ['/email/share-quote-to-insurers'],
  }),
  feature({
    key: 'campaigns', name: 'Marketing campaigns', module: 'Sales & Marketing', tier: FUT,
    description: 'E-mail campaigns to consenting clients with segments, templates and the public opt-out link',
    decision: { question: 'No BRD or FRS requirement asks for marketing campaigns (NFR-17.1 covers consent and opt-out only). Are campaigns wanted?',
      options: ['Not wanted', 'Wanted in a later release'] },
    menus: ['Operations > Sales & Marketing > Campaigns'], api: ['/campaigns'], jobs: ['campaign-dispatch'], settings: ['campaigns.conversion_window_days', 'campaigns.max_recipients'],
    data: ['campaigns'], documents: ['campaigns', 'tis-sales-officer-campaign'], permissions: ['read:campaigns', 'write:campaigns'],
  }),
  feature({
    key: 'quote-online-approval', name: 'Online quotation approval by the client', module: 'Sales & Marketing', tier: FUT,
    description: 'Client approves a quotation through a public link instead of the internal approval and e-mailed PDF',
    decision: { question: 'TIS-BRD-QUOT-03 asks for internal maker-checker approval and an e-mailed PDF. Should clients also approve quotations through a link?',
      options: ['Not wanted', 'Wanted'] },
    routes: ['/approve-quote'], api: ['/quotations/approve-by-customer'], settings: ['quotations.approval_link_ttl_hours'],
  }),
  feature({
    key: 'product-recommendation', name: 'Product recommendation step', module: 'Sales & Marketing', tier: FUT,
    description: 'Rule-based product recommendation by vehicle class inside the motor quotation wizard',
    decision: { question: 'The motor quotation wizard offers a product recommendation step that no requirement names. Keep the step?',
      options: ['Skip the step', 'Keep the step'] },
    routes: ['/agent/createquote/product-recommendation'], sections: ['Motor quotation: product recommendation step'],
  }),
  feature({
    key: 'coinsurance', name: 'Co-insurance', module: 'Sales & Marketing', tier: FUT,
    description: 'Lead insurer with participant shares totalling 100%, amounts split by share and a slip to each co-insurer',
    sections: ['Quotations, placement slips and policies: co-insurance participants'],
  }),
  feature({
    key: 'multi-currency', name: 'Foreign currency premium and receipts', module: 'Sales & Marketing', tier: FUT,
    description: 'Choice of a currency other than the peso for the premium and the receipt',
    sections: ['Motor quotation: premium currency', 'Receipts: receipt currency'],
  }),

  // ---------------------------------------------------------------- operations
  feature({
    key: 'clients', name: 'Clients', module: 'Operations', tier: P1,
    description: 'Single client master with KYC documents and the 360 view of proposals, policies, receipts and claims',
    requirements: ['TIS-BRD-KYC-01', 'TIS-BRD-KYC-02', 'TIS-BRD-KYC-04', 'TIS-BRD-KYC-05', 'TIS-BRD-NFR-10.2'],
    menus: ['Operations > Clients'],
  }),
  feature({
    key: 'policies', name: 'Policies, cover notes and cancellations', module: 'Operations', tier: P1,
    description: 'Policy register and lifecycle, policy payments, cover notes, endorsements and cancellations with return premium',
    requirements: ['TIS-BRD-ISSUE-03', 'TIS-BRD-ISSUE-04', 'TIS-BRD-KYC-03', 'TIS-BRD-ENDT-01', 'TIS-BRD-ENDT-02', 'TIS-BRD-ENDT-03', 'TIS-BRD-CANC-01', 'TIS-BRD-CANC-02',
      'TIS-BRD-CANC-03', 'TIS-BRD-BULK-02'],
    menus: ['Operations > Policy', 'Operations > Payments', 'Operations > Cover Notes', 'Operations > Policy Cancellation'],
    jobs: ['policy-expiry', 'quote-expiry', 'cover-note-expiry'],
  }),
  feature({
    key: 'fleet-schedules', name: 'Fleet schedules', module: 'Operations', tier: P1,
    description: 'Fleet schedules of vehicles under one policy, with vehicles added or deleted by endorsement',
    requirements: ['TIS-BRD-ENDT-04', 'MOM-S9-GROUP-ENDT'],
    menus: ['Operations > Fleet Schedules'],
  }),
  feature({
    key: 'open-covers', name: 'Parcel and courier open covers', module: 'Operations', tier: P1,
    description: 'Open policy for parcel and courier shipments with certificates per customer and monthly declarations',
    requirements: ['TIS-BRD-PJRN-09', 'FR-PCL-001'],
    menus: ['Operations > Marine Open Covers'],
  }),
  feature({
    key: 'marine-cargo', name: 'Marine cargo open covers', module: 'Operations', tier: FUT,
    description: 'Marine cargo as an open cover product beside parcel and courier',
    dependsOn: ['open-covers'],
    sections: ['Marine Open Covers: open covers on the marine cargo product (parcel and courier otherwise)'],
  }),
  feature({
    key: 'claims', name: 'Claims', module: 'Operations', tier: P1,
    description: 'Motor and credit life claims from notification to settlement, document checklist, repairs and repair shops',
    requirements: ['TIS-BRD-CLAIM-01', 'TIS-BRD-CLAIM-02', 'TIS-BRD-CLAIM-03', 'TIS-BRD-CLAIM-04', 'TIS-BRD-CLAIM-05', 'TIS-BRD-CLAIM-06', 'TIS-BRD-CLAIM-07', 'TIS-BRD-CLAIM-08',
      'TIS-BRD-PJRN-08'],
    menus: ['Operations > Claims', 'Operations > Claim Documents', 'Operations > Motor Claim Repairs', 'Master > Insurance Management > Claim Document Checklist',
      'Master > Insurance Management > Repair Shops'],
    jobs: ['claim-document-reminders'],
  }),
  feature({
    key: 'renewals', name: 'Renewals', module: 'Operations', tier: P1,
    description: 'Renewal run, notices at 90, 60 and 30 days, renewal queue, negotiations and lapse management',
    requirements: ['TIS-BRD-RENEW-01', 'TIS-BRD-RENEW-02', 'TIS-BRD-RENEW-03', 'TIS-BRD-RENEW-05', 'PBSM-M24-LAP', 'PBSM-M15-REN-DUE'],
    menus: ['Operations > Renewals > Renewal Policy', 'Operations > Renewals > Renewal Batch', 'Operations > Renewals > Renewal Queue', 'Operations > Renewals > Negotiations',
      'Operations > Renewals > Lapse Management'],
    jobs: ['renewal-notices', 'renewal-pipeline', 'renewal-queue'],
  }),
  feature({
    key: 'renewal-analytics', name: 'Retention analytics and renewal performance', module: 'Operations', tier: FUT,
    description: 'Retention KPIs by product, agent and month; renewal rate, premium retention and cycle time',
    menus: ['Operations > Renewals > Retention Analytics', 'Operations > Renewals > Performance'], api: ['/renewals/performance'],
    permissions: ['read:renewals'],
  }),
  feature({
    key: 'renewal-at-risk', name: 'At-risk renewals', module: 'Operations', tier: FUT,
    description: 'Rule-based retention risk score of open renewals with recommended actions and escalation',
    menus: ['Operations > Renewals > At-Risk Policies'], api: ['/renewals/at-risk'], permissions: ['read:renewals'],
  }),
  feature({
    key: 'win-back', name: 'Win-back campaigns', module: 'Operations', tier: FUT,
    description: 'Campaigns, offers and links to win back lapsed renewals, with their statistics',
    dependsOn: ['renewals'],
    sections: ['Renewals > Lapse Management: win-back campaigns'], api: ['/renewals/campaigns'], data: ['winback_campaigns'],
  }),
  feature({
    key: 'ctpl-authentication', name: 'CTPL authentication', module: 'Operations', tier: FUT,
    description: 'COC number series, COC authentication with the accredited provider and the unauthenticated COC report',
    decision: { question: 'The broker does not issue policies (BRD 4.1) and no requirement asks for COC authentication. Is CTPL authentication wanted?',
      options: ['Not wanted', 'Wanted'] },
    menus: ['Operations > CTPL Authentication'], api: ['/ctpl'], connectors: ['CTPL_AUTH', 'LTO_FEED'],
    settings: ['ctpl.register_on_issue', 'ctpl.authenticate_on_issue', 'ctpl.lto_feed'], data: ['ctpl_authentications'], permissions: ['read:policies', 'write:policies'],
    documents: ['ctpl-authentication'],
  }),
  feature({
    key: 'lines-fire-engineering', name: 'Fire, engineering and industrial all risks', module: 'Operations', tier: P2,
    description: 'Prospect, quotation and policy flows of fire and allied perils, engineering and industrial all risks',
    requirements: ['TIS-BRD-PJRN-11', 'FI-01', 'FI-02', 'FI-03', 'FI-04', 'FI-05', 'FI-06', 'FI-07', 'FI-08', 'FI-09', 'FI-10', 'FI-11'],
    routes: ['/agent/createlead/fire-allied-perils', '/agent/createlead/iar', '/agent/convertpolicy/customerinfo/fire'],
    api: ['/document-templates/policy-schedule-fire', '/document-templates/quote-template-fire'],
    permissions: ['read:quotations', 'write:quotations'],
  }),
  feature({
    key: 'lines-employee-benefits', name: 'Group life and employee benefits', module: 'Operations', tier: P2,
    description: 'Employee census upload, group life and employee benefit quotations with the yearly renewal quote',
    requirements: ['TIS-BRD-PJRN-10'],
    routes: ['/agent/createlead/employee-benefit', '/agent/employee-benefit'],
    permissions: ['read:quotations', 'write:quotations'],
  }),
  feature({
    key: 'lines-liability-bonds', name: 'Bonds, liability and miscellaneous lines', module: 'Operations', tier: P2,
    description: 'Quotations of bonds, comprehensive general liability and miscellaneous lines through requests for quotation',
    requirements: ['TIS-BRD-PJRN-13'],
    sections: ['Request for Quotation: bond and liability lines'],
  }),

  // ---------------------------------------------------------------- accounts
  feature({
    key: 'receipts', name: 'Receipts and post-dated cheques', module: 'Accounts', tier: P1,
    description: 'Official and acknowledgement receipts, allocation and matching, post-dated cheques and their deposit',
    requirements: ['TIS-BRD-COLL-01', 'TIS-BRD-COLL-03', 'TIS-BRD-COLL-04', 'TIS-BRD-COLL-05', 'TIS-BRD-COLL-06', 'TIS-BRD-COLL-07', 'TIS-BRD-COLL-08', 'PBSM-M17v4-RECEIPTING',
      'PBSM-M17v4-PDC'],
    menus: ['Accounts > Receipts', 'Accounts > Post-Dated Cheques'], jobs: ['pdc-deposit-due'],
  }),
  feature({
    key: 'collections', name: 'Collections and credit control', module: 'Accounts', tier: P1,
    description: 'Collections, instalment plans, premium warranty monitor and remittance ageing',
    requirements: ['TIS-BRD-PROD-17', 'TIS-BRD-RPT-OPS-10', 'TIS-BRD-RPT-OPS-11', 'TIS-BRD-COMM-04', 'MOM-S3-COLL-CREDIT-TERMS'],
    menus: ['Accounts > Collections', 'Accounts > Credit Control > Instalment Plans', 'Accounts > Credit Control > Premium Warranty Monitor',
      'Accounts > Credit Control > Remittance Ageing'],
    jobs: ['collection-reminders', 'receivable-ageing'],
  }),
  feature({
    key: 'client-credit-limits', name: 'Client credit limits', module: 'Accounts', tier: FUT,
    description: 'Credit limit per client with the open broker-billed exposure and the exceptions over the limit',
    decision: { question: 'MOM-S3-COLL-CREDIT-TERMS covers credit terms, not credit limits. Are client credit limits wanted?',
      options: ['Not wanted', 'Wanted'] },
    dependsOn: ['collections'],
    menus: ['Accounts > Credit Control > Client Credit Limits'], api: ['/credit-control/clients$', '/credit-control/clients/*/credit-limit', '/credit-control/credit-exceptions'],
    data: ['client_credit_exceptions'], permissions: ['read:collections', 'approve:credit-control'],
  }),
  feature({
    key: 'claims-settlements', name: 'Claims paid through the broker', module: 'Accounts', tier: FUT,
    description: 'Insurer claim funds received by the broker and paid to the claimant, with voucher and release form',
    decision: { question: 'TIS-BRD-CLAIM-05 covers the settlement status with the insurer. Do claim funds ever pass through TISPH?',
      options: ['Never: not wanted', 'Yes: wanted'] },
    dependsOn: ['claims'],
    menus: ['Accounts > Claims Settlements'], api: ['/claim-payments'], data: ['claim_settlement_movements'],
    documents: ['claims-settlements-paid-through-the-broker', 'ccd-bp-qrph-receipting-claim-funds'], permissions: ['read:receipts', 'write:receipts'],
  }),
  feature({
    key: 'suppliers', name: 'Suppliers and supplier BIR 2307', module: 'Accounts', tier: P1,
    description: 'Vendor and payee register for non-insurer payments, and the BIR Form 2307 issued to suppliers',
    requirements: ['TIS-BRD-MAS-06', 'FGA-EN-01', 'TIS-BRD-TAX-03'],
    menus: ['Accounts > Payables > Suppliers', 'Accounts > Payables > Supplier 2307'],
  }),
  feature({
    key: 'payables', name: 'Accounts payable', module: 'Accounts', tier: P2,
    description: 'Supplier invoices with input VAT and withholding, maker-checker approval, supplier payments and AP ageing',
    requirements: ['TIS-BRD-NIA-03', 'PBSM-M17v4-NIA'],
    dependsOn: ['suppliers'],
    menus: ['Accounts > Payables > Supplier Invoices', 'Accounts > Payables > Supplier Payments', 'Accounts > Payables > AP Ageing'],
    api: ['/payables/invoices', '/payables/payments', '/payables/ageing'], data: ['supplier_invoices', 'supplier_payments'],
    sections: ['Accounts > Payables: supplier invoices, payments and ageing (the manual section also explains the suppliers)'],
    permissions: ['read:payables', 'write:payables', 'approve:payables'],
    documents: ['tis-finance-and-general-accounting-payables', 'tis-general-manager-supplier-invoice', 'tis-operations-unit-head-supplier-invoices', 'tis-sales-unit-head-supplier-invoice'],
  }),
  feature({
    key: 'fixed-assets', name: 'Fixed assets', module: 'Accounts', tier: P2,
    description: 'Asset register by asset class, monthly straight-line depreciation and disposals',
    requirements: ['TIS-BRD-NIA-07', 'FGA-FA-01', 'FGA-FA-02', 'FGA-FA-04', 'FGA-DS-08', 'TIS-BRD-RPT-FGA-10', 'PBSM-M17v4-PAFA'],
    decision: { question: 'MOM-S5-AP-ASSET-MASTER (Phase 1) asks for an asset master at requisition while fixed assets (TIS-BRD-NIA-07) are Phase 2. Does the asset master go live in Phase 1?',
      options: ['Phase 2 (enable with Phase 2)', 'Asset master in Phase 1'] },
    menus: ['Accounts > Fixed Assets > Asset Register', 'Accounts > Fixed Assets > Depreciation Run', 'Accounts > Fixed Assets > Disposals', 'Master > Finance > Asset Classes'],
    api: ['/fixed-assets'], data: ['fixed_assets'], documents: ['fixed-assets-and-depreciation', 'asset-disposal', 'tis-finance-and-general-accounting-depreciation', 'tis-operations-officer-fixed-assets'],
    permissions: ['read:fixed-assets', 'write:fixed-assets'],
  }),
  feature({
    key: 'disbursements', name: 'Disbursements and bank payment files', module: 'Accounts', tier: P1,
    description: 'Payment vouchers and cheques, refund fund transfers and Metrobank payment files with maker-checker',
    requirements: ['TIS-BRD-DISB-01', 'TIS-BRD-DISB-02', 'TIS-BRD-DISB-03', 'PBSM-M17v4-DISB', 'MOM-S5-DISB-MAKER-CHECKER'],
    menus: ['Accounts > Disbursement', 'Accounts > Bank Payment Files'],
  }),
  feature({
    key: 'bank-file-integration', name: 'Bank file interface', module: 'Accounts', tier: P1,
    description: 'Connector and outbox of the bank payment files',
    requirements: ['TIS-BRD-DISB-03', 'TIS-BRD-NFR-09'],
    menus: ['Master > System Configuration > Integrations'],
  }),
  feature({
    key: 'remittance', name: 'Remittance to insurers', module: 'Accounts', tier: P1,
    description: 'Weekly remittance with approvals, insurer payments, statement reconciliation, exceptions, billing, schedules and settlement',
    requirements: ['TIS-BRD-COMM-01', 'TIS-BRD-COMM-03', 'TIS-BRD-COMM-04', 'TIS-BRD-RPT-OPS-05', 'TIS-BRD-RPT-OPS-06', 'TIS-BRD-RPT-OPS-08', 'TIS-BRD-RPT-OPS-09',
      'PBSM-M15-REMIT-WEEKLY', 'FR-RMT-001'],
    menus: ['Accounts > Remittance > Remittances', 'Accounts > Remittance > Approvals', 'Accounts > Remittance > Insurer payments', 'Accounts > Remittance > Reconciliation',
      'Accounts > Remittance > Exceptions', 'Accounts > Remittance > Insurer billing', 'Accounts > Remittance > Setup', 'Accounts > Remittance > Settlement'],
    jobs: ['remittance-schedules'],
  }),
  feature({
    key: 'insurer-statements', name: 'Insurer statement reconciliation (generic)', module: 'Accounts', tier: FUT,
    description: 'Generic insurer statement screen; TISPH reconciles insurer statements under Remittance > Reconciliation',
    menus: ['Accounts > Insurer Reconciliation > Insurer Statements'],
  }),
  feature({
    key: 'general-ledger', name: 'Journals and general ledger', module: 'Accounts', tier: P1,
    description: 'Journal vouchers with upload, correction and reversal, open entry matching, accounting queries and the daily SAP GL files',
    requirements: ['TIS-BRD-NIA-05', 'TIS-BRD-GL-01', 'TIS-BRD-GL-02', 'TIS-BRD-GL-03', 'TIS-BRD-GL-06', 'TIS-BRD-INTG-04', 'FGA-JV-01', 'MOM-S5-AP-JV-UPLOAD',
      'PBSM-M17v4-JV', 'PBSM-M17v4-REVERSALS'],
    menus: ['Accounts > Journal Voucher', 'Accounts > SAP GL Export', 'Accounts > Correction JV', 'Accounts > Reversal JV', 'Accounts > Open Entry Matching',
      'Accounts > Open Entry Unmatching', 'Accounts > Accounting Query', 'Accounts > All Clients Accounting'],
    jobs: ['sap-gl-export'],
  }),
  feature({
    key: 'petty-cash', name: 'Petty cash', module: 'Accounts', tier: FUT,
    description: 'Petty cash funds, requests, disbursements, receipts and replenishment',
    menus: ['Accounts > Petty Cash > Initiate', 'Accounts > Petty Cash > Request', 'Accounts > Petty Cash > Disbursement', 'Accounts > Petty Cash > Receipts',
      'Accounts > Petty Cash > Replenish'],
    api: ['/petty-cash'], data: ['petty_cash_requests'], documents: ['petty-cash'], permissions: ['read:disbursements', 'write:disbursements'],
  }),
  feature({
    key: 'bank-reconciliation', name: 'Bank reconciliation', module: 'Accounts', tier: P1,
    description: 'Bank statement upload and matching, reconciliations with approval, and the bank reconciliation reports',
    requirements: ['TIS-BRD-COLL-09', 'TIS-BRD-RPT-OPS-12', 'TIS-BRD-RPT-OPS-13', 'PBSM-M17v4-RECON'],
    menus: ['Accounts > Bank Reconciliation > Reconciliation Workspace', 'Accounts > Bank Reconciliation > Reconciliations',
      'Accounts > Bank Reconciliation > Reconciliation Statement Report', 'Accounts > Bank Reconciliation > Outstanding Cheques',
      'Accounts > Bank Reconciliation > Deposits in Transit', 'Accounts > Bank Reconciliation > Unmatched Bank Lines', 'Accounts > Bank Reconciliation > Bank Book'],
    jobs: ['bank-auto-match'],
  }),
  feature({
    key: 'tax', name: 'BIR 2307, sales invoices and CAS books', module: 'Accounts', tier: P1,
    description: 'BIR Form 2307 certificates, sales invoices under the EOPT Act and the books and documents of the computerised accounting system',
    requirements: ['TIS-BRD-TAX-01', 'TIS-BRD-TAX-02', 'TIS-BRD-TAX-03', 'FGA-E3', 'FGA-IB-06', 'PBSM-M17v4-INVOICES', 'MOM-S5-TAX-2307-BATCH'],
    menus: ['Accounts > Tax > BIR Form 2307', 'Accounts > Tax > Sales Invoices', 'Accounts > Tax > CAS Books and Documents'],
  }),
  feature({
    key: 'bir-reports', name: 'BIR relief and summary reports', module: 'Accounts', tier: FUT,
    description: 'VAT summary, SAWT, QAP and the summary lists of sales and purchases',
    decision: { question: 'TIS-BRD-TAX-02 asks for a BIR report on criteria TISPH has not yet given (MOM s.16). Which BIR reports are wanted?',
      options: ['VAT summary', 'SAWT', 'QAP', 'SLSP sales and purchases', 'None for now'] },
    dependsOn: ['tax'],
    menus: ['Accounts > Tax > VAT Summary', 'Accounts > Tax > SAWT', 'Accounts > Tax > QAP', 'Accounts > Tax > SLSP Sales', 'Accounts > Tax > SLSP Purchases'],
    api: ['/reports/bir-vat-summary', '/reports/bir-sawt', '/reports/bir-qap', '/reports/bir-slsp-sales', '/reports/bir-slsp-purchases'],
    reports: ['bir-vat-summary', 'bir-sawt', 'bir-qap', 'bir-slsp-sales', 'bir-slsp-purchases'],
    permissions: ['read:period-end'],
  }),
  feature({
    key: 'bir-returns', name: 'BIR withholding returns, alphalist and DAT files', module: 'Accounts', tier: FUT,
    description: 'Withholding returns 0619-E and 1601-EQ with filing records, the annual alphalist 1604-E and the DAT files for the BIR',
    decision: { question: 'Which BIR returns does TISPH want the system to prepare (0619-E, 1601-EQ, 1604-E, DAT files)?',
      options: ['All', 'Withholding returns only', 'None for now'] },
    dependsOn: ['tax'],
    menus: ['Accounts > Tax > Withholding Returns', 'Accounts > Tax > Annual Alphalist 1604-E', 'Accounts > Tax > BIR DAT Files'],
    api: ['/bir/returns', '/bir/filings', '/bir/dat-files'], data: ['bir_return_filings', 'bir_dat_files'],
    documents: ['withholding-returns-0619-e-1601-eq-and-their-filing-records', 'annual-information-return-1604-e-and-alphalist-of-payees', 'bir-dat-files', 'tis-finance-and-general-accounting-bir'],
    permissions: ['read:period-end', 'write:period-end'],
  }),
  feature({
    key: 'bir-2551q', name: 'Percentage tax 2551Q', module: 'Accounts', tier: FUT,
    description: 'Quarterly percentage tax return of a non-VAT broker',
    decision: { question: 'TISPH is VAT-registered. Is the percentage tax return 2551Q ever needed?', options: ['Not needed', 'Needed'] },
    dependsOn: ['bir-returns'],
    menus: ['Accounts > Tax > Percentage Tax 2551Q'], api: ['/bir/returns/2551Q'], sections: ['Withholding Returns: 2551Q in the returns calendar'],
    documents: ['percentage-tax-2551q-non-vat-broker-or-agent'],
  }),
  feature({
    key: 'bir-eis', name: 'BIR electronic invoicing (EIS)', module: 'Accounts', tier: FUT,
    description: 'Submission of sales invoices to the BIR electronic invoicing system',
    decision: { question: 'Is TISPH required to submit invoices to the BIR EIS?', options: ['Not required', 'Required'] },
    dependsOn: ['tax'],
    menus: ['Accounts > Tax > E-Invoicing (EIS)'], api: ['/bir/eis'], jobs: ['eis-outbox'], settings: ['eis.enabled', 'eis.submit_on_issue', 'eis.mode'],
    sections: ['Sales Invoices: EIS submission status'], data: ['eis_submissions'], documents: ['e-invoicing-eis'],
  }),
  feature({
    key: 'period-end', name: 'Period end and financial statements', module: 'Accounts', tier: P1,
    description: 'Period calendar, month-end and year-end close, close checklist and the financial statements',
    requirements: ['TIS-BRD-GL-04', 'TIS-BRD-RPT-04', 'PBSM-M32-PERIODS', 'PBSM-M32-CONTROLS', 'MOM-S4-CLOSE-26-29'],
    menus: ['Accounts > Period End > Period Management', 'Accounts > Period End > Month-End Close', 'Accounts > Period End > Year-End Close',
      'Accounts > Period End > Financial Statements'],
    jobs: ['month-end-reminder', 'period-auto-soft-close'],
  }),
  feature({
    key: 'recurring-journals', name: 'Recurring and accrual journals', module: 'Accounts', tier: P2,
    description: 'Recurring and accrual journal templates posted automatically and reversed on the first day of the next period',
    requirements: ['FGA-ACR-01', 'TIS-BRD-NIA-06'],
    menus: ['Accounts > Period End > Recurring Journals'], api: ['/period-end/recurring-journals'], jobs: ['recurring-journals', 'accrual-reversal'],
    data: ['recurring_journals'], documents: ['recurring-journals'], permissions: ['read:period-end', 'write:period-end'],
  }),
  feature({
    key: 'incentives', name: 'Incentives', module: 'Accounts', tier: P1,
    description: 'Telesales incentive programmes, calculation with approval, statements and reports',
    requirements: ['TIS-BRD-COMM-08'],
    menus: ['Accounts > Incentive > My Programs', 'Accounts > Incentive > Calculations', 'Accounts > Incentive > Approvals', 'Accounts > Incentive > Statement',
      'Accounts > Incentive > Reports', 'Master > Finance > Incentive Programs'],
  }),

  // ---------------------------------------------------------------- commission
  feature({
    key: 'commission', name: 'Commission and referrer accounts', module: 'Commission', tier: P1,
    description: 'Commission dashboard and the accounts of agents, dealers and referrers with their share',
    requirements: ['TIS-BRD-COMM-05', 'TIS-BRD-COMM-06', 'TIS-BRD-PROD-16', 'TIS-BRD-RPT-OPS-07'],
    menus: ['Commission > Commission Dashboard', 'Commission > Agents/Referrer Accounts'],
  }),
  feature({
    key: 'insurer-overrides', name: 'Insurer overriding commission', module: 'Commission', tier: FUT,
    description: 'Overriding, profit and contingent commission agreements with insurers and their computations',
    menus: ['Commission > Insurer Overrides > Agreements', 'Commission > Insurer Overrides > Computations'], api: ['/insurer-overrides'],
    data: ['override_agreements'], permissions: ['read:commission', 'write:commission'],
    documents: ['overriding-profit-and-contingent-commission-from-insurers'],
  }),

  // ---------------------------------------------------------------- reports
  feature({
    key: 'reports', name: 'Operational and financial reports', module: 'Reports', tier: P1,
    description: 'Report catalogue, production, claims, renewal, remittance and commission reports, receivables, ledger and financial statement reports',
    requirements: ['TIS-BRD-RPT-SLS-01', 'TIS-BRD-RPT-SLS-02', 'TIS-BRD-RPT-OPS-02', 'TIS-BRD-RPT-OPS-03', 'TIS-BRD-RPT-OPS-04', 'TIS-BRD-RPT-CCD-01', 'TIS-BRD-RPT-FGA-01',
      'TIS-BRD-RPT-FGA-02', 'TIS-BRD-RPT-FGA-05', 'TIS-BRD-RPT-FGA-06'],
    menus: ['Reports > All Reports', 'Reports > Operational Reports > Production', 'Reports > Operational Reports > Claims', 'Reports > Operational Reports > Renewal',
      'Reports > Operational Reports > Remittance', 'Reports > Operational Reports > Broker Commission', 'Reports > Operational Reports > Dealer Production',
      'Reports > Financial Reports > SOA/Premium Receivable', 'Reports > Financial Reports > Collection Report', 'Reports > Financial Reports > Payables',
      'Reports > Financial Reports > Journal', 'Reports > Financial Reports > Trial Balance', 'Reports > Financial Reports > Income Statement',
      'Reports > Financial Reports > Balance Sheet', 'Reports > Financial Reports > Trial Balance Movement', 'Reports > Financial Reports > General Ledger Detail',
      'Reports > Financial Reports > Aged Payables to Insurers', 'Reports > Financial Reports > Month-End Close Status'],
  }),
  feature({
    key: 'coinsurance-reports', name: 'Co-insurance reports', module: 'Reports', tier: FUT,
    description: 'Co-insurance register and amounts due to insurers by co-insurer',
    dependsOn: ['coinsurance'],
    menus: ['Reports > Financial Reports > Co-insurance Register', 'Reports > Financial Reports > Due to Insurers by Co-insurer'],
    api: ['/reports/coinsurance-register', '/reports/due-to-insurers-by-coinsurer'], reports: ['coinsurance-register', 'due-to-insurers-by-coinsurer'],
    permissions: ['read:reports'],
  }),
  feature({
    key: 'report-builder', name: 'Report Builder', module: 'Reports', tier: P1,
    description: 'Reports built and scheduled by the business on the published datasets',
    requirements: ['TIS-BRD-NFR-10.1', 'TIS-BRD-NFR-10.4'],
    menus: ['Reports > Report Builder'],
  }),
  feature({
    key: 'bi-extract', name: 'BI extract', module: 'Reports', tier: FUT,
    description: 'Nightly CSV extract of the datasets for an external BI tool',
    decision: { question: 'TIS-BRD-RPT-DSH-01 leaves the BI tool open (Power BI or in-app). Is a nightly extract for a BI tool wanted?', options: ['Not wanted', 'Wanted'] },
    dependsOn: ['report-builder'],
    api: ['/report-builder/bi-extract'], jobs: ['bi-extract'], settings: ['bi.extract_datasets', 'bi.extract_folder', 'bi.extract_keep_runs'],
    sections: ['Report Builder: BI extract'], data: ['bi_extract_runs'],
  }),

  // ---------------------------------------------------------------- masters and product configuration
  feature({
    key: 'insurance-masters', name: 'Insurance masters', module: 'Master data', tier: P1,
    description: 'Insurers, lines of business, products, covers, signatories, vehicles, short-period rates, cancellation and reason codes',
    requirements: ['TIS-BRD-MAS-04', 'TIS-BRD-MAS-09', 'TIS-BRD-MAS-10', 'TIS-BRD-PROD-02', 'TIS-BRD-PROD-03', 'TIS-BRD-PROD-06', 'TIS-BRD-PROD-08', 'MOM-S3-9-PRODUCTS'],
    menus: ['Master > Insurance Management > Insurance Company', 'Master > Insurance Management > Line of Business', 'Master > Insurance Management > Product',
      'Master > Insurance Management > Cover', 'Master > Insurance Management > Signatories', 'Master > Insurance Management > Vehicle',
      'Master > Insurance Management > Short-Period Rates', 'Master > Insurance Management > Cancellation Reasons', 'Master > Insurance Management > Reason Codes'],
  }),
  feature({
    key: 'distribution-channels', name: 'Distribution channels', module: 'Master data', tier: P1,
    description: 'Dealers, financing banks, affinity partners and their production',
    requirements: ['TIS-BRD-MAS-07', 'TIS-BRD-MAS-05'],
    menus: ['Master > Insurance Management > Distribution Channels'],
  }),
  feature({
    key: 'finance-masters', name: 'Finance masters and posting rules', module: 'Master data', tier: P1,
    description: 'Chart of accounts, account determination and posting rules with approval, taxes, premium taxes, commission rates, banks, cost centres and statement formats',
    requirements: ['TIS-BRD-GL-01', 'TIS-BRD-GL-02', 'TIS-BRD-TAX-01', 'TIS-BRD-PROD-11', 'TIS-BRD-PROD-16', 'FGA-DS-04', 'MOM-S9-ACC-COST-CENTRE', 'PBSM-M18-COA',
      'PBSM-M23-POSTING'],
    menus: ['Master > Finance > Account Determination', 'Master > Finance > Posting Rules', 'Master > Finance > Configuration Approvals', 'Master > Finance > Accounting Flow',
      'Master > Finance > Premium Taxes & LGU Rates', 'Master > Finance > Commission Rate Matrix', 'Master > Finance > Transaction Code', 'Master > Finance > Bank',
      'Master > Finance > Account Category', 'Master > Finance > Main Account', 'Master > Finance > Sub Account', 'Master > Finance > Taxation',
      'Master > Finance > Close Checklist', 'Master > Finance > Cost Centres', 'Master > Finance > Bank Statement Formats', 'Master > Finance > Bank Transaction Types',
      'Master > Finance > Insurer Statement Formats', 'Master > Finance > Bank File Layouts'],
  }),
  feature({
    key: 'exchange-rates', name: 'Exchange rates', module: 'Master data', tier: FUT,
    description: 'Dated foreign exchange rates for amounts in other currencies',
    dependsOn: ['multi-currency'],
    menus: ['Master > Finance > Exchange Rate'],
  }),
  feature({
    key: 'payment-gateways', name: 'Online payment links', module: 'Master data', tier: FUT,
    description: 'Card and e-wallet payment links with the public checkout page and the payment gateways',
    menus: ['Master > Finance > Payment Gateways'],
    api: ['/payment-gateways', '/payment-links', '/public/payments'], data: ['payment_links'], permissions: ['read:receipts'],
  }),
  feature({
    key: 'package-bundles', name: 'Package bundles', module: 'Master data', tier: FUT,
    description: 'Multi-section bundles across insurers issued under one package policy number',
    dependsOn: ['insurer-rate-tables'],
    menus: ['Master > Finance > Package Bundles'], api: ['/packages/bundles', '/packages/quotes', '/packages/policies'],
    settings: ['payments.auto_issue_package_policies'], data: ['package_quotes'], permissions: ['read:products', 'write:products'],
  }),
  feature({
    key: 'insurer-rate-tables', name: 'Insurer rate tables', module: 'Master data', tier: FUT,
    description: 'One rate per insurer and product used by packages and comparisons',
    decision: { question: 'TIS-BRD-PROD-13 asks for a rate card per insurer. Is it met by the Product Configurator rating, or are insurer rate tables wanted?',
      options: ['Met by the Product Configurator', 'Insurer rate tables wanted'] },
    menus: ['Master > Finance > Insurer Rate Tables'], api: ['/packages/rate-tables'],
  }),
  feature({
    key: 'remittance-master', name: 'Automated remittance master', module: 'Master data', tier: FUT,
    description: 'Earlier remittance configuration: automated remittance, statement template and settlement parameters',
    menus: ['Master > Finance > Remittance Master'],
  }),
  feature({
    key: 'sms-messaging', name: 'SMS and Viber messages', module: 'Master data', tier: FUT,
    description: 'SMS and Viber templates, SMS renewal notices and payment reminders through the SMS connectors',
    menus: ['Master > System Configuration > Message Templates'], api: ['/messaging'],
    jobs: ['sms-renewal-notices', 'sms-payment-reminders'], connectors: ['SMS_SEMAPHORE', 'SMS_GLOBE_LABS', 'SMS_GENERIC', 'VIBER_BUSINESS'],
    permissions: ['read:integrations', 'write:integrations'],
    documents: ['sms-and-message-templates'],
  }),
  feature({
    key: 'insurer-api', name: 'Insurer API integration', module: 'Master data', tier: P2,
    description: 'REST API mappings and calls to the insurers, claim status received from the insurers',
    requirements: ['TIS-BRD-INTG-05'],
    menus: ['Master > System Configuration > Insurer Integration'], api: ['/insurer-integration'], connectors: ['INSURER_API'],
    data: ['insurer_api_mappings'], permissions: ['read:integrations', 'write:integrations'],
    documents: ['insurer-integration'],
  }),
  feature({
    key: 'integration-inbound', name: 'Inbound integration messages', module: 'Master data', tier: FUT,
    description: 'Public endpoint receiving signed messages pushed by third parties',
    api: ['/public/integrations'], settings: ['integrations.inbound_enabled'],
  }),
  feature({
    key: 'legacy-migration', name: 'Legacy book migration', module: 'Master data', tier: P2,
    description: 'Cutover load of in-force policies, open bills, open claims and opening balances of the legacy system',
    requirements: ['TIS-BRD-MIG-01', 'MOM-S21-MIGRATION-PARKED'],
    api: ['/data-load/kits/migration'],
  }),
  feature({
    key: 'product-configurator', name: 'Product configuration', module: 'Product Configurator', tier: P1,
    description: 'Product templates, coverages, rating engine, acceptance rules, documents, market mapping and risk mapping',
    requirements: ['TIS-BRD-PROD-01', 'TIS-BRD-PROD-04', 'TIS-BRD-PROD-07', 'TIS-BRD-PROD-09', 'TIS-BRD-PROD-10', 'TIS-BRD-PROD-12', 'TIS-BRD-PROD-13', 'TIS-BRD-PROD-14'],
    menus: ['Product Configurator > Product Templates', 'Product Configurator > Coverage Builder', 'Product Configurator > Rating Engine',
      'Product Configurator > Acceptance Rules', 'Product Configurator > Document Manager', 'Product Configurator > Market Mapping', 'Product Configurator > Risk Mapping'],
  }),
  feature({
    key: 'product-analytics', name: 'Product analytics', module: 'Product Configurator', tier: FUT,
    description: 'Top products, trends and category breakdown',
    menus: ['Product Configurator > Product Analytics'], api: ['/product-configurator/analytics'],
    documents: ['product-analytics'],
  }),
]);

export const FEATURE_KEYS = FEATURES.map((f) => f.key);
const byKey = new Map(FEATURES.map((f) => [f.key, f]));

/** The feature of a key (undefined when unknown). */
export const featureOf = (key) => byKey.get(key);
/** Is the tier always on (Phase 1 and platform functions)? */
export const alwaysOn = (f) => !!TIERS[f?.tier]?.alwaysOn;
/** Features that can be switched on and off (Phase 2 and future releases). */
export const switchable = () => FEATURES.filter((f) => !alwaysOn(f));

/**
 * The delivered edition of a TISPH environment: Phase 1 and platform functions on, Phase 2 and future releases off.
 * The help build and the role facts of the manual read it when no environment is given.
 */
export const deliveredEnabled = () => FEATURES.filter(alwaysOn).map((f) => f.key);

/** Problems of the catalogue itself: duplicate keys or menus, unknown tiers or dependencies, a cycle. */
export function catalogueProblems() {
  const problems = [];
  const seen = new Set();
  const menus = new Map();
  for (const f of FEATURES) {
    if (seen.has(f.key)) problems.push(`duplicate feature key ${f.key}`);
    seen.add(f.key);
    if (!TIERS[f.tier]) problems.push(`${f.key}: unknown tier ${f.tier}`);
    for (const d of f.dependsOn) if (!byKey.has(d)) problems.push(`${f.key}: depends on unknown feature ${d}`);
    for (const m of f.controls.menus) {
      if (menus.has(m)) problems.push(`menu entry "${m}" is registered by ${menus.get(m)} and ${f.key}`);
      menus.set(m, f.key);
    }
  }
  const visiting = new Set();
  const done = new Set();
  const walk = (key, trail) => {
    if (done.has(key)) return;
    if (visiting.has(key)) { problems.push(`dependency cycle: ${[...trail, key].join(' > ')}`); return; }
    visiting.add(key);
    for (const d of byKey.get(key)?.dependsOn || []) walk(d, [...trail, key]);
    visiting.delete(key);
    done.add(key);
  };
  FEATURES.forEach((f) => walk(f.key, []));
  return problems;
}
