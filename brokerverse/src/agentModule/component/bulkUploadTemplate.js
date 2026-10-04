/**
 * Bulk upload templates generated in the browser as CSV (the upload endpoints accept CSV or XLSX).
 * Column names match the headers read by the bulk-upload endpoints of leads, quotations, policies,
 * receipts and disbursements (the backend camel-cases them: "Policy Number" -> policyNumber). They are the headers of
 * the delivered upload templates (docs/package/05_Delivery/Upload_Templates); backend/test/upload-templates.test.js
 * fails when a list here differs from the importer's column list.
 */
export const BULK_UPLOAD_TEMPLATES = {
  leads: {
    fileName: "Leads-Bulk-Upload.csv",
    columns: [
      "First Name", "Last Name", "Preferred Name", "Company Name", "Date of Birth", "Gender", "Email", "Contact Number",
      "House / Unit No.", "Street", "Barangay", "City / Municipality", "Province", "Region", "Country", "ZIP Code", "Lead Category", "TIN", "LOB",
      "Source",
    ],
  },
  quotations: {
    fileName: "Quotations-Bulk-Upload.csv",
    columns: [
      "Lead Id", "First Name", "Last Name", "Company Name", "Email", "Contact Number", "Product Type", "Policy Type",
      "Insurance Company", "Sum Insured", "Own Damage", "OD Rate", "Net Premium", "Discount", "Remarks",
    ],
  },
  policies: {
    fileName: "Policies-Bulk-Upload.csv",
    columns: [
      "Policy Number", "Insured Name", "First Name", "Last Name", "Company Name", "Email", "Contact Number", "Product Type",
      "Insurance Company", "Inception Date", "Expiry Date", "Issue Date", "Sum Insured", "Net Premium", "Gross Premium",
      "Plate Number", "Payment Status",
    ],
  },
  receipts: {
    fileName: "Receipts-Bulk-Upload.csv",
    columns: ["Policy Number", "Amount", "Receipt Date", "Payment Mode", "Reference No", "Customer Code", "Transaction Code", "Remarks"],
  },
  disbursements: {
    fileName: "Disbursements-Bulk-Upload.csv",
    columns: [
      "Voucher Date", "Payee Type", "Customer Code", "Insurer Name", "Policy Number", "Referrer Id", "Amount", "Payment Mode",
      "Transaction Code", "Transaction Description", "Remarks",
    ],
  },
};

const csvCell = (value) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Downloads the header-only CSV template of the given kind (a key of BULK_UPLOAD_TEMPLATES). */
export const downloadBulkUploadTemplate = (kind) => {
  const { fileName, columns } = BULK_UPLOAD_TEMPLATES[kind];
  const blob = new Blob([`${columns.map(csvCell).join(",")}\r\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/** True for the spreadsheet types the bulk upload endpoints accept (.xlsx or .csv). */
export const isSupportedUploadFile = (file) => /\.(xlsx|csv)$/i.test(file?.name || "");
