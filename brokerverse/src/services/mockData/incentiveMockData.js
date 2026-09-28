// Mock Data Service for Incentive Module
// Provides realistic data for Thailand insurance broker incentive management

export const incentiveMockData = {
  // Incentive Programs
  programs: [
    {
      id: 1,
      programCode: "INC-2025-001",
      programName: "Q1 Premium Achievers",
      description: "Quarterly incentive for premium targets",
      programType: "Target Based",
      applicableTo: ["Individual Agent"],
      startDate: "2025-01-01",
      endDate: "2025-03-31",
      targetMetric: "Premium Volume",
      baseTarget: 500000,
      stretchTarget: 750000,
      currency: "THB",
      calculationFrequency: "Quarterly",
      status: "Active",
      createdDate: "2024-12-15",
      createdBy: "Admin",
      structure: [
        { level: "80-90%", type: "Percentage", value: 2, maxPayout: 20000 },
        { level: "90-100%", type: "Percentage", value: 3, maxPayout: 30000 },
        { level: "100-110%", type: "Percentage", value: 4, maxPayout: 50000 },
        { level: "110%+", type: "Percentage", value: 5, maxPayout: 75000 }
      ]
    },
    {
      id: 2,
      programCode: "INC-2025-002",
      programName: "New Business Champion",
      description: "Monthly incentive for new policy acquisition",
      programType: "Commission Based",
      applicableTo: ["Individual Agent", "Team"],
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      targetMetric: "Policy Count",
      baseTarget: 20,
      stretchTarget: 30,
      currency: "THB",
      calculationFrequency: "Monthly",
      status: "Active",
      createdDate: "2024-12-20",
      createdBy: "Manager",
      structure: [
        { level: "0-10 policies", type: "Fixed Amount", value: 500, maxPayout: 5000 },
        { level: "11-20 policies", type: "Fixed Amount", value: 750, maxPayout: 15000 },
        { level: "21-30 policies", type: "Fixed Amount", value: 1000, maxPayout: 30000 },
        { level: "31+ policies", type: "Fixed Amount", value: 1500, maxPayout: 50000 }
      ]
    },
    {
      id: 3,
      programCode: "INC-2025-003",
      programName: "Renewal Excellence",
      description: "Incentive for maintaining high renewal rates",
      programType: "Hybrid",
      applicableTo: ["Individual Agent", "Branch"],
      startDate: "2025-01-01",
      endDate: "2025-06-30",
      targetMetric: "Renewal Rate",
      baseTarget: 85,
      stretchTarget: 95,
      currency: "THB",
      calculationFrequency: "Semi-Annual",
      status: "Active",
      createdDate: "2024-12-18",
      createdBy: "Admin",
      structure: [
        { level: "85-90%", type: "Fixed Amount", value: 10000, maxPayout: 10000 },
        { level: "90-95%", type: "Fixed Amount", value: 20000, maxPayout: 20000 },
        { level: "95%+", type: "Fixed Amount", value: 35000, maxPayout: 35000 }
      ]
    },
    {
      id: 4,
      programCode: "INC-2025-004",
      programName: "Team Performance Bonus",
      description: "Quarterly team-based performance incentive",
      programType: "Target Based",
      applicableTo: ["Team", "Branch"],
      startDate: "2025-04-01",
      endDate: "2025-06-30",
      targetMetric: "Premium Volume",
      baseTarget: 2000000,
      stretchTarget: 3000000,
      currency: "THB",
      calculationFrequency: "Quarterly",
      status: "Draft",
      createdDate: "2025-01-10",
      createdBy: "Manager"
    },
    {
      id: 5,
      programCode: "INC-2024-010",
      programName: "Year End Special",
      description: "Annual performance bonus",
      programType: "Hybrid",
      applicableTo: ["Individual Agent"],
      startDate: "2024-01-01",
      endDate: "2024-12-31",
      targetMetric: "Premium Volume",
      baseTarget: 1000000,
      stretchTarget: 1500000,
      currency: "THB",
      calculationFrequency: "Annual",
      status: "Completed",
      createdDate: "2023-12-01",
      createdBy: "Admin"
    },
    // H8: Renewal-specific Incentive Programs
    {
      id: 6,
      programCode: "REN-2025-001",
      programName: "Renewal Retention Champion",
      description: "Monthly incentive for achieving renewal targets",
      programType: "Target Based",
      applicableTo: ["Individual Agent", "Team"],
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      targetMetric: "Renewal Rate",
      baseTarget: 80,
      stretchTarget: 90,
      currency: "THB",
      calculationFrequency: "Monthly",
      status: "Active",
      createdDate: "2024-12-28",
      createdBy: "Admin",
      structure: [
        { level: "80-85%", type: "Fixed Amount", value: 5000, maxPayout: 5000 },
        { level: "85-90%", type: "Fixed Amount", value: 10000, maxPayout: 10000 },
        { level: "90-95%", type: "Fixed Amount", value: 20000, maxPayout: 20000 },
        { level: "95%+", type: "Fixed Amount", value: 35000, maxPayout: 35000 }
      ]
    },
    {
      id: 7,
      programCode: "REN-2025-002",
      programName: "Early Bird Renewal Bonus",
      description: "Bonus for renewals completed 30+ days before expiry",
      programType: "Commission Based",
      applicableTo: ["Individual Agent"],
      startDate: "2025-01-01",
      endDate: "2025-06-30",
      targetMetric: "Early Renewal Count",
      baseTarget: 10,
      stretchTarget: 25,
      currency: "THB",
      calculationFrequency: "Monthly",
      status: "Active",
      createdDate: "2024-12-30",
      createdBy: "Manager",
      structure: [
        { level: "Per early renewal", type: "Fixed Amount", value: 500, maxPayout: 25000 }
      ]
    },
    {
      id: 8,
      programCode: "REN-2025-003",
      programName: "Lapse Recovery Specialist",
      description: "Incentive for successful win-back of lapsed policies",
      programType: "Commission Based",
      applicableTo: ["Individual Agent"],
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      targetMetric: "Lapsed Policy Recovery",
      baseTarget: 5,
      stretchTarget: 15,
      currency: "THB",
      calculationFrequency: "Quarterly",
      status: "Active",
      createdDate: "2025-01-02",
      createdBy: "Admin",
      structure: [
        { level: "Per recovery", type: "Percentage", value: 10, maxPayout: 50000 }
      ]
    }
  ],

  // Agent Assignments and Performance
  agentPrograms: [
    {
      agentId: "AG001",
      agentName: "Juan Dela Cruz",
      agentCode: "JDC001",
      branch: "Manila Main",
      assignedPrograms: [
        {
          programId: 1,
          programName: "Q1 Premium Achievers",
          target: 500000,
          achieved: 425000,
          achievementPercent: 85,
          potentialEarning: 17000,
          daysRemaining: 65,
          lastUpdated: "2025-01-26"
        },
        {
          programId: 2,
          programName: "New Business Champion",
          target: 20,
          achieved: 18,
          achievementPercent: 90,
          potentialEarning: 13500,
          daysRemaining: 5,
          lastUpdated: "2025-01-26"
        },
        {
          programId: 3,
          programName: "Renewal Excellence",
          target: 85,
          achieved: 88,
          achievementPercent: 103.5,
          potentialEarning: 10000,
          daysRemaining: 155,
          lastUpdated: "2025-01-26"
        }
      ],
      recentActivities: [
        { date: "2025-01-26", activity: "New Policy - Auto Insurance", impact: "+25,000", points: 250 },
        { date: "2025-01-25", activity: "Policy Renewal - Home Insurance", impact: "+15,000", points: 150 },
        { date: "2025-01-24", activity: "New Policy - Life Insurance", impact: "+50,000", points: 500 },
        { date: "2025-01-23", activity: "Policy Endorsement", impact: "+5,000", points: 50 }
      ]
    },
    {
      agentId: "AG002",
      agentName: "Maria Santos",
      agentCode: "MS002",
      branch: "Quezon City",
      assignedPrograms: [
        {
          programId: 1,
          programName: "Q1 Premium Achievers",
          target: 500000,
          achieved: 550000,
          achievementPercent: 110,
          potentialEarning: 50000,
          daysRemaining: 65
        },
        {
          programId: 2,
          programName: "New Business Champion",
          target: 20,
          achieved: 25,
          achievementPercent: 125,
          potentialEarning: 25000,
          daysRemaining: 5
        }
      ]
    }
  ],

  // Calculation Batches
  calculationBatches: [
    {
      batchId: "CALC-2025-01",
      period: "January 2025",
      calculationDate: "2025-02-01",
      programsIncluded: ["INC-2025-002"],
      totalAmount: 285000,
      agentCount: 15,
      status: "Pending Approval",
      submittedBy: "System Admin",
      submittedDate: "2025-02-01",
      details: [
        {
          agentName: "Juan Dela Cruz",
          program: "New Business Champion",
          target: 20,
          achieved: 18,
          achievementPercent: 90,
          baseIncentive: 13500,
          adjustments: 0,
          finalAmount: 13500,
          status: "Calculated"
        },
        {
          agentName: "Maria Santos",
          program: "New Business Champion",
          target: 20,
          achieved: 25,
          achievementPercent: 125,
          baseIncentive: 25000,
          adjustments: -1000,
          finalAmount: 24000,
          status: "Adjusted"
        },
        {
          agentName: "Pedro Reyes",
          program: "New Business Champion",
          target: 20,
          achieved: 22,
          achievementPercent: 110,
          baseIncentive: 22000,
          adjustments: 0,
          finalAmount: 22000,
          status: "Calculated"
        }
      ]
    },
    {
      batchId: "CALC-2024-12",
      period: "December 2024",
      calculationDate: "2025-01-01",
      programsIncluded: ["INC-2024-010"],
      totalAmount: 450000,
      agentCount: 20,
      status: "Approved",
      submittedBy: "System Admin",
      submittedDate: "2025-01-01",
      approvedBy: "Finance Manager",
      approvalDate: "2025-01-03"
    },
    {
      batchId: "CALC-2024-11",
      period: "November 2024",
      calculationDate: "2024-12-01",
      programsIncluded: ["INC-2024-009"],
      totalAmount: 380000,
      agentCount: 18,
      status: "Paid",
      submittedBy: "System Admin",
      submittedDate: "2024-12-01",
      approvedBy: "Finance Manager",
      approvalDate: "2024-12-03",
      paymentDate: "2024-12-15"
    }
  ],

  // Report Templates
  reportTemplates: [
    {
      id: 1,
      name: "Monthly Payout Summary",
      category: "Payout Reports",
      description: "Summary of incentives paid by month",
      parameters: ["Period", "Program", "Branch"],
      formats: ["PDF", "Excel"]
    },
    {
      id: 2,
      name: "Agent Payout Details",
      category: "Payout Reports",
      description: "Detailed breakdown of individual agent payouts",
      parameters: ["Agent", "Date Range", "Program"],
      formats: ["PDF", "Excel"]
    },
    {
      id: 3,
      name: "Target Achievement Report",
      category: "Performance Reports",
      description: "Achievement levels across programs and agents",
      parameters: ["Period", "Program", "Minimum Achievement %"],
      formats: ["PDF", "Excel"]
    },
    {
      id: 4,
      name: "Top Performers",
      category: "Performance Reports",
      description: "Ranking of top performing agents",
      parameters: ["Period", "Top N", "Program"],
      formats: ["PDF"]
    },
    {
      id: 5,
      name: "Program Effectiveness",
      category: "Program Analysis",
      description: "Analysis of program impact on sales",
      parameters: ["Program", "Date Range"],
      formats: ["PDF"]
    }
  ],

  // Statement Data
  statementData: {
    agentName: "Juan Dela Cruz",
    agentCode: "JDC001",
    period: "January 2025",
    statementDate: "2025-02-01",
    totalEarnings: 38500,
    ytdEarnings: 38500,
    pendingPayment: 13500,
    lastPayment: 25000,
    lastPaymentDate: "2024-12-15",
    programBreakdown: [
      {
        program: "New Business Champion",
        target: 20,
        achievement: 18,
        rate: "750 per policy",
        earnedAmount: 13500
      },
      {
        program: "Q1 Premium Achievers",
        target: 500000,
        achievement: 425000,
        rate: "3%",
        earnedAmount: 0
      },
      {
        program: "Renewal Excellence",
        target: "85%",
        achievement: "88%",
        rate: "Fixed",
        earnedAmount: 0
      }
    ],
    monthlyTrend: [
      { month: "Jan-24", earnings: 22000 },
      { month: "Feb-24", earnings: 28000 },
      { month: "Mar-24", earnings: 31000 },
      { month: "Apr-24", earnings: 25000 },
      { month: "May-24", earnings: 27000 },
      { month: "Jun-24", earnings: 35000 },
      { month: "Jul-24", earnings: 29000 },
      { month: "Aug-24", earnings: 32000 },
      { month: "Sep-24", earnings: 38000 },
      { month: "Oct-24", earnings: 41000 },
      { month: "Nov-24", earnings: 36000 },
      { month: "Dec-24", earnings: 45000 },
      { month: "Jan-25", earnings: 38500 }
    ]
  },

  // Common data
  agents: [
    { id: "AG001", name: "Juan Dela Cruz", code: "JDC001", branch: "Manila Main" },
    { id: "AG002", name: "Maria Santos", code: "MS002", branch: "Quezon City" },
    { id: "AG003", name: "Pedro Reyes", code: "PR003", branch: "Makati" },
    { id: "AG004", name: "Ana Garcia", code: "AG004", branch: "Pasig" },
    { id: "AG005", name: "Jose Martinez", code: "JM005", branch: "Manila Main" }
  ],

  branches: [
    { id: "BR001", name: "Manila Main", region: "NCR" },
    { id: "BR002", name: "Quezon City", region: "NCR" },
    { id: "BR003", name: "Makati", region: "NCR" },
    { id: "BR004", name: "Cebu", region: "Visayas" },
    { id: "BR005", name: "Davao", region: "Mindanao" }
  ]
};

// Mock CRUD operations
export const incentiveCrudOperations = {
  createProgram: (program) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            ...program,
            id: Math.floor(Math.random() * 10000),
            programCode: `INC-2025-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
            createdDate: new Date().toISOString()
          }
        });
      }, 500);
    });
  },

  updateProgram: (id, updates) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: { id, ...updates, updatedDate: new Date().toISOString() }
        });
      }, 500);
    });
  },

  deleteProgram: (id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, message: "Program deleted successfully" });
      }, 500);
    });
  },

  runCalculation: (period, programs) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const batchId = `CALC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
        resolve({
          success: true,
          data: {
            batchId,
            period,
            totalAmount: Math.floor(Math.random() * 500000) + 100000,
            agentCount: Math.floor(Math.random() * 20) + 5,
            status: "Calculated"
          }
        });
      }, 2000);
    });
  },

  approveCalculation: (batchId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            batchId,
            status: "Approved",
            approvedBy: "Current User",
            approvalDate: new Date().toISOString()
          }
        });
      }, 500);
    });
  },

  generateReport: (reportType, parameters) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            reportId: `RPT-${Date.now()}`,
            reportType,
            generatedDate: new Date().toISOString(),
            fileUrl: "/mock-report.pdf"
          }
        });
      }, 1500);
    });
  }
};

export default { incentiveMockData, incentiveCrudOperations };