import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { getStatusColor, getStatusLabel, getStatusDescription } from '../../utils/statusHelpers';

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
 * StatusBadge Component
 * Displays a colored badge with status information
 * 
 * @param {string} status - Status value
 * @param {string} type - Type: 'lead', 'quotation', 'policy', 'payment'
 * @param {string} size - Size: 'sm', 'md', 'lg'
 * @param {boolean} showTooltip - Show tooltip with description
 */
const StatusBadge = ({ status, type, size = 'md', showTooltip = true, className = '' }) => {
  const { t } = useTranslation();
  if (!status) return null;

  const colorClass = getStatusColor(status, type);
  const labelKey = type === 'quotation' && QUOTATION_STATUS_I18N[status];
  const label = labelKey ? t(`leads.${labelKey}`) : getStatusLabel(status);
  const description = getStatusDescription(status, type);

  // Size configurations with inline styles
  const sizeConfig = {
    sm: { padding: '4px 8px', fontSize: '11px' },
    md: { padding: '6px 12px', fontSize: '13px' },
    lg: { padding: '8px 16px', fontSize: '15px' }
  };

  const config = sizeConfig[size] || sizeConfig.md;

  // Color mapping to inline styles
  const getBackgroundColor = () => {
    if (colorClass.includes('bg-green')) return '#22c55e';
    if (colorClass.includes('bg-blue')) return '#3b82f6';
    if (colorClass.includes('bg-yellow')) return '#eab308';
    if (colorClass.includes('bg-red')) return '#ef4444';
    if (colorClass.includes('bg-gray')) return '#6b7280';
    if (colorClass.includes('bg-purple')) return '#a855f7';
    if (colorClass.includes('bg-orange')) return '#f97316';
    return '#3b82f6'; // default blue
  };

  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: config.padding,
          fontSize: config.fontSize,
          fontWeight: 500,
          color: 'white',
          backgroundColor: getBackgroundColor(),
          borderRadius: '9999px',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        }}
        className={className}
      >
        {label}
      </span>
      
      {showTooltip && description && (
        <div 
          style={{
            position: 'absolute',
            zIndex: 50,
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            padding: '8px 12px',
            fontSize: '12px',
            color: 'white',
            backgroundColor: '#111827',
            borderRadius: '8px',
            whiteSpace: 'nowrap',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity 0.2s'
          }}
          className="status-tooltip"
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
        >
          {description}
        </div>
      )}
    </div>
  );
};

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['lead', 'quotation', 'policy', 'payment']).isRequired,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  showTooltip: PropTypes.bool,
  className: PropTypes.string
};

export default StatusBadge;

