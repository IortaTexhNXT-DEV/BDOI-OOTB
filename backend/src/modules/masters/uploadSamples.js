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
      City: 'Makati City', State: 'Metro Manila', Country: 'Philippines', PhoneNumber: '+63 2 8812 4400', IsPrimary: 'No' }],
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
      tin: '000-439-588-000', addressLine1: 'Skyland Plaza, Sen. Gil Puyat Ave.', city: 'Makati City', state: 'Metro Manila', country: 'Philippines', email: 'underwriting@charterpingan.example.ph',
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
    type: 'region', menu: 'Master > Generals > Location > Province (regions are shown with their provinces; no Region screen of its own)',
    notes: ['The 18 Philippine regions of the PSGC (NCR, CAR, Region I to XIII, MIMAROPA, NIR, BARMM) are shipped. Add a region only for another country.'],
    samples: [{ RegionCode: 'MY-PEN', RegionName: 'Peninsular Malaysia', Designation: 'West Malaysia', PsgcCode: '', Country: 'Malaysia', SortOrder: '100' }],
  },
  {
    type: 'state', button: true, menu: 'Master > Generals > Location > Province',
    notes: ['The 82 Philippine provinces, Metro Manila and the BARMM Special Geographic Area are shipped with their PSGC codes (Philippine Statistics Authority). Add a province only for another country.',
      'Province Code: the ISO 3166-2:PH code of a Philippine province (e.g. CEB for Cebu). The headers State Code and State Name of earlier templates are still read.'],
    samples: [{ StateCode: 'MY-10', StateName: 'Selangor', Description: 'State of Selangor', Region: 'Peninsular Malaysia', Country: 'Malaysia', Level: 'Province / state outside the Philippines', PsgcCode: '' }],
  },
  {
    type: 'city', button: true, file: 'City Municipality', menu: 'Master > Generals > Location > City / Municipality',
    notes: ['The 1,642 Philippine cities and municipalities are shipped with their PSGC code, class and ZIP code. Add one only for another country, or edit a shipped record on the screen.',
      'Province: name or code of a record of the Province master. Region is filled from the province when left empty.'],
    samples: [{ CityCode: 'MY-10-SHA', CityName: 'Shah Alam', Description: 'City of Shah Alam, Selangor', State: 'MY-10', Region: '', CityClass: '', PostalCode: '40000', NcrDistrict: '', PsgcCode: '' }],
  },
  {
    type: 'barangay', menu: 'Master > Generals > Location > City / Municipality (barangays are picked on the address forms; no Barangay screen of its own)',
    notes: ['Metro Manila barangays are shipped; the 42,000 barangays of the whole country are loaded with backend/scripts/load-barangays.js (PSGC list). Use this template only for barangays missing from the list.',
      'City / Municipality: PSGC code (10 digits) or name of a record of the City / Municipality master. A name shared by several cities (e.g. San Jose) needs the PSGC code.'],
    samples: [{ BarangayCode: '0730600041', BarangayName: 'Lahug', City: '0730600000', PostalCode: '6000' }],
  },
  {
    type: 'bank', button: true, menu: 'Master > Finance > Bank',
    formats: { ifscCode: 'SWIFT / BIC code of the branch' },
    notes: ['The main Philippine banks are shipped (BDO, BPI, Metrobank, Land Bank, PNB, Security Bank, UnionBank, RCBC, China Bank, EastWest, DBP, PSBank, AUB, Maybank, PBCom, Bank of Commerce, Veterans Bank) with their SWIFT codes. Add the others you deal with.'],
    samples: [{ bankCode: 'CITI', bankName: 'Citibank, N.A. (Philippine Branch)', bankBranch: 'Bonifacio Global City', ifscCode: 'CITIPHMX', AddressLine1: '1 Bonifacio High Street, 5th Ave.', City: 'Taguig City',
      state: 'Metro Manila', Country: 'Philippines', mobile: '+63 2 8995 9999', email: 'customer.service@citi.example.ph', category: 'Commercial Bank' }],
  },
  {
    type: 'bank-account', button: true, menu: 'Master > Finance > Bank (choose Bank accounts in the Upload dialog)',
    notes: ['Check the GL link and statement format of each account afterwards in Accounts > Bank Reconciliation.'],
    formats: { glAccountCode: 'GL cash account of the chart of accounts that this bank account reconciles to', statementFormat: 'Code of a bank statement format (Master > Finance > Bank Statement Formats), e.g. GENERIC, BDO-SAMPLE, BPI-SAMPLE, MBT-SAMPLE', reconcileFrom: 'Date YYYY-MM-DD from which bank reconciliation starts (normally the go-live date)' },
    samples: [{ accountCode: 'ACC-BDO-PAY', accountName: 'Payroll Account', bankCode: 'BDO', bankName: 'BDO Unibank, Inc.', accountNumber: '0012-3456-7890', accountType: 'Current Account',
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
  {
    type: 'salutation', menu: 'Master > Configuration (reference list, API /api/masters/salutation; no screen of its own)',
    samples: [{ code: 'PROF', name: 'Prof.', description: 'Professor', sortOrder: '110' }],
  },
  {
    type: 'civil-status', menu: 'Master > Configuration (reference list, API /api/masters/civil-status; no screen of its own)',
    samples: [{ code: 'LIVEIN', name: 'Living In', description: 'Not a civil status in law; for internal use only', sortOrder: '70' }],
  },
  {
    type: 'gender', menu: 'Master > Configuration (reference list, API /api/masters/gender; no screen of its own)',
    samples: [{ code: 'X', name: 'Prefer not to say', sortOrder: '30' }],
  },
  {
    type: 'nationality', menu: 'Master > Configuration (reference list, API /api/masters/nationality; no screen of its own)',
    samples: [{ code: 'NZL', name: 'New Zealander', countryCode: 'NZ', isDefault: 'No' }],
  },
  {
    type: 'government-id-type', menu: 'Master > Configuration (reference list, API /api/masters/government-id-type; no screen of its own)',
    samples: [{ code: 'NBI', name: 'NBI Clearance', issuingAgency: 'National Bureau of Investigation', numberFormat: '', sortOrder: '130' }],
  },
  {
    type: 'customer-type', menu: 'Master > Configuration (reference list, API /api/masters/customer-type; no screen of its own)',
    samples: [{ code: 'MUTUAL', name: 'Mutual Benefit Association', clientType: 'corporate', registrationAuthority: 'SEC', registrationNumberLabel: 'SEC Registration No.', tinRequired: 'Yes', description: 'Mutual benefit association' }],
  },
  {
    type: 'payment-mode', menu: 'Master > Configuration (reference list, API /api/masters/payment-mode; no screen of its own)',
    samples: [{ code: 'SHOPEEPAY', name: 'ShopeePay', channel: 'online', referenceRequired: 'Yes', description: 'E-wallet payment', sortOrder: '110' }],
  },
  {
    type: 'holiday', menu: 'Master > Configuration (reference list, API /api/masters/holiday; no screen of its own)',
    notes: ['National holidays of the current and next year are shipped (Republic Act No. 9492 and the yearly proclamation). Add local special non-working days (city or province charter days) and correct a date when a proclamation moves it.'],
    samples: [{ code: '2026-08-19-QCDAY', name: 'Quezon City Day', date: '2026-08-19', holidayType: 'Special Non-working Day', scope: 'Local', location: 'Quezon City', legalBasis: 'Proclamation for the year', remarks: 'Confirm the date with the yearly proclamation' }],
  },
  // operations and accounting masters (seed 73_ops_accounting.sql)
  {
    type: 'supplier', menu: 'Accounts > Payables > Suppliers',
    formats: { ewtCode: 'EWT tax code of Master > Finance > Taxation withheld from the supplier, e.g. WC158 (goods), WC160 (services), WC100 (rentals); empty = none',
      paymentTermsDays: 'Days from the invoice date to the due date', expenseAccount: 'GL expense account proposed on new invoice lines, e.g. 4401008' },
    samples: [{ code: 'SUP-010', name: 'Metro Courier Services Inc.', tin: '009-876-543-000', address: '12 Shaw Blvd., Mandaluyong City', vatRegistered: 'Yes', ewtCode: 'WC160',
      paymentTermsDays: '30', expenseAccount: '4401007', contactPerson: 'Billing Officer', email: 'billing@metrocourier.example.ph', phone: '+63 2 8700 1234', bankName: 'BDO Unibank, Inc.', bankAccountNo: '0012-3456-7899' }],
  },
  {
    type: 'asset-class', menu: 'Master > Finance > Asset Classes',
    formats: { usefulLifeMonths: 'Straight-line useful life in months, e.g. 36 for computers', salvagePercent: 'Salvage value as a percent of cost (0 when none)',
      assetAccount: 'GL asset account, e.g. 1401003', accumulatedAccount: 'GL accumulated depreciation account, e.g. 1402003', expenseAccount: 'GL depreciation expense account, e.g. 4406001' },
    samples: [{ code: 'OFFICE-FITOUT', name: 'Office fit-out', usefulLifeMonths: '84', salvagePercent: '0', assetAccount: '1401005', accumulatedAccount: '1402005', expenseAccount: '4406002' }],
  },
  {
    type: 'short-period-rate', menu: 'Master > Insurance Management > Short-Period Rates',
    notes: ['Premium the insurer keeps when the insured cancels, by the days the policy was in force (annual policies). The common Philippine non-life scale is shipped; replace it with the scale of your insurers if it differs.'],
    formats: { maxDays: 'Upper limit of the band in days in force, e.g. 31 for not exceeding 1 month', retainedPercent: 'Percent of the annual premium kept by the insurer, e.g. 20' },
    samples: [{ code: 'SP13', maxDays: '15', retainedPercent: '10', description: 'Not exceeding 15 days' }],
  },
  {
    type: 'cancellation-reason', menu: 'Master > Insurance Management > Cancellation Reasons',
    formats: { initiatedBy: 'insured (short-period scale) or insurer (pro-rata)', method: 'auto (from who initiates), pro-rata, short-period or flat (whole premium returned)' },
    samples: [{ code: 'TOTAL_LOSS', name: 'Total loss of the insured property', initiatedBy: 'insurer', method: 'pro-rata', description: 'Cover ends with a total loss' }],
  },
  {
    type: 'claim-document-requirement', menu: 'Master > Insurance Management > Claim Document Checklist',
    formats: { lineOfBusiness: 'Line of business code as on the policy (MOTOR, FIRE ...) or * for every line', claimType: 'Claim type as on the claim (Own Damage, Theft, Third Party ...) or * for every type',
      required: 'Yes when the claim cannot go to the insurer without it' },
    samples: [{ code: 'PA-MEDCERT', lineOfBusiness: 'PA', claimType: '*', documentName: 'Medical certificate and hospital bills', required: 'Yes', sortOrder: '40' }],
  },
  {
    type: 'repair-shop', menu: 'Master > Insurance Management > Repair Shops',
    formats: { accredited: 'Yes when the insurers accredit the shop (only accredited shops take estimates)', accreditedInsurers: 'Insurers that accredit the shop', labourRatePerHour: 'Labour rate per hour agreed with the insurers' },
    samples: [{ code: 'RS-010', name: 'Quality Auto Repair Center', address: '88 E. Rodriguez Jr. Ave.', city: 'Quezon City', contactPerson: 'Service Advisor', phone: '+63 2 8911 2233',
      email: 'service@qualityauto.example.ph', tin: '010-222-333-000', accredited: 'Yes', accreditedInsurers: 'Malayan, Pioneer', labourRatePerHour: '650' }],
  },
  // sales activities (seed 76_sales_activities.sql): what account executives log and its outcome
  {
    type: 'sales-activity-type', menu: 'Master > Organization > Sales Activity Types',
    formats: { channel: 'call, meeting, email, visit or other', followUpDays: 'Days from the activity to the next step date proposed', sortOrder: 'Order in the list' },
    samples: [{ code: 'TRADE-FAIR', name: 'Trade fair or motor show', channel: 'meeting', followUpDays: '7', sortOrder: '80' }],
  },
  {
    type: 'sales-activity-outcome', menu: 'Master > Organization > Sales Activity Outcomes',
    formats: { result: 'positive, neutral or negative (counted in the activity report)', sortOrder: 'Order in the list' },
    samples: [{ code: 'REFERRAL', name: 'Gave a referral', result: 'positive', sortOrder: '90' }],
  },
];

export const masterTemplateInfo = (code) => MASTER_TEMPLATES.find((m) => m.type === code) || null;
