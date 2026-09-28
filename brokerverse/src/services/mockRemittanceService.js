// Mock Remittance Service - Simulates backend API calls with delays

// Utility function to simulate API delay
const simulateDelay = (ms = 1000) => new Promise(resolve => setTimeout(resolve, ms));

// Generate random data
const generateRandomAmount = (min = 1000, max = 100000) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const generateRandomDate = (daysBack = 30) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date;
};

// Mock data generators
export const mockRemittanceService = {
  // Process remittances
  processRemittances: async (selectedItems, options) => {
    await simulateDelay(2000);

    // Simulate 90% success rate
    const success = Math.random() > 0.1;

    if (success) {
      return {
        success: true,
        message: `Successfully processed ${selectedItems.length} remittances`,
        processedIds: selectedItems.map(item => item.id),
        batchId: `BATCH-${Date.now()}`,
        processedAt: new Date()
      };
    } else {
      throw new Error('Processing failed due to system error. Please try again.');
    }
  },

  // Validate remittances
  validateRemittances: async (selectedItems) => {
    await simulateDelay(1500);

    const results = selectedItems.map(item => ({
      id: item.id,
      code: item.scheduleCode,
      valid: Math.random() > 0.2,
      errors: Math.random() > 0.2 ? [] : ['Missing required documents', 'Invalid amount']
    }));

    return {
      totalValidated: selectedItems.length,
      validCount: results.filter(r => r.valid).length,
      invalidCount: results.filter(r => !r.valid).length,
      results
    };
  },

  // Search and filter remittances
  searchRemittances: async (filters) => {
    await simulateDelay(800);

    // Generate mock search results
    const count = Math.floor(Math.random() * 20) + 5;
    const results = [];

    for (let i = 0; i < count; i++) {
      results.push({
        id: Date.now() + i,
        remittanceNo: `REM-2025-${String(i + 100).padStart(3, '0')}`,
        remittanceDate: generateRandomDate(),
        insurerCode: `INS${String(Math.floor(Math.random() * 5) + 1).padStart(3, '0')}`,
        insurerName: ['ABC Insurance', 'XYZ Life', 'Global Health', 'Premier Auto', 'SafeGuard'][Math.floor(Math.random() * 5)],
        policyCount: Math.floor(Math.random() * 50) + 1,
        grossAmount: generateRandomAmount(),
        commission: generateRandomAmount(500, 10000),
        netAmount: generateRandomAmount(5000, 90000),
        status: ['Draft', 'Pending', 'Processing', 'Completed'][Math.floor(Math.random() * 4)]
      });
    }

    return results;
  },

  // Get remittance details
  getRemittanceDetails: async (remittanceId) => {
    await simulateDelay(1000);

    return {
      id: remittanceId,
      remittanceNo: `REM-2025-${remittanceId}`,
      createdDate: generateRandomDate(60),
      lastModified: generateRandomDate(5),
      createdBy: 'John Doe',
      status: 'Pending',
      insurerDetails: {
        code: 'INS001',
        name: 'ABC Insurance Co.',
        address: '123 Insurance Street, City, State 12345',
        contact: 'contact@abcinsurance.com',
        phone: '+1-234-567-8900'
      },
      policies: [
        { policyNo: 'POL-001', premium: 5000, commission: 500, status: 'Active' },
        { policyNo: 'POL-002', premium: 3500, commission: 350, status: 'Active' },
        { policyNo: 'POL-003', premium: 2800, commission: 280, status: 'Pending' }
      ],
      documents: [
        { name: 'Invoice.pdf', size: '245 KB', uploadedAt: generateRandomDate(10) },
        { name: 'PolicyList.xlsx', size: '128 KB', uploadedAt: generateRandomDate(8) }
      ],
      activityLog: [
        { action: 'Created', by: 'John Doe', at: generateRandomDate(30), notes: 'Initial creation' },
        { action: 'Updated', by: 'Jane Smith', at: generateRandomDate(20), notes: 'Added policies' },
        { action: 'Submitted', by: 'John Doe', at: generateRandomDate(10), notes: 'Submitted for review' }
      ]
    };
  },

  // Generate statement
  generateStatement: async (parameters) => {
    await simulateDelay(3000);

    const success = Math.random() > 0.05;

    if (success) {
      return {
        success: true,
        statementId: `STMT-${Date.now()}`,
        fileName: `Statement_${parameters.period.getFullYear()}_${parameters.period.getMonth() + 1}.pdf`,
        fileSize: '1.2 MB',
        generatedAt: new Date(),
        downloadUrl: '#',
        previewUrl: '#'
      };
    } else {
      throw new Error('Statement generation failed. Please check parameters and try again.');
    }
  },

  // Save draft
  saveDraft: async (data, type) => {
    await simulateDelay(500);

    const draftId = `DRAFT-${type}-${Date.now()}`;

    // Save to localStorage
    const drafts = JSON.parse(localStorage.getItem('remittanceDrafts') || '{}');
    drafts[draftId] = {
      ...data,
      savedAt: new Date().toISOString(),
      type
    };
    localStorage.setItem('remittanceDrafts', JSON.stringify(drafts));

    return {
      success: true,
      draftId,
      message: 'Draft saved successfully'
    };
  },

  // Load draft
  loadDraft: async (draftId) => {
    await simulateDelay(300);

    const drafts = JSON.parse(localStorage.getItem('remittanceDrafts') || '{}');
    const draft = drafts[draftId];

    if (draft) {
      return {
        success: true,
        data: draft
      };
    } else {
      throw new Error('Draft not found');
    }
  },

  // Submit for approval
  submitForApproval: async (settlementData) => {
    await simulateDelay(1500);

    const success = Math.random() > 0.1;

    if (success) {
      return {
        success: true,
        approvalId: `APPR-${Date.now()}`,
        status: 'Pending Approval',
        submittedAt: new Date(),
        approver: 'Manager Name',
        expectedApprovalDate: new Date(Date.now() + 86400000) // Tomorrow
      };
    } else {
      throw new Error('Submission failed. Please ensure all required fields are completed.');
    }
  },

  // Calculate settlement
  calculateSettlement: async (policies, adjustments) => {
    await simulateDelay(500);

    const totalPremium = policies.reduce((sum, p) => sum + p.premium, 0);
    const totalCommission = policies.reduce((sum, p) => sum + p.commission, 0);
    const totalTax = policies.reduce((sum, p) => sum + p.tax, 0);
    const totalAdjustments = Object.values(adjustments).reduce((sum, val) => sum + (val || 0), 0);
    const netAmount = totalPremium - totalCommission - totalTax + totalAdjustments;

    return {
      totalPremium,
      totalCommission,
      totalTax,
      totalAdjustments,
      netAmount,
      calculatedAt: new Date()
    };
  },

  // Get processing history
  getProcessingHistory: async () => {
    await simulateDelay(1000);

    const history = [];
    for (let i = 0; i < 10; i++) {
      history.push({
        batchId: `BATCH-202509${String(i + 1).padStart(2, '0')}`,
        processedAt: generateRandomDate(30),
        processedBy: ['John Doe', 'Jane Smith', 'Bob Wilson'][Math.floor(Math.random() * 3)],
        itemCount: Math.floor(Math.random() * 10) + 1,
        totalAmount: generateRandomAmount(10000, 500000),
        status: ['Completed', 'Failed', 'Partial'][Math.random() > 0.8 ? 1 : Math.random() > 0.9 ? 2 : 0],
        duration: `${Math.floor(Math.random() * 10) + 1} minutes`
      });
    }

    return history.sort((a, b) => b.processedAt - a.processedAt);
  }
};

export default mockRemittanceService;