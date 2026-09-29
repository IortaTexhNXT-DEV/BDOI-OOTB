// Reinsurance Mock Data Service for Thailand Market
// Comprehensive data for treaty management, cessions, claims, and analytics

// Reinsurers - Mix of local and international
const reinsurers = [
  {
    id: 'RE001',
    name: 'National Reinsurance Corporation of Thailand',
    shortName: 'NRCP',
    type: 'Local',
    country: 'Thailand',
    rating: 'A-',
    capacity: 'THB 5 Billion',
    contact: {
      email: 'treaty@nrcp.ph',
      phone: '+63 2 8888 7777',
      address: 'Makati City, Metro Manila'
    },
    status: 'Active'
  },
  {
    id: 'RE002',
    name: 'Swiss Re Asia Pte Ltd',
    shortName: 'Swiss Re',
    type: 'International',
    country: 'Switzerland',
    rating: 'AA-',
    capacity: 'USD 10 Billion',
    contact: {
      email: 'asia.treaty@swissre.com',
      phone: '+65 6532 2161',
      address: 'Singapore'
    },
    status: 'Active'
  },
  {
    id: 'RE003',
    name: 'Munich Re Singapore',
    shortName: 'Munich Re',
    type: 'International',
    country: 'Germany',
    rating: 'AA-',
    capacity: 'USD 8 Billion',
    contact: {
      email: 'singapore@munichre.com',
      phone: '+65 6318 9700',
      address: 'Singapore'
    },
    status: 'Active'
  },
  {
    id: 'RE004',
    name: 'Gen Re Thailand',
    shortName: 'Gen Re',
    type: 'International',
    country: 'Germany',
    rating: 'AA+',
    capacity: 'USD 6 Billion',
    contact: {
      email: 'manila@genre.com',
      phone: '+63 2 8845 1234',
      address: 'BGC, Taguig City'
    },
    status: 'Active'
  },
  {
    id: 'RE005',
    name: 'Asian Reinsurance Corporation',
    shortName: 'Asian Re',
    type: 'Regional',
    country: 'Thailand',
    rating: 'BBB+',
    capacity: 'USD 500 Million',
    contact: {
      email: 'treaty@asianre.com',
      phone: '+66 2 665 7000',
      address: 'Bangkok, Thailand'
    },
    status: 'Active'
  }
];

// Treaties - Various types for different lines of business
const treaties = [
  {
    id: 'TR001',
    treatyNumber: 'QS-MOTOR-2025',
    name: 'Motor Quota Share Treaty 2025',
    type: 'Quota Share',
    lineOfBusiness: 'Motor',
    reinsurers: ['RE001', 'RE002'],
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    cession: {
      percentage: 40,
      maxLimit: 'THB 50,000,000',
      retention: 'THB 30,000,000'
    },
    commission: {
      type: 'Sliding Scale',
      rates: [
        { lossRatio: '0-50%', commission: '35%' },
        { lossRatio: '50-60%', commission: '32.5%' },
        { lossRatio: '60-70%', commission: '30%' },
        { lossRatio: '70%+', commission: '27.5%' }
      ]
    },
    status: 'Active',
    utilization: 67.5,
    premiumCeded: 'THB 125,000,000',
    claimsRecovered: 'THB 45,000,000'
  },
  {
    id: 'TR002',
    treatyNumber: 'SURPLUS-PROP-2025',
    name: 'Property Surplus Treaty 2025',
    type: 'Surplus',
    lineOfBusiness: 'Property',
    reinsurers: ['RE002', 'RE003', 'RE004'],
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    lines: 8,
    retention: 'THB 100,000,000',
    capacity: 'THB 800,000,000',
    commission: {
      type: 'Flat',
      rate: '30%'
    },
    status: 'Active',
    utilization: 45.2,
    premiumCeded: 'THB 85,000,000',
    claimsRecovered: 'THB 22,000,000'
  },
  {
    id: 'TR003',
    treatyNumber: 'CAT-XOL-2025',
    name: 'Catastrophe Excess of Loss 2025',
    type: 'Excess of Loss',
    lineOfBusiness: 'Catastrophe',
    reinsurers: ['RE002', 'RE003'],
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    layers: [
      {
        layer: 1,
        limit: 'THB 500,000,000',
        excess: 'THB 100,000,000',
        rate: '3.5%',
        reinstatements: 2
      },
      {
        layer: 2,
        limit: 'THB 1,000,000,000',
        excess: 'THB 600,000,000',
        rate: '2.8%',
        reinstatements: 1
      }
    ],
    events: ['Typhoon', 'Earthquake', 'Flood'],
    status: 'Active',
    utilization: 0,
    premiumCeded: 'THB 45,000,000',
    claimsRecovered: 'THB 0'
  },
  {
    id: 'TR004',
    treatyNumber: 'STOP-LOSS-2025',
    name: 'Aggregate Stop Loss Treaty 2025',
    type: 'Stop Loss',
    lineOfBusiness: 'All Lines',
    reinsurers: ['RE001', 'RE005'],
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    trigger: {
      type: 'Loss Ratio',
      threshold: '75%',
      limit: '90%',
      coverage: '90% of excess'
    },
    premium: 'THB 25,000,000',
    status: 'Active',
    currentLossRatio: 68.5,
    utilization: 0,
    premiumCeded: 'THB 25,000,000',
    claimsRecovered: 'THB 0'
  },
  {
    id: 'TR005',
    treatyNumber: 'QS-FIRE-2025',
    name: 'Fire Quota Share Treaty 2025',
    type: 'Quota Share',
    lineOfBusiness: 'Fire',
    reinsurers: ['RE001'],
    effectiveDate: '2025-01-01',
    expiryDate: '2025-12-31',
    cession: {
      percentage: 50,
      maxLimit: 'THB 100,000,000',
      retention: 'THB 100,000,000'
    },
    commission: {
      type: 'Flat',
      rate: '32.5%'
    },
    status: 'Active',
    utilization: 72.3,
    premiumCeded: 'THB 95,000,000',
    claimsRecovered: 'THB 38,000,000'
  }
];

// Cessions - Policy cessions to treaties
const cessions = [
  {
    id: 'CES001',
    policyNumber: 'MOT-2025-00145',
    insured: 'ABC Transport Inc.',
    lineOfBusiness: 'Motor',
    treatyId: 'TR001',
    treatyNumber: 'QS-MOTOR-2025',
    grossPremium: 'THB 500,000',
    sumInsured: 'THB 25,000,000',
    cessionPercentage: 40,
    cededPremium: 'THB 200,000',
    cededSumInsured: 'THB 10,000,000',
    commission: 'THB 70,000',
    netPremium: 'THB 130,000',
    cessionDate: '2025-09-15',
    status: 'Confirmed',
    bordereau: 'BDX-2025-09'
  },
  {
    id: 'CES002',
    policyNumber: 'FIRE-2025-00234',
    insured: 'XYZ Manufacturing Corp.',
    lineOfBusiness: 'Fire',
    treatyId: 'TR005',
    treatyNumber: 'QS-FIRE-2025',
    grossPremium: 'THB 2,000,000',
    sumInsured: 'THB 150,000,000',
    cessionPercentage: 50,
    cededPremium: 'THB 1,000,000',
    cededSumInsured: 'THB 75,000,000',
    commission: 'THB 325,000',
    netPremium: 'THB 675,000',
    cessionDate: '2025-09-10',
    status: 'Confirmed',
    bordereau: 'BDX-2025-09'
  },
  {
    id: 'CES003',
    policyNumber: 'PROP-2025-00567',
    insured: 'Megamall Properties Inc.',
    lineOfBusiness: 'Property',
    treatyId: 'TR002',
    treatyNumber: 'SURPLUS-PROP-2025',
    grossPremium: 'THB 5,000,000',
    sumInsured: 'THB 500,000,000',
    retention: 'THB 100,000,000',
    lines: 4,
    cededSumInsured: 'THB 400,000,000',
    cededPremium: 'THB 4,000,000',
    commission: 'THB 1,200,000',
    netPremium: 'THB 2,800,000',
    cessionDate: '2025-09-05',
    status: 'Confirmed',
    bordereau: 'BDX-2025-09'
  },
  {
    id: 'CES004',
    policyNumber: 'MAR-2025-00089',
    insured: 'Shipping Lines Thailand',
    lineOfBusiness: 'Marine',
    type: 'Facultative',
    grossPremium: 'THB 3,000,000',
    sumInsured: 'THB 200,000,000',
    facultativeReinsurer: 'RE003',
    cessionPercentage: 80,
    cededPremium: 'THB 2,400,000',
    cededSumInsured: 'THB 160,000,000',
    commission: 'THB 600,000',
    netPremium: 'THB 1,800,000',
    cessionDate: '2025-09-01',
    status: 'Pending',
    notes: 'High value cargo - awaiting reinsurer confirmation'
  },
  {
    id: 'CES005',
    policyNumber: 'MOT-2025-00188',
    insured: 'City Bus Corporation',
    lineOfBusiness: 'Motor',
    treatyId: 'TR001',
    treatyNumber: 'QS-MOTOR-2025',
    grossPremium: 'THB 800,000',
    sumInsured: 'THB 30,000,000',
    cessionPercentage: 40,
    cededPremium: 'THB 320,000',
    cededSumInsured: 'THB 12,000,000',
    commission: 'THB 112,000',
    netPremium: 'THB 208,000',
    cessionDate: '2025-09-20',
    status: 'Confirmed',
    bordereau: 'BDX-2025-09'
  }
];

// Reinsurance Claims and Recoveries
const reinsuranceClaims = [
  {
    id: 'RCL001',
    claimNumber: 'CLM-2025-00456',
    policyNumber: 'MOT-2025-00145',
    insured: 'ABC Transport Inc.',
    dateOfLoss: '2025-08-15',
    causeOfLoss: 'Collision',
    grossClaim: 'THB 5,000,000',
    treatyId: 'TR001',
    treatyNumber: 'QS-MOTOR-2025',
    cessionPercentage: 40,
    recoverableAmount: 'THB 2,000,000',
    status: 'Recovered',
    recoveryDate: '2025-09-10',
    settlementAmount: 'THB 2,000,000',
    documents: ['Loss Report', 'Police Report', 'Repair Estimate']
  },
  {
    id: 'RCL002',
    claimNumber: 'CLM-2025-00512',
    policyNumber: 'FIRE-2025-00234',
    insured: 'XYZ Manufacturing Corp.',
    dateOfLoss: '2025-07-20',
    causeOfLoss: 'Fire',
    grossClaim: 'THB 20,000,000',
    treatyId: 'TR005',
    treatyNumber: 'QS-FIRE-2025',
    cessionPercentage: 50,
    recoverableAmount: 'THB 10,000,000',
    status: 'Pending',
    submissionDate: '2025-08-01',
    expectedSettlement: '2025-10-15',
    documents: ['Fire Report', 'Loss Adjuster Report', 'Photos']
  },
  {
    id: 'RCL003',
    claimNumber: 'CLM-2025-00523',
    policyNumber: 'PROP-2025-00567',
    insured: 'Megamall Properties Inc.',
    dateOfLoss: '2025-09-01',
    causeOfLoss: 'Typhoon Damage',
    grossClaim: 'THB 50,000,000',
    treatyId: 'TR002',
    treatyNumber: 'SURPLUS-PROP-2025',
    retention: 'THB 10,000,000',
    recoverableAmount: 'THB 40,000,000',
    status: 'Processing',
    submissionDate: '2025-09-05',
    cashCall: {
      requested: true,
      amount: 'THB 20,000,000',
      date: '2025-09-06',
      status: 'Approved'
    },
    documents: ['Catastrophe Report', 'Engineering Assessment', 'Photos']
  },
  {
    id: 'RCL004',
    claimNumber: 'CLM-2025-00478',
    policyNumber: 'MOT-2025-00098',
    insured: 'Delivery Express Corp.',
    dateOfLoss: '2025-06-10',
    causeOfLoss: 'Theft',
    grossClaim: 'THB 3,000,000',
    treatyId: 'TR001',
    treatyNumber: 'QS-MOTOR-2025',
    cessionPercentage: 40,
    recoverableAmount: 'THB 1,200,000',
    status: 'Recovered',
    recoveryDate: '2025-08-20',
    settlementAmount: 'THB 1,200,000',
    documents: ['Police Report', 'Investigation Report']
  }
];

// Bordereaux - Premium and claims statements
const bordereaux = [
  {
    id: 'BDX001',
    reference: 'BDX-2025-09',
    type: 'Premium',
    period: 'September 2025',
    treatyId: 'TR001',
    treatyNumber: 'QS-MOTOR-2025',
    reinsurer: 'RE001',
    entries: 15,
    grossPremium: 'THB 8,500,000',
    cededPremium: 'THB 3,400,000',
    commission: 'THB 1,190,000',
    netAmount: 'THB 2,210,000',
    status: 'Submitted',
    submissionDate: '2025-10-05',
    dueDate: '2025-10-31'
  },
  {
    id: 'BDX002',
    reference: 'BDX-CLM-Q3-2025',
    type: 'Claims',
    period: 'Q3 2025',
    treatyId: 'TR001',
    treatyNumber: 'QS-MOTOR-2025',
    reinsurer: 'RE002',
    entries: 8,
    grossClaims: 'THB 15,000,000',
    recoverableAmount: 'THB 6,000,000',
    recovered: 'THB 4,500,000',
    outstanding: 'THB 1,500,000',
    status: 'Confirmed',
    submissionDate: '2025-10-10',
    confirmationDate: '2025-10-15'
  }
];

// Analytics Data
const analyticsData = {
  treatyUtilization: [
    { treaty: 'QS-MOTOR', utilization: 67.5 },
    { treaty: 'SURPLUS-PROP', utilization: 45.2 },
    { treaty: 'CAT-XOL', utilization: 0 },
    { treaty: 'STOP-LOSS', utilization: 0 },
    { treaty: 'QS-FIRE', utilization: 72.3 }
  ],
  lossRatioTrend: [
    { month: 'Jan', gross: 65, net: 58 },
    { month: 'Feb', gross: 62, net: 55 },
    { month: 'Mar', gross: 68, net: 60 },
    { month: 'Apr', gross: 70, net: 62 },
    { month: 'May', gross: 66, net: 58 },
    { month: 'Jun', gross: 71, net: 63 },
    { month: 'Jul', gross: 73, net: 65 },
    { month: 'Aug', gross: 69, net: 61 },
    { month: 'Sep', gross: 67, net: 59 }
  ],
  retentionOptimization: {
    current: {
      retention: 60,
      cession: 40,
      profitability: 15.5
    },
    recommended: {
      retention: 65,
      cession: 35,
      profitability: 17.2
    }
  },
  recoveryPerformance: {
    totalClaimed: 'THB 125,000,000',
    totalRecovered: 'THB 106,250,000',
    recoveryRate: 85,
    averageTime: 45,
    disputed: 3
  },
  catastropheExposure: {
    zones: [
      { zone: 'Metro Manila', exposure: 'THB 2,500,000,000', policies: 450 },
      { zone: 'Cebu', exposure: 'THB 800,000,000', policies: 150 },
      { zone: 'Davao', exposure: 'THB 600,000,000', policies: 120 },
      { zone: 'Iloilo', exposure: 'THB 400,000,000', policies: 85 }
    ],
    perils: [
      { peril: 'Typhoon', pml: 'THB 500,000,000' },
      { peril: 'Earthquake', pml: 'THB 750,000,000' },
      { peril: 'Flood', pml: 'THB 300,000,000' }
    ]
  }
};

// Reconciliation Data
const reconciliationData = {
  pending: [
    {
      id: 'REC001',
      type: 'Premium',
      reinsurer: 'RE001',
      period: 'August 2025',
      ourAmount: 'THB 3,200,000',
      theirAmount: 'THB 3,180,000',
      variance: 'THB 20,000',
      variancePercent: 0.6,
      status: 'Pending Review',
      items: 42
    },
    {
      id: 'REC002',
      type: 'Claims',
      reinsurer: 'RE002',
      period: 'Q2 2025',
      ourAmount: 'THB 12,500,000',
      theirAmount: 'THB 12,500,000',
      variance: 'THB 0',
      variancePercent: 0,
      status: 'Matched',
      items: 18
    }
  ],
  exceptions: [
    {
      id: 'EXC001',
      date: '2025-09-20',
      type: 'Missing Policy',
      description: 'Policy MOT-2025-00199 not found in reinsurer statement',
      amount: 'THB 45,000',
      status: 'Under Investigation'
    }
  ]
};

// Report Templates
const reportTemplates = [
  {
    id: 'RPT001',
    name: 'Monthly Premium Bordereau',
    type: 'Premium',
    frequency: 'Monthly',
    format: ['Excel', 'PDF'],
    recipients: ['All Treaty Reinsurers'],
    lastGenerated: '2025-10-05',
    nextDue: '2025-11-05'
  },
  {
    id: 'RPT002',
    name: 'Quarterly Claims Report',
    type: 'Claims',
    frequency: 'Quarterly',
    format: ['Excel', 'PDF'],
    recipients: ['Treaty and Facultative Reinsurers'],
    lastGenerated: '2025-10-10',
    nextDue: '2026-01-10'
  },
  {
    id: 'RPT003',
    name: 'Annual Treaty Performance',
    type: 'Performance',
    frequency: 'Annual',
    format: ['PowerPoint', 'PDF'],
    recipients: ['Management', 'Reinsurers'],
    lastGenerated: '2024-12-31',
    nextDue: '2025-12-31'
  },
  {
    id: 'RPT004',
    name: 'IC Quarterly Submission',
    type: 'Regulatory',
    frequency: 'Quarterly',
    format: ['Excel'],
    recipients: ['Insurance Commission'],
    lastGenerated: '2025-09-30',
    nextDue: '2025-12-31'
  }
];

// CRUD Operations
const reinsuranceMockService = {
  // Treaties
  getTreaties: () => Promise.resolve([...treaties]),
  getTreatyById: (id) => Promise.resolve(treaties.find(t => t.id === id)),
  addTreaty: (treaty) => {
    const newTreaty = {
      id: `TR${String(treaties.length + 1).padStart(3, '0')}`,
      ...treaty,
      status: 'Active',
      utilization: 0,
      premiumCeded: 'THB 0',
      claimsRecovered: 'THB 0'
    };
    treaties.push(newTreaty);
    return Promise.resolve(newTreaty);
  },
  updateTreaty: (id, updates) => {
    const index = treaties.findIndex(t => t.id === id);
    if (index !== -1) {
      treaties[index] = { ...treaties[index], ...updates };
      return Promise.resolve(treaties[index]);
    }
    return Promise.reject('Treaty not found');
  },

  // Reinsurers
  getReinsurers: () => Promise.resolve([...reinsurers]),
  getReinsurerById: (id) => Promise.resolve(reinsurers.find(r => r.id === id)),

  // Cessions
  getCessions: () => Promise.resolve([...cessions]),
  getCessionById: (id) => Promise.resolve(cessions.find(c => c.id === id)),
  addCession: (cession) => {
    const newCession = {
      id: `CES${String(cessions.length + 1).padStart(3, '0')}`,
      ...cession,
      cessionDate: new Date().toISOString().split('T')[0],
      status: 'Pending'
    };
    cessions.push(newCession);
    return Promise.resolve(newCession);
  },

  // Claims
  getReinsuranceClaims: () => Promise.resolve([...reinsuranceClaims]),
  getClaimById: (id) => Promise.resolve(reinsuranceClaims.find(c => c.id === id)),
  submitRecovery: (claimId, recovery) => {
    const claim = reinsuranceClaims.find(c => c.id === claimId);
    if (claim) {
      claim.status = 'Processing';
      claim.submissionDate = new Date().toISOString().split('T')[0];
      return Promise.resolve(claim);
    }
    return Promise.reject('Claim not found');
  },

  // Bordereaux
  getBordereaux: () => Promise.resolve([...bordereaux]),
  generateBordereau: (params) => {
    const newBordereau = {
      id: `BDX${String(bordereaux.length + 1).padStart(3, '0')}`,
      reference: `BDX-${params.type}-${params.period}`,
      ...params,
      status: 'Draft',
      createdDate: new Date().toISOString().split('T')[0]
    };
    bordereaux.push(newBordereau);
    return Promise.resolve(newBordereau);
  },

  // Treaty specific methods
  getTreatyById: (id) => {
    const treaty = treaties.find(t => t.id === id);
    return Promise.resolve(treaty || treaties[0]);
  },
  getCessionsByTreaty: (treatyId) => {
    const treatyCessions = cessions.filter(c => c.treatyId === treatyId || c.treatyNumber === 'QS-MOTOR-2025');
    return Promise.resolve(treatyCessions.length > 0 ? treatyCessions : cessions.slice(0, 5));
  },
  getClaimsByTreaty: (treatyId) => {
    const treatyClaims = reinsuranceClaims.filter(c => c.treatyId === treatyId || c.treatyNumber === 'QS-MOTOR-2025');
    return Promise.resolve(treatyClaims.length > 0 ? treatyClaims : reinsuranceClaims.slice(0, 5));
  },

  // Analytics
  getAnalytics: () => Promise.resolve({ ...analyticsData }),
  getTreatyUtilization: () => Promise.resolve(analyticsData.treatyUtilization),
  getLossRatioTrend: () => Promise.resolve(analyticsData.lossRatioTrend),
  getRetentionAnalysis: () => Promise.resolve(analyticsData.retentionOptimization),
  getRecoveryMetrics: () => Promise.resolve(analyticsData.recoveryPerformance),
  getCatastropheExposure: () => Promise.resolve(analyticsData.catastropheExposure),

  // Reconciliation
  getReconciliationItems: () => Promise.resolve({ ...reconciliationData }),
  getPendingReconciliations: () => Promise.resolve(reconciliationData.pending),
  getExceptions: () => Promise.resolve(reconciliationData.exceptions),

  // Reports
  getReportTemplates: () => Promise.resolve([...reportTemplates]),
  generateReport: (templateId) => {
    const template = reportTemplates.find(t => t.id === templateId);
    if (template) {
      return Promise.resolve({
        ...template,
        generatedDate: new Date().toISOString(),
        data: 'Report data would be here'
      });
    }
    return Promise.reject('Template not found');
  }
};

// Export service
export default reinsuranceMockService;

// Export individual data for potential direct access
export {
  reinsurers,
  treaties,
  cessions,
  reinsuranceClaims,
  bordereaux,
  analyticsData,
  reconciliationData,
  reportTemplates
};