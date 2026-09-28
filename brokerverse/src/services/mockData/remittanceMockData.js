// Comprehensive Mock Data Service for Remittance Module
// This service provides consistent mock data across all remittance features

// Common data used across multiple features
export const commonData = {
  insurers: [
    { id: 1, code: "INS001", name: "Allianz Insurance", status: "Active" },
    { id: 2, code: "INS002", name: "AXA Insurance", status: "Active" },
    { id: 3, code: "INS003", name: "MetLife", status: "Active" },
    { id: 4, code: "INS004", name: "Prudential", status: "Active" },
    { id: 5, code: "INS005", name: "AIG", status: "Active" },
  ],

  agencies: [
    { id: 1, code: "AG001", name: "Premier Agency", region: "North", status: "Active" },
    { id: 2, code: "AG002", name: "Elite Insurance Agency", region: "South", status: "Active" },
    { id: 3, code: "AG003", name: "Trust Agency", region: "East", status: "Active" },
    { id: 4, code: "AG004", name: "Global Agency", region: "West", status: "Active" },
  ],

  glAccounts: [
    { code: "1001", name: "Premium Collection", type: "Asset" },
    { code: "2001", name: "Commission Payable", type: "Liability" },
    { code: "3001", name: "Revenue - Commission", type: "Revenue" },
    { code: "4001", name: "Operating Expenses", type: "Expense" },
    { code: "1002", name: "Bank Account", type: "Asset" },
    { code: "2002", name: "Tax Payable", type: "Liability" },
  ],

  currencies: ["USD", "EUR", "GBP", "CAD", "AUD", "SGD"],

  paymentMethods: ["Bank Transfer", "Check", "Wire Transfer", "ACH", "Credit Card"],
};

// K1: Automated Remittance
export const automatedRemittanceData = {
  configurations: [
    {
      id: 1,
      code: "ARM-001",
      name: "Monthly Auto Remittance",
      frequency: "Monthly",
      dayOfExecution: 15,
      insurers: ["INS001", "INS002", "INS003"],
      includeTypes: ["New Business", "Renewal", "Endorsement"],
      excludeStatuses: ["Cancelled", "On Hold"],
      glMapping: { debit: "1001", credit: "2001" },
      notifications: ["email", "system"],
      status: "Active",
      lastRun: "2025-09-15",
      nextRun: "2025-10-15",
    },
    {
      id: 2,
      code: "ARM-002",
      name: "Quarterly Auto Remittance",
      frequency: "Quarterly",
      dayOfExecution: 1,
      insurers: ["INS004", "INS005"],
      includeTypes: ["New Business", "Renewal"],
      excludeStatuses: ["Cancelled"],
      glMapping: { debit: "1001", credit: "2001" },
      notifications: ["email"],
      status: "Active",
      lastRun: "2025-07-01",
      nextRun: "2025-10-01",
    },
  ],
  executionHistory: [
    {
      id: 1,
      configCode: "ARM-001",
      executionDate: "2025-09-15",
      status: "Success",
      recordsProcessed: 245,
      totalAmount: 125000.00,
      duration: "2m 15s",
    },
    {
      id: 2,
      configCode: "ARM-001",
      executionDate: "2025-08-15",
      status: "Success",
      recordsProcessed: 198,
      totalAmount: 98500.00,
      duration: "1m 45s",
    },
  ],
};

// K2: Statement Templates
export const statementTemplateData = {
  templates: [
    {
      id: 1,
      code: "STM-001",
      name: "Standard Monthly Statement",
      type: "Account Statement",
      format: "PDF",
      columns: [
        "Transaction Date", "Policy Number", "Insured Name",
        "Premium", "Commission", "Net Amount", "Status"
      ],
      groupBy: "Insurer",
      sortBy: "Transaction Date",
      includeSubtotals: true,
      includeSummary: true,
      logo: true,
      footer: "Standard disclaimer text",
      status: "Active",
    },
    {
      id: 2,
      code: "STM-002",
      name: "Detailed Transaction Report",
      type: "Transaction Report",
      format: "Excel",
      columns: [
        "Transaction ID", "Date", "Time", "Policy Number", "Type",
        "Gross Premium", "Commission Rate", "Commission Amount",
        "Taxes", "Net Payable", "Payment Status"
      ],
      groupBy: "Agency",
      sortBy: "Transaction ID",
      includeSubtotals: true,
      includeSummary: true,
      status: "Active",
    },
  ],
  sampleData: [
    {
      transactionDate: "2025-09-20",
      policyNumber: "POL-2025-0001",
      insuredName: "John Smith",
      premium: 5000.00,
      commission: 500.00,
      netAmount: 4500.00,
      status: "Processed",
    },
    {
      transactionDate: "2025-09-19",
      policyNumber: "POL-2025-0002",
      insuredName: "Jane Doe",
      premium: 3500.00,
      commission: 350.00,
      netAmount: 3150.00,
      status: "Processed",
    },
  ],
};

// K3: Settlement Parameters
export const settlementParameterData = {
  parameters: [
    {
      id: 1,
      code: "STP-001",
      name: "Standard Settlement Rules",
      settlementFrequency: "Weekly",
      minimumAmount: 1000.00,
      maximumAmount: 500000.00,
      approvalLevels: [
        { level: 1, minAmount: 1000, maxAmount: 10000, approver: "Manager" },
        { level: 2, minAmount: 10001, maxAmount: 50000, approver: "Director" },
        { level: 3, minAmount: 50001, maxAmount: 500000, approver: "CFO" },
      ],
      autoApproveBelow: 1000.00,
      holdPeriodDays: 3,
      paymentMethods: ["Bank Transfer", "Wire Transfer"],
      glAccounts: { debit: "2001", credit: "1002" },
      status: "Active",
    },
    {
      id: 2,
      code: "STP-002",
      name: "Express Settlement",
      settlementFrequency: "Daily",
      minimumAmount: 500.00,
      maximumAmount: 100000.00,
      approvalLevels: [
        { level: 1, minAmount: 500, maxAmount: 100000, approver: "Senior Manager" },
      ],
      autoApproveBelow: 5000.00,
      holdPeriodDays: 1,
      paymentMethods: ["ACH", "Wire Transfer"],
      glAccounts: { debit: "2001", credit: "1002" },
      status: "Active",
    },
  ],
  pendingSettlements: [
    {
      id: 1,
      referenceNumber: "SET-2025-0145",
      agency: "Premier Agency",
      amount: 25000.00,
      dueDate: "2025-09-28",
      status: "Pending Approval",
      approvalLevel: 2,
    },
    {
      id: 2,
      referenceNumber: "SET-2025-0146",
      agency: "Elite Insurance Agency",
      amount: 8500.00,
      dueDate: "2025-09-29",
      status: "Approved",
      approvalLevel: 1,
    },
  ],
};

// K4: Reconciliation Master
export const reconciliationData = {
  rules: [
    {
      id: 1,
      code: "REC-001",
      name: "Standard Auto-Match Rules",
      matchingCriteria: [
        { field: "Policy Number", matchType: "Exact", priority: 1 },
        { field: "Premium Amount", matchType: "Within Tolerance", tolerance: 2.5, priority: 2 },
        { field: "Transaction Date", matchType: "Within Range", rangeDays: 3, priority: 3 },
      ],
      autoMatchThreshold: 95,
      manualReviewBelow: 85,
      unmatched: "Flag for Review",
      glImpact: true,
      status: "Active",
    },
    {
      id: 2,
      code: "REC-002",
      name: "Strict Match Rules",
      matchingCriteria: [
        { field: "Policy Number", matchType: "Exact", priority: 1 },
        { field: "Premium Amount", matchType: "Exact", priority: 2 },
        { field: "Transaction Date", matchType: "Exact", priority: 3 },
        { field: "Commission Amount", matchType: "Exact", priority: 4 },
      ],
      autoMatchThreshold: 100,
      manualReviewBelow: 100,
      unmatched: "Reject",
      glImpact: true,
      status: "Active",
    },
  ],
  reconciliationSummary: {
    lastRunDate: "2025-09-26",
    totalRecords: 1250,
    matched: 1180,
    partialMatch: 45,
    unmatched: 25,
    successRate: 94.4,
  },
};

// K5: Bulk Processing
export const bulkProcessingData = {
  configurations: [
    {
      id: 1,
      code: "BFM-001",
      name: "Standard CSV Import",
      fileFormat: "CSV",
      delimiter: ",",
      hasHeader: true,
      encoding: "UTF-8",
      maxFileSize: "50MB",
      maxRecords: 50000,
      fieldMappings: [
        { sourceField: "PolicyNo", targetField: "policy_number", required: true },
        { sourceField: "Premium", targetField: "premium_amount", required: true },
        { sourceField: "Commission", targetField: "commission_amount", required: true },
        { sourceField: "InsuredName", targetField: "insured_name", required: false },
      ],
      validationRules: [
        { field: "policy_number", rule: "Not Empty" },
        { field: "premium_amount", rule: "Positive Number" },
        { field: "commission_amount", rule: "Between 0 and Premium" },
      ],
      duplicateHandling: "Skip",
      errorHandling: "Log and Continue",
      status: "Active",
    },
    {
      id: 2,
      code: "BFM-002",
      name: "Excel Import Template",
      fileFormat: "XLSX",
      sheetName: "Data",
      startRow: 2,
      maxFileSize: "25MB",
      maxRecords: 10000,
      fieldMappings: [
        { sourceColumn: "A", targetField: "transaction_id", required: true },
        { sourceColumn: "B", targetField: "policy_number", required: true },
        { sourceColumn: "C", targetField: "premium_amount", required: true },
      ],
      validationRules: [
        { field: "transaction_id", rule: "Unique" },
        { field: "premium_amount", rule: "Positive Number" },
      ],
      duplicateHandling: "Update",
      errorHandling: "Stop on Error",
      status: "Active",
    },
  ],
  processingHistory: [
    {
      id: 1,
      fileName: "remittance_sep_2025.csv",
      uploadDate: "2025-09-25 10:30:00",
      processedBy: "John Admin",
      totalRecords: 2500,
      successCount: 2485,
      errorCount: 15,
      status: "Completed with Errors",
      downloadErrorLog: true,
    },
    {
      id: 2,
      fileName: "quarterly_data.xlsx",
      uploadDate: "2025-09-20 14:15:00",
      processedBy: "Sarah Manager",
      totalRecords: 850,
      successCount: 850,
      errorCount: 0,
      status: "Success",
    },
  ],
};

// K6: Schedule Master
export const scheduleMasterData = {
  schedules: [
    {
      id: 1,
      code: "SCH-001",
      name: "Daily Remittance Processing",
      type: "Remittance Processing",
      frequency: "Daily",
      time: "02:00",
      timezone: "EST",
      activeDays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      linkedProcesses: ["ARM-001", "REC-001"],
      notifications: {
        onStart: ["system"],
        onSuccess: ["email", "system"],
        onFailure: ["email", "sms", "system"],
      },
      retryOnFailure: true,
      maxRetries: 3,
      retryInterval: 30,
      status: "Active",
      lastRun: "2025-09-26 02:00:00",
      nextRun: "2025-09-27 02:00:00",
    },
    {
      id: 2,
      code: "SCH-002",
      name: "Weekly Settlement Run",
      type: "Settlement",
      frequency: "Weekly",
      dayOfWeek: "Friday",
      time: "18:00",
      timezone: "EST",
      linkedProcesses: ["STP-001"],
      notifications: {
        onStart: ["system"],
        onSuccess: ["email"],
        onFailure: ["email", "sms"],
      },
      retryOnFailure: false,
      status: "Active",
      lastRun: "2025-09-20 18:00:00",
      nextRun: "2025-09-27 18:00:00",
    },
  ],
  executionLogs: [
    {
      scheduleCode: "SCH-001",
      executionTime: "2025-09-26 02:00:00",
      duration: "5m 23s",
      status: "Success",
      recordsProcessed: 450,
    },
    {
      scheduleCode: "SCH-001",
      executionTime: "2025-09-25 02:00:00",
      duration: "4m 15s",
      status: "Success",
      recordsProcessed: 380,
    },
  ],
};

// K7: Electronic Transfer Master
export const electronicTransferData = {
  configurations: [
    {
      id: 1,
      code: "ETM-001",
      name: "Domestic Wire Transfer",
      transferType: "Wire Transfer",
      scope: "Domestic",
      bankDetails: {
        bankName: "Chase Bank",
        accountNumber: "****5678",
        routingNumber: "021000021",
        accountType: "Business Checking",
      },
      limits: {
        minAmount: 100.00,
        maxAmount: 100000.00,
        dailyLimit: 500000.00,
        monthlyLimit: 5000000.00,
      },
      approvalRequired: true,
      cutoffTime: "15:00",
      processingDays: 1,
      charges: {
        fixed: 25.00,
        percentage: 0,
      },
      status: "Active",
    },
    {
      id: 2,
      code: "ETM-002",
      name: "ACH Batch Transfer",
      transferType: "ACH",
      scope: "Domestic",
      bankDetails: {
        bankName: "Bank of America",
        accountNumber: "****9012",
        routingNumber: "026009593",
        accountType: "Business Savings",
      },
      limits: {
        minAmount: 10.00,
        maxAmount: 50000.00,
        dailyLimit: 250000.00,
        monthlyLimit: 2000000.00,
      },
      approvalRequired: false,
      batchProcessing: true,
      cutoffTime: "17:00",
      processingDays: 2,
      charges: {
        fixed: 2.50,
        percentage: 0,
      },
      status: "Active",
    },
  ],
  transferQueue: [
    {
      id: 1,
      referenceNo: "TRF-2025-0890",
      beneficiary: "Premier Agency",
      amount: 15000.00,
      method: "Wire Transfer",
      scheduledDate: "2025-09-27",
      status: "Pending",
    },
    {
      id: 2,
      referenceNo: "TRF-2025-0891",
      beneficiary: "Elite Insurance Agency",
      amount: 8500.00,
      method: "ACH",
      scheduledDate: "2025-09-28",
      status: "Scheduled",
    },
  ],
};

// K8: Approval Workflow Master
export const approvalWorkflowData = {
  workflows: [
    {
      id: 1,
      code: "AWF-001",
      name: "Standard Approval Matrix",
      type: "Sequential",
      levels: [
        {
          level: 1,
          role: "Supervisor",
          minAmount: 1000,
          maxAmount: 10000,
          sla: "4 hours",
          escalateTo: "Manager",
        },
        {
          level: 2,
          role: "Manager",
          minAmount: 10001,
          maxAmount: 50000,
          sla: "8 hours",
          escalateTo: "Director",
        },
        {
          level: 3,
          role: "Director",
          minAmount: 50001,
          maxAmount: 200000,
          sla: "24 hours",
          escalateTo: "CFO",
        },
        {
          level: 4,
          role: "CFO",
          minAmount: 200001,
          maxAmount: null,
          sla: "48 hours",
          escalateTo: null,
        },
      ],
      delegationAllowed: true,
      parallelApproval: false,
      autoApproveOnTimeout: false,
      notifications: true,
      status: "Active",
    },
    {
      id: 2,
      code: "AWF-002",
      name: "Express Approval",
      type: "Parallel",
      levels: [
        {
          level: 1,
          role: "Any Two Managers",
          minAmount: 1000,
          maxAmount: 100000,
          sla: "2 hours",
          requiredApprovals: 2,
        },
      ],
      delegationAllowed: true,
      parallelApproval: true,
      autoApproveOnTimeout: false,
      notifications: true,
      status: "Active",
    },
  ],
  pendingApprovals: [
    {
      id: 1,
      requestNo: "APR-2025-0234",
      type: "Settlement",
      amount: 45000.00,
      requestedBy: "John User",
      requestDate: "2025-09-26 10:00:00",
      currentLevel: 2,
      assignedTo: "Manager Group",
      slaRemaining: "4 hours",
      status: "Pending",
    },
    {
      id: 2,
      requestNo: "APR-2025-0235",
      type: "Adjustment",
      amount: 5000.00,
      requestedBy: "Sarah Admin",
      requestDate: "2025-09-26 14:00:00",
      currentLevel: 1,
      assignedTo: "Supervisor Group",
      slaRemaining: "2 hours",
      status: "Pending",
    },
  ],
};

// K9: Exception Master
export const exceptionMasterData = {
  exceptionTypes: [
    {
      id: 1,
      code: "EXC-001",
      name: "Duplicate Policy Exception",
      category: "Data Quality",
      severity: "Medium",
      autoResolve: false,
      resolutionSteps: [
        "Verify policy details",
        "Check with source system",
        "Merge or reject duplicate",
        "Update audit log",
      ],
      notification: ["email"],
      sla: "24 hours",
      glImpact: false,
      status: "Active",
    },
    {
      id: 2,
      code: "EXC-002",
      name: "Missing Commission Rate",
      category: "Configuration",
      severity: "High",
      autoResolve: true,
      autoResolveRule: "Use default rate from insurer master",
      resolutionSteps: [
        "Check insurer configuration",
        "Apply default rate",
        "Flag for review",
      ],
      notification: ["system"],
      sla: "4 hours",
      glImpact: true,
      status: "Active",
    },
    {
      id: 3,
      code: "EXC-003",
      name: "Payment Amount Mismatch",
      category: "Financial",
      severity: "Critical",
      autoResolve: false,
      resolutionSteps: [
        "Compare payment with invoice",
        "Identify variance reason",
        "Create adjustment if needed",
        "Obtain approval",
        "Process correction",
      ],
      notification: ["email", "sms"],
      sla: "2 hours",
      glImpact: true,
      status: "Active",
    },
  ],
  activeExceptions: [
    {
      id: 1,
      exceptionCode: "EXC-001",
      referenceNo: "POL-2025-0445",
      description: "Duplicate policy found in system",
      detectedOn: "2025-09-26 11:30:00",
      severity: "Medium",
      assignedTo: "Data Team",
      status: "Under Review",
      slaRemaining: "18 hours",
    },
    {
      id: 2,
      exceptionCode: "EXC-003",
      referenceNo: "PAY-2025-0890",
      description: "Payment amount differs by \u20B1500",
      detectedOn: "2025-09-26 15:00:00",
      severity: "Critical",
      assignedTo: "Finance Team",
      status: "Pending",
      slaRemaining: "1 hour",
    },
  ],
};

// K10: Report Template Master
export const reportTemplateData = {
  templates: [
    {
      id: 1,
      code: "RPT-001",
      name: "Daily Remittance Summary",
      category: "Operational",
      frequency: "Daily",
      format: "PDF",
      sections: [
        {
          name: "Executive Summary",
          charts: ["pie", "bar"],
          metrics: ["Total Premium", "Total Commission", "Transaction Count"],
        },
        {
          name: "Insurer Breakdown",
          type: "table",
          groupBy: "Insurer",
          columns: ["Insurer", "Policies", "Premium", "Commission", "Status"],
        },
        {
          name: "Trends",
          charts: ["line"],
          period: "Last 30 days",
        },
      ],
      distribution: {
        email: ["management@company.com", "finance@company.com"],
        schedule: "Daily at 6:00 AM",
      },
      filters: {
        dateRange: "Previous Day",
        excludeZeroTransactions: true,
      },
      status: "Active",
    },
    {
      id: 2,
      code: "RPT-002",
      name: "Monthly Commission Analysis",
      category: "Financial",
      frequency: "Monthly",
      format: "Excel",
      sections: [
        {
          name: "Commission Summary",
          type: "pivot",
          rows: ["Agency", "Product"],
          columns: ["Month"],
          values: ["Commission Amount"],
        },
        {
          name: "Top Performers",
          type: "table",
          sortBy: "Commission DESC",
          limit: 20,
        },
        {
          name: "YoY Comparison",
          charts: ["column"],
          compareWith: "Previous Year",
        },
      ],
      distribution: {
        email: ["cfo@company.com", "sales-head@company.com"],
        schedule: "First Monday of Month",
      },
      status: "Active",
    },
  ],
  generatedReports: [
    {
      id: 1,
      templateCode: "RPT-001",
      generatedOn: "2025-09-26 06:00:00",
      period: "2025-09-25",
      fileSize: "2.3 MB",
      status: "Delivered",
      downloads: 5,
    },
    {
      id: 2,
      templateCode: "RPT-002",
      generatedOn: "2025-09-01 08:00:00",
      period: "August 2025",
      fileSize: "5.8 MB",
      status: "Delivered",
      downloads: 12,
    },
  ],
};

// K11: Agency Bill Master
export const agencyBillData = {
  configurations: [
    {
      id: 1,
      code: "ABL-001",
      name: "Standard Agency Billing",
      billingFrequency: "Monthly",
      billDate: 1,
      dueDays: 30,
      agencies: ["AG001", "AG002", "AG003"],
      includeTypes: ["New Business", "Renewal", "Endorsement"],
      chargeTypes: [
        { type: "Service Fee", amount: 25.00, frequency: "Per Bill" },
        { type: "Processing Fee", percentage: 1.5, basis: "Premium" },
      ],
      paymentTerms: "Net 30",
      lateFee: {
        type: "Percentage",
        rate: 1.5,
        gracePeriod: 5,
        compound: false,
      },
      invoiceTemplate: "STM-001",
      glMapping: {
        receivable: "1003",
        revenue: "3002",
        lateFee: "3003",
      },
      status: "Active",
    },
    {
      id: 2,
      code: "ABL-002",
      name: "Premium Agency Billing",
      billingFrequency: "Quarterly",
      billDate: 15,
      dueDays: 45,
      agencies: ["AG004"],
      includeTypes: ["New Business", "Renewal"],
      chargeTypes: [
        { type: "Account Management", amount: 100.00, frequency: "Per Quarter" },
      ],
      paymentTerms: "Net 45",
      lateFee: {
        type: "Fixed",
        amount: 50.00,
        gracePeriod: 10,
      },
      invoiceTemplate: "STM-002",
      status: "Active",
    },
  ],
  outstandingBills: [
    {
      billNo: "BILL-2025-0890",
      agency: "Premier Agency",
      billDate: "2025-09-01",
      dueDate: "2025-10-01",
      amount: 45000.00,
      paidAmount: 20000.00,
      balance: 25000.00,
      status: "Partial",
      daysOverdue: 0,
    },
    {
      billNo: "BILL-2025-0891",
      agency: "Elite Insurance Agency",
      billDate: "2025-08-15",
      dueDate: "2025-09-15",
      amount: 32000.00,
      paidAmount: 32000.00,
      balance: 0,
      status: "Paid",
      paidOn: "2025-09-14",
    },
  ],
};

// K12: Direct Bill Master
export const directBillData = {
  configurations: [
    {
      id: 1,
      code: "DBL-001",
      name: "Standard Direct Billing",
      billMethod: "Policy-wise",
      frequency: "Monthly",
      billCycle: 1,
      paymentTerms: "Due on Receipt",
      dueDays: 30,
      minimumPremium: 100.00,
      installmentOptions: [
        { type: "Annual", discount: 5 },
        { type: "Semi-Annual", discount: 2.5 },
        { type: "Quarterly", charge: 2 },
        { type: "Monthly", charge: 5 },
      ],
      paymentMethods: ["Credit Card", "Bank Transfer", "Check"],
      lateFee: {
        type: "Percentage",
        rate: 2.0,
        minimumCharge: 25.00,
        maximumCharge: 100.00,
        gracePeriod: 10,
      },
      cancellationPolicy: {
        graceperiod: 30,
        notice: 15,
        refundType: "Pro-rata",
      },
      glMapping: {
        premium: "1004",
        lateFee: "3004",
        refund: "4002",
      },
      status: "Active",
    },
  ],
  activeBills: [
    {
      billNo: "DIR-2025-1234",
      policyNo: "POL-2025-0123",
      insured: "John Smith",
      billDate: "2025-09-01",
      dueDate: "2025-10-01",
      premium: 1200.00,
      installment: "Monthly",
      installmentNo: 3,
      status: "Pending",
    },
    {
      billNo: "DIR-2025-1235",
      policyNo: "POL-2025-0124",
      insured: "Jane Doe",
      billDate: "2025-09-01",
      dueDate: "2025-10-01",
      premium: 3500.00,
      installment: "Quarterly",
      installmentNo: 2,
      status: "Paid",
      paidOn: "2025-09-28",
    },
  ],
};

// K13-K17: Additional configurations
export const adjustmentMasterData = {
  adjustmentTypes: [
    {
      id: 1,
      code: "ADJ-001",
      name: "Commission Correction",
      category: "Commission",
      requiresApproval: true,
      approvalLimit: 1000.00,
      glImpact: true,
      glAccounts: { debit: "2001", credit: "3001" },
      documentation: "Required",
      status: "Active",
    },
    {
      id: 2,
      code: "ADJ-002",
      name: "Premium Adjustment",
      category: "Premium",
      requiresApproval: true,
      approvalLimit: 5000.00,
      glImpact: true,
      glAccounts: { debit: "1001", credit: "3001" },
      documentation: "Required",
      validationRules: ["Premium cannot exceed policy limit"],
      status: "Active",
    },
  ],
};

export const notificationMasterData = {
  templates: [
    {
      id: 1,
      code: "NTF-001",
      name: "Payment Reminder",
      channel: "Email",
      trigger: "Due Date - 5 days",
      subject: "Payment Reminder - {BillNo}",
      body: "Your payment of {Amount} is due on {DueDate}",
      variables: ["BillNo", "Amount", "DueDate", "InsuredName"],
      status: "Active",
    },
    {
      id: 2,
      code: "NTF-002",
      name: "Payment Confirmation",
      channel: "SMS",
      trigger: "Payment Received",
      message: "Payment of {Amount} received for Bill {BillNo}. Thank you!",
      variables: ["Amount", "BillNo"],
      status: "Active",
    },
  ],
};

export const historyConfigurationData = {
  retention: {
    transactionHistory: 24,
    documentHistory: 36,
    auditLogs: 60,
    errorLogs: 12,
  },
  archival: {
    enabled: true,
    frequency: "Monthly",
    storageLocation: "AWS S3",
    compression: true,
    encryption: true,
  },
};

export const analyticsConfigurationData = {
  dashboards: [
    {
      id: 1,
      name: "Executive Dashboard",
      widgets: [
        { type: "KPI", metric: "Total Premium", position: 1 },
        { type: "Chart", chartType: "Line", metric: "Premium Trend", position: 2 },
        { type: "Table", data: "Top Agencies", position: 3 },
      ],
      refreshRate: 5,
      access: ["Executive", "Manager"],
    },
    {
      id: 2,
      name: "Operations Dashboard",
      widgets: [
        { type: "KPI", metric: "Pending Transactions", position: 1 },
        { type: "Chart", chartType: "Bar", metric: "Daily Processing", position: 2 },
        { type: "Alert", data: "Exceptions", position: 3 },
      ],
      refreshRate: 1,
      access: ["Operations", "Manager"],
    },
  ],
};

// Mock CRUD operations helper
export const mockCrudOperations = {
  // Generic create operation
  create: (dataType, newItem) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const id = Math.floor(Math.random() * 10000);
        resolve({ ...newItem, id, createdAt: new Date().toISOString() });
      }, 500);
    });
  },

  // Generic update operation
  update: (dataType, id, updates) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ id, ...updates, updatedAt: new Date().toISOString() });
      }, 500);
    });
  },

  // Generic delete operation
  delete: (dataType, id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, message: `${dataType} deleted successfully` });
      }, 500);
    });
  },

  // Generic get operation
  get: (dataType, id) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ id, data: `Mock data for ${dataType} with id ${id}` });
      }, 300);
    });
  },
};

// Export all mock data as a single object for easy access
const remittanceMockData = {
  commonData,
  automatedRemittanceData,
  statementTemplateData,
  settlementParameterData,
  reconciliationData,
  bulkProcessingData,
  scheduleMasterData,
  electronicTransferData,
  approvalWorkflowData,
  exceptionMasterData,
  reportTemplateData,
  agencyBillData,
  directBillData,
  adjustmentMasterData,
  notificationMasterData,
  historyConfigurationData,
  analyticsConfigurationData,
  mockCrudOperations,
};

export default remittanceMockData;