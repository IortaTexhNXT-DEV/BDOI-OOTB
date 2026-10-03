import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useFormatCurrency } from '../../../hooks/useFormatCurrency';
import { Card } from 'primereact/card';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Divider } from 'primereact/divider';
import { Chart } from 'primereact/chart';
import { Dialog } from 'primereact/dialog';
import reinsuranceService from '../../../services/reinsuranceService';
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import './style.scss';

const TreatyDetail = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [treaty, setTreaty] = useState(null);
  const [cessions, setCessions] = useState([]);
  const [claims, setClaims] = useState([]);
  const [capacity, setCapacity] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCessionDialog, setShowCessionDialog] = useState(false);
  const [selectedCession, setSelectedCession] = useState(null);
  const toast = useRef(null);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    loadTreatyDetails();
  }, [id]);

  const loadTreatyDetails = async () => {
    setLoading(true);
    try {
      const [treatyData, capacityData, cessionsData, claimsData, bordereaux] = await Promise.all([
        reinsuranceService.getTreatyById(id),
        reinsuranceService.getTreatyCapacity(id),
        reinsuranceService.getCessionsByTreaty(id),
        reinsuranceService.getClaimsByTreaty(id),
        reinsuranceService.getBordereaux()
      ]);

      setTreaty(treatyData);
      setCapacity(capacityData);
      setCessions(cessionsData);
      setClaims(claimsData);
      setDocuments(bordereaux.filter(b => String(b.treatyId) === String(treatyData.id)));
    } catch (error) {
      toast.current?.show({
        severity: 'error',
        summary: t('reinsurance.error'),
        detail: error?.message || t('reinsurance.failedToLoadTreatyDetails')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCessionDetails = (cession) => {
    setSelectedCession(cession);
    setShowCessionDialog(true);
  };

  const statusBodyTemplate = (rowData) => {
    const severity = ['Active', 'Confirmed', 'Recovered'].includes(rowData.status) ? 'success' :
                     rowData.status === 'Pending' ? 'warning' : 'danger';
    return <Tag value={rowData.status} severity={severity} />;
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text p-button-primary"
          tooltip={t('reinsurance.viewDetails')}
          onClick={() => handleCessionDetails(rowData)} aria-label={t('reinsurance.viewDetails')}
        />
        <Button
          icon="pi pi-file-pdf"
          className="p-button-rounded p-button-text"
          tooltip="Generate Bordereau"
          onClick={() => navigate('/reinsurance/cessions')} aria-label="Generate Bordereau"
        />
      </div>
    );
  };

  const treatyChart = {
    labels: ['Capacity Used', 'Available'],
    datasets: [{
      data: [treaty?.utilization || 0, 100 - (treaty?.utilization || 0)],
      backgroundColor: ['#ff6384', '#36a2eb']
    }]
  };

  const chartOptions = {
    plugins: {
      legend: {
        position: 'bottom'
      }
    }
  };

  if (loading || !treaty) {
    return <div>Loading...</div>;
  }

  return (
    <div className="treaty-detail">
      <Toast ref={toast} />

      <div className="detail-header">
        <div className="header-left">
          <Button
            icon="pi pi-arrow-left"
            label="Back to Treaties"
            className="p-button-text"
            onClick={() => navigate('/reinsurance/treaties')}
          />
          <h2>{treaty.treatyNumber} - {treaty.type}</h2>
        </div>
        <div className="header-actions">
          <Button
            label="Edit Treaty"
            icon="pi pi-pencil"
            className="p-button-outlined"
            onClick={() => navigate('/master/reinsurance/treaty')}
          />
          <Button
            label="Generate Report"
            icon="pi pi-file-pdf"
            className="p-button-primary"
            onClick={() => navigate('/reinsurance/reports')}
          />
        </div>
      </div>

      <div className="treaty-grid">
        <Card title="Treaty Information" className="treaty-info-card">
          <div className="info-grid">
            <div className="info-item">
              <label>Treaty Number:</label>
              <span>{treaty.treatyNumber}</span>
            </div>
            <div className="info-item">
              <label>Type:</label>
              <span>{treaty.type}</span>
            </div>
            <div className="info-item">
              <label>Reinsurer:</label>
              <span>{treaty.reinsurerDetails?.map(r => r.shortName || r.name).join(', ')}</span>
            </div>
            <div className="info-item">
              <label>Coverage:</label>
              <span>{treaty.lineOfBusiness}</span>
            </div>
            <div className="info-item">
              <label>Limit:</label>
              <span>{formatCurrency(treaty.capacity)}</span>
            </div>
            <div className="info-item">
              <label>Retention:</label>
              <span>{formatCurrency(treaty.retention)}</span>
            </div>
            <div className="info-item">
              <label>Period:</label>
              <span>{formatAppDate(treaty.effectiveDate)} to {formatAppDate(treaty.expiryDate)}</span>
            </div>
            <div className="info-item">
              <label>Status:</label>
              <Tag value={treaty.status} severity={treaty.status === 'Active' ? 'success' : 'warning'} />
            </div>
          </div>
        </Card>

        <Card title="Capacity Utilization" className="utilization-card">
          <div className="chart-container">
            <Chart type="doughnut" data={treatyChart} options={chartOptions} style={{ width: '250px' }} />
          </div>
          <Divider />
          <div className="utilization-details">
            <div className="detail-row">
              <span>Total Capacity:</span>
              <strong>{formatCurrency(capacity?.capacity ?? treaty.capacity)}</strong>
            </div>
            <div className="detail-row">
              <span>Used Capacity:</span>
              <strong>{formatCurrency(capacity?.used ?? 0)}</strong>
            </div>
            <div className="detail-row">
              <span>Available:</span>
              <strong>{formatCurrency(capacity?.available ?? treaty.availableCapacity)}</strong>
            </div>
          </div>
        </Card>
      </div>

      <TabView>
        <TabPanel header="Cessions" leftIcon="pi pi-list">
          <DataTable
            value={cessions}
            paginator
            rows={20}
            loading={loading}
            className="cessions-table"
          >
            <Column field="cessionNumber" header="Cession No" sortable />
            <Column field="policyNumber" header="Policy" sortable />
            <Column field="insured" header="Insured" sortable />
            <Column field="sumInsured" header="Sum Insured" sortable
              body={(rowData) => formatCurrency(rowData.sumInsured)} />
            <Column field="grossPremium" header="Premium" sortable
              body={(rowData) => formatCurrency(rowData.grossPremium)} />
            <Column field="cessionPercentage" header="Ceded %" sortable
              body={(rowData) => `${rowData.cessionPercentage}%`} />
            <Column field="status" header="Status" body={statusBodyTemplate} />
            <Column header="Actions" body={actionBodyTemplate} />
          </DataTable>
        </TabPanel>

        <TabPanel header="Claims" leftIcon="pi pi-exclamation-triangle">
          <DataTable
            value={claims}
            paginator
            rows={20}
            loading={loading}
            className="claims-table"
          >
            <Column field="claimNumber" header="Claim No" sortable />
            <Column field="policyNumber" header="Policy" sortable />
            <Column body={(row) => formatAppDate(row.dateOfLoss)} field="dateOfLoss" header="Loss Date" sortable />
            <Column field="grossClaim" header="Gross Claim" sortable
              body={(rowData) => formatCurrency(rowData.grossClaim)} />
            <Column field="recoverableAmount" header="Recoverable" sortable
              body={(rowData) => formatCurrency(rowData.recoverableAmount)} />
            <Column field="status" header="Status" body={statusBodyTemplate} />
          </DataTable>
        </TabPanel>

        <TabPanel header="Documents" leftIcon="pi pi-file">
          <div className="documents-section">
            <div className="document-list">
              {documents.map((doc) => (
                <div className="document-item" key={doc.id}>
                  <i className="pi pi-file-excel"></i>
                  <span>{doc.type} Bordereau {doc.periodLabel} ({doc.reference})</span>
                  <Button
                    icon="pi pi-download"
                    className="p-button-text"
                    disabled={!doc.fileUrl}
                    onClick={() => window.open(doc.fileUrl, '_blank', 'noopener')} aria-label="Download" tooltip="Download" tooltipOptions={{ position: "top" }} />
                </div>
              ))}
            </div>
            <Button
              label="Generate Bordereau"
              icon="pi pi-file"
              className="p-button-outlined"
              onClick={() => navigate('/reinsurance/cessions')}
            />
          </div>
        </TabPanel>
      </TabView>

      <Dialog
        header="Cession Details"
        visible={showCessionDialog}
        style={{ width: '50vw' }}
        onHide={() => setShowCessionDialog(false)}
      >
        {selectedCession && (
          <div className="cession-details">
            <div className="detail-grid">
              <div className="detail-item">
                <label>Cession Number:</label>
                <span>{selectedCession.cessionNumber}</span>
              </div>
              <div className="detail-item">
                <label>Policy Number:</label>
                <span>{selectedCession.policyNumber}</span>
              </div>
              <div className="detail-item">
                <label>Insured:</label>
                <span>{selectedCession.insured}</span>
              </div>
              <div className="detail-item">
                <label>Line of Business:</label>
                <span>{selectedCession.lineOfBusiness || '-'}</span>
              </div>
              <div className="detail-item">
                <label>Sum Insured:</label>
                <span>{formatCurrency(selectedCession.sumInsured)}</span>
              </div>
              <div className="detail-item">
                <label>Premium:</label>
                <span>{formatCurrency(selectedCession.grossPremium)}</span>
              </div>
              <div className="detail-item">
                <label>Ceded Percentage:</label>
                <span>{selectedCession.cessionPercentage}%</span>
              </div>
              <div className="detail-item">
                <label>Ceded Amount:</label>
                <span>{formatCurrency(selectedCession.cededSumInsured)}</span>
              </div>
              <div className="detail-item">
                <label>Status:</label>
                <Tag value={selectedCession.status} severity={selectedCession.status === 'Confirmed' ? 'success' : 'warning'} />
              </div>
            </div>
            <Divider />
            <div className="detail-actions">
              <Button label="Generate Bordereau" className="p-button-outlined" onClick={() => navigate('/reinsurance/cessions')} />
              <Button label="Close" className="p-button-secondary" onClick={() => setShowCessionDialog(false)} />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default TreatyDetail;