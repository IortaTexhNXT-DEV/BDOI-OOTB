// Thailand Open Items Mock Data

import SvgDocumentIcon from "../../../assets/agentIcon/SvgDocumentIcon";
import SvgGreenDocument from "../../../assets/agentIcon/SvgGreenDocument";
import SvgPaymentIcon from "../../../assets/agentIcon/SvgPaymentIcon";
import SvgRenewalIcon from "../../../assets/agentIcon/SvgRenewalIcon";

export const mock = [
  {
    id: 1,
    name: "Juan Dela Cruz",
    clientId: "CL-2025-001",
    policyNo: "MIC-2025-MOT-00123",
    status: "Pending Payments",
    count: "10",
    icon: <SvgPaymentIcon />,
    amount: "₱22,500",
    dueDate: "04/15/2025",
    insurer: "Malayan Insurance"
  },
  {
    id: 2,
    name: "Maria Santos",
    clientId: "CL-2025-002",
    policyNo: "PGA-2025-MOT-00456",
    status: "Renewal Request",
    count: "8",
    icon: <SvgRenewalIcon />,
    renewalDate: "04/30/2025",
    insurer: "PGA Sompo"
  },
  {
    id: 3,
    name: "Roberto Reyes",
    clientId: "CL-2025-003",
    policyNo: "AXA-2025-HLT-00789",
    status: "Pending Documents",
    count: "5",
    icon: <SvgDocumentIcon />,
    documentsNeeded: "Medical Certificate, ID Copy",
    insurer: "AXA Thailand"
  },
  {
    id: 4,
    name: "Ana Garcia",
    clientId: "CL-2025-004",
    policyNo: "CHA-2025-FIRE-01012",
    status: "Endorsement Processing",
    count: "3",
    icon: <SvgGreenDocument />,
    endorsementType: "Coverage Extension",
    insurer: "Charter Ping An"
  },
  {
    id: 5,
    name: "Pedro Gonzales",
    clientId: "CL-2025-005",
    policyNo: "FPG-2025-MOT-01315",
    status: "Pending Payments",
    count: "12",
    icon: <SvgPaymentIcon />,
    amount: "₱8,500",
    dueDate: "04/10/2025",
    insurer: "FPG Insurance"
  },
  {
    id: 6,
    name: "SM Prime Holdings",
    clientId: "CL-2025-007",
    policyNo: "CHA-2025-FIRE-00189",
    status: "Renewal Request",
    count: "15",
    icon: <SvgRenewalIcon />,
    renewalDate: "05/01/2025",
    insurer: "Charter Ping An",
    premium: "₱625,000"
  }
];