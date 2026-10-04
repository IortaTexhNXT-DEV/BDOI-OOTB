/**
 * Master types published as upload templates (docs/package/05_Delivery/Upload_Templates, GET /masters/:type/template):
 * the menu path of the screen, sample rows (Philippine examples, keyed by field name) and column notes the field type
 * alone does not give; button: the screen has an Upload button; file: the template file name when the label alone is
 * not clear. The columns themselves always come from the type definition (service.uploadColumns). Every master type
 * that takes an upload has an entry (test/upload-templates.test.js); retired types have none.
 */
export const MASTER_TEMPLATES = [
  {
    type: 'company', menu: 'Master > Generals > Organization > Company',
    notes: ['The primary company (Is Primary = Yes) is the letterhead of every document and report; only one active company may be primary. Replace the shipped iorta TechNXT record with your own company by editing it on the screen.'],
    samples: [{ CompanyCode: 'BIB', CompanyName: 'Bayanihan Insurance Brokers Inc.', LicenseNumber: 'IC-BR-2026-0142', TIN: '008-765-432-000', EmailID: 'info@bayanihanbrokers.example.ph',
      Websitelink: 'https://bayanihanbrokers.example.ph', Description: 'Non-life insurance broker', AddressLine1: '18/F Ayala Tower One', AddressLine2: 'Ayala Avenue', PinCode: '1226',
      City: 'Makati', State: 'Metro Manila', Country: 'Philippines', PhoneNumber: '+63 2 8812 4400', IsPrimary: 'No' }],
  },
  {
    type: 'branch', menu: 'Master > Generals > Organization > Branch',
    samples: [{ BranchCode: 'ILO', BranchName: 'Iloilo Branch', CompanyName: 'iorta TechNXT Corp.', EmailID: 'iloilo@bayanihanbrokers.example.ph', Description: 'Western Visayas sales office',
      AddressLine1: 'Unit 305, Atria Park District', AddressLine2: 'Mandurriao', City: 'Iloilo City', State: 'Iloilo', Country: 'Philippines', PhoneNumber: '+63 33 321 4455' }],
  },
  {
    type: 'department', menu: 'Master > Finance > Department (opened from Master > Generals > Organization > Branch)',
    samples: [{ DepartmentCode: 'MKT', DepartmentName: 'Marketing', Description: 'Marketing and business development', BranchCode: 'HO' }],
  },
  {
    type: 'insurance-company', button: true, menu: 'Master > Generals > Insurance Management > Insurance Company',
    formats: { commissionRate: 'Decimal fraction, e.g. 0.20 for 20%', premiumWarrantyDays: 'Days the client has to pay the premium (premium payment warranty)', remittanceTermsDays: 'Days after collection to remit to the insurer' },
    samples: [{ insuranceCompanyCode: 'CHARTER', insuranceCompanyName: 'Charter Ping An Insurance Corporation', insuranceCompanyDescription: 'Non-life insurer', shortName: 'Charter Ping An',
      tin: '000-439-588-000', addressLine1: 'Skyland Plaza, Sen. Gil Puyat Ave.', city: 'Makati', state: 'Metro Manila', country: 'Philippines', email: 'underwriting@charterpingan.example.ph',
      phoneNumber: '+63 2 8555 8888', contactPerson: 'Ana Cruz', commissionRate: '0.20', premiumWarrantyDays: '60', remittanceTermsDays: '30', defaultBillingMode: 'broker' }],
  },
  {
    type: 'line-of-business', menu: 'Master > Generals > Insurance Management > Line of Business',
    samples: [{ lineofBusinessCode: 'AVIATION', LOBName: 'Aviation', LOBDescription: 'Aircraft hull and aviation liability' }],
  },
  {
    type: 'product', menu: 'Master > Generals > Insurance Management > Product',
    samples: [{ productCode: 'STUDENT-PA', productName: 'Student Personal Accident', productDescription: 'School accident cover for enrolled students', lineofBusiness: 'ACCIDENT', businessType: 'package', customerSegment: 'retail' }],
  },
  {
    type: 'policy-type', menu: 'Master > Generals > Insurance Management > Product (policy types)',
    samples: [{ policyTypeCode: 'CV-TRK', policyTypeName: 'Commercial Vehicle - Truck', policyTypeDescription: 'Light and heavy trucks for business use', Product: 'MOTOR' }],
  },
  {
    type: 'cover', menu: 'Master > Generals > Insurance Management > Cover',
    samples: [{ coverCode: 'RSCC', coverName: 'Riot, Strike and Civil Commotion', coverDescription: 'Damage from riot, strike and civil commotion' }],
  },
  {
    type: 'signatory', menu: 'Master > Generals > Insurance Management > Signatories',
    samples: [{ signatoryCode: 'SIG-FIN', signatoryName: 'Teresa Villanueva', signatoryDescription: 'Signs official receipts and payment vouchers', designation: 'Finance Manager' }],
  },
  {
    type: 'vehicle-brand', button: true, menu: 'Master > Generals > Insurance Management > Vehicle (choose Vehicle brands in the Upload dialog)',
    samples: [{ name: 'Geely' }],
  },
  {
    type: 'vehicle-model', button: true, menu: 'Master > Generals > Insurance Management > Vehicle (choose Vehicle models in the Upload dialog)',
    samples: [{ brand: 'Toyota', name: 'Veloz' }],
  },
  {
    type: 'vehicle-variant', button: true, menu: 'Master > Generals > Insurance Management > Vehicle (choose Vehicle variants in the Upload dialog)',
    samples: [{ model: 'Vios', name: '1.5 XE CVT', bodyType: 'Sedan', seating: '5' }],
  },
  {
    type: 'vehicle', button: true, menu: 'Master > Generals > Insurance Management > Vehicle',
    samples: [{ vehicleCode: 'VH-TOY-VELOZ-G', vehicleName: 'Toyota Veloz 1.5 G CVT', vehicleVariant: '1.5 G CVT', vehicleModel: 'Veloz', vehicleBrand: 'Toyota', seatingCapacity: '7', bodyType: 'MPV' }],
  },
  {
    type: 'country', button: true, menu: 'Master > Generals > Location > Country',
    samples: [{ CountryName: 'Indonesia', ISOCode: 'ID', Description: 'Republic of Indonesia', PhoneCode: '+62' }],
  },
  {
    type: 'state', button: true, menu: 'Master > Generals > Location > State',
    samples: [{ StateCode: 'QUE', StateName: 'Quezon', Description: 'Province of Quezon, CALABARZON', Country: 'Philippines' }],
  },
  {
    type: 'city', button: true, menu: 'Master > Generals > Location > City',
    samples: [{ CityCode: 'CBY', CityName: 'Cabuyao', Description: 'City of Cabuyao, Laguna', State: 'Laguna', PostalCode: '4025' }],
  },
  {
    type: 'bank', button: true, menu: 'Master > Finance > Bank',
    formats: { ifscCode: 'SWIFT / BIC code of the branch' },
    samples: [{ bankCode: 'UBP', bankName: 'Union Bank of the Philippines', bankBranch: 'Ortigas Center', ifscCode: 'UBPHPHMM', AddressLine1: 'UnionBank Plaza, Meralco Ave.', City: 'Pasig',
      state: 'Metro Manila', Country: 'Philippines', mobile: '+63 2 8841 8600', email: 'customer.service@unionbank.example.ph', category: 'Universal Bank' }],
  },
  {
    type: 'bank-account', button: true, menu: 'Master > Finance > Bank (choose Bank accounts in the Upload dialog)',
    notes: ['Check the GL link and statement format of each account afterwards in Accounts > Bank Reconciliation.'],
    formats: { glAccountCode: 'GL cash account of the chart of accounts that this bank account reconciles to', statementFormat: 'Code of a bank statement format (Master > Finance > Bank Statement Formats), e.g. GENERIC, BDO-SAMPLE, BPI-SAMPLE, MBT-SAMPLE', reconcileFrom: 'Date YYYY-MM-DD from which bank reconciliation starts (normally the go-live date)' },
    samples: [{ accountCode: 'ACC-BDO-PAY', accountName: 'Payroll Account', bankCode: 'BDO', bankName: 'Banco de Oro', accountNumber: '0012-3456-7890', accountType: 'Current Account',
      currency: 'PHP', glAccount: '1102004', branch: 'Makati Ayala', branchCode: 'MKT', swiftCode: 'BNORPHMM', openingDate: '2026-10-01', contactPerson: 'Carlo Dizon', contactNumber: '+63 2 8840 7000',
      email: 'makati.ayala@bdo.example.ph', glAccountCode: '1102004', statementFormat: 'BDO-SAMPLE', reconcileFrom: '2026-10-01' }],
  },
  {
    type: 'currency', button: true, menu: 'Master > Finance > Currency',
    samples: [{ CurrencyCode: 'HKD', ISOcode: 'HKD', SmallestUnit: 'Cent', UnitDescription: 'Hong Kong cent', CurrencyName: 'Hong Kong Dollar', Description: 'Hong Kong Dollar',
      CurrencyFormat: '#,##0.00', NumberofDecimals: '2', symbol: 'HK$', isBase: 'No' }],
  },
  {
    type: 'exchange-rate', menu: 'Master > Finance > Exchange Rate',
    samples: [{ EffectiveFrom: '2026-10-01', EffectiveTo: '2026-10-31', CurrencyCode: 'USD', ToCurrencyCode: 'PHP', ExchangeRate: '57.85', CurrencyDescription: 'US Dollar', ToCurrencyDescription: 'Philippine Peso' }],
  },
  {
    type: 'transaction-code', button: true, menu: 'Master > Finance > Transaction Code',
    formats: { userGroupAccess: 'JSON list of role limits, e.g. [{"UserRole":"accounting","MinimumTransaction":0,"MaximumTransaction":1000000}]; may be left empty' },
    samples: [{ TransactionCode: 'CMR', TransactionName: 'Commission Receipt', Description: 'Commission received from insurers (direct bill)', TransactionBasis: 'Credit',
      MainAccountCode: '1203001', MainAccountDescription: 'Commission Receivable – Insurers (Direct Bill)', BranchCode: 'HO', BranchDescription: 'Head Office', DepartmentCode: 'FIN', DepartmentDescription: 'Finance' }],
  },
  {
    type: 'hierarchy', menu: 'Master > Generals > Employee Management > Hierarchy',
    samples: [{ rankCode: 'R6', rankName: 'Regional Director', description: 'Heads the sales regions', levelNumber: '6' }],
  },
  {
    type: 'designation', menu: 'Master > Generals > Employee Management > Designation',
    samples: [{ designationCode: 'DSG-CLO', designationName: 'Claims Officer', designationDescription: 'Handles claims from notification to settlement', departmentCode: 'CLM', level: '1', reportingtoLevel: '2' }],
  },
  {
    type: 'write-off-reason', menu: 'Master > Finance > Account Determination (write-off reasons)',
    formats: { glAccount: 'GL expense or income account the write-off is charged to', maxAmount: 'Largest amount one write-off may have, in PHP' },
    samples: [{ code: 'COURTESY', name: 'Courtesy adjustment approved by management', glAccount: '4401009', maxAmount: '500', description: 'Small courtesy adjustments on client accounts' }],
  },
  {
    type: 'account-category', menu: 'Master > Finance > Account Category',
    samples: [{ categoryCode: 'AC-CONTRA', categoryName: 'Contra Asset', description: 'Allowance for doubtful accounts and accumulated depreciation' }],
  },
  {
    type: 'security-rating', menu: 'Master > Finance > Reinsurance Treaty (security ratings of reinsurers)',
    formats: { rank: 'Whole number; a higher rank is a stronger rating (AAA is 22)' },
    samples: [{ rating: 'A++', rank: '21', agency: 'AM Best', description: 'Superior financial strength (AM Best)' }],
  },
  {
    type: 'product-category', menu: 'Product Configurator > Product Templates (product categories)',
    samples: [{ categoryCode: 'BONDS', categoryName: 'Surety Bonds', description: 'Performance, bid and payment bonds' }],
  },
  {
    type: 'risk-section', menu: 'Product Configurator > Risk Mapping (risk sections)',
    formats: { defaultRatePercent: 'Rate in percent of the sum insured, e.g. 0.25 for 0.25%' },
    samples: [{ sectionCode: 'MARINE', sectionLabel: 'Marine Cargo', defaultRatePercent: '0.25', sortOrder: '9', description: 'Marine cargo section for single shipments and open covers' }],
  },
  {
    type: 'remittance-schedule', file: 'Remittance Schedule', menu: 'Accounts > Remittance > Scheduling',
    notes: ['Insurers take the insurer names separated by semicolons (names contain commas). With no insurer named, the schedule runs the automated remittances listed in Linked Processes.'],
    samples: [{ code: 'SCH-003', name: 'Monthly MAPFRE remittance', insurers: 'MAPFRE Insurance Corporation', cutOffDays: '5', frequency: 'Monthly', nextRun: '2026-11-05', type: 'Remittance Processing' }],
  },
  {
    type: 'remittance-automated', file: 'Remittance Automated', menu: 'Master > Finance > Remittance Master > Automated Remittance',
    formats: { insurers: 'Insurer codes separated by commas', glMapping: 'JSON text, e.g. {"debit":"2201001","credit":"1102003"}' },
    samples: [{ code: 'ARM-003', name: 'Weekly auto remittance - motor', frequency: 'Weekly', dayOfExecution: '5', cutoffDays: '2', minTransactionCount: '1', insurers: 'MALAYAN, PIONEER', glMapping: '{"debit":"2201001","credit":"1102003"}' }],
  },
  {
    type: 'remittance-bulk-processing', file: 'Remittance Bulk Processing Configuration', menu: 'Master > Finance > Remittance Master > Bulk Processing',
    formats: {
      fieldMappings: 'JSON list of [{ sourceField, targetField, required }]; targetField one of policy_number, premium_amount, commission_amount, tax_amount, insured_name',
      validationRules: 'JSON list of [{ field, rule }]',
    },
    notes: ['A configuration defines the columns of the Remittance bulk upload file (Accounts > Remittance > Bulk Processing). The Remittance_Bulk_Upload_Template follows configuration BFM-001.'],
    samples: [{ code: 'BFM-003', name: 'Insurer Excel import', fileFormat: 'Excel', maxFileSize: '20MB', maxRecords: '10000',
      fieldMappings: '[{"sourceField":"Policy No","targetField":"policy_number","required":true},{"sourceField":"Gross Premium","targetField":"premium_amount","required":true},{"sourceField":"Commission","targetField":"commission_amount","required":true}]',
      validationRules: '[{"field":"policy_number","rule":"Not Empty"},{"field":"premium_amount","rule":"Positive Number"}]' }],
  },
  {
    type: 'remittance-settlement-parameter', file: 'Remittance Settlement Parameter', menu: 'Master > Finance > Remittance Master > Settlement Parameter',
    samples: [{ code: 'STP-003', name: 'Monthly settlement - small insurers', settlementFrequency: 'Monthly', minimumAmount: '500', maximumAmount: '250000', autoApproveBelow: '500', holdPeriodDays: '2' }],
  },
  {
    type: 'remittance-adjustment-type', file: 'Remittance Adjustment Type', menu: 'Master > Finance > Remittance Master > Adjustment Type',
    formats: { glAccounts: 'JSON text, e.g. {"debit":"4401009","credit":"2201001"}' },
    samples: [{ code: 'ADJ-010', name: 'Premium rounding difference', category: 'Premium', requiresApproval: 'Yes', approvalLimit: '100', glAccounts: '{"debit":"4401009","credit":"2201001"}' }],
  },
  {
    type: 'remittance-agency-bill', file: 'Remittance Agency Bill', menu: 'Master > Finance > Remittance Master > Agency Bill',
    formats: { lateFee: 'JSON text, e.g. {"type":"Percentage","rate":1,"gracePeriod":10,"compound":false}' },
    samples: [{ code: 'ABL-003', name: 'Quarterly agency billing', billingFrequency: 'Quarterly', billDate: '5', dueDays: '45', paymentTerms: 'Net 45', lateFee: '{"type":"Percentage","rate":1,"gracePeriod":10,"compound":false}' }],
  },
  {
    type: 'remittance-exception', file: 'Remittance Exception Type', menu: 'Master > Finance > Remittance Master > Exception Type',
    formats: { sla: 'JSON text, e.g. "48 hours" (with the quotes)' },
    samples: [{ code: 'EXC-004', name: 'Premium short remitted', category: 'Amount Mismatch', severity: 'High', autoResolve: 'No', sla: '"48 hours"' }],
  },
  {
    type: 'remittance-notification-template', file: 'Remittance Notification Template', menu: 'Master > Finance > Remittance Master > Notification Template',
    samples: [{ code: 'NTF-003', name: 'Remittance confirmation', channel: 'Email', trigger: 'Remittance approved', subject: 'Remittance {RemittanceNo} approved',
      body: 'Dear {InsurerName}: remittance {RemittanceNo} of {Amount} was approved on {ApprovedDate}.', variables: 'RemittanceNo, InsurerName, Amount, ApprovedDate' }],
  },
  {
    type: 'remittance-statement-template', file: 'Remittance Statement Template', menu: 'Master > Finance > Remittance Master > Statement Template',
    samples: [{ code: 'STM-003', name: 'Commission statement', type: 'Commission Statement', format: 'Excel', columns: 'Policy Number, Insured Name, Premium, Commission Rate, Commission' }],
  },
  {
    type: 'incentive-report-template', menu: 'Accounts > Incentive (incentive report templates; no menu screen of their own)',
    samples: [{ code: 'IRT-006', name: 'Quarterly producer ranking', category: 'Performance Reports', description: 'Top producers by premium for the quarter', parameters: 'Period, Branch', formats: 'PDF, Excel' }],
  },
  {
    type: 'reinsurance-report-template', menu: 'Reinsurance (reinsurance report templates; no menu screen of their own)',
    samples: [{ code: 'RPT005', name: 'Quarterly claims recovery statement', type: 'Claims', frequency: 'Quarterly', format: 'Excel, PDF', recipients: 'All Treaty Reinsurers', nextDue: '2027-01-10' }],
  },
];

export const masterTemplateInfo = (code) => MASTER_TEMPLATES.find((m) => m.type === code) || null;
