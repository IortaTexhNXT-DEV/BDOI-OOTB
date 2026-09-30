/**
 * Master types published as upload templates (docs/templates, GET /masters/:type/template): the menu path of the
 * screen, sample rows (Philippine examples, keyed by field name) and column notes the field type alone does not
 * give; button: the screen has an Upload button. The columns themselves always come from the type definition (service.uploadColumns).
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
    type: 'department', menu: 'Master > Finance > Department (reached from the Branch screen)',
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
    type: 'city', button: true, menu: 'Master > Generals > Location > City Master',
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
      CurrencyFormat: '#,##0.00', NumberofDecimals: '2', symbol: 'HK$', isBase: 'No', exchangeRate: '7.40' }],
  },
  {
    type: 'exchange-rate', menu: 'Master > Finance > Exchange Rate',
    samples: [{ EffectiveFrom: '2026-10-01', EffectiveTo: '2026-10-31', CurrencyCode: 'USD', ToCurrencyCode: 'PHP', ExchangeRate: '57.85', CurrencyDescription: 'US Dollar', ToCurrencyDescription: 'Philippine Peso' }],
  },
  {
    type: 'transaction-code', button: true, menu: 'Master > Finance > Transaction code',
    formats: { userGroupAccess: 'JSON list of role limits, e.g. [{"UserRole":"accounting","MinimumTransaction":0,"MaximumTransaction":1000000}]; may be left empty' },
    samples: [{ TransactionCode: 'CMR', TransactionName: 'Commission Receipt', Description: 'Commission received from insurers (direct bill)', TransactionBasis: 'Credit',
      MainAccountCode: '1203001', MainAccountDescription: 'Commission Receivable – Insurers (Direct Bill)', BranchCode: 'HO', BranchDescription: 'Head Office', DepartmentCode: 'FIN', DepartmentDescription: 'Finance' }],
  },
  {
    type: 'commission', menu: 'Master > Generals > Commission',
    formats: { maxRate: 'Percent, e.g. 25 for 25%', sharing: 'JSON list of sharing levels, e.g. [{"level":"Agent","sharingRate":60}]; may be left empty' },
    samples: [{ commissionCode: 'COM-FIRE-CHA', desc: 'Fire - Charter Ping An', insuranceCompany: 'Charter Ping An Insurance Corporation', product: 'Fire and Allied Perils', selectCover: 'Fire',
      maxRate: '25', selectAgent: '', effectiveFrom: '2026-10-01', effectiveTo: '2027-09-30' }],
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
    type: 'employee', menu: 'Master > Generals > Employee Management > Employee',
    samples: [{ employeeCode: 'EMP-0101', firstName: 'Paolo', middleName: 'Garcia', lastName: 'Mendoza', employeeType: 'Permanent', designation: 'Account Executive', reportingTo: 'EMP-0001',
      branchCode: 'HO', departmentCode: 'SLS', idProofType: 'PhilSys ID', idNumber: '1234-5678-9012-3456', addressLine1: '45 Kalayaan Ave.', city: 'Quezon City', state: 'Metro Manila',
      country: 'Philippines', email: 'paolo.mendoza@example.ph' }],
  },
  {
    type: 'write-off-reason', menu: 'Master > Finance > Account Determination (write-off reasons)',
    formats: { glAccount: 'GL expense or income account the write-off is charged to', maxAmount: 'Largest amount one write-off may have, in PHP' },
    samples: [{ code: 'COURTESY', name: 'Courtesy adjustment approved by management', glAccount: '4401009', maxAmount: '500', description: 'Small courtesy adjustments on client accounts' }],
  },
  {
    type: 'petty-cash', button: true, menu: 'Master > Finance > Petty cash',
    formats: { pettycashsize: 'Fund size in PHP', avilabelcash: 'Cash on hand at go-live in PHP', minicashbox: 'Replenish below this amount (PHP)', transactionlimit: 'Largest single payment in PHP' },
    samples: [{ pettycashcode: 'PC-ILO', pettycashname: 'Iloilo Branch Petty Cash', pettycashsize: '20000', avilabelcash: '20000', minicashbox: '5000', transactionlimit: '2000', custodian: 'Liza Uy', branchCode: 'CEB' }],
  },
];

export const masterTemplateInfo = (code) => MASTER_TEMPLATES.find((m) => m.type === code) || null;
