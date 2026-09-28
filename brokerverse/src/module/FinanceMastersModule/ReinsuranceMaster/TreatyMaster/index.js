import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { InputNumber } from 'primereact/inputnumber';
import { Toast } from 'primereact/toast';
import { TabView, TabPanel } from 'primereact/tabview';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { MultiSelect } from 'primereact/multiselect';
import reinsuranceMockService from '../../../../services/mockData/reinsuranceMockData';
import './style.scss';

const TreatyMaster = () => {
  const { t } = useTranslation();
  const [treaties, setTreaties] = useState([]);
  const [reinsurers, setReinsurers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedTreaty, setSelectedTreaty] = useState(null);
  const [formData, setFormData] = useState({
    treatyNumber: '',
    name: '',
    type: null,
    lineOfBusiness: '',
    reinsurers: [],
    effectiveDate: null,
    expiryDate: null,
    retention: '',
    cession: {},
    commission: {}
  });
  const toast = useRef(null);

  const treatyTypes = [
    { label: t('reinsuranceTreaty.quotaShare'), value: 'Quota Share' },
    { label: t('reinsuranceTreaty.surplus'), value: 'Surplus' },
    { label: t('reinsuranceTreaty.excessOfLoss'), value: 'Excess of Loss' },
    { label: t('reinsuranceTreaty.stopLoss'), value: 'Stop Loss' },
    { label: t('reinsuranceTreaty.nrcpMandatory'), value: 'NRCP Mandatory' }
  ];

  const linesOfBusiness = [
    { label: t('reinsuranceTreaty.motor'), value: 'Motor' },
    { label: t('reinsuranceTreaty.fire'), value: 'Fire' },
    { label: t('reinsuranceTreaty.property'), value: 'Property' },
    { label: t('reinsuranceTreaty.marine'), value: 'Marine' },
    { label: t('reinsuranceTreaty.personalAccident'), value: 'Personal Accident' },
    { label: t('reinsuranceTreaty.health'), value: 'Health' },
    { label: t('reinsuranceTreaty.engineering'), value: 'Engineering' },
    { label: t('reinsuranceTreaty.catastrophe'), value: 'Catastrophe' },
    { label: t('reinsuranceTreaty.allLines'), value: 'All Lines' }
  ];

  const commissionTypes = [
    { label: t('reinsuranceTreaty.flatRate'), value: 'Flat' },
    { label: t('reinsuranceTreaty.slidingScale'), value: 'Sliding Scale' },
    { label: t('reinsuranceTreaty.profitCommission'), value: 'Profit Commission' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [treatyData, reinsurerData] = await Promise.all([
        reinsuranceMockService.getTreaties(),
        reinsuranceMockService.getReinsurers()
      ]);
      setTreaties(treatyData);
      setReinsurers(reinsurerData);
    } catch (error) {
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load data'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({
      treatyNumber: '',
      name: '',
      type: null,
      lineOfBusiness: '',
      reinsurers: [],
      effectiveDate: null,
      expiryDate: null,
      retention: '',
      cession: {},
      commission: { type: 'Flat', rate: '' }
    });
    setEditMode(false);
    setShowDialog(true);
  };

  const handleEdit = (treaty) => {
    setFormData({
      ...treaty,
      effectiveDate: new Date(treaty.effectiveDate),
      expiryDate: new Date(treaty.expiryDate)
    });
    setSelectedTreaty(treaty);
    setEditMode(true);
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      if (editMode) {
        await reinsuranceMockService.updateTreaty(selectedTreaty.id, formData);
        toast.current?.show({
          severity: 'success',
          summary: t('reinsuranceTreaty.success'),
          detail: t('reinsuranceTreaty.treatyUpdated')
        });
      } else {
        await reinsuranceMockService.addTreaty(formData);
        toast.current?.show({
          severity: 'success',
          summary: t('reinsuranceTreaty.success'),
          detail: t('reinsuranceTreaty.treatyCreated')
        });
      }
      setShowDialog(false);
      loadData();
    } catch (error) {
      toast.current?.show({
        severity: 'error',
        summary: t('reinsuranceTreaty.error'),
        detail: t('reinsuranceTreaty.failedToSave')
      });
    }
  };

  const statusBodyTemplate = (rowData) => {
    const severity = rowData.status === 'Active' ? 'success' : 'warning';
    return <Tag value={rowData.status} severity={severity} />;
  };

  const utilizationBodyTemplate = (rowData) => {
    const color = rowData.utilization > 80 ? '#f44336' :
                  rowData.utilization > 60 ? '#ff9800' : '#4caf50';
    return (
      <div className="utilization-cell">
        <ProgressBar
          value={rowData.utilization}
          color={color}
          showValue={false}
          style={{ height: '6px' }}
        />
        <span className="utilization-text">{rowData.utilization}%</span>
      </div>
    );
  };

  const reinsurersBodyTemplate = (rowData) => {
    const reinsurerNames = rowData.reinsurers?.map(id => {
      const reinsurer = reinsurers.find(r => r.id === id);
      return reinsurer?.shortName || id;
    }).join(', ');
    return <span>{reinsurerNames}</span>;
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-pencil"
          className="p-button-rounded p-button-text p-button-primary"
          onClick={() => handleEdit(rowData)}
          tooltip={t('reinsuranceTreaty.editTreaty')}
        />
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip={t('reinsuranceTreaty.viewDetails')}
        />
      </div>
    );
  };

  const dialogFooter = (
    <div className="dialog-footer">
      <Button
        label={t('reinsuranceTreaty.cancel')}
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setShowDialog(false)}
      />
      <Button
        label={t('reinsuranceTreaty.save')}
        icon="pi pi-check"
        className="p-button-primary"
        onClick={handleSave}
      />
    </div>
  );

  const renderTreatyForm = () => {
    return (
      <div className="treaty-form">
        <TabView>
          <TabPanel header={t('reinsuranceTreaty.basicInfo')}>
            <div className="p-fluid">
              <div className="p-field p-grid">
                <label className="p-col-12 p-md-3">{t('reinsuranceTreaty.treatyNumber')}*</label>
                <div className="p-col-12 p-md-9">
                  <InputText
                    value={formData.treatyNumber}
                    onChange={(e) => setFormData({...formData, treatyNumber: e.target.value})}
                    placeholder={t('reinsuranceTreaty.placeholderTreatyNumber')}
                  />
                </div>
              </div>

              <div className="p-field p-grid">
                <label className="p-col-12 p-md-3">{t('reinsuranceTreaty.treatyName')}*</label>
                <div className="p-col-12 p-md-9">
                  <InputText
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder={t('reinsuranceTreaty.placeholderTreatyName')}
                  />
                </div>
              </div>

              <div className="p-field p-grid">
                <label className="p-col-12 p-md-3">{t('reinsuranceTreaty.treatyType')}*</label>
                <div className="p-col-12 p-md-9">
                  <Dropdown
                    value={formData.type}
                    options={treatyTypes}
                    onChange={(e) => setFormData({...formData, type: e.value})}
                    placeholder={t('reinsuranceTreaty.selectTreatyType')}
                  />
                </div>
              </div>

              <div className="p-field p-grid">
                <label className="p-col-12 p-md-3">{t('reinsuranceTreaty.lineOfBusiness')}*</label>
                <div className="p-col-12 p-md-9">
                  <Dropdown
                    value={formData.lineOfBusiness}
                    options={linesOfBusiness}
                    onChange={(e) => setFormData({...formData, lineOfBusiness: e.value})}
                    placeholder={t('reinsuranceTreaty.selectLineOfBusiness')}
                  />
                </div>
              </div>

              <div className="p-field p-grid">
                <label className="p-col-12 p-md-3">{t('reinsuranceTreaty.reinsurers')}*</label>
                <div className="p-col-12 p-md-9">
                  <MultiSelect
                    value={formData.reinsurers}
                    options={reinsurers.map(r => ({
                      label: `${r.shortName} (${r.rating})`,
                      value: r.id
                    }))}
                    onChange={(e) => setFormData({...formData, reinsurers: e.value})}
                    placeholder={t('reinsuranceTreaty.selectReinsurers')}
                    display="chip"
                  />
                </div>
              </div>

              <div className="p-field p-grid">
                <label className="p-col-12 p-md-3">{t('reinsuranceTreaty.effectiveDate')}*</label>
                <div className="p-col-12 p-md-9">
                  <Calendar
                    value={formData.effectiveDate}
                    onChange={(e) => setFormData({...formData, effectiveDate: e.value})}
                    dateFormat="dd/mm/yy"
                    placeholder={t('reinsuranceTreaty.selectEffectiveDate')}
                  />
                </div>
              </div>

              <div className="p-field p-grid">
                <label className="p-col-12 p-md-3">{t('reinsuranceTreaty.expiryDate')}*</label>
                <div className="p-col-12 p-md-9">
                  <Calendar
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({...formData, expiryDate: e.value})}
                    dateFormat="dd/mm/yy"
                    placeholder={t('reinsuranceTreaty.selectExpiryDate')}
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header={t('reinsuranceTreaty.coverageLimits')}>
            <div className="p-fluid">
              {formData.type === 'Quota Share' && (
                <>
                  <div className="p-field p-grid">
                    <label className="p-col-12 p-md-3">{t('reinsuranceTreaty.cession')}</label>
                    <div className="p-col-12 p-md-9">
                      <InputNumber
                        value={formData.cession?.percentage}
                        onValueChange={(e) => setFormData({
                          ...formData,
                          cession: {...formData.cession, percentage: e.value}
                        })}
                        suffix="%"
                        min={0}
                        max={100}
                      />
                    </div>
                  </div>
<div className="p-field p-grid">
                    <label className="p-col-12 p-md-3">{t('reinsuranceTreaty.retention')}</label>
                    <div className="p-col-12 p-md-9">
                    <InputText
                        value={formData.retention}
                        onChange={(e) => setFormData({...formData, retention: e.target.value})}
                        placeholder={t('reinsuranceTreaty.enterRetention')}
                      />
                    </div>
                  </div>
                </>
              )}

              {formData.type === 'Surplus' && (
                <>
                  <div className="p-field p-grid">
                    <label className="p-col-12 p-md-3">{t('reinsuranceTreaty.numberOfLines')}</label>
                    <div className="p-col-12 p-md-9">
                      <InputNumber
                        value={formData.lines}
                        onValueChange={(e) => setFormData({...formData, lines: e.value})}
                        min={1}
                        max={20}
                      />
                    </div>
                  </div>
                  <div className="p-field p-grid">
                    <label className="p-col-12 p-md-3">{t('reinsuranceTreaty.retentionPerLine')}</label>
                    <div className="p-col-12 p-md-9">
                      <InputText
                        value={formData.retention}
                        onChange={(e) => setFormData({...formData, retention: e.target.value})}
                        placeholder={t('reinsuranceTreaty.enterRetention')}
                      />
                    </div>
                  </div>
                </>
              )}

              {formData.type === 'Excess of Loss' && (
                <>
                  <div className="p-field p-grid">
                    <label className="p-col-12 p-md-3">{t('reinsuranceTreaty.layerLimit')}</label>
                    <div className="p-col-12 p-md-9">
                      <InputText
                        value={formData.limit}
                        onChange={(e) => setFormData({...formData, limit: e.target.value})}
                        placeholder="Enter layer limit"
                      />
                    </div>
                  </div>
                  <div className="p-field p-grid">
                    <label className="p-col-12 p-md-3">Excess Point (THB)</label>
                    <div className="p-col-12 p-md-9">
                      <InputText
                        value={formData.excess}
                        onChange={(e) => setFormData({...formData, excess: e.target.value})}
                        placeholder="Enter excess point"
                      />
                    </div>
                  </div>
                  <div className="p-field p-grid">
                    <label className="p-col-12 p-md-3">Reinstatements</label>
                    <div className="p-col-12 p-md-9">
                      <InputNumber
                        value={formData.reinstatements}
                        onValueChange={(e) => setFormData({...formData, reinstatements: e.value})}
                        min={0}
                        max={5}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabPanel>

          <TabPanel header="Commission">
            <div className="p-fluid">
              <div className="p-field p-grid">
                <label className="p-col-12 p-md-3">Commission Type</label>
                <div className="p-col-12 p-md-9">
                  <Dropdown
                    value={formData.commission?.type}
                    options={commissionTypes}
                    onChange={(e) => setFormData({
                      ...formData,
                      commission: {...formData.commission, type: e.value}
                    })}
                    placeholder="Select commission type"
                  />
                </div>
              </div>

              {formData.commission?.type === 'Flat' && (
                <div className="p-field p-grid">
                  <label className="p-col-12 p-md-3">Commission Rate</label>
                  <div className="p-col-12 p-md-9">
                    <InputNumber
                      value={parseFloat(formData.commission?.rate) || 0}
                      onValueChange={(e) => setFormData({
                        ...formData,
                        commission: {...formData.commission, rate: e.value + '%'}
                      })}
                      suffix="%"
                      min={0}
                      max={50}
                      minFractionDigits={1}
                      maxFractionDigits={2}
                    />
                  </div>
                </div>
              )}

              {formData.commission?.type === 'Sliding Scale' && (
                <div className="sliding-scale-section">
                  <h4>Loss Ratio Bands</h4>
                  <div className="p-field p-grid">
                    <label className="p-col-12 p-md-3">0-50%</label>
                    <div className="p-col-12 p-md-9">
                      <InputNumber
                        value={35}
                        suffix="%"
                        disabled
                      />
                    </div>
                  </div>
                  <div className="p-field p-grid">
                    <label className="p-col-12 p-md-3">50-60%</label>
                    <div className="p-col-12 p-md-9">
                      <InputNumber
                        value={32.5}
                        suffix="%"
                        disabled
                      />
                    </div>
                  </div>
                  <div className="p-field p-grid">
                    <label className="p-col-12 p-md-3">60-70%</label>
                    <div className="p-col-12 p-md-9">
                      <InputNumber
                        value={30}
                        suffix="%"
                        disabled
                      />
                    </div>
                  </div>
                  <div className="p-field p-grid">
                    <label className="p-col-12 p-md-3">70%+</label>
                    <div className="p-col-12 p-md-9">
                      <InputNumber
                        value={27.5}
                        suffix="%"
                        disabled
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabPanel>
        </TabView>
      </div>
    );
  };

  return (
    <div className="treaty-master">
      <Toast ref={toast} />

      <Card title={t('reinsuranceTreaty.pageTitle')}>
        <div className="header-actions">
          <Button
            label={t('reinsuranceTreaty.addTreaty')}
            icon="pi pi-plus"
            className="p-button-primary"
            onClick={handleAdd}
          />
          <Button
            label="Export"
            icon="pi pi-download"
            className="p-button-secondary p-ml-2"
          />
        </div>

        <DataTable
          value={treaties}
          loading={loading}
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25]}
          className="treaty-table"
          emptyMessage={t('reinsuranceTreaty.noTreatiesFound')}
          responsiveLayout="scroll"
        >
          <Column field="treatyNumber" header={t('reinsuranceTreaty.treatyNumber')} sortable />
          <Column field="name" header={t('reinsuranceTreaty.treatyName')} sortable />
          <Column field="type" header={t('reinsuranceTreaty.treatyType')} sortable />
          <Column field="lineOfBusiness" header={t('reinsuranceTreaty.lineOfBusiness')} sortable />
          <Column header={t('reinsuranceTreaty.reinsurers')} body={reinsurersBodyTemplate} />
          <Column field="effectiveDate" header={t('reinsuranceTreaty.effectiveDate')} sortable />
          <Column field="expiryDate" header={t('reinsuranceTreaty.expiryDate')} sortable />
          <Column header={t('reinsuranceTreaty.utilization')} body={utilizationBodyTemplate} sortable />
          <Column header={t('reinsuranceTreaty.status')} body={statusBodyTemplate} sortable />
          <Column header={t('reinsuranceTreaty.actions')} body={actionBodyTemplate} />
        </DataTable>
      </Card>

      <Dialog
        visible={showDialog}
        onHide={() => setShowDialog(false)}
        header={editMode ? t('reinsuranceTreaty.editTreaty') : t('reinsuranceTreaty.addTreaty')}
        modal
        className="treaty-dialog"
        style={{ width: '70vw' }}
        footer={dialogFooter}
      >
        {renderTreatyForm()}
      </Dialog>
    </div>
  );
};

export default TreatyMaster;