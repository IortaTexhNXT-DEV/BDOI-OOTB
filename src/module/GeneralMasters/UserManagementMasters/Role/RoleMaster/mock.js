// Thailand Role Master Mock Data

const Productdata = [
  {
    id: 1,
    roleCode: "ROLE-ADMIN",
    roleName: "System Administrator",
    description: "Full system access with all permissions",
    permissions: "All modules",
    modifiedBy: "System",
    modifiedOn: "03/28/2025",
    status: "Active",
    userCount: 2
  },
  {
    id: 2,
    roleCode: "ROLE-DIR",
    roleName: "Director",
    description: "Executive level access with management reports",
    permissions: "All modules except system settings",
    modifiedBy: "Admin",
    modifiedOn: "03/27/2025",
    status: "Active",
    userCount: 1
  },
  {
    id: 3,
    roleCode: "ROLE-MGR",
    roleName: "Branch Manager",
    description: "Branch level operations and management",
    permissions: "Branch operations, reports, approvals",
    modifiedBy: "Admin",
    modifiedOn: "03/26/2025",
    status: "Active",
    userCount: 3
  },
  {
    id: 4,
    roleCode: "ROLE-SUP",
    roleName: "Supervisor",
    description: "Department supervision and team management",
    permissions: "Department operations, team management",
    modifiedBy: "Admin",
    modifiedOn: "03/25/2025",
    status: "Active",
    userCount: 4
  },
  {
    id: 5,
    roleCode: "ROLE-AGENT",
    roleName: "Insurance Agent",
    description: "Agent operations and client management",
    permissions: "Quotes, policies, clients, commissions",
    modifiedBy: "Roberto Reyes",
    modifiedOn: "03/24/2025",
    status: "Active",
    userCount: 15
  },
  {
    id: 6,
    roleCode: "ROLE-UW",
    roleName: "Underwriter",
    description: "Policy underwriting and risk assessment",
    permissions: "Underwriting, risk assessment, approvals",
    modifiedBy: "Admin",
    modifiedOn: "03/23/2025",
    status: "Active",
    userCount: 5
  },
  {
    id: 7,
    roleCode: "ROLE-CLM",
    roleName: "Claims Officer",
    description: "Claims processing and settlement",
    permissions: "Claims module, payment processing",
    modifiedBy: "Admin",
    modifiedOn: "03/22/2025",
    status: "Active",
    userCount: 4
  },
  {
    id: 8,
    roleCode: "ROLE-FIN",
    roleName: "Finance Officer",
    description: "Financial operations and accounting",
    permissions: "Finance module, payments, reports",
    modifiedBy: "Admin",
    modifiedOn: "03/21/2025",
    status: "Active",
    userCount: 3
  },
  {
    id: 9,
    roleCode: "ROLE-CLIENT",
    roleName: "Client User",
    description: "Client portal access - view only",
    permissions: "View policies, submit claims, view receipts",
    modifiedBy: "Admin",
    modifiedOn: "03/20/2025",
    status: "Active",
    userCount: 50
  },
  {
    id: 10,
    roleCode: "ROLE-VIEWER",
    roleName: "Read-Only User",
    description: "View only access for auditors/inspectors",
    permissions: "View all modules, no edit permissions",
    modifiedBy: "Admin",
    modifiedOn: "03/19/2025",
    status: "Active",
    userCount: 3
  }
];

export default Productdata;