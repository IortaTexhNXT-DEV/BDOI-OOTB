// Product Configurator Mock Data Service for Thailand Market
// Comprehensive data for product configuration, rating, and underwriting

// Product Templates - Base templates for different lines of business
const productTemplates = [
  {
    id: 'PT001',
    templateCode: 'MOTOR-COMP-2025',
    name: 'Motor Comprehensive Insurance',
    category: 'Motor',
    lineOfBusiness: 'Motor Vehicle',
    description: 'Comprehensive motor insurance with CTPL and AOG coverage',
    status: 'Active',
    version: '2.1',
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    createdBy: 'Admin',
    createdDate: '2024-12-01',
    lastModified: '2025-01-15',
    insurers: ['Malayan Insurance', 'PGA Insurance', 'Charter Ping An'],
    baseRate: 2.5,
    minPremium: 15000,
    commissionRate: 15,
    features: {
      mandatory: ['CTPL', 'Own Damage'],
      optional: ['Acts of God', 'Personal Accident', 'Towing Service']
    }
  },
  {
    id: 'PT002',
    templateCode: 'HEALTH-GROUP-2025',
    name: 'Group Health Insurance',
    category: 'Health',
    lineOfBusiness: 'Health & Medical',
    description: 'Group health insurance for corporate clients',
    status: 'Active',
    version: '1.5',
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    createdBy: 'Product Manager',
    createdDate: '2024-11-15',
    lastModified: '2025-01-10',
    insurers: ['Maxicare', 'Medicard', 'Philhealth Partners'],
    baseRate: 1200,
    minPremium: 1200,
    commissionRate: 10,
    features: {
      mandatory: ['Hospitalization', 'Outpatient', 'Emergency'],
      optional: ['Dental', 'Maternity', 'Executive Check-up']
    }
  },
  {
    id: 'PT003',
    templateCode: 'PROP-FIRE-2025',
    name: 'Property Fire Insurance',
    category: 'Property',
    lineOfBusiness: 'Fire & Allied Perils',
    description: 'Standard fire insurance with allied perils',
    status: 'Active',
    version: '3.0',
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    createdBy: 'Admin',
    createdDate: '2024-10-01',
    lastModified: '2025-01-20',
    insurers: ['FPG Insurance', 'Standard Insurance', 'Pioneer Insurance'],
    baseRate: 0.35,
    minPremium: 5000,
    commissionRate: 20,
    features: {
      mandatory: ['Fire', 'Lightning'],
      optional: ['Typhoon', 'Flood', 'Earthquake', 'Riot & Strike']
    }
  },
  {
    id: 'PT004',
    templateCode: 'TRAVEL-INT-2025',
    name: 'International Travel Insurance',
    category: 'Travel',
    lineOfBusiness: 'Travel & Personal Accident',
    description: 'Comprehensive travel insurance for international trips',
    status: 'Active',
    version: '1.8',
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    createdBy: 'Product Team',
    createdDate: '2024-12-10',
    lastModified: '2025-01-18',
    insurers: ['AXA Thailand', 'Pacific Cross', 'Chubb Insurance'],
    baseRate: 500,
    minPremium: 500,
    commissionRate: 25,
    features: {
      mandatory: ['Medical Expenses', 'Emergency Evacuation', 'Trip Cancellation'],
      optional: ['Baggage Loss', 'Flight Delay', 'Adventure Sports']
    }
  },
  // Employee Benefit Templates
  {
    id: 'PT005',
    templateCode: 'EB-LIFE-2025',
    name: 'Group Life Insurance',
    category: 'Employee Benefits',
    lineOfBusiness: 'Employee Benefits',
    description: 'Group life insurance for employees with optional dependent coverage',
    status: 'Active',
    version: '2.0',
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    createdBy: 'EB Product Team',
    createdDate: '2024-11-01',
    lastModified: '2025-01-28',
    insurers: ['Sun Life Thailand', 'Pru Life UK', 'Manulife Thailand'],
    baseRate: 500,
    minPremium: 500,
    commissionRate: 15,
    features: {
      mandatory: ['Basic Life', 'Total Permanent Disability'],
      optional: ['Accidental Death', 'Dependent Life', 'Burial Assistance']
    }
  },
  {
    id: 'PT006',
    templateCode: 'EB-HEALTH-2025',
    name: 'Employee Health & Medical',
    category: 'Employee Benefits',
    lineOfBusiness: 'Employee Benefits',
    description: 'Comprehensive health coverage for employees including HMO',
    status: 'Active',
    version: '2.5',
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    createdBy: 'EB Product Team',
    createdDate: '2024-10-15',
    lastModified: '2025-01-28',
    insurers: ['Maxicare', 'Medicard', 'Intellicare', 'Philcare'],
    baseRate: 3500,
    minPremium: 3500,
    commissionRate: 12,
    features: {
      mandatory: ['Hospitalization', 'Outpatient', 'Emergency'],
      optional: ['Dental', 'Optical', 'Maternity', 'Mental Health', 'Executive Check-up']
    }
  },
  {
    id: 'PT007',
    templateCode: 'EB-ACCIDENT-2025',
    name: 'Group Personal Accident',
    category: 'Employee Benefits',
    lineOfBusiness: 'Employee Benefits',
    description: '24/7 worldwide accident protection for employees',
    status: 'Active',
    version: '1.8',
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    createdBy: 'EB Product Team',
    createdDate: '2024-11-20',
    lastModified: '2025-01-28',
    insurers: ['AXA Thailand', 'Malayan Insurance', 'Charter Ping An'],
    baseRate: 250,
    minPremium: 250,
    commissionRate: 18,
    features: {
      mandatory: ['Accidental Death', 'Dismemberment'],
      optional: ['Medical Reimbursement', 'Daily Hospital Income', 'Bereavement']
    }
  },
  {
    id: 'PT008',
    templateCode: 'EB-RETIREMENT-2025',
    name: 'Group Retirement Plan',
    category: 'Employee Benefits',
    lineOfBusiness: 'Employee Benefits',
    description: 'Retirement savings with insurance component',
    status: 'Active',
    version: '1.5',
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    createdBy: 'EB Product Team',
    createdDate: '2024-12-01',
    lastModified: '2025-01-28',
    insurers: ['Pru Life UK', 'Sun Life', 'Manulife', 'AXA Life'],
    baseRate: 1000,
    minPremium: 1000,
    commissionRate: 10,
    features: {
      mandatory: ['Retirement Fund', 'Life Insurance'],
      optional: ['Investment Options', 'Disability Waiver', 'Loan Facility']
    }
  },
  {
    id: 'PT009',
    templateCode: 'MARINE-CARGO-2025',
    name: 'Marine Cargo Insurance',
    category: 'Marine',
    lineOfBusiness: 'Marine Cargo',
    description: 'Coverage for goods in transit via sea, air, or land',
    status: 'Active',
    version: '2.3',
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    createdBy: 'Marine Dept',
    createdDate: '2024-11-20',
    lastModified: '2025-01-12',
    insurers: ['Malayan Insurance', 'FPG Insurance', 'Security Bank Insurance'],
    baseRate: 0.25,
    minPremium: 3000,
    commissionRate: 15,
    features: {
      mandatory: ['Institute Cargo Clauses'],
      optional: ['War Risk', 'SRCC', 'Theft Pilferage']
    }
  }
];

// Coverage Configurations
const coverageConfigurations = [
  {
    id: 'COV001',
    productId: 'PT001',
    coverageName: 'CTPL (Compulsory Third Party Liability)',
    coverageCode: 'CTPL',
    type: 'Mandatory',
    description: 'Mandatory coverage for bodily injury/death to third parties',
    limits: [
      { type: 'Per Person', amount: 100000, currency: 'THB' },
      { type: 'Per Event', amount: 500000, currency: 'THB' }
    ],
    deductible: 0,
    waitingPeriod: 0,
    exclusions: ['Intentional damage', 'Racing', 'DUI'],
    premiumImpact: 'Base',
    requiredDocuments: ['OR/CR', 'Valid License']
  },
  {
    id: 'COV002',
    productId: 'PT001',
    coverageName: 'Acts of God',
    coverageCode: 'AOG',
    type: 'Optional',
    description: 'Coverage for typhoon, flood, earthquake damages',
    limits: [
      { type: 'Maximum', amount: 1000000, currency: 'THB' }
    ],
    deductible: 5000,
    waitingPeriod: 0,
    exclusions: ['Gradual deterioration', 'Wear and tear'],
    premiumImpact: '+0.5%',
    requiredDocuments: []
  },
  {
    id: 'COV003',
    productId: 'PT002',
    coverageName: 'Hospitalization Benefit',
    coverageCode: 'HOSP',
    type: 'Mandatory',
    description: 'Inpatient coverage including room and board',
    limits: [
      { type: 'Annual', amount: 500000, currency: 'THB' },
      { type: 'Per Illness', amount: 150000, currency: 'THB' }
    ],
    deductible: 0,
    waitingPeriod: 30,
    exclusions: ['Pre-existing conditions', 'Cosmetic surgery'],
    premiumImpact: 'Base',
    requiredDocuments: ['Medical History Form']
  }
];

// Rating Factors
const ratingFactors = [
  {
    id: 'RF001',
    productId: 'PT001',
    factorName: 'Vehicle Age',
    factorCode: 'VEH_AGE',
    type: 'Multiplicative',
    status: 'Active',
    rules: [
      { condition: '0-1 years', factor: 1.0, description: 'New vehicle' },
      { condition: '2-5 years', factor: 1.1, description: 'Slightly used' },
      { condition: '6-10 years', factor: 1.3, description: 'Moderately used' },
      { condition: '> 10 years', factor: 1.5, description: 'Old vehicle' }
    ]
  },
  {
    id: 'RF002',
    productId: 'PT001',
    factorName: 'Driver Age',
    factorCode: 'DRV_AGE',
    type: 'Multiplicative',
    status: 'Active',
    rules: [
      { condition: '< 25 years', factor: 1.3, description: 'Young driver' },
      { condition: '25-65 years', factor: 1.0, description: 'Standard risk' },
      { condition: '> 65 years', factor: 1.2, description: 'Senior driver' }
    ]
  },
  {
    id: 'RF003',
    productId: 'PT001',
    factorName: 'NCB (No Claim Bonus)',
    factorCode: 'NCB',
    type: 'Discount',
    status: 'Active',
    rules: [
      { condition: '1 year', factor: 0.95, description: '5% discount' },
      { condition: '2 years', factor: 0.90, description: '10% discount' },
      { condition: '3+ years', factor: 0.85, description: '15% discount' }
    ]
  },
  {
    id: 'RF004',
    productId: 'PT003',
    factorName: 'Construction Type',
    factorCode: 'CONST_TYPE',
    type: 'Multiplicative',
    status: 'Active',
    rules: [
      { condition: 'Concrete', factor: 1.0, description: 'Standard rate' },
      { condition: 'Mixed', factor: 1.2, description: '20% loading' },
      { condition: 'Wood', factor: 1.5, description: '50% loading' }
    ]
  }
];

// Underwriting Rules
const underwritingRules = [
  {
    id: 'UW001',
    productId: 'PT001',
    ruleName: 'Vehicle Age Limit',
    ruleCode: 'VEH_AGE_LIMIT',
    type: 'Acceptance',
    status: 'Active',
    condition: 'Vehicle Age <= 15 years',
    action: 'Auto-Accept',
    message: 'Vehicle within acceptable age',
    authority: 'System',
    exceptions: ['Vintage cars with appraisal']
  },
  {
    id: 'UW002',
    productId: 'PT001',
    ruleName: 'Sum Insured Validation',
    ruleCode: 'SI_VALIDATION',
    type: 'Validation',
    status: 'Active',
    condition: 'Sum Insured <= Fair Market Value * 1.1',
    action: 'Refer',
    message: 'Sum insured exceeds fair market value',
    authority: 'Underwriter Level 1',
    exceptions: ['New vehicles', 'Imported vehicles']
  },
  {
    id: 'UW003',
    productId: 'PT002',
    ruleName: 'Group Size Minimum',
    ruleCode: 'GRP_SIZE_MIN',
    type: 'Acceptance',
    status: 'Active',
    condition: 'Number of Members >= 10',
    action: 'Auto-Accept',
    message: 'Meets minimum group size',
    authority: 'System',
    exceptions: ['Family plans']
  },
  {
    id: 'UW004',
    productId: 'PT003',
    ruleName: 'High Risk Location',
    ruleCode: 'HIGH_RISK_LOC',
    type: 'Loading',
    status: 'Active',
    condition: 'Location in Flood Prone Area',
    action: 'Apply Loading',
    message: 'Additional 25% loading for flood-prone area',
    authority: 'Underwriter Level 2',
    exceptions: ['With flood mitigation measures']
  }
];

// Document Templates
const documentTemplates = [
  {
    id: 'DOC001',
    productId: 'PT001',
    documentName: 'Motor Policy Schedule',
    documentCode: 'MOTOR_SCHED',
    type: 'Policy Document',
    format: 'PDF',
    template: 'motor_schedule_template.pdf',
    status: 'Active',
    mandatory: true,
    stage: 'Policy Issuance',
    variables: ['PolicyNumber', 'InsuredName', 'VehicleDetails', 'Premium']
  },
  {
    id: 'DOC002',
    productId: 'PT001',
    documentName: 'CTPL Certificate',
    documentCode: 'CTPL_CERT',
    type: 'Certificate',
    format: 'PDF',
    template: 'ctpl_certificate.pdf',
    status: 'Active',
    mandatory: true,
    stage: 'Policy Issuance',
    variables: ['PolicyNumber', 'PlateNumber', 'CoverageAmount']
  },
  {
    id: 'DOC003',
    productId: 'PT002',
    documentName: 'Member Enrollment Form',
    documentCode: 'MEMBER_ENROLL',
    type: 'Application',
    format: 'Excel',
    template: 'member_enrollment.xlsx',
    status: 'Active',
    mandatory: true,
    stage: 'Quotation',
    variables: ['CompanyName', 'MemberList', 'CoverageDetails']
  }
];

// Approval Workflows
const approvalWorkflows = [
  {
    id: 'WF001',
    workflowName: 'New Product Approval',
    workflowCode: 'NEW_PROD_APPR',
    type: 'Sequential',
    status: 'Active',
    stages: [
      {
        level: 1,
        role: 'Product Manager',
        action: 'Review & Recommend',
        sla: '2 days',
        escalation: 'Department Head'
      },
      {
        level: 2,
        role: 'Compliance Officer',
        action: 'Compliance Check',
        sla: '1 day',
        escalation: 'Chief Compliance'
      },
      {
        level: 3,
        role: 'Chief Product Officer',
        action: 'Final Approval',
        sla: '1 day',
        escalation: 'CEO'
      }
    ],
    triggers: ['New Product', 'Major Version Change']
  },
  {
    id: 'WF002',
    workflowName: 'Rate Change Approval',
    workflowCode: 'RATE_CHG_APPR',
    type: 'Parallel',
    status: 'Active',
    stages: [
      {
        level: 1,
        role: 'Actuarial Team',
        action: 'Rate Validation',
        sla: '3 days',
        escalation: 'Chief Actuary'
      },
      {
        level: 1,
        role: 'Sales Head',
        action: 'Market Impact Review',
        sla: '2 days',
        escalation: 'Chief Sales Officer'
      }
    ],
    triggers: ['Rate Change > 10%']
  }
];

// Product Versions
const productVersions = [
  {
    id: 'PV001',
    productId: 'PT001',
    version: '2.1',
    status: 'Current',
    releaseDate: '2025-01-15',
    changes: [
      'Updated AOG coverage limits',
      'Added towing service option',
      'Revised NCB discount structure'
    ],
    approvedBy: 'Chief Product Officer',
    approvalDate: '2025-01-14',
    effectiveDate: '2025-01-15',
    expiryDate: null
  },
  {
    id: 'PV002',
    productId: 'PT001',
    version: '2.0',
    status: 'Archived',
    releaseDate: '2024-07-01',
    changes: [
      'Initial 2024 product launch',
      'Standard CTPL coverage',
      'Basic rating structure'
    ],
    approvedBy: 'Chief Product Officer',
    approvalDate: '2024-06-30',
    effectiveDate: '2024-07-01',
    expiryDate: '2025-01-14'
  }
];

// Market Mapping - Products mapped to different insurers
const marketMapping = [
  {
    id: 'MM001',
    productId: 'PT001',
    insurerId: 'INS001',
    insurerName: 'Malayan Insurance',
    productCode: 'MAL-MOTOR-COMP',
    status: 'Active',
    commissionRate: 15,
    overrideRate: 2,
    profitShare: 5,
    targetPremium: 100000000,
    ytdPremium: 45000000,
    specialTerms: 'Exclusive fleet discount available',
    validFrom: '2025-01-01',
    validTo: '2025-12-31'
  },
  {
    id: 'MM002',
    productId: 'PT001',
    insurerId: 'INS002',
    insurerName: 'PGA Insurance',
    productCode: 'PGA-AUTO-2025',
    status: 'Active',
    commissionRate: 14,
    overrideRate: 1.5,
    profitShare: 3,
    targetPremium: 80000000,
    ytdPremium: 38000000,
    specialTerms: 'Quick claim settlement',
    validFrom: '2025-01-01',
    validTo: '2025-12-31'
  }
];

// Product Analytics Data
const productAnalytics = {
  topProducts: [
    {
      productId: 'PT001',
      productName: 'Motor Comprehensive',
      totalPolicies: 15234,
      totalPremium: 458000000,
      avgPremium: 30067,
      lossRatio: 65.2,
      profitMargin: 18.5,
      growth: 12.3
    },
    {
      productId: 'PT002',
      productName: 'Group Health',
      totalPolicies: 3456,
      totalPremium: 234000000,
      avgPremium: 67708,
      lossRatio: 72.1,
      profitMargin: 12.8,
      growth: 8.7
    },
    {
      productId: 'PT003',
      productName: 'Property Fire',
      totalPolicies: 8921,
      totalPremium: 156000000,
      avgPremium: 17489,
      lossRatio: 45.3,
      profitMargin: 28.9,
      growth: 15.6
    }
  ],
  performanceTrend: [
    { month: 'Jan', premium: 145000000, policies: 4532, lossRatio: 62.1 },
    { month: 'Feb', premium: 138000000, policies: 4289, lossRatio: 64.5 },
    { month: 'Mar', premium: 152000000, policies: 4721, lossRatio: 61.8 },
    { month: 'Apr', premium: 148000000, policies: 4598, lossRatio: 63.2 },
    { month: 'May', premium: 156000000, policies: 4845, lossRatio: 60.9 },
    { month: 'Jun', premium: 162000000, policies: 5032, lossRatio: 59.7 }
  ],
  categoryBreakdown: {
    Motor: { percentage: 45, premium: 458000000, count: 15234 },
    Health: { percentage: 23, premium: 234000000, count: 3456 },
    Property: { percentage: 15, premium: 156000000, count: 8921 },
    Travel: { percentage: 10, premium: 102000000, count: 12543 },
    Marine: { percentage: 7, premium: 71000000, count: 2134 }
  }
};

// Commission Structures
const commissionStructures = [
  {
    id: 'CS001',
    productId: 'PT001',
    structureName: 'Standard Motor Commission',
    type: 'Tiered',
    status: 'Active',
    tiers: [
      { from: 0, to: 1000000, rate: 12, description: 'Base tier' },
      { from: 1000001, to: 5000000, rate: 14, description: 'Silver tier' },
      { from: 5000001, to: 10000000, rate: 16, description: 'Gold tier' },
      { from: 10000001, to: null, rate: 18, description: 'Platinum tier' }
    ],
    bonusScheme: {
      quarterly: { target: 25000000, bonus: 2 },
      annual: { target: 100000000, bonus: 5 }
    }
  }
];

// Mock Service
const productConfiguratorMockService = {
  // Product Templates
  getProductTemplates: () => Promise.resolve([...productTemplates]),
  getProductTemplateById: (id) => Promise.resolve(productTemplates.find(p => p.id === id)),
  createProductTemplate: (template) => {
    const newTemplate = {
      ...template,
      id: `PT${String(productTemplates.length + 1).padStart(3, '0')}`,
      createdDate: new Date().toISOString()
    };
    productTemplates.push(newTemplate);
    return Promise.resolve(newTemplate);
  },
  updateProductTemplate: (id, updates) => {
    const index = productTemplates.findIndex(p => p.id === id);
    if (index !== -1) {
      productTemplates[index] = { ...productTemplates[index], ...updates };
      return Promise.resolve(productTemplates[index]);
    }
    return Promise.reject('Product template not found');
  },

  // Coverage Configurations
  getCoverageConfigurations: (productId) => {
    if (productId) {
      return Promise.resolve(coverageConfigurations.filter(c => c.productId === productId));
    }
    return Promise.resolve([...coverageConfigurations]);
  },
  createCoverage: (coverage) => {
    const newCoverage = {
      ...coverage,
      id: `COV${String(coverageConfigurations.length + 1).padStart(3, '0')}`
    };
    coverageConfigurations.push(newCoverage);
    return Promise.resolve(newCoverage);
  },

  // Rating Factors
  getRatingFactors: (productId) => {
    if (productId) {
      return Promise.resolve(ratingFactors.filter(r => r.productId === productId));
    }
    return Promise.resolve([...ratingFactors]);
  },
  createRatingFactor: (factor) => {
    const newFactor = {
      ...factor,
      id: `RF${String(ratingFactors.length + 1).padStart(3, '0')}`
    };
    ratingFactors.push(newFactor);
    return Promise.resolve(newFactor);
  },

  // Underwriting Rules
  getUnderwritingRules: (productId) => {
    if (productId) {
      return Promise.resolve(underwritingRules.filter(u => u.productId === productId));
    }
    return Promise.resolve([...underwritingRules]);
  },
  createUnderwritingRule: (rule) => {
    const newRule = {
      ...rule,
      id: `UW${String(underwritingRules.length + 1).padStart(3, '0')}`
    };
    underwritingRules.push(newRule);
    return Promise.resolve(newRule);
  },

  // Document Templates
  getDocumentTemplates: (productId) => {
    if (productId) {
      return Promise.resolve(documentTemplates.filter(d => d.productId === productId));
    }
    return Promise.resolve([...documentTemplates]);
  },

  // Approval Workflows
  getApprovalWorkflows: () => Promise.resolve([...approvalWorkflows]),
  getWorkflowById: (id) => Promise.resolve(approvalWorkflows.find(w => w.id === id)),

  // Product Versions
  getProductVersions: (productId) => {
    if (productId) {
      return Promise.resolve(productVersions.filter(v => v.productId === productId));
    }
    return Promise.resolve([...productVersions]);
  },

  // Market Mapping
  getMarketMapping: (productId) => {
    if (productId) {
      return Promise.resolve(marketMapping.filter(m => m.productId === productId));
    }
    return Promise.resolve([...marketMapping]);
  },

  // Product Analytics
  getProductAnalytics: () => Promise.resolve({ ...productAnalytics }),
  getTopProducts: () => Promise.resolve(productAnalytics.topProducts),
  getPerformanceTrend: () => Promise.resolve(productAnalytics.performanceTrend),
  getCategoryBreakdown: () => Promise.resolve(productAnalytics.categoryBreakdown),

  // Commission Structures
  getCommissionStructures: (productId) => {
    if (productId) {
      return Promise.resolve(commissionStructures.filter(c => c.productId === productId));
    }
    return Promise.resolve([...commissionStructures]);
  },

  // Calculate Premium
  calculatePremium: (productId, sumInsured, factors) => {
    const template = productTemplates.find(p => p.id === productId);
    if (!template) return Promise.reject('Product not found');

    let premium = sumInsured * (template.baseRate / 100);

    // Apply rating factors
    Object.values(factors || {}).forEach(factor => {
      premium *= factor;
    });

    // Apply minimum premium
    premium = Math.max(premium, template.minPremium);

    return Promise.resolve({
      basePremium: sumInsured * (template.baseRate / 100),
      adjustedPremium: premium,
      factors: factors,
      commission: premium * (template.commissionRate / 100),
      netPremium: premium * (1 - template.commissionRate / 100)
    });
  }
};

// Export service
export default productConfiguratorMockService;

// Export individual data for potential direct access
export {
  productTemplates,
  coverageConfigurations,
  ratingFactors,
  underwritingRules,
  documentTemplates,
  approvalWorkflows,
  productVersions,
  marketMapping,
  productAnalytics,
  commissionStructures
};