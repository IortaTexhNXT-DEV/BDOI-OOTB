
import { formatDate as formatAppDate } from "../utility/dateFormat";/**
 * Status Helpers - Utility functions for handling Lead, Quote, and Policy statuses
 */

// Lead Status Enum
export const LeadStatus = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  QUOTE_GENERATED: 'QuoteGenerated',
  CONVERTED: 'Converted',
  LOST: 'Lost'
};

// Quotation Status Enum
export const QuotationStatus = {
  DRAFT: 'Draft',
  PENDING_CUSTOMER: 'PendingCustomer',
  CUSTOMER_ACCEPTED: 'CustomerAccepted',
  SUBMITTED_TO_INSURER: 'SubmittedToInsurer',
  APPROVED: 'Approved',
  CONVERTED_TO_POLICY: 'ConvertedToPolicy',
  REJECTED: 'Rejected'
};

// Policy Status Enum
export const PolicyStatus = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  SUSPENDED: 'Suspended'
};

// Payment Status Enum
export const PaymentStatus = {
  PENDING: 'Pending',
  REVIEWING: 'Reviewing',
  PARTIAL: 'Partial',
  COMPLETED: 'Completed',
  REFUNDED: 'Refunded'
};

/**
 * Get status badge color
 * @param {string} status - Status value
 * @param {string} type - Type: 'lead', 'quotation', 'policy', 'payment'
 * @returns {string} Color class
 */
export const getStatusColor = (status, type) => {
  if (!status) return 'bg-gray-500';

  switch (type) {
    case 'lead':
      switch (status) {
        case LeadStatus.NEW:
          return 'bg-blue-500';
        case LeadStatus.CONTACTED:
          return 'bg-indigo-500';
        case LeadStatus.QUALIFIED:
          return 'bg-purple-500';
        case LeadStatus.QUOTE_GENERATED:
          return 'bg-yellow-500';
        case LeadStatus.CONVERTED:
          return 'bg-green-500';
        case LeadStatus.LOST:
          return 'bg-red-500';
        default:
          return 'bg-gray-500';
      }

    case 'quotation':
      switch (status) {
        case QuotationStatus.DRAFT:
          return 'bg-gray-500';
        case QuotationStatus.PENDING_CUSTOMER:
          return 'bg-yellow-500';
        case QuotationStatus.CUSTOMER_ACCEPTED:
          return 'bg-blue-500';
        case QuotationStatus.SUBMITTED_TO_INSURER:
          return 'bg-indigo-500';
        case QuotationStatus.APPROVED:
          return 'bg-green-500';
        case QuotationStatus.CONVERTED_TO_POLICY:
          return 'bg-teal-500';
        case QuotationStatus.REJECTED:
          return 'bg-red-500';
        default:
          return 'bg-gray-500';
      }

    case 'policy':
      switch (status) {
        case PolicyStatus.DRAFT:
          return 'bg-gray-500';
        case PolicyStatus.SUBMITTED:
          return 'bg-yellow-500';
        case PolicyStatus.ACTIVE:
          return 'bg-green-500';
        case PolicyStatus.EXPIRED:
          return 'bg-orange-500';
        case PolicyStatus.CANCELLED:
          return 'bg-red-500';
        case PolicyStatus.SUSPENDED:
          return 'bg-red-700';
        default:
          return 'bg-gray-500';
      }

    case 'payment':
      switch (status) {
        case PaymentStatus.PENDING:
          return 'bg-yellow-500';
        case PaymentStatus.REVIEWING:
          return 'bg-blue-500';
        case PaymentStatus.PARTIAL:
          return 'bg-orange-500';
        case PaymentStatus.COMPLETED:
          return 'bg-green-500';
        case PaymentStatus.REFUNDED:
          return 'bg-purple-500';
        default:
          return 'bg-gray-500';
      }

    default:
      return 'bg-gray-500';
  }
};

/**
 * Get status label (formatted)
 * @param {string} status - Status value
 * @returns {string} Formatted label
 */
export const getStatusLabel = (status) => {
  if (!status) return 'Unknown';
  
  // Convert camelCase/PascalCase to readable format
  return status
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, (str) => str.toUpperCase());
};

/**
 * Check if quotation can be converted to policy
 * @param {string} status - Quotation status
 * @returns {boolean} Can convert
 */
export const canConvertToPolicy = (status) => {
  // Allow conversion when customer has accepted OR quote is approved
  return status === QuotationStatus.CUSTOMER_ACCEPTED || 
         status === QuotationStatus.APPROVED;
};

/**
 * Check if quotation can be edited
 * @param {string} status - Quotation status
 * @returns {boolean} Can edit
 */
export const canEditQuotation = (status) => {
  return status === QuotationStatus.DRAFT || status === QuotationStatus.PENDING_CUSTOMER;
};

/**
 * Check if quotation can be deleted
 * @param {string} status - Quotation status
 * @returns {boolean} Can delete
 */
export const canDeleteQuotation = (status) => {
  return status === QuotationStatus.DRAFT || status === QuotationStatus.REJECTED;
};

/**
 * Get next possible status transitions
 * @param {string} currentStatus - Current status
 * @param {string} type - Type: 'lead', 'quotation', 'policy'
 * @returns {Array<string>} Possible next statuses
 */
export const getNextStatuses = (currentStatus, type) => {
  if (!currentStatus) return [];

  switch (type) {
    case 'lead':
      switch (currentStatus) {
        case LeadStatus.NEW:
          return [LeadStatus.CONTACTED, LeadStatus.LOST];
        case LeadStatus.CONTACTED:
          return [LeadStatus.QUALIFIED, LeadStatus.LOST];
        case LeadStatus.QUALIFIED:
          return [LeadStatus.QUOTE_GENERATED, LeadStatus.LOST];
        case LeadStatus.QUOTE_GENERATED:
          return [LeadStatus.CONVERTED, LeadStatus.LOST];
        default:
          return [];
      }

    case 'quotation':
      switch (currentStatus) {
        case QuotationStatus.DRAFT:
          return [QuotationStatus.PENDING_CUSTOMER];
        case QuotationStatus.PENDING_CUSTOMER:
          return [QuotationStatus.CUSTOMER_ACCEPTED, QuotationStatus.REJECTED];
        case QuotationStatus.CUSTOMER_ACCEPTED:
          return [QuotationStatus.SUBMITTED_TO_INSURER, QuotationStatus.APPROVED];
        case QuotationStatus.SUBMITTED_TO_INSURER:
          return [QuotationStatus.APPROVED, QuotationStatus.REJECTED];
        case QuotationStatus.APPROVED:
          return [QuotationStatus.CONVERTED_TO_POLICY];
        default:
          return [];
      }

    case 'policy':
      switch (currentStatus) {
        case PolicyStatus.DRAFT:
          return [PolicyStatus.SUBMITTED];
        case PolicyStatus.SUBMITTED:
          return [PolicyStatus.ACTIVE, PolicyStatus.CANCELLED];
        case PolicyStatus.ACTIVE:
          return [PolicyStatus.EXPIRED, PolicyStatus.CANCELLED, PolicyStatus.SUSPENDED];
        case PolicyStatus.SUSPENDED:
          return [PolicyStatus.ACTIVE, PolicyStatus.CANCELLED];
        default:
          return [];
      }

    default:
      return [];
  }
};

/**
 * Format status with timestamp
 * @param {string} status - Status
 * @param {string} timestamp - Timestamp
 * @returns {string} Formatted string
 */
export const formatStatusWithTime = (status, timestamp) => {
  if (!timestamp) return getStatusLabel(status);
  
  const date = new Date(timestamp);
  const formattedDate = formatAppDate(date);
  
  return `${getStatusLabel(status)} (${formattedDate})`;
};

/**
 * Get status description
 * @param {string} status - Status value
 * @param {string} type - Type: 'lead', 'quotation', 'policy', 'payment'
 * @returns {string} Description
 */
export const getStatusDescription = (status, type) => {
  if (!status) return 'Status not available';

  switch (type) {
    case 'lead':
      switch (status) {
        case LeadStatus.NEW:
          return 'New lead, not yet contacted';
        case LeadStatus.CONTACTED:
          return 'Lead has been contacted';
        case LeadStatus.QUALIFIED:
          return 'Lead qualified for insurance';
        case LeadStatus.QUOTE_GENERATED:
          return 'Quotation has been generated';
        case LeadStatus.CONVERTED:
          return 'Lead converted to policy';
        case LeadStatus.LOST:
          return 'Lead lost or declined';
        default:
          return 'Unknown status';
      }

    case 'quotation':
      switch (status) {
        case QuotationStatus.DRAFT:
          return 'Quote is being prepared';
        case QuotationStatus.PENDING_CUSTOMER:
          return 'Waiting for customer response';
        case QuotationStatus.CUSTOMER_ACCEPTED:
          return 'Customer has accepted the quote';
        case QuotationStatus.SUBMITTED_TO_INSURER:
          return 'Quote submitted to insurance company';
        case QuotationStatus.APPROVED:
          return 'Quote approved by insurer';
        case QuotationStatus.CONVERTED_TO_POLICY:
          return 'Quote converted to active policy';
        case QuotationStatus.REJECTED:
          return 'Quote rejected';
        default:
          return 'Unknown status';
      }

    case 'policy':
      switch (status) {
        case PolicyStatus.DRAFT:
          return 'Policy is being prepared';
        case PolicyStatus.SUBMITTED:
          return 'Policy submitted for approval';
        case PolicyStatus.ACTIVE:
          return 'Policy is currently active';
        case PolicyStatus.EXPIRED:
          return 'Policy has expired';
        case PolicyStatus.CANCELLED:
          return 'Policy has been cancelled';
        case PolicyStatus.SUSPENDED:
          return 'Policy is temporarily suspended';
        default:
          return 'Unknown status';
      }

    case 'payment':
      switch (status) {
        case PaymentStatus.PENDING:
          return 'Payment is pending';
        case PaymentStatus.REVIEWING:
          return 'Payment is being reviewed';
        case PaymentStatus.PARTIAL:
          return 'Partial payment received';
        case PaymentStatus.COMPLETED:
          return 'Payment completed';
        case PaymentStatus.REFUNDED:
          return 'Payment has been refunded';
        default:
          return 'Unknown status';
      }

    default:
      return 'Unknown status';
  }
};

