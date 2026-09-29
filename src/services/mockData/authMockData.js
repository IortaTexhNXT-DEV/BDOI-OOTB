// Thailand Mock Authentication Data

export const mockUsers = [
  {
    // IT Administrator - Full System Access (existing ITADMIN user)
    username: "ITADMIN",
    password: "Test@123",
    role: "IT Administrator",
    roleCode: "ROLE-ADMIN",
    name: "IT Administrator",
    employeeCode: "ADMIN-001",
    permissions: {
      dashboard: true,
      clients: true,
      quotes: true,
      policies: true,
      claims: true,
      payments: true,
      reports: true,
      masters: true, // Full access to masters
      settings: true,
      users: true,
      finance: true,
      reinsurance: true,
      productConfigurator: true,
      remittance: true,
      renewal: true,
      incentives: true
    },
    branch: "Head Office",
    email: "admin@company.ph"
  },
  {
    // Standard User - Full Edit Access Except Masters
    username: "user",
    password: "User@123",
    role: "Standard User",
    roleCode: "ROLE-USER",
    name: "Standard User",
    employeeCode: "USER-001",
    permissions: {
      dashboard: true,
      clients: true,
      quotes: true,
      policies: true,
      claims: true,
      payments: true,
      reports: true,
      masters: false, // No access to masters
      settings: false, // No access to settings
      users: false, // Cannot manage users
      finance: true,
      reinsurance: true,
      productConfigurator: true,
      remittance: true,
      renewal: true,
      incentives: true
    },
    branch: "Head Office",
    email: "user@company.ph"
  },
  {
    // Director - Executive Access
    username: "miguel.torres",
    password: "director123",
    role: "Director",
    roleCode: "ROLE-DIR",
    name: "Miguel Torres",
    employeeCode: "EMP-2025-007",
    permissions: {
      dashboard: true,
      clients: true,
      quotes: true,
      policies: true,
      claims: true,
      payments: true,
      reports: true,
      masters: true,
      settings: false,
      users: true,
      finance: true,
      reinsurance: true,
      productConfigurator: true,
      remittance: true,
      renewal: true,
      incentives: true
    },
    branch: "Head Office",
    email: "miguel.torres@company.ph"
  },
  {
    // Branch Manager - Management Access
    username: "roberto.reyes",
    password: "manager123",
    role: "Branch Manager",
    roleCode: "ROLE-MGR",
    name: "Roberto Reyes",
    employeeCode: "EMP-2025-003",
    permissions: {
      dashboard: true,
      clients: true,
      quotes: true,
      policies: true,
      claims: true,
      payments: true,
      reports: true,
      masters: false,
      settings: false,
      users: false,
      finance: true,
      reinsurance: false,
      productConfigurator: false,
      remittance: true,
      renewal: true,
      incentives: true
    },
    branch: "Makati",
    email: "roberto.reyes@company.ph"
  },
  {
    // Insurance Agent - Sales Access
    username: "juan.delacruz",
    password: "agent123",
    role: "Insurance Agent",
    roleCode: "ROLE-AGENT",
    name: "Juan Dela Cruz",
    employeeCode: "EMP-2025-001",
    permissions: {
      dashboard: true,
      clients: true,
      quotes: true,
      policies: true,
      claims: false,
      payments: true,
      reports: false,
      masters: false,
      settings: false,
      users: false,
      finance: false,
      reinsurance: false,
      productConfigurator: false,
      remittance: false,
      renewal: true,
      incentives: true
    },
    branch: "Makati",
    email: "juan.delacruz@company.ph"
  },
  {
    // Client User - Limited View-Only Access
    username: "client.demo",
    password: "client123",
    role: "Client User",
    roleCode: "ROLE-CLIENT",
    name: "Demo Client User",
    employeeCode: "CLIENT-001",
    permissions: {
      dashboard: true, // Client dashboard only
      clients: false,
      quotes: false,
      policies: true, // View own policies only
      claims: true, // Submit and view own claims
      payments: true, // View own payments
      reports: false,
      masters: false,
      settings: false,
      users: false,
      finance: false,
      reinsurance: false,
      productConfigurator: false,
      remittance: false,
      renewal: true, // View renewal notices
      incentives: false
    },
    branch: "N/A",
    email: "client.demo@gmail.com",
    clientId: "CL-2025-001",
    policyNumbers: ["MIC-2025-MOT-00123", "AXA-2025-HLT-00567"],
    viewOnly: true,
    clientPortal: true
  },
  {
    // Underwriter - Underwriting Access
    username: "pedro.gonzales",
    password: "underwriter123",
    role: "Underwriter",
    roleCode: "ROLE-UW",
    name: "Pedro Gonzales",
    employeeCode: "EMP-2025-005",
    permissions: {
      dashboard: true,
      clients: true,
      quotes: true,
      policies: true,
      claims: false,
      payments: false,
      reports: true,
      masters: false,
      settings: false,
      users: false,
      finance: false,
      reinsurance: true,
      productConfigurator: true,
      remittance: false,
      renewal: false,
      incentives: false
    },
    branch: "Makati",
    email: "pedro.gonzales@company.ph"
  },
  {
    // Claims Officer - Claims Access
    username: "rosa.fernandez",
    password: "claims123",
    role: "Claims Officer",
    roleCode: "ROLE-CLM",
    name: "Rosa Fernandez",
    employeeCode: "EMP-2025-006",
    permissions: {
      dashboard: true,
      clients: true,
      quotes: false,
      policies: true,
      claims: true,
      payments: true,
      reports: true,
      masters: false,
      settings: false,
      users: false,
      finance: true,
      reinsurance: false,
      productConfigurator: false,
      remittance: false,
      renewal: false,
      incentives: false
    },
    branch: "Davao",
    email: "rosa.fernandez@company.ph"
  },
  {
    // Finance Officer - Finance Access
    username: "elena.martinez",
    password: "finance123",
    role: "Finance Officer",
    roleCode: "ROLE-FIN",
    name: "Elena Martinez",
    employeeCode: "EMP-2025-010",
    permissions: {
      dashboard: true,
      clients: false,
      quotes: false,
      policies: false,
      claims: false,
      payments: true,
      reports: true,
      masters: false,
      settings: false,
      users: false,
      finance: true,
      reinsurance: false,
      productConfigurator: false,
      remittance: true,
      renewal: false,
      incentives: true
    },
    branch: "Makati",
    email: "elena.martinez@company.ph"
  },
  {
    // Read-Only Auditor - View Only Access
    username: "auditor.view",
    password: "auditor123",
    role: "Read-Only User",
    roleCode: "ROLE-VIEWER",
    name: "Insurance Commission Auditor",
    employeeCode: "AUD-001",
    permissions: {
      dashboard: true,
      clients: true,
      quotes: true,
      policies: true,
      claims: true,
      payments: true,
      reports: true,
      masters: true,
      settings: true,
      users: true,
      finance: true,
      reinsurance: true,
      productConfigurator: true,
      remittance: true,
      renewal: true,
      incentives: true
    },
    branch: "External",
    email: "auditor@insurance.gov.ph",
    viewOnly: true, // Important flag for read-only access
    canExport: true, // Can export reports
    canPrint: true // Can print documents
  }
];

// Quick login helper for development
export const quickLoginCredentials = {
  admin: { username: "ITADMIN", password: "Test@123", description: "Full system access with masters" },
  user: { username: "user", password: "User@123", description: "Full edit access except masters" },
  director: { username: "miguel.torres", password: "director123", description: "Executive access" },
  manager: { username: "roberto.reyes", password: "manager123", description: "Branch management" },
  agent: { username: "juan.delacruz", password: "agent123", description: "Sales operations" },
  client: { username: "client.demo", password: "client123", description: "Client portal (view-only)" },
  underwriter: { username: "pedro.gonzales", password: "underwriter123", description: "Underwriting" },
  claims: { username: "rosa.fernandez", password: "claims123", description: "Claims processing" },
  finance: { username: "elena.martinez", password: "finance123", description: "Financial operations" },
  auditor: { username: "auditor.view", password: "auditor123", description: "Read-only audit access" }
};

// Session timeout settings (in minutes)
export const sessionSettings = {
  admin: 120, // 2 hours
  employee: 60, // 1 hour
  client: 30, // 30 minutes
  auditor: 240 // 4 hours
};

// Mock authentication service
export const mockAuthService = {
  login: (username, password) => {
    const user = mockUsers.find(u =>
      u.username === username && u.password === password
    );

    if (user) {
      // Remove password from response
      const { password, ...userInfo } = user;
      return {
        success: true,
        user: userInfo,
        token: `mock-jwt-token-${Date.now()}`,
        expiresIn: sessionSettings[user.roleCode === 'ROLE-CLIENT' ? 'client' : 'employee'] * 60
      };
    }

    return {
      success: false,
      message: "Invalid username or password"
    };
  },

  logout: () => {
    return {
      success: true,
      message: "Logged out successfully"
    };
  },

  validateToken: (token) => {
    // Mock token validation
    return token && token.startsWith('mock-jwt-token-');
  }
};

export default mockAuthService;