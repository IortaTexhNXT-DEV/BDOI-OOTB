// Mock Data Service for Renewal Module
// Thailand Insurance Broker Renewal Management System

export const renewalMockData = {
  // Thailand Market Requirements
  marketRequirements: {
    regulatoryCompliance: {
      insuranceCommission: "Thailand Insurance Commission (IC)",
      requiredNotices: {
        firstNotice: 60, // days before expiry
        secondNotice: 30,
        finalNotice: 15,
        graceperiod: 30
      },
      documentRequirements: [
        "Policy Schedule",
        "Premium Computation",
        "Terms and Conditions",
        "Claims History Declaration"
      ]
    },
    paymentMethods: [
      "BDO", "BPI", "Metrobank", "UnionBank", // Major banks
      "GCash", "PayMaya", "GrabPay", // E-wallets
      "Credit Card", "Debit Card",
      "Check", "Cash",
      "Auto-Debit Arrangement (ADA)",
      "Salary Deduction"
    ],
    commonProducts: [
      { code: "MOTOR", name: "Motor/Auto Insurance", avgPremium: 15000 },
      { code: "FIRE", name: "Fire Insurance", avgPremium: 25000 },
      { code: "MAR", name: "Marine Cargo", avgPremium: 30000 },
      { code: "PA", name: "Personal Accident", avgPremium: 5000 },
      { code: "HEALTH", name: "Health Insurance", avgPremium: 20000 },
      { code: "CTPL", name: "Compulsory Third Party Liability", avgPremium: 1500 }
    ],
    taxesAndCharges: {
      vat: 12, // 12% VAT
      dst: 12.5, // Documentary Stamp Tax varies
      lgt: 0.75, // Local Government Tax
      fst: 2 // Fire Service Tax (for Fire insurance)
    }
  },

  // Policies Due for Renewal
  renewalQueue: [
    {
      id: 1,
      policyNumber: "POL-2024-001234",
      insuredName: "Maria Santos",
      insuredContact: {
        mobile: "+639171234567",
        email: "maria.santos@email.com",
        preferredContact: "SMS"
      },
      product: "Motor/Auto Insurance",
      insurer: "Pioneer Insurance",
      vehicleDetails: {
        make: "Toyota",
        model: "Vios",
        year: 2020,
        plateNumber: "ABC 123"
      },
      expiryDate: "2025-03-15",
      daysToExpiry: 47,
      currentPremium: 18500,
      sumInsured: 850000,
      claimsHistory: {
        hasClaimsLastYear: false,
        totalClaims: 0,
        claimsAmount: 0
      },
      paymentHistory: "Good",
      retentionRisk: "Low",
      loyaltyYears: 3,
      status: "Pending",
      assignedAgent: "Juan Dela Cruz",
      lastContactDate: null,
      renewalAttempts: 0
    },
    {
      id: 2,
      policyNumber: "POL-2024-001235",
      insuredName: "ABC Corporation",
      insuredContact: {
        mobile: "+639189876543",
        email: "finance@abccorp.ph",
        preferredContact: "Email"
      },
      product: "Fire Insurance",
      insurer: "Malayan Insurance",
      propertyDetails: {
        type: "Commercial Building",
        location: "Makati City",
        area: "2,500 sqm"
      },
      expiryDate: "2025-02-28",
      daysToExpiry: 32,
      currentPremium: 125000,
      sumInsured: 50000000,
      claimsHistory: {
        hasClaimsLastYear: true,
        totalClaims: 1,
        claimsAmount: 250000
      },
      paymentHistory: "Good",
      retentionRisk: "Medium",
      loyaltyYears: 5,
      status: "Quote Sent",
      assignedAgent: "Ana Reyes",
      lastContactDate: "2025-01-20",
      renewalAttempts: 1,
      quotedPremium: 145000,
      premiumIncrease: 16,
      negotiationNotes: "Client requesting to maintain current premium"
    },
    {
      id: 3,
      policyNumber: "POL-2024-001236",
      insuredName: "Pedro Garcia",
      insuredContact: {
        mobile: "+639201234567",
        email: "pedro.g@gmail.com",
        preferredContact: "Phone"
      },
      product: "Personal Accident",
      insurer: "AXA Thailand",
      coverageDetails: {
        accidentalDeath: 1000000,
        medicalReimbursement: 100000,
        dailyHospitalization: 2000
      },
      expiryDate: "2025-02-15",
      daysToExpiry: 19,
      currentPremium: 6500,
      sumInsured: 1000000,
      claimsHistory: {
        hasClaimsLastYear: false,
        totalClaims: 0,
        claimsAmount: 0
      },
      paymentHistory: "Excellent",
      retentionRisk: "High",
      loyaltyYears: 1,
      status: "At Risk",
      assignedAgent: "Carlos Mendoza",
      lastContactDate: "2025-01-25",
      renewalAttempts: 2,
      atRiskReason: "Received competitor quote - 20% cheaper"
    },
    {
      id: 4,
      policyNumber: "POL-2024-001237",
      insuredName: "Logistics Express Inc.",
      insuredContact: {
        mobile: "+639223456789",
        email: "insurance@logexpress.ph",
        preferredContact: "Email"
      },
      product: "Marine Cargo",
      insurer: "Standard Insurance",
      cargoDetails: {
        type: "General Merchandise",
        annualVolume: "THB 200M",
        routes: ["Domestic", "International"]
      },
      expiryDate: "2025-04-01",
      daysToExpiry: 64,
      currentPremium: 450000,
      sumInsured: 200000000,
      claimsHistory: {
        hasClaimsLastYear: true,
        totalClaims: 3,
        claimsAmount: 1500000
      },
      paymentHistory: "Fair",
      retentionRisk: "Medium",
      loyaltyYears: 7,
      status: "Under Negotiation",
      assignedAgent: "Ana Reyes",
      lastContactDate: "2025-01-26",
      renewalAttempts: 1,
      quotedPremium: 520000,
      negotiationStatus: "Pending Management Approval"
    },
    {
      id: 5,
      policyNumber: "POL-2024-001238",
      insuredName: "Rosa Martinez",
      insuredContact: {
        mobile: "+639234567890",
        email: "rosa.m@yahoo.com",
        preferredContact: "SMS"
      },
      product: "Health Insurance",
      insurer: "Philam Life",
      healthDetails: {
        plan: "Premium Care",
        coverageLimit: 2000000,
        dependents: 3
      },
      expiryDate: "2025-02-10",
      daysToExpiry: 14,
      currentPremium: 35000,
      sumInsured: 2000000,
      claimsHistory: {
        hasClaimsLastYear: true,
        totalClaims: 5,
        claimsAmount: 125000,
        claimsRatio: 35.7
      },
      paymentHistory: "Good",
      retentionRisk: "Critical",
      loyaltyYears: 2,
      status: "In Grace Period",
      assignedAgent: "Juan Dela Cruz",
      lastContactDate: "2025-01-27",
      renewalAttempts: 3,
      gracePeriodEnd: "2025-03-12"
    }
  ],

  // Renewal Quotes
  renewalQuotes: [
    {
      quoteId: "RQ-2025-0001",
      policyNumber: "POL-2024-001235",
      quoteNumber: "QTE-REN-2025-0145",
      generatedDate: "2025-01-20",
      validUntil: "2025-02-20",
      insuredName: "ABC Corporation",
      product: "Fire Insurance",

      // Premium Calculation
      premiumCalculation: {
        basePremium: 125000,
        claimsLoading: 20000, // Due to previous claim
        loyaltyDiscount: -10000, // 5 years loyalty
        riskAdjustment: 10000,
        subtotal: 145000,
        taxes: {
          vat: 17400, // 12%
          dst: 1812.50, // Documentary Stamp Tax
          lgt: 1087.50, // Local Government Tax
          fst: 2900 // Fire Service Tax (2%)
        },
        totalPremium: 168200
      },

      // Coverage Comparison
      coverageComparison: {
        current: {
          buildingCover: 30000000,
          contentsCover: 15000000,
          businessInterruption: 5000000,
          deductible: 50000
        },
        proposed: {
          buildingCover: 35000000,
          contentsCover: 15000000,
          businessInterruption: 5000000,
          deductible: 50000
        },
        changes: ["Building cover increased by THB 5M due to property appreciation"]
      },

      // Retention Offers
      retentionOffers: [
        {
          type: "Multi-Year Discount",
          description: "5% discount for 2-year policy commitment",
          discountAmount: 7250,
          conditions: "Non-cancellable for 2 years"
        },
        {
          type: "Bundle Discount",
          description: "Add Motor Fleet Insurance for additional 8% discount",
          discountAmount: 11600,
          conditions: "Minimum 5 vehicles"
        },
        {
          type: "Early Renewal",
          description: "3% discount if renewed before January 31",
          discountAmount: 4350,
          conditions: "Payment within 7 days"
        }
      ],

      paymentOptions: [
        { method: "Annual", charge: 0, total: 168200 },
        { method: "Semi-Annual", charge: 2523, total: 170723 },
        { method: "Quarterly", charge: 5046, total: 173246 },
        { method: "Monthly", charge: 8410, total: 176610 }
      ],

      status: "Sent",
      sentDate: "2025-01-20",
      clientResponse: "Reviewing internally",
      followUpDate: "2025-01-30"
    }
  ],

  // Negotiation History
  negotiations: [
    {
      negotiationId: "NEG-2025-0023",
      policyNumber: "POL-2024-001237",
      clientName: "Logistics Express Inc.",
      currentStage: "Pending Approval",

      timeline: [
        {
          date: "2025-01-15",
          type: "Initial Contact",
          method: "Email",
          description: "Sent renewal notice with standard quote",
          outcome: "Client requested meeting"
        },
        {
          date: "2025-01-18",
          type: "Meeting",
          method: "Face-to-face",
          description: "Discussed renewal terms and claims history",
          outcome: "Client concerned about 15% premium increase"
        },
        {
          date: "2025-01-20",
          type: "Counter Offer",
          method: "Email",
          clientRequest: "Maximum 8% increase",
          ourResponse: "Offered 12% with enhanced coverage"
        },
        {
          date: "2025-01-22",
          type: "Competitor Quote",
          method: "Email",
          competitor: "MAPFRE",
          competitorPremium: 480000,
          competitorTerms: "Similar coverage, 10% lower"
        },
        {
          date: "2025-01-25",
          type: "Revised Offer",
          method: "Phone",
          description: "Matched competitor price with loyalty benefits",
          specialTerms: "Extended payment terms, Free risk assessment"
        },
        {
          date: "2025-01-26",
          type: "Approval Request",
          requestedBy: "Ana Reyes",
          specialDiscount: 13.5,
          justification: "7-year client, total portfolio THB 2M",
          status: "Pending"
        }
      ],

      competitorAnalysis: {
        ourAdvantages: [
          "24/7 claims hotline",
          "Dedicated account manager",
          "Faster claims settlement (3 days avg)",
          "Network of approved repairers"
        ],
        competitorAdvantages: [
          "Lower premium",
          "Online policy management",
          "Cashback rewards"
        ]
      },

      finalOffer: {
        premium: 485000,
        discount: "13.5%",
        specialTerms: [
          "60-day payment terms",
          "Free annual risk assessment",
          "Dedicated claims handler",
          "Quarterly payment option at no extra charge"
        ]
      }
    }
  ],

  // At-Risk Policies
  atRiskPolicies: [
    {
      policyNumber: "POL-2024-001236",
      riskScore: 78,
      riskCategory: "High",

      riskFactors: [
        { factor: "Competitor Quote", score: 25, details: "20% cheaper quote received" },
        { factor: "First Renewal", score: 20, details: "Statistically higher lapse rate" },
        { factor: "Price Sensitivity", score: 15, details: "Previous price objections" },
        { factor: "Low Engagement", score: 10, details: "Minimal contact in past 6 months" },
        { factor: "Payment History", score: 8, details: "One late payment" }
      ],

      recommendedActions: [
        "Immediate manager call",
        "Offer to match competitor price",
        "Highlight unique benefits",
        "Consider loyalty incentive"
      ],

      actionPlan: {
        priority: "Urgent",
        assignedTo: "Senior Retention Specialist",
        deadline: "2025-01-30",
        approvedDiscount: 15,
        specialOffer: "Match competitor + free personal accident add-on"
      }
    },
    {
      policyNumber: "POL-2024-001238",
      riskScore: 92,
      riskCategory: "Critical",

      riskFactors: [
        { factor: "In Grace Period", score: 30, details: "Payment overdue" },
        { factor: "High Claims Ratio", score: 25, details: "35.7% claims ratio" },
        { factor: "Premium Increase", score: 20, details: "18% increase quoted" },
        { factor: "Multiple Attempts", score: 10, details: "3 unsuccessful contacts" },
        { factor: "Financial Difficulty", score: 7, details: "Mentioned budget constraints" }
      ],

      recommendedActions: [
        "Escalate to management",
        "Offer payment plan",
        "Review premium with underwriting",
        "Consider coverage adjustment"
      ],

      actionPlan: {
        priority: "Critical",
        assignedTo: "Branch Manager",
        deadline: "2025-01-28",
        approvedActions: [
          "Reduce premium by adjusting coverage",
          "12-month payment plan at 0% interest",
          "Waive late payment charges"
        ]
      }
    }
  ],

  // Lapsed Policies
  lapsedPolicies: [
    {
      policyNumber: "POL-2024-000567",
      insuredName: "Tech Solutions Ltd",
      product: "Professional Indemnity",
      lapseDate: "2025-01-15",
      daysLapsed: 12,
      premiumLost: 85000,
      lapseReason: "Premium too high",

      winBackAttempts: [
        {
          date: "2025-01-20",
          method: "Email",
          offer: "15% discount",
          response: "No response"
        },
        {
          date: "2025-01-25",
          method: "Phone",
          offer: "20% discount + flexible payment",
          response: "Will consider"
        }
      ],

      reinstatementEligible: true,
      reinstatementDeadline: "2025-04-15",
      winBackStatus: "In Progress"
    }
  ],

  // Performance Metrics
  performanceMetrics: {
    overall: {
      renewalRate: 82.5,
      premiumRetention: 87.3,
      avgCycleTime: 18,
      customerSatisfaction: 4.2
    },

    byProduct: {
      motor: { renewalRate: 85, avgPremium: 18000 },
      fire: { renewalRate: 88, avgPremium: 95000 },
      marine: { renewalRate: 75, avgPremium: 380000 },
      health: { renewalRate: 79, avgPremium: 28000 },
      personalAccident: { renewalRate: 72, avgPremium: 5500 }
    },

    byAgent: [
      {
        agentName: "Juan Dela Cruz",
        renewalRate: 84.5,
        policiesRenewed: 42,
        premiumRetained: 2340000,
        avgCycleTime: 16,
        ranking: 2
      },
      {
        agentName: "Ana Reyes",
        renewalRate: 88.2,
        policiesRenewed: 38,
        premiumRetained: 4250000,
        avgCycleTime: 14,
        ranking: 1
      },
      {
        agentName: "Carlos Mendoza",
        renewalRate: 78.3,
        policiesRenewed: 35,
        premiumRetained: 1890000,
        avgCycleTime: 21,
        ranking: 4
      }
    ],

    trends: {
      monthly: [
        { month: "Jan-24", rate: 79.5 },
        { month: "Feb-24", rate: 81.2 },
        { month: "Mar-24", rate: 80.8 },
        { month: "Apr-24", rate: 82.1 },
        { month: "May-24", rate: 83.5 },
        { month: "Jun-24", rate: 82.9 },
        { month: "Jul-24", rate: 84.2 },
        { month: "Aug-24", rate: 83.7 },
        { month: "Sep-24", rate: 85.1 },
        { month: "Oct-24", rate: 84.6 },
        { month: "Nov-24", rate: 83.9 },
        { month: "Dec-24", rate: 82.8 },
        { month: "Jan-25", rate: 82.5 }
      ]
    }
  },

  // Win-back Campaigns
  winBackCampaigns: [
    {
      campaignId: "WB-2025-001",
      campaignName: "New Year Win-back Special",
      startDate: "2025-01-15",
      endDate: "2025-02-28",
      targetSegment: "Lapsed in Q4 2024",

      offer: {
        discount: 25,
        additionalBenefits: [
          "Waived reinstatement fee",
          "Free add-on coverage for 3 months",
          "Flexible payment terms"
        ]
      },

      statistics: {
        targetedPolicies: 145,
        contacted: 98,
        responded: 23,
        converted: 8,
        conversionRate: 8.2,
        revenueRecovered: 285000
      }
    }
  ],

  // Approval Queue
  pendingApprovals: [
    {
      approvalId: "APR-2025-0089",
      type: "Special Discount",
      policyNumber: "POL-2024-001237",
      clientName: "Logistics Express Inc.",
      requestedBy: "Ana Reyes",
      requestDate: "2025-01-26",

      details: {
        standardPremium: 520000,
        requestedPremium: 485000,
        discountPercent: 6.7,
        specialTerms: ["60-day payment", "Free risk assessment"],
        justification: "Long-term client, competitive pressure"
      },

      approvalLevel: "Branch Manager",
      priority: "High",
      dueDate: "2025-01-28"
    }
  ]
};

// Mock CRUD Operations
export const renewalCrudOperations = {
  // Generate new renewal quote
  generateQuote: (policyId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const policy = renewalMockData.renewalQueue.find(p => p.id === policyId);
        if (policy) {
          const baseQuote = {
            quoteId: `RQ-2025-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
            quoteNumber: `QTE-REN-2025-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
            policyNumber: policy.policyNumber,
            insuredName: policy.insuredName,
            generatedDate: new Date().toISOString().split('T')[0],
            validUntil: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
            basePremium: policy.currentPremium,
            quotedPremium: Math.round(policy.currentPremium * (1 + (Math.random() * 0.1 - 0.05))),
            status: "Generated"
          };
          resolve({ success: true, data: baseQuote });
        } else {
          resolve({ success: false, error: "Policy not found" });
        }
      }, 1500);
    });
  },

  // Update negotiation status
  updateNegotiation: (negotiationId, update) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            negotiationId,
            ...update,
            updatedAt: new Date().toISOString()
          }
        });
      }, 500);
    });
  },

  // Approve special terms
  approveSpecialTerms: (approvalId, decision) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            approvalId,
            decision,
            approvedBy: "Current User",
            approvalDate: new Date().toISOString()
          }
        });
      }, 500);
    });
  },

  // Send renewal reminder
  sendReminder: (policyId, method) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: `Reminder sent via ${method}`,
          timestamp: new Date().toISOString()
        });
      }, 1000);
    });
  },

  // Process win-back offer
  processWinBack: (policyNumber, offer) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            policyNumber,
            offer,
            campaignId: `WB-2025-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
            status: "Offer Sent"
          }
        });
      }, 800);
    });
  },

  // Calculate retention metrics
  calculateMetrics: (period) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const metrics = {
          period,
          renewalRate: 80 + Math.random() * 10,
          premiumRetention: 85 + Math.random() * 10,
          atRiskCount: Math.floor(Math.random() * 50) + 20,
          calculatedAt: new Date().toISOString()
        };
        resolve({ success: true, data: metrics });
      }, 2000);
    });
  },

  // Process reinstatement
  processReinstatement: (policyNumber, terms) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: {
            policyNumber,
            reinstatementId: `REIN-2025-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
            effectiveDate: new Date().toISOString().split('T')[0],
            terms,
            status: "Reinstated"
          }
        });
      }, 1200);
    });
  }
};

export default { renewalMockData, renewalCrudOperations };