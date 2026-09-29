import SvgDocumentIcon from "../../../assets/agentIcon/SvgDocumentIcon";
import SvgGreenDocument from "../../../assets/agentIcon/SvgGreenDocument";
import SvgPaymentIcon from "../../../assets/agentIcon/SvgPaymentIcon";
import SvgRenewalIcon from "../../../assets/agentIcon/SvgRenewalIcon";

export const data = [
    {
        id: 1,
        name: "Carson Darrin",
        clientId: "12345678",
        policyNo: "Policy0123",
        count: "15",
        status: "Policies Expiring soon",
        icon: <SvgDocumentIcon />
    },
    {
        id: 2,
        name: "Carson Darrin",
        clientId: "12345678",
        policyNo: "Policy0123",
        status: "Quote Pending",
       
        count: "20",
       
        icon: <SvgGreenDocument />
    }
]