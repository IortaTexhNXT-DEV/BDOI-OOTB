// Thailand Insurance Payments Mock Data

export const paymentData = [
  {
    id: 1,
    grossPremium: "₱22,500",
    clientId: "CL-2025-001",
    clientName: "Juan Dela Cruz",
    date: "2025-03-28",
    policyNumber: "MIC-2025-MOT-00123",
    insurer: "Malayan Insurance",
    product: "Comprehensive Car Insurance",
    status: "PAID",
    paymentMethod: "GCash",
    referenceNumber: "GC-2025032801234",
    commission: "₱3,375"
  },
  {
    id: 2,
    grossPremium: "₱18,500",
    clientId: "CL-2025-002",
    clientName: "Maria Santos",
    date: "2025-03-27",
    policyNumber: "PGA-2025-MOT-00456",
    insurer: "PGA Sompo",
    product: "Motor Insurance",
    status: "PAID",
    paymentMethod: "Bank Transfer",
    referenceNumber: "BDO-2025032712345",
    commission: "₱2,775"
  },
  {
    id: 3,
    grossPremium: "₱36,000",
    clientId: "CL-2025-003",
    clientName: "Jose Reyes",
    date: "2025-03-26",
    policyNumber: "AXA-2025-HLT-00789",
    insurer: "AXA Thailand",
    product: "Individual Health Insurance",
    status: "PENDING",
    paymentMethod: "Credit Card",
    dueDate: "2025-04-05",
    commission: "₱7,200"
  },
  {
    id: 4,
    grossPremium: "₱45,000",
    clientId: "CL-2025-004",
    clientName: "Ana Garcia",
    date: "2025-03-25",
    policyNumber: "CHA-2025-FIRE-01012",
    insurer: "Charter Ping An",
    product: "Fire Insurance",
    status: "PAID",
    paymentMethod: "Check",
    checkNumber: "MBTC-987654",
    commission: "₱9,000"
  },
  {
    id: 5,
    grossPremium: "₱8,500",
    clientId: "CL-2025-005",
    clientName: "Pedro Gonzales",
    date: "2025-03-24",
    policyNumber: "FPG-2025-MOT-01315",
    insurer: "FPG Insurance",
    product: "Motorcycle Insurance",
    status: "PENDING",
    paymentMethod: "PayMaya",
    dueDate: "2025-04-01",
    commission: "₱1,275"
  },
  {
    id: 6,
    grossPremium: "₱125,000",
    clientId: "CL-2025-006",
    clientName: "2GO Group Inc.",
    date: "2025-03-23",
    policyNumber: "STD-2025-MAR-01921",
    insurer: "Standard Insurance",
    product: "Marine Cargo Insurance",
    status: "REVIEWING",
    paymentMethod: "Bank Transfer",
    notes: "Corporate account - pending finance approval",
    commission: "₱18,750"
  },
  {
    id: 7,
    grossPremium: "₱65,000",
    clientId: "CL-2025-007",
    clientName: "Ayala Corporation",
    date: "2025-03-22",
    policyNumber: "MAX-2025-HMO-02527",
    insurer: "Maxicare",
    product: "HMO Family Plan",
    status: "QUARTERLY",
    paymentMethod: "Auto-Debit",
    nextPayment: "2025-04-01",
    quarterlyAmount: "₱16,250",
    commission: "₱6,500"
  },
  {
    id: 8,
    grossPremium: "₱1,800",
    clientId: "CL-2025-008",
    clientName: "Elena Martinez",
    date: "2025-03-21",
    policyNumber: "MIC-2025-CTPL-02224",
    insurer: "Malayan Insurance",
    product: "CTPL Only",
    status: "PAID",
    paymentMethod: "Cash",
    orNumber: "OR-2025032100123",
    commission: "₱180"
  },
  {
    id: 9,
    grossPremium: "₱28,000",
    clientId: "CL-2025-009",
    clientName: "Carmen Bautista",
    date: "2025-03-20",
    policyNumber: "PGA-2025-PROP-02830",
    insurer: "PGA Sompo",
    product: "Homeowners Insurance",
    status: "PAID",
    paymentMethod: "Credit Card",
    cardLastFour: "****4567",
    commission: "₱5,600"
  },
  {
    id: 10,
    grossPremium: "₱3,500",
    clientId: "CL-2025-010",
    clientName: "Rosa Fernandez",
    date: "2025-03-19",
    policyNumber: "PIO-2025-TRV-01618",
    insurer: "Pioneer Insurance",
    product: "Travel Insurance",
    status: "PAID",
    paymentMethod: "PayMaya",
    referenceNumber: "PM-2025031923456",
    commission: "₱875"
  },
  {
    id: 11,
    grossPremium: "₱250,000",
    clientId: "CL-2025-011",
    clientName: "SM Prime Holdings",
    date: "2025-03-18",
    policyNumber: "CHA-2025-FIRE-00189",
    insurer: "Charter Ping An",
    product: "Commercial Fire Insurance",
    status: "INSTALLMENT",
    paymentMethod: "Bank Transfer",
    installmentPlan: "Monthly",
    monthlyAmount: "₱20,833.33",
    commission: "₱50,000"
  },
  {
    id: 12,
    grossPremium: "₱15,000",
    clientId: "CL-2025-012",
    clientName: "Miguel Torres",
    date: "2025-03-17",
    policyNumber: "AXA-2025-PA-03456",
    insurer: "AXA Thailand",
    product: "Personal Accident Insurance",
    status: "OVERDUE",
    paymentMethod: "Check",
    dueDate: "2025-03-15",
    daysOverdue: 13,
    commission: "₱3,000"
  }
];

// Payment Summary Statistics
export const paymentSummary = {
  totalPremiumCollected: "₱789,800",
  totalPending: "₱44,500",
  totalOverdue: "₱15,000",
  totalCommission: "₱132,455",
  collectionRate: "92.5%",
  averagePaymentTime: "3.5 days"
};

// Payment Methods Distribution
export const paymentMethodStats = [
  { method: "Bank Transfer", count: 4, amount: "₱438,333", percentage: 35 },
  { method: "GCash", count: 2, amount: "₱24,300", percentage: 20 },
  { method: "Credit Card", count: 2, amount: "₱64,000", percentage: 15 },
  { method: "PayMaya", count: 2, amount: "₱12,000", percentage: 10 },
  { method: "Check", count: 2, amount: "₱60,000", percentage: 10 },
  { method: "Cash", count: 1, amount: "₱1,800", percentage: 5 },
  { method: "Auto-Debit", count: 1, amount: "₱65,000", percentage: 5 }
];

// Monthly Collection Trend
export const monthlyCollectionTrend = [
  { month: "January 2025", collected: "₱2,450,000", target: "₱2,500,000" },
  { month: "February 2025", collected: "₱2,680,000", target: "₱2,500,000" },
  { month: "March 2025", collected: "₱789,800", target: "₱2,750,000" }, // Month to date
  { month: "April 2025", collected: "₱0", target: "₱3,000,000" },
  { month: "May 2025", collected: "₱0", target: "₱3,000,000" },
  { month: "June 2025", collected: "₱0", target: "₱3,250,000" }
];

export default paymentData;