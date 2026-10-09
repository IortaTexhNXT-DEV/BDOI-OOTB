import { useState, useEffect } from 'react';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { useSearchParams } from 'react-router-dom';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { BASE_URL } from '../../utility/constant';
import i18n from '../../i18n';
import './ApproveQuote.scss';

const ApproveQuote = () => {
  // The client approves in English: this public page offers no language switch (Philippine clients; the
  // system has no configured list of client languages) and never follows the agent's saved app language.
  const t = i18n.getFixedT('en');
  const { formatCurrency } = useFormatCurrency();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState(null);
  const [, setTokenPayload] = useState(null);
  const [quotationData, setQuotationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState(null);
  const [approved, setApproved] = useState(false);
  
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      setError(t('approveQuote.invalidLink'));
      setLoading(false);
      return;
    }
    
    // Decode token to get basic info (quotationId, etc.)
    try {
      const payload = JSON.parse(atob(tokenParam.split('.')[1]));
      setToken(tokenParam);
      setTokenPayload(payload);
      
      // Fetch full quotation details in preview mode
      fetchQuotationPreview(tokenParam);
    } catch (e) {
      setError(t('approveQuote.invalidLink'));
      setLoading(false);
    }
  }, [searchParams]);

  const fetchQuotationPreview = async (token) => {
    try {
      // Call public endpoint with preview flag to get quote details without approving
      const response = await fetch(`${BASE_URL}/quotations/approve-by-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, preview: true })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setQuotationData(result);
      } else {
        setError(result.message || t('approveQuote.failedToLoad'));
      }
    } catch (error) {
      setError(t('approveQuote.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleApprove = async () => {
    setApproving(true);
    
    try {
      const response = await fetch(`${BASE_URL}/quotations/approve-by-customer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setApproved(true);
        // Backend returns full quotation with all details and premium values
        setQuotationData(result);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError(t('approveQuote.failedToApprove'));
    } finally {
      setApproving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="approve-quote-container">
        <Card>
          <div style={{textAlign: 'center', padding: '40px'}}>
            <i className="pi pi-spin pi-spinner" style={{fontSize: '2rem'}}></i>
            <p>{t('approveQuote.loading')}</p>
          </div>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="approve-quote-container">
        <Card>
          <div style={{textAlign: 'center', padding: '40px'}}>
            <i className="pi pi-times-circle" style={{fontSize: '1.25rem', color: 'var(--color-danger)'}}></i>
            <h2>{t('approveQuote.error')}</h2>
            <p>{error}</p>
          </div>
        </Card>
      </div>
    );
  }
  
  if (approved) {
    const premiumBreakdown = [
      { label: t('approveQuote.netPremium'), value: quotationData?.netPremium },
      { label: t('approveQuote.valueAddedTax'), value: quotationData?.valueAddedTax },
      { label: t('approveQuote.documentaryStampTax'), value: quotationData?.documentaryStampTax },
      { label: t('approveQuote.localGovernmentTax'), value: quotationData?.localGovernmentTax },
      { label: t('approveQuote.accountPremiumOthers'), value: quotationData?.accountPremiumOthers },
      { label: t('approveQuote.ncd'), value: quotationData?.NCD },
    ];

    return (
      <div className="approve-quote-container">
        <Card>
          <div style={{textAlign: 'center', padding: '20px 20px 30px'}}>
            <i className="pi pi-check-circle" style={{fontSize: '1.25rem', color: 'var(--color-success)', marginBottom: '16px'}}></i>
            <h2 style={{marginBottom: '8px'}}>{t('approveQuote.quoteApprovedSuccess')}</h2>
            <p style={{marginBottom: '30px'}}>{t('approveQuote.thankYouApprove')}</p>
            
            {quotationData && (
              <>
                {/* Quote Basic Info */}
                <div className="quote-info-card">
                  <div className="info-row">
                    <span className="info-label">{t('approveQuote.quoteNumber')}</span>
                    <span className="info-value">{quotationData.quotationNumber}</span>
                  </div>
                  
                  {quotationData.participantDetails?.[0] && (
                    <div className="info-row">
                      <span className="info-label">{t('approveQuote.insuranceCompany')}</span>
                      <span className="info-value">
                        {quotationData.participantDetails[0].insuranceCompanyName || 
                         quotationData.participantDetails[0].participantName || 'N/A'}
                      </span>
                    </div>
                  )}

                  {quotationData.insuranceVehicleDetails?.[0] && (
                    <>
                      <div className="info-row">
                        <span className="info-label">{t('approveQuote.vehicle')}</span>
                        <span className="info-value">
                          {`${quotationData.insuranceVehicleDetails[0].vehicleBrand || ''} 
                           ${quotationData.insuranceVehicleDetails[0].vehicleModel || ''} 
                           ${quotationData.insuranceVehicleDetails[0].modelYear || ''}`.trim() || 'N/A'}
                        </span>
                      </div>
                      {quotationData.plateNumber && (
                        <div className="info-row">
                          <span className="info-label">{t('approveQuote.plateNumber')}</span>
                          <span className="info-value">{quotationData.plateNumber}</span>
                        </div>
                      )}
                    </>
                  )}

                  {quotationData.totalSumInsured && (
                    <div className="info-row">
                      <span className="info-label">{t('approveQuote.totalCoverage')}</span>
                      <span className="info-value">{formatCurrency(quotationData.totalSumInsured)}</span>
                    </div>
                  )}
                </div>

                {/* Premium Breakdown Table */}
                <div className="premium-breakdown-section">
                  <h3 style={{marginBottom: '16px', fontSize: '18px', fontWeight: '600', color: 'var(--color-heading)'}}>
                    {t('approveQuote.premiumBreakdown')}
                  </h3>
                  <DataTable 
                    value={premiumBreakdown} 
                    size="small"
                    className="premium-table"
                  >
                    <Column 
                      field="label" 
                      header={t('approveQuote.description')} 
                      style={{textAlign: 'left', fontWeight: '500'}}
                    />
                    <Column 
                      field="value" 
                      header={t('approveQuote.amount')} 
                      body={(rowData) => formatCurrency(rowData.value)}
                    headerClassName="bv-num"
                    bodyClassName="bv-num"
                      style={{textAlign: 'right', fontWeight: '500'}}
                    />
                  </DataTable>
                  
                  <div className="gross-premium-total">
                    <span className="total-label">{t('approveQuote.grossPremiumTotal')}</span>
                    <span className="total-value">{formatCurrency(quotationData.grossPremium)}</span>
                  </div>
                </div>

                <div className="next-steps-message">
                  <i className="pi pi-info-circle" style={{marginRight: '8px'}}></i>
                  {t('approveQuote.nextStepsMessage')}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }
  
  const premiumBreakdown = quotationData ? [
    { label: t('approveQuote.netPremium'), value: quotationData.netPremium },
    { label: t('approveQuote.valueAddedTax'), value: quotationData.valueAddedTax },
    { label: t('approveQuote.documentaryStampTax'), value: quotationData.documentaryStampTax },
    { label: t('approveQuote.localGovernmentTax'), value: quotationData.localGovernmentTax },
    { label: t('approveQuote.accountPremiumOthers'), value: quotationData.accountPremiumOthers },
    { label: t('approveQuote.ncd'), value: quotationData.NCD },
  ] : [];

  return (
    <div className="approve-quote-container">
      <Card>
        <div style={{padding: '20px'}}>
          <h2 style={{textAlign: 'center', marginBottom: '8px'}}>{t('approveQuote.approveInsuranceQuote')}</h2>
          <p style={{textAlign: 'center', marginBottom: '30px', color: 'var(--color-text-muted)'}}>
            {t('approveQuote.reviewBeforeApprove')}
          </p>
          
          {quotationData && (
            <>
              {/* Quote Basic Info */}
              <div className="quote-info-card">
                <h3 className="section-title">{t('approveQuote.quoteInformation')}</h3>
                
                <div className="info-row">
                  <span className="info-label">{t('approveQuote.quoteNumber')}</span>
                  <span className="info-value">{quotationData.quotationNumber}</span>
                </div>
                
                {quotationData.participantDetails?.[0] && (
                  <div className="info-row">
                    <span className="info-label">{t('approveQuote.insuranceCompany')}</span>
                    <span className="info-value">
                      {quotationData.participantDetails[0].insuranceCompanyName || 
                       quotationData.participantDetails[0].participantName || 'N/A'}
                    </span>
                  </div>
                )}

                {quotationData.insurancePolicyType && (
                  <div className="info-row">
                    <span className="info-label">{t('approveQuote.policyType')}</span>
                    <span className="info-value">{quotationData.insurancePolicyType}</span>
                  </div>
                )}
              </div>

              {/* Customer Info */}
              {quotationData.lead && (
                <div className="quote-info-card">
                  <h3 className="section-title">{t('approveQuote.customerInformation')}</h3>
                  
                  <div className="info-row">
                    <span className="info-label">{t('approveQuote.name')}</span>
                    <span className="info-value">
                      {`${quotationData.lead.firstName || ''} ${quotationData.lead.lastName || ''}`.trim() || 'N/A'}
                    </span>
                  </div>
                  
                  {quotationData.lead.emailId && (
                    <div className="info-row">
                      <span className="info-label">{t('approveQuote.email')}</span>
                      <span className="info-value">{quotationData.lead.emailId}</span>
                    </div>
                  )}
                  
                  {quotationData.lead.contactNumber && (
                    <div className="info-row">
                      <span className="info-label">{t('approveQuote.contact')}</span>
                      <span className="info-value">{quotationData.lead.contactNumber}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Vehicle Info */}
              {quotationData.insuranceVehicleDetails?.[0] && (
                <div className="quote-info-card">
                  <h3 className="section-title">{t('approveQuote.vehicleInformation')}</h3>
                  
                  <div className="info-row">
                    <span className="info-label">{t('approveQuote.vehicle')}</span>
                    <span className="info-value">
                      {`${quotationData.insuranceVehicleDetails[0].vehicleBrand || ''} 
                       ${quotationData.insuranceVehicleDetails[0].vehicleModel || ''} 
                       ${quotationData.insuranceVehicleDetails[0].modelYear || ''}`.trim() || 'N/A'}
                    </span>
                  </div>
                  
                  {quotationData.insuranceVehicleDetails[0].vehicleType && (
                    <div className="info-row">
                      <span className="info-label">{t('approveQuote.type')}</span>
                      <span className="info-value">{quotationData.vehicleTypeLabel || quotationData.insuranceVehicleDetails[0].vehicleType}</span>
                    </div>
                  )}
                  
                  {quotationData.plateNumber && (
                    <div className="info-row">
                      <span className="info-label">{t('approveQuote.plateNumber')}</span>
                      <span className="info-value">{quotationData.plateNumber}</span>
                    </div>
                  )}

                  {quotationData.motorNumber && (
                    <div className="info-row">
                      <span className="info-label">{t('approveQuote.motorNumber')}</span>
                      <span className="info-value">{quotationData.motorNumber}</span>
                    </div>
                  )}

                  {quotationData.chassisNumber && (
                    <div className="info-row">
                      <span className="info-label">{t('approveQuote.chassisNumber')}</span>
                      <span className="info-value">{quotationData.chassisNumber}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Coverage Info */}
              {quotationData.totalSumInsured && (
                <div className="quote-info-card">
                  <h3 className="section-title">{t('approveQuote.coverageSummary')}</h3>
                  
                  <div className="info-row">
                    <span className="info-label">{t('approveQuote.totalSumInsured')}</span>
                    <span className="info-value highlight">{formatCurrency(quotationData.totalSumInsured)}</span>
                  </div>
                  
                  {quotationData.deductible && (
                    <div className="info-row">
                      <span className="info-label">{t('approveQuote.deductible')}</span>
                      <span className="info-value">{formatCurrency(quotationData.deductible)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Premium Breakdown */}
              <div className="premium-breakdown-section">
                <h3 className="section-title">{t('approveQuote.premiumBreakdown')}</h3>
                
                <DataTable 
                  value={premiumBreakdown} 
                  size="small"
                  className="premium-table"
                >
                  <Column 
                    field="label" 
                    header={t('approveQuote.description')} 
                    style={{textAlign: 'left', fontWeight: '500'}}
                  />
                  <Column 
                    field="value" 
                    header={t('approveQuote.amount')} 
                    body={(rowData) => formatCurrency(rowData.value)}
                    headerClassName="bv-num"
                    bodyClassName="bv-num"
                    style={{textAlign: 'right', fontWeight: '500'}}
                  />
                </DataTable>
                
                <div className="gross-premium-total">
                  <span className="total-label">{t('approveQuote.grossPremiumTotal')}</span>
                  <span className="total-value">{formatCurrency(quotationData.grossPremium)}</span>
                </div>
              </div>
            </>
          )}
          
          <div style={{marginTop: '30px', textAlign: 'center'}}>
            <Button 
              label={quotationData ? t('approveQuote.approveQuote') : t('approveQuote.loading')}
              icon="pi pi-check"
              onClick={handleApprove}
              loading={approving}
              disabled={!quotationData}
              className="p-button-lg"
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ApproveQuote;

