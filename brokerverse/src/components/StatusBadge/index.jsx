import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Tag } from 'primereact/tag';
import { getStatusLabel, getStatusDescription } from '../../utils/statusHelpers';
import { statusSeverity } from '../../utils/statusSeverity';

// Quotation status -> leads.* translation key
const QUOTATION_STATUS_I18N = {
  Draft: 'draft',
  Dropped: 'dropped',
  CustomerAccepted: 'customerAccepted',
  ConvertedToPolicy: 'convertedToPolicy',
  PendingCustomer: 'pendingCustomer',
  Approved: 'approved',
  SubmittedToInsurer: 'submittedToInsurer',
  Rejected: 'rejected',
};

/**
 * Status chip of a lead, quotation, policy or payment: the same Tag and colour scheme as every other list
 * (utils/statusSeverity), with the status description as its tooltip.
 */
const StatusBadge = ({ status, type, showTooltip = true, className = '' }) => {
  const { t } = useTranslation();
  if (!status) return null;
  const labelKey = type === 'quotation' && QUOTATION_STATUS_I18N[status];
  const label = labelKey ? t(`leads.${labelKey}`) : getStatusLabel(status);
  const description = showTooltip ? getStatusDescription(status, type) : null;
  return <Tag value={label} severity={statusSeverity(status)} className={className} title={description || undefined} />;
};

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['lead', 'quotation', 'policy', 'payment']).isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showTooltip: PropTypes.bool,
  className: PropTypes.string
};

export default StatusBadge;
