// Thailand Taxation Master Mock Data

import SvgEditIcon from "../../../assets/icons/SvgEditicons";

const Productdata = [
  {
    id: 1,
    TaxCode: "VAT-12",
    TaxName: "Value Added Tax",
    TaxRate: "12%",
    EffectiveFrom: "01/01/2025",
    EffectiveTo: "12/31/2025",
    description: "Standard VAT rate in Thailand",
    applicableTo: "Goods and Services",
    status: "Active"
  },
  {
    id: 2,
    TaxCode: "DST-125",
    TaxName: "Documentary Stamp Tax",
    TaxRate: "1.25%",
    EffectiveFrom: "01/01/2025",
    EffectiveTo: "12/31/2025",
    description: "DST on insurance policies",
    applicableTo: "Insurance Premiums",
    status: "Active"
  },
  {
    id: 3,
    TaxCode: "LGT-075",
    TaxName: "Local Government Tax",
    TaxRate: "0.75%",
    EffectiveFrom: "01/01/2025",
    EffectiveTo: "12/31/2025",
    description: "LGU tax on premiums",
    applicableTo: "Insurance Premiums",
    status: "Active"
  },
  {
    id: 4,
    TaxCode: "FST-05",
    TaxName: "Fire Service Tax",
    TaxRate: "0.5%",
    EffectiveFrom: "01/01/2025",
    EffectiveTo: "12/31/2025",
    description: "Fire service tax on fire insurance",
    applicableTo: "Fire Insurance",
    status: "Active"
  },
  {
    id: 5,
    TaxCode: "PIT-20",
    TaxName: "Premium Tax",
    TaxRate: "2%",
    EffectiveFrom: "01/01/2025",
    EffectiveTo: "12/31/2025",
    description: "Premium tax on life insurance",
    applicableTo: "Life Insurance",
    status: "Active"
  },
  {
    id: 6,
    TaxCode: "WHT-10",
    TaxName: "Withholding Tax",
    TaxRate: "10%",
    EffectiveFrom: "01/01/2025",
    EffectiveTo: "12/31/2025",
    description: "Withholding tax on commissions",
    applicableTo: "Agent Commissions",
    status: "Active"
  },
  {
    id: 7,
    TaxCode: "WHT-15",
    TaxName: "Withholding Tax (Corporate)",
    TaxRate: "15%",
    EffectiveFrom: "01/01/2025",
    EffectiveTo: "12/31/2025",
    description: "Corporate withholding tax",
    applicableTo: "Corporate Commissions",
    status: "Active"
  },
  {
    id: 8,
    TaxCode: "EVAT-0",
    TaxName: "VAT Exempt",
    TaxRate: "0%",
    EffectiveFrom: "01/01/2025",
    EffectiveTo: "12/31/2025",
    description: "VAT exempt transactions",
    applicableTo: "Health Insurance, Educational Plans",
    status: "Active"
  }
];

export default Productdata;