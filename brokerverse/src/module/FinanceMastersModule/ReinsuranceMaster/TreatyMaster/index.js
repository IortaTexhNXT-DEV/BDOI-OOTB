import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import reinsuranceService from '../../../../services/reinsuranceService';
import mastersService from '../../../../services/mastersService';
import './style.scss';

const toIsoDate = (date) => (date instanceof Date ? date.toLocaleDateString('en-CA') : date);
const toNumberOrUndefined = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
};

/** Maps the treaty form to the /reinsurance/treaties request body. */
const toTreatyPayload = (form) => {
  const payload = {
    treatyNumber: form.treatyNumber || undefined,
    name: form.name,
    type: form.type,
    lineOfBusiness: form.lineOfBusiness,
    reinsurers: form.reinsurers,
    effectiveDate: toIsoDate(form.effectiveDate),
    expiryDate: toIsoDate(form.expiryDate),
    retention: toNumberOrUndefined(form.retention),
    cession: form.cession,
    commission: { ...form.commission, rate: toNumberOrUndefined(form.commission?.rate) },
  };
  if (form.type === 'Surplus') payload.lines = form.lines;
  if (form.type === 'Excess of Loss') {
    const limit = toNumberOrUndefined(form.limit);
    payload.capacity = limit;
    payload.layers = [{ layer: 1, limit, excess: toNumberOrUndefined(form.excess), reinstatements: form.reinstatements }];
  }
  return payload;
};

/** Treaty from the API to the form fields (XoL first layer exposed as limit / excess / reinstatements). */
const toTreatyForm = (treaty) => {
  const layer = treaty.layers?.[0] || {};
  return {
    ...treaty,
    retention: treaty.retention ?? '',
    cession: treaty.cession || {},
    commission: treaty.commission || {},
    limit: layer.limit ?? treaty.capacity,
    excess: layer.excess,
    reinstatements: layer.reinstatements,
    effectiveDate: new Date(treaty.effectiveDate),
    expiryDate: new Date(treaty.expiryDate)
  };
};

const TreatyMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dt = useRef(null);
  const [treaties, setTreaties] = useState([]);
  const [reinsurers, setReinsurers] = useState([]);
  const [lobOptions, setLobOptions] = useState([]);
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
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

  const commissionTypes = [
    { label: t('reinsuranceTreaty.flatRate'), value: 'Flat' },
    { label: t('reinsuranceTreaty.slidingScale'), value: 'Sliding Scale' },
    { label: t('reinsuranceTreaty.profitCommission'), value: 'Profit Commission' }
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [treatyData, reinsurerData, lobData] = await Promise.all([
        reinsuranceService.getTreaties(),
        reinsuranceService.getReinsurers({ status: 'Active' }),
        mastersService.options('line-of-business')
      ]);
      const lobValues = [...new Set([...lobData.map(o => o.value), ...treatyData.map(tr => tr.lineOfBusiness)])];
      setTreaties(treatyData);
      setReinsurers(reinsurerData);
      setLobOptions(lobValues.filter(Boolean).map(value => ({ label: value, value })));
    } catch (error) {
      toast.current?.show({
        severity: 'error',
        summary: t('reinsuranceTreaty.error'),
        detail: error?.message || 'Failed to load data'
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    setFormData(toTreatyForm(treaty));
    setSelectedTreaty(treaty);
    setEditMode(true);
    setShowDialog(true);
  };

  const handleSave = async () => {
    try {
      if (editMode) {
        await reinsuranceService.updateTreaty(selectedTreaty.id, toTreatyPayload(formData));
        toast.current?.show({
          severity: 'success',
          summary: t('reinsuranceTreaty.success'),
          detail: t('reinsuranceTreaty.treatyUpdated')
        });
      } else {
        await reinsuranceService.createTreaty(toTreatyPayload(formData));
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
        detail: error?.message || t('reinsuranceTreaty.failedToSave')
      });
    }
  };

  const decide = async (action, treaty, reason) => {
    try {
      if (action === 'approve') await reinsuranceService.approveTreaty(treaty.id);
      else await reinsuranceService.rejectTreaty(treaty.id, reason);
      toast.current?.show({
        severity: 'success',
        summary: t('reinsuranceTreaty.success'),
        detail: `${treaty.treatyNumber}: ${action === 'approve' ? t('common.approve', 'Approved') : t('common.reject', 'Rejected')}`
      });
      setRejecting(null);
      loadData();
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: t('reinsuranceTreaty.error'), detail: error?.message });
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
          onClick={() => navigate(`/reinsurance/treaty/${rowData.id}`)}
        />
        {rowData.status === 'Pending Approval' && (
          <>
            <Button
              icon="pi pi-check"
              className="p-button-rounded p-button-text p-button-success"
              tooltip={t('common.approve', 'Approve')}
              onClick={() => decide('approve', rowData)}
            />
            <Button
              icon="pi pi-times"
              className="p-button-rounded p-button-text p-button-danger"
              tooltip={t('common.reject', 'Reject')}
              onClick={() => {
                setRejectReason('');
                setRejecting(rowData);
              }}
            />
          </>
        )}
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
                    options={lobOptions}
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
                      label: `${r.shortName || r.name} (${r.rating})`,
                      value: r.id,
                      disabled: !r.meetsMinimumRating
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
                        commission: {...formData.commission, rate: e.value}
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
            onClick={() => dt.current?.exportCSV()}
          />
        </div>

        <DataTable
          ref={dt}
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

      <Dialog
        visible={!!rejecting}
        onHide={() => setRejecting(null)}
        header={`${t('common.reject', 'Reject')} ${rejecting?.treatyNumber || ''}`}
        style={{ width: '30rem' }}
      >
        <div className="p-fluid">
          <InputText
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('reinsurance.reason', 'Reason')}
          />
          <Button
            className="mt-3"
            label={t('common.submit')}
            icon="pi pi-check"
            disabled={!rejectReason.trim()}
            onClick={() => decide('reject', rejecting, rejectReason.trim())}
          />
        </div>
      </Dialog>
    </div>
  );
};

export default TreatyMaster;