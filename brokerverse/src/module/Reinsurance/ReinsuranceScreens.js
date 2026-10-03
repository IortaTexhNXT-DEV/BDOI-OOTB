// Consolidated Reinsurance Screens: cessions, recoveries, reports, reconciliation and analytics.

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatCurrency } from '../../hooks/useFormatCurrency';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { Chart } from 'primereact/chart';
import { Tag } from 'primereact/tag';
import { Toast } from 'primereact/toast';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'primereact/calendar';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { InputTextarea } from 'primereact/inputtextarea';
import { Knob } from 'primereact/knob';
import { Accordion, AccordionTab } from 'primereact/accordion';
import reinsuranceService from '../../services/reinsuranceService';
import { calendarDateFormat, formatDate as formatAppDate, toIsoDate as isoDate } from "../../utility/dateFormat";
import { formatWithUnit } from "../../utility/numberFormat";

const sum = (rows, field) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
const orDash = (value) => (value === undefined || value === null || value === '' ? '-' : value);
const toIsoDate = (date) => (date instanceof Date ? isoDate(date) : date);

/** Last `count` calendar months as { label, value: 'YYYY-MM' }, newest first. */
const recentPeriods = (count = 6) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), value };
  });
};

const openFile = (url) => {
  if (url) window.open(url, '_blank', 'noopener');
};

/** Small dialog that asks for one line of text (reject reason, resolution, ...). */
const TextPromptDialog = ({ visible, header, label, onHide, onSubmit }) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');

  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  return (
    <Dialog header={header} visible={visible} onHide={onHide} style={{ width: '30rem' }}>
      <div className="p-fluid">
        <div className="field">
          <label>{label}</label>
          <InputTextarea value={text} rows={3} onChange={(e) => setText(e.target.value)} />
        </div>
        <Button label={t('common.submit')} icon="pi pi-check" disabled={!text.trim()} onClick={() => onSubmit(text.trim())} />
      </div>
    </Dialog>
  );
};

const useToastError = (toast, t) => (error, fallbackKey) => {
  toast.current?.show({ severity: 'error', summary: t('reinsurance.error'), detail: error?.message || t(fallbackKey) });
};

// P3: Cession Dashboard Component
export const CessionDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [cessions, setCessions] = useState([]);
  const [treaties, setTreaties] = useState([]);
  const [reinsurers, setReinsurers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBordereau, setShowBordereau] = useState(false);
  const [bordereau, setBordereau] = useState({ period: null, type: 'Premium', treatyId: null });
  const [showCessionDetails, setShowCessionDetails] = useState(false);
  const [showProcessCession, setShowProcessCession] = useState(false);
  const [newCession, setNewCession] = useState({ type: 'Treaty' });
  const [rejecting, setRejecting] = useState(null);
  const [selectedCession, setSelectedCession] = useState(null);
  const [selectedLOB, setSelectedLOB] = useState('all');
  const toast = useRef(null);
  const showError = useToastError(toast, t);

  useEffect(() => {
    loadCessions();
    loadReferenceData();
  }, []);

  const loadCessions = async () => {
    setLoading(true);
    try {
      setCessions(await reinsuranceService.getCessions());
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: t('common.error'), detail: t('reinsurance.failedToLoadCessions') });
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const [treatyData, reinsurerData] = await Promise.all([
        reinsuranceService.getTreaties({ status: 'Active' }),
        reinsuranceService.getReinsurers({ status: 'Active' }),
      ]);
      setTreaties(treatyData);
      setReinsurers(reinsurerData.filter((r) => r.meetsMinimumRating));
    } catch (error) {
      showError(error, 'reinsurance.failedToLoadTreatyData');
    }
  };

  const runAction = async (action, successDetail) => {
    try {
      await action();
      toast.current?.show({ severity: 'success', summary: t('common.success'), detail: successDetail });
      loadCessions();
      return true;
    } catch (error) {
      showError(error, 'reinsurance.failedToLoadCessions');
      return false;
    }
  };

  const statusBodyTemplate = (rowData) => {
    const severity = rowData.status === 'Confirmed' ? 'success' :
                    rowData.status === 'Pending' ? 'warning' : 'danger';
    return <Tag value={rowData.status} severity={severity} />;
  };

  const openBordereauFor = (cession) => {
    setBordereau({ period: cession?.cessionDate?.slice(0, 7) || null, type: 'Premium', treatyId: cession?.treatyId || null });
    setShowBordereau(true);
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <div className="flex gap-2">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip={t('reinsurance.viewDetails')}
          onClick={() => viewCessionDetails(rowData)} aria-label={t('reinsurance.viewDetails')}
        />
        {rowData.status === 'Pending' && (
          <>
            <Button
              icon="pi pi-check"
              className="p-button-rounded p-button-text p-button-success"
              tooltip={t('common.confirm')}
              onClick={() => runAction(() => reinsuranceService.confirmCession(rowData.id), t('reinsurance.cessionConfirmed', 'Cession confirmed'))} aria-label={t('common.confirm')}
            />
            <Button
              icon="pi pi-times"
              className="p-button-rounded p-button-text p-button-danger"
              tooltip={t('common.reject', 'Reject')}
              onClick={() => setRejecting(rowData)} aria-label={t('common.reject', 'Reject')}
            />
          </>
        )}
        <Button
          icon="pi pi-file-pdf"
          className="p-button-rounded p-button-text"
          tooltip={t('reinsurance.generateReport')}
          onClick={() => openBordereauFor(rowData)} aria-label={t('reinsurance.generateReport')}
        />
      </div>
    );
  };

  const viewCessionDetails = (cession) => {
    setSelectedCession(cession);
    setShowCessionDetails(true);
  };

  const generateBordereau = async () => {
    try {
      const result = await reinsuranceService.generateBordereau(bordereau);
      toast.current?.show({ severity: 'success', summary: t('common.success'), detail: t('reinsurance.bordereauGeneratedSuccess') });
      setShowBordereau(false);
      openFile(result?.fileUrl);
    } catch (error) {
      showError(error, 'reinsurance.failedToLoadCessions');
    }
  };

  const processCession = async () => {
    const { type, policyNumber, treatyId, facultativeReinsurer, cessionPercentage, commissionRate, notes } = newCession;
    const payload = type === 'Treaty'
      ? { type, policyNumber, treatyId, notes }
      : { type, policyNumber, facultativeReinsurer, cessionPercentage, commissionRate, notes };
    const done = await runAction(() => reinsuranceService.createCession(payload), t('reinsurance.cessionProcessed', 'Cession processed'));
    if (done) setShowProcessCession(false);
  };

  const rejectCession = async (reason) => {
    const done = await runAction(() => reinsuranceService.rejectCession(rejecting.id, reason), t('reinsurance.cessionRejected', 'Cession rejected'));
    if (done) setRejecting(null);
  };

  const filteredCessions = selectedLOB === 'all'
    ? cessions
    : cessions.filter(c => c.lineOfBusiness === selectedLOB);

  const linesOfBusiness = [...new Set(cessions.map(c => c.lineOfBusiness).filter(Boolean))];
  const lobOptions = [
    { label: 'All Lines', value: 'all' },
    ...linesOfBusiness.map(lob => ({ label: lob, value: lob }))
  ];
  const treatyOptions = treaties.map(tr => ({ label: tr.treatyNumber, value: tr.id }));
  const commissionRate = (cession) => (cession.cededPremium ? ((cession.commission / cession.cededPremium) * 100).toFixed(2) : '-');
  const money = (value) => (value === undefined || value === null ? '-' : formatCurrency(value));

  return (
    <div className="cession-dashboard p-3">
      <Toast ref={toast} />
      <Card title={t('reinsurance.cessionTrackingDashboard')}>
        <div className="mb-3 flex justify-content-between">
          <div className="flex align-items-center gap-3">
            <h3>{t('reinsurance.policyCessionsManagement')}</h3>
            <Dropdown
              value={selectedLOB}
              options={lobOptions}
              onChange={(e) => setSelectedLOB(e.value)}
              placeholder={t('reinsurance.filterByLOB')}
            />
          </div>
          <div className="flex gap-2">
            <Button
              label={t('reinsurance.processCession')}
              icon="pi pi-plus"
              onClick={() => {
                setNewCession({ type: 'Treaty' });
                setShowProcessCession(true);
              }}
            />
            <Button label={t('reinsurance.generateBordereau')} icon="pi pi-file" className="p-button-secondary" onClick={() => openBordereauFor(null)} />
          </div>
        </div>

        <TabView>
          <TabPanel header="Summary Statistics">
            <div className="grid mb-3">
              <div className="col-3">
                <Card>
                  <h4 className="m-0">Total Cessions</h4>
                  <p className="text-3xl font-bold">{filteredCessions.length}</p>
                </Card>
              </div>
              <div className="col-3">
                <Card>
                  <h4 className="m-0">Pending Confirmation</h4>
                  <p className="text-3xl font-bold text-orange-500">
                    {filteredCessions.filter(c => c.status === 'Pending').length}
                  </p>
                </Card>
              </div>
              <div className="col-3">
                <Card>
                  <h4 className="m-0">Total Ceded Premium</h4>
                  <p className="text-3xl font-bold">{formatCurrency(sum(filteredCessions, 'cededPremium'))}</p>
                </Card>
              </div>
              <div className="col-3">
                <Card>
                  <h4 className="m-0">Commission Earned</h4>
                  <p className="text-3xl font-bold text-green-500">{formatCurrency(sum(filteredCessions, 'commission'))}</p>
                </Card>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Line of Business Breakdown">
            <div className="grid">
              {linesOfBusiness.map((lob) => {
                const lobCessions = cessions.filter(c => c.lineOfBusiness === lob);
                return (
                  <div className="col-4" key={lob}>
                    <Card title={`${lob} Cessions`}>
                      <div className="flex justify-content-between mb-2">
                        <span>Active Cessions:</span>
                        <strong>{lobCessions.length}</strong>
                      </div>
                      <div className="flex justify-content-between mb-2">
                        <span>Total Premium:</span>
                        <strong>{formatCurrency(sum(lobCessions, 'cededPremium'))}</strong>
                      </div>
                      <div className="flex justify-content-between">
                        <span>Commission:</span>
                        <strong>{formatCurrency(sum(lobCessions, 'commission'))}</strong>
                      </div>
                      <Button label="View Details" className="p-button-text mt-3"
                        onClick={() => setSelectedLOB(lob)} />
                    </Card>
                  </div>
                );
              })}
            </div>
          </TabPanel>
        </TabView>

        <DataTable value={filteredCessions} loading={loading} paginator rows={20} className="mt-3">
          <Column field="policyNumber" header="Policy Number" sortable />
          <Column field="insured" header="Insured" sortable />
          <Column field="lineOfBusiness" header="Line of Business" sortable />
          <Column header="Treaty" sortable sortField="treatyNumber"
            body={(rowData) => rowData.treatyNumber || rowData.facultativeReinsurerName || rowData.type} />
          <Column field="cessionPercentage" header="Cession %" sortable />
          <Column field="cededPremium" header="Ceded Premium" sortable body={(rowData) => formatCurrency(rowData.cededPremium)} />
          <Column field="commission" header="Commission" sortable body={(rowData) => formatCurrency(rowData.commission)} />
          <Column header="Status" body={statusBodyTemplate} sortable sortField="status" />
          <Column body={(row) => formatAppDate(row.cessionDate)} field="cessionDate" header="Cession Date" sortable />
          <Column header="Actions" body={actionBodyTemplate} />
        </DataTable>
      </Card>

      <Dialog header="Generate Bordereau" visible={showBordereau} onHide={() => setShowBordereau(false)} style={{ width: '50vw' }}>
        <div className="p-fluid">
          <div className="field">
            <label>Period</label>
            <Dropdown value={bordereau.period} options={recentPeriods()} placeholder="Select Period"
              onChange={(e) => setBordereau({ ...bordereau, period: e.value })} />
          </div>
          <div className="field">
            <label>Type</label>
            <Dropdown value={bordereau.type} options={[
              { label: 'Premium Bordereau', value: 'Premium' },
              { label: 'Claims Bordereau', value: 'Claims' }
            ]} placeholder="Select Type" onChange={(e) => setBordereau({ ...bordereau, type: e.value })} />
          </div>
          <div className="field">
            <label>Treaty</label>
            <Dropdown value={bordereau.treatyId} options={[{ label: 'All Treaties', value: null }, ...treatyOptions]}
              placeholder="Select Treaty" onChange={(e) => setBordereau({ ...bordereau, treatyId: e.value })} />
          </div>
          <Button label="Generate" icon="pi pi-download" onClick={generateBordereau} disabled={!bordereau.period} className="mt-3" />
        </div>
      </Dialog>

      <Dialog header={t('reinsurance.processCession')} visible={showProcessCession} onHide={() => setShowProcessCession(false)} style={{ width: '40vw' }}>
        <div className="p-fluid">
          <div className="field">
            <label>{t('reinsurance.policyNumber')}</label>
            <InputText value={newCession.policyNumber || ''} onChange={(e) => setNewCession({ ...newCession, policyNumber: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('reinsurance.type')}</label>
            <Dropdown value={newCession.type} options={[
              { label: t('reinsurance.treaty', 'Treaty'), value: 'Treaty' },
              { label: t('reinsurance.facultative', 'Facultative'), value: 'Facultative' }
            ]} onChange={(e) => setNewCession({ ...newCession, type: e.value })} />
          </div>
          {newCession.type === 'Treaty' ? (
            <div className="field">
              <label>{t('reinsurance.treatyNumber')}</label>
              <Dropdown value={newCession.treatyId} options={treatyOptions} placeholder="Select Treaty"
                onChange={(e) => setNewCession({ ...newCession, treatyId: e.value })} />
            </div>
          ) : (
            <>
              <div className="field">
                <label>{t('reinsurance.reinsurer')}</label>
                <Dropdown value={newCession.facultativeReinsurer} placeholder={t('reinsurance.reinsurer')}
                  options={reinsurers.map(r => ({ label: `${r.shortName || r.name} (${r.rating})`, value: r.id }))}
                  onChange={(e) => setNewCession({ ...newCession, facultativeReinsurer: e.value })} />
              </div>
              <div className="field">
                <label>Cession %</label>
                <InputNumber value={newCession.cessionPercentage} min={0} max={100} suffix="%"
                  onValueChange={(e) => setNewCession({ ...newCession, cessionPercentage: e.value })} />
              </div>
              <div className="field">
                <label>Commission Rate</label>
                <InputNumber value={newCession.commissionRate} min={0} max={100} suffix="%" maxFractionDigits={2}
                  onValueChange={(e) => setNewCession({ ...newCession, commissionRate: e.value })} />
              </div>
            </>
          )}
          <div className="field">
            <label>{t('reinsurance.description')}</label>
            <InputTextarea value={newCession.notes || ''} rows={2} onChange={(e) => setNewCession({ ...newCession, notes: e.target.value })} />
          </div>
          <Button label={t('reinsurance.processCession')} icon="pi pi-check" onClick={processCession}
            disabled={!newCession.policyNumber || (newCession.type === 'Treaty' ? !newCession.treatyId : !newCession.facultativeReinsurer)} />
        </div>
      </Dialog>

      <TextPromptDialog
        visible={!!rejecting}
        header={t('reinsurance.rejectCession', 'Reject Cession')}
        label={t('reinsurance.reason', 'Reason')}
        onHide={() => setRejecting(null)}
        onSubmit={rejectCession}
      />

      <Dialog header="Cession Transaction Details" visible={showCessionDetails}
        onHide={() => setShowCessionDetails(false)} style={{ width: '60vw' }}>
        {selectedCession && (
          <div className="cession-detail-view">
            <Accordion multiple activeIndex={[0]}>
              <AccordionTab header="Policy Information">
                <div className="grid">
                  <div className="col-6">
                    <div className="field">
                      <label>Policy Number:</label>
                      <p>{selectedCession.policyNumber}</p>
                    </div>
                    <div className="field">
                      <label>Insured:</label>
                      <p>{selectedCession.insured}</p>
                    </div>
                    <div className="field">
                      <label>Line of Business:</label>
                      <p><Tag value={selectedCession.lineOfBusiness} /></p>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="field">
                      <label>Cession Date:</label>
                      <p>{orDash(selectedCession.cessionDate)}</p>
                    </div>
                    <div className="field">
                      <label>Sum Insured:</label>
                      <p>{formatCurrency(selectedCession.sumInsured)}</p>
                    </div>
                    <div className="field">
                      <label>Gross Premium:</label>
                      <p>{formatCurrency(selectedCession.grossPremium)}</p>
                    </div>
                  </div>
                </div>
              </AccordionTab>

              <AccordionTab header="Cession Details">
                <div className="grid">
                  <div className="col-6">
                    <div className="field">
                      <label>Treaty:</label>
                      <p>{selectedCession.treatyNumber || selectedCession.facultativeReinsurerName || selectedCession.type}</p>
                    </div>
                    <div className="field">
                      <label>Cession Percentage:</label>
                      <p>{selectedCession.cessionPercentage}%</p>
                    </div>
                    <div className="field">
                      <label>Ceded Premium:</label>
                      <p>{formatCurrency(selectedCession.cededPremium)}</p>
                    </div>
                    <div className="field">
                      <label>Ceded Sum Insured:</label>
                      <p>{money(selectedCession.cededSumInsured)}</p>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="field">
                      <label>Commission Rate:</label>
                      <p>{commissionRate(selectedCession)}%</p>
                    </div>
                    <div className="field">
                      <label>Commission Amount:</label>
                      <p>{formatCurrency(selectedCession.commission)}</p>
                    </div>
                    <div className="field">
                      <label>Net Premium:</label>
                      <p>{money(selectedCession.netPremium)}</p>
                    </div>
                    <div className="field">
                      <label>Status:</label>
                      <p>{statusBodyTemplate(selectedCession)}</p>
                    </div>
                  </div>
                </div>
              </AccordionTab>

              {selectedCession.notes && (
                <AccordionTab header={t('reinsurance.description')}>
                  <p>{selectedCession.notes}</p>
                </AccordionTab>
              )}
            </Accordion>

            <div className="flex justify-content-end gap-2 mt-3">
              <Button label="Generate Report" icon="pi pi-file-pdf" className="p-button-secondary"
                onClick={() => {
                  setShowCessionDetails(false);
                  openBordereauFor(selectedCession);
                }} />
              <Button label="Close" icon="pi pi-times" onClick={() => setShowCessionDetails(false)} />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

// P5: Recovery Dashboard Component
export const RecoveryDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [claims, setClaims] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [newRecovery, setNewRecovery] = useState({});
  const [settling, setSettling] = useState(null);
  const [settlement, setSettlement] = useState({});
  const [disputing, setDisputing] = useState(null);
  const toast = useRef(null);
  const showError = useToastError(toast, t);

  useEffect(() => {
    loadClaims();
  }, []);

  const loadClaims = async () => {
    setLoading(true);
    try {
      const [data, analytics] = await Promise.all([
        reinsuranceService.getRecoveries(),
        reinsuranceService.getAnalytics(),
      ]);
      setClaims(data);
      setPerformance(analytics?.recoveryPerformance || null);
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: t('reinsurance.error'), detail: t('reinsurance.failedToLoadClaims') });
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (action, successDetail) => {
    try {
      await action();
      toast.current?.show({ severity: 'success', summary: t('common.success'), detail: successDetail });
      loadClaims();
      return true;
    } catch (error) {
      showError(error, 'reinsurance.failedToLoadClaims');
      return false;
    }
  };

  const statusBodyTemplate = (rowData) => {
    const severity = rowData.status === 'Recovered' ? 'success' :
                    rowData.status === 'Processing' ? 'info' :
                    rowData.status === 'Pending' ? 'warning' : 'danger';
    return <Tag value={rowData.status} severity={severity} />;
  };

  const actionBodyTemplate = (rowData) => (
    <div className="flex gap-2">
      {['Pending', 'Disputed'].includes(rowData.status) && (
        <Button icon="pi pi-send" className="p-button-rounded p-button-text" tooltip={t('reinsurance.submitRecovery', 'Submit to reinsurers')}
          onClick={() => runAction(() => reinsuranceService.submitRecovery(rowData.id), t('reinsurance.recoverySubmitted', 'Recovery submitted'))} aria-label={t('reinsurance.submitRecovery', 'Submit to reinsurers')}
          />
      )}
      {rowData.status === 'Processing' && (
        <Button icon="pi pi-wallet" className="p-button-rounded p-button-text p-button-success" tooltip={t('reinsurance.settle', 'Record settlement')}
          onClick={() => {
            setSettlement({ settlementAmount: rowData.recoverableAmount, recoveryDate: new Date() });
            setSettling(rowData);
          }} aria-label={t('reinsurance.settle', 'Record settlement')}
          />
      )}
      {['Pending', 'Processing'].includes(rowData.status) && (
        <Button icon="pi pi-flag" className="p-button-rounded p-button-text p-button-danger" tooltip={t('reinsurance.dispute', 'Mark as disputed')}
          onClick={() => setDisputing(rowData)} aria-label={t('reinsurance.dispute', 'Mark as disputed')}
          />
      )}
    </div>
  );

  const registerRecovery = async () => {
    const done = await runAction(() => reinsuranceService.createRecovery(newRecovery), t('reinsurance.recoveryRegistered', 'Recovery registered'));
    if (done) setShowRegister(false);
  };

  const settleRecovery = async () => {
    const payload = { settlementAmount: settlement.settlementAmount, recoveryDate: toIsoDate(settlement.recoveryDate) };
    const done = await runAction(() => reinsuranceService.settleRecovery(settling.id, payload), t('reinsurance.recoverySettled', 'Settlement recorded'));
    if (done) setSettling(null);
  };

  const disputeRecovery = async (reason) => {
    const done = await runAction(() => reinsuranceService.disputeRecovery(disputing.id, reason), t('reinsurance.recoveryDisputed', 'Recovery marked as disputed'));
    if (done) setDisputing(null);
  };

  const amount = (field) => (rowData) => formatCurrency(rowData[field]);

  return (
    <div className="recovery-dashboard p-3">
      <Toast ref={toast} />
      <Card title={t('reinsurance.claimsRecovery')}>
        <div className="flex justify-content-end mb-3">
          <Button label={t('reinsurance.registerRecovery', 'Register Recovery')} icon="pi pi-plus"
            onClick={() => {
              setNewRecovery({});
              setShowRegister(true);
            }} />
        </div>
        <div className="grid mb-3">
          <div className="col-3">
            <Card>
              <h4 className="m-0">{t('reinsurance.totalClaimed')}</h4>
              <p className="text-3xl font-bold">{formatCurrency(performance?.totalClaimed ?? 0)}</p>
            </Card>
          </div>
          <div className="col-3">
            <Card>
              <h4 className="m-0">{t('reinsurance.totalRecovered')}</h4>
              <p className="text-3xl font-bold text-green-500">{formatCurrency(performance?.totalRecovered ?? 0)}</p>
            </Card>
          </div>
          <div className="col-3">
            <Card>
              <h4 className="m-0">{t('reinsurance.recoveryRate')}</h4>
              <Knob value={Math.round(performance?.recoveryRate ?? 0)} size={80} readOnly valueColor="#4caf50" />
            </Card>
          </div>
          <div className="col-3">
            <Card>
              <h4 className="m-0">{t('reinsurance.avgRecoveryTime')}</h4>
              <p className="text-3xl font-bold">{formatWithUnit(performance?.averageTime ?? 0, "days")}</p>
            </Card>
          </div>
        </div>

        <TabView>
          <TabPanel header={t('reinsurance.pendingRecoveries')}>
            <DataTable value={claims.filter(c => c.status !== 'Recovered')} loading={loading} paginator rows={20}>
              <Column field="claimNumber" header={t('reinsurance.claimNumber')} sortable />
              <Column field="policyNumber" header={t('reinsurance.policyNumber')} sortable />
              <Column field="insured" header={t('reinsurance.insured')} sortable />
              <Column body={(row) => formatAppDate(row.dateOfLoss)} field="dateOfLoss" header={t('reinsurance.dateOfLoss')} sortable />
              <Column field="causeOfLoss" header={t('reinsurance.cause')} sortable />
              <Column field="grossClaim" header={t('reinsurance.grossClaim')} sortable body={amount('grossClaim')} />
              <Column field="recoverableAmount" header={t('reinsurance.recoverable')} sortable body={amount('recoverableAmount')} />
              <Column header={t('reinsurance.status')} body={statusBodyTemplate} sortable sortField="status" />
              <Column header={t('common.actions')} body={actionBodyTemplate} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t('reinsurance.recoveredClaims')}>
            <DataTable value={claims.filter(c => c.status === 'Recovered')} loading={loading} paginator rows={20}>
              <Column field="claimNumber" header={t('reinsurance.claimNumber')} sortable />
              <Column field="insured" header={t('reinsurance.insured')} sortable />
              <Column field="recoverableAmount" header={t('reinsurance.recoveredAmount')} sortable body={amount('recoverableAmount')} />
              <Column body={(row) => formatAppDate(row.recoveryDate)} field="recoveryDate" header={t('reinsurance.recoveryDate')} sortable />
              <Column field="settlementAmount" header={t('reinsurance.settlement')} sortable body={amount('settlementAmount')} />
            </DataTable>
          </TabPanel>
        </TabView>
      </Card>

      <Dialog header={t('reinsurance.registerRecovery', 'Register Recovery')} visible={showRegister} onHide={() => setShowRegister(false)} style={{ width: '35rem' }}>
        <div className="p-fluid">
          <div className="field">
            <label>{t('reinsurance.claimNumber')}</label>
            <InputText value={newRecovery.claimNumber || ''} onChange={(e) => setNewRecovery({ ...newRecovery, claimNumber: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('reinsurance.grossClaim')}</label>
            <InputNumber value={newRecovery.grossClaim} min={0} maxFractionDigits={2}
              onValueChange={(e) => setNewRecovery({ ...newRecovery, grossClaim: e.value })} />
          </div>
          <div className="field">
            <label>{t('reinsurance.cause')}</label>
            <InputText value={newRecovery.causeOfLoss || ''} onChange={(e) => setNewRecovery({ ...newRecovery, causeOfLoss: e.target.value })} />
          </div>
          <Button label={t('common.submit')} icon="pi pi-check" disabled={!newRecovery.claimNumber} onClick={registerRecovery} />
        </div>
      </Dialog>

      <Dialog header={t('reinsurance.settle', 'Record settlement')} visible={!!settling} onHide={() => setSettling(null)} style={{ width: '30rem' }}>
        <div className="p-fluid">
          <div className="field">
            <label>{t('reinsurance.settlement')}</label>
            <InputNumber value={settlement.settlementAmount} min={0} maxFractionDigits={2}
              onValueChange={(e) => setSettlement({ ...settlement, settlementAmount: e.value })} />
          </div>
          <div className="field">
            <label>{t('reinsurance.recoveryDate')}</label>
            <Calendar value={settlement.recoveryDate} dateFormat={calendarDateFormat()} showIcon
              onChange={(e) => setSettlement({ ...settlement, recoveryDate: e.value })} />
          </div>
          <Button label={t('common.submit')} icon="pi pi-check" disabled={!settlement.settlementAmount} onClick={settleRecovery} />
        </div>
      </Dialog>

      <TextPromptDialog
        visible={!!disputing}
        header={t('reinsurance.dispute', 'Mark as disputed')}
        label={t('reinsurance.reason', 'Reason')}
        onHide={() => setDisputing(null)}
        onSubmit={disputeRecovery}
      />
    </div>
  );
};

// P6: Reinsurance Reports Component
export const ReinsuranceReports = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [reports, setReports] = useState([]);
  const [bordereaux, setBordereaux] = useState([]);
  const toast = useRef(null);
  const showError = useToastError(toast, t);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const [templates, bordereauList] = await Promise.all([
        reinsuranceService.getReportTemplates(),
        reinsuranceService.getBordereaux(),
      ]);
      setReports(templates);
      setBordereaux(bordereauList);
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: t('reinsurance.error'), detail: t('reinsurance.failedToLoadReports') });
    }
  };

  const generateReport = async (report) => {
    try {
      const result = await reinsuranceService.generateReport(report.id);
      toast.current?.show({ severity: 'success', summary: t('common.success'), detail: t('reinsurance.reportGeneratedSuccess', { name: report.name }) });
      openFile(result?.fileUrl);
      loadReports();
    } catch (error) {
      showError(error, 'reinsurance.failedToLoadReports');
    }
  };

  const bordereauAction = async (action, row) => {
    try {
      await action(row.id);
      toast.current?.show({ severity: 'success', summary: t('common.success'), detail: row.reference });
      loadReports();
    } catch (error) {
      showError(error, 'reinsurance.failedToLoadReports');
    }
  };

  const bordereauActions = (rowData) => (
    <div className="flex gap-2">
      {rowData.status === 'Draft' && (
        <Button icon="pi pi-send" className="p-button-rounded p-button-text" tooltip={t('common.submit')}
          onClick={() => bordereauAction(reinsuranceService.submitBordereau, rowData)} aria-label={t('common.submit')}
          />
      )}
      {rowData.status === 'Submitted' && (
        <Button icon="pi pi-check" className="p-button-rounded p-button-text p-button-success" tooltip={t('common.confirm')}
          onClick={() => bordereauAction(reinsuranceService.confirmBordereau, rowData)} aria-label={t('common.confirm')}
          />
      )}
      {rowData.fileUrl && (
        <Button icon="pi pi-download" className="p-button-rounded p-button-text" onClick={() => openFile(rowData.fileUrl)} aria-label="Download" tooltip="Download" tooltipOptions={{ position: "top" }} />
      )}
    </div>
  );

  return (
    <div className="reinsurance-reports p-3">
      <Toast ref={toast} />
      <Card title={t('reinsurance.reportsCenter')}>
        <div className="grid">
          {reports.map((report) => (
            <div key={report.id} className="col-12 md:col-6 lg:col-4">
              <Card className="mb-3">
                <h4>{report.name}</h4>
                <p className="text-secondary">{report.type} Report</p>
                <div className="flex justify-content-between align-items-center mt-3">
                  <Tag value={report.frequency} />
                  <Button icon="pi pi-download" label={t('reinsurance.generate')} className="p-button-sm" onClick={() => generateReport(report)} />
                </div>
                <small className="block mt-2">{t('reinsurance.lastGenerated')}: {orDash(report.lastGenerated)}</small>
              </Card>
            </div>
          ))}
        </div>
      </Card>
      <Card title={t('reinsurance.bordereaux', 'Bordereaux')} className="mt-3">
        <DataTable value={bordereaux} paginator rows={20}>
          <Column field="reference" header={t('reinsurance.reference', 'Reference')} sortable />
          <Column field="type" header={t('reinsurance.type')} sortable />
          <Column field="periodLabel" header={t('reinsurance.period')} sortable />
          <Column field="treatyNumber" header={t('reinsurance.treatyNumber')} body={(rowData) => orDash(rowData.treatyNumber)} />
          <Column field="entries" header={t('reinsurance.entries', 'Entries')} />
          <Column header={t('reinsurance.amount')}
            body={(rowData) => formatCurrency(rowData.type === 'Premium' ? rowData.cededPremium : rowData.recoverableAmount)} />
          <Column field="status" header={t('reinsurance.status')} sortable />
          <Column header={t('common.actions')} body={bordereauActions} />
        </DataTable>
      </Card>
    </div>
  );
};

// P7: Reconciliation Dashboard Component
export const ReconciliationDashboard = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [reconciliations, setReconciliations] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [reinsurers, setReinsurers] = useState([]);
  const [showReconcile, setShowReconcile] = useState(false);
  const [reconcileForm, setReconcileForm] = useState({ type: 'Premium' });
  const [showException, setShowException] = useState(false);
  const [exceptionForm, setExceptionForm] = useState({});
  const [resolving, setResolving] = useState(null);
  const toast = useRef(null);
  const showError = useToastError(toast, t);

  useEffect(() => {
    loadReconciliation();
    reinsuranceService.getReinsurers().then(setReinsurers).catch((error) => showError(error, 'reinsurance.failedToLoadReconciliationData'));
  }, []);

  const loadReconciliation = async () => {
    try {
      const data = await reinsuranceService.getReconciliation();
      setReconciliations(data.pending || []);
      setExceptions(data.exceptions || []);
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: t('reinsurance.error'), detail: t('reinsurance.failedToLoadReconciliationData') });
    }
  };

  const save = async (action, onDone) => {
    try {
      await action();
      toast.current?.show({ severity: 'success', summary: t('common.success'), detail: t('reinsurance.reconciliation') });
      onDone();
      loadReconciliation();
    } catch (error) {
      showError(error, 'reinsurance.failedToLoadReconciliationData');
    }
  };

  const reconcile = () => save(() => reinsuranceService.createReconciliation(reconcileForm), () => setShowReconcile(false));
  const logException = () => save(() => reinsuranceService.createException(exceptionForm), () => setShowException(false));
  const resolve = (resolution) => save(
    () => (resolving.kind === 'exception'
      ? reinsuranceService.resolveException(resolving.row.id, resolution)
      : reinsuranceService.resolveReconciliation(resolving.row.id, resolution)),
    () => setResolving(null)
  );

  const varianceTemplate = (rowData) => {
    const color = Math.abs(rowData.variancePercent) > 1 ? 'red' : 'green';
    return <span style={{ color }}>{formatCurrency(rowData.variance)} ({rowData.variancePercent}%)</span>;
  };

  const resolveTemplate = (kind) => (rowData) => (
    ['Resolved', 'Matched'].includes(rowData.status) ? null : (
      <Button icon="pi pi-check-circle" className="p-button-rounded p-button-text" tooltip={t('reinsurance.resolve', 'Resolve')}
        onClick={() => setResolving({ kind, row: rowData })} aria-label={t('reinsurance.resolve', 'Resolve')}
        />
    )
  );

  const amount = (field) => (rowData) => formatCurrency(rowData[field]);

  return (
    <div className="reconciliation-dashboard p-3">
      <Toast ref={toast} />
      <Card title={t('reinsurance.reinsuranceReconciliation')}>
        <div className="flex justify-content-end gap-2 mb-3">
          <Button label={t('reinsurance.reconcileStatement', 'Reconcile Statement')} icon="pi pi-plus"
            onClick={() => {
              setReconcileForm({ type: 'Premium' });
              setShowReconcile(true);
            }} />
          <Button label={t('reinsurance.logException', 'Log Exception')} icon="pi pi-exclamation-triangle" className="p-button-secondary"
            onClick={() => {
              setExceptionForm({});
              setShowException(true);
            }} />
        </div>
        <TabView>
          <TabPanel header={t('reinsurance.pendingReconciliations')}>
            <DataTable value={reconciliations} paginator rows={20}>
              <Column field="type" header={t('reinsurance.type')} sortable />
              <Column field="reinsurerName" header={t('reinsurance.reinsurer')} sortable />
              <Column field="period" header={t('reinsurance.period')} sortable />
              <Column field="ourAmount" header={t('reinsurance.ourAmount')} sortable body={amount('ourAmount')} />
              <Column field="theirAmount" header={t('reinsurance.theirAmount')} sortable body={amount('theirAmount')} />
              <Column header={t('reinsurance.variance')} body={varianceTemplate} sortable sortField="variance" />
              <Column field="status" header={t('reinsurance.status')} sortable />
              <Column body={resolveTemplate('reconciliation')} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t('reinsurance.exceptions')}>
            <DataTable value={exceptions} paginator rows={20}>
              <Column body={(row) => formatAppDate(row.date)} field="date" header={t('remittance.date')} sortable />
              <Column field="type" header={t('reinsurance.type')} sortable />
              <Column field="description" header={t('reinsurance.description')} sortable />
              <Column field="amount" header={t('reinsurance.amount')} sortable body={amount('amount')} />
              <Column field="status" header={t('reinsurance.status')} sortable />
              <Column body={resolveTemplate('exception')} />
            </DataTable>
          </TabPanel>
        </TabView>
      </Card>

      <Dialog header={t('reinsurance.reconcileStatement', 'Reconcile Statement')} visible={showReconcile} onHide={() => setShowReconcile(false)} style={{ width: '35rem' }}>
        <div className="p-fluid">
          <div className="field">
            <label>{t('reinsurance.type')}</label>
            <Dropdown value={reconcileForm.type} options={['Premium', 'Claims']}
              onChange={(e) => setReconcileForm({ ...reconcileForm, type: e.value })} />
          </div>
          <div className="field">
            <label>{t('reinsurance.reinsurer')}</label>
            <Dropdown value={reconcileForm.reinsurerId} options={reinsurers.map(r => ({ label: r.name, value: r.id }))}
              onChange={(e) => setReconcileForm({ ...reconcileForm, reinsurerId: e.value })} />
          </div>
          <div className="field">
            <label>{t('reinsurance.period')}</label>
            <Dropdown value={reconcileForm.period} options={recentPeriods(12)}
              onChange={(e) => setReconcileForm({ ...reconcileForm, period: e.value })} />
          </div>
          <div className="field">
            <label>{t('reinsurance.theirAmount')}</label>
            <InputNumber value={reconcileForm.theirAmount} min={0} maxFractionDigits={2}
              onValueChange={(e) => setReconcileForm({ ...reconcileForm, theirAmount: e.value })} />
          </div>
          <Button label={t('common.submit')} icon="pi pi-check" onClick={reconcile}
            disabled={!reconcileForm.reinsurerId || !reconcileForm.period || reconcileForm.theirAmount == null} />
        </div>
      </Dialog>

      <Dialog header={t('reinsurance.logException', 'Log Exception')} visible={showException} onHide={() => setShowException(false)} style={{ width: '35rem' }}>
        <div className="p-fluid">
          <div className="field">
            <label>{t('reinsurance.type')}</label>
            <InputText value={exceptionForm.type || ''} onChange={(e) => setExceptionForm({ ...exceptionForm, type: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('reinsurance.description')}</label>
            <InputTextarea value={exceptionForm.description || ''} rows={3}
              onChange={(e) => setExceptionForm({ ...exceptionForm, description: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('reinsurance.amount')}</label>
            <InputNumber value={exceptionForm.amount} min={0} maxFractionDigits={2}
              onValueChange={(e) => setExceptionForm({ ...exceptionForm, amount: e.value })} />
          </div>
          <Button label={t('common.submit')} icon="pi pi-check" onClick={logException}
            disabled={!exceptionForm.type || !exceptionForm.description} />
        </div>
      </Dialog>

      <TextPromptDialog
        visible={!!resolving}
        header={t('reinsurance.resolve', 'Resolve')}
        label={t('reinsurance.resolution', 'Resolution')}
        onHide={() => setResolving(null)}
        onSubmit={resolve}
      />
    </div>
  );
};

// P8: Reinsurance Analytics Component
export const ReinsuranceAnalytics = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [analytics, setAnalytics] = useState(null);
  const toast = useRef(null);
  const recoveryMetrics = analytics?.recoveryPerformance ?? { totalRecovered: 0, totalClaimed: 0, recoveryRate: 0, averageTime: 0 };
  const retention = analytics?.retentionOptimization ?? {};
  const percent = (value) => (value === undefined || value === null ? '-' : `${value}%`);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setAnalytics(await reinsuranceService.getAnalytics());
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: t('reinsurance.error'), detail: t('reinsurance.failedToLoadAnalytics') });
    }
  };

  const treatyUtilizationData = {
    labels: analytics?.treatyUtilization?.map(tu => tu.treaty) || [],
    datasets: [{
      label: 'Utilization %',
      data: analytics?.treatyUtilization?.map(tu => tu.utilization) || [],
      backgroundColor: ['#4caf50', '#ff9800', '#f44336', '#2196f3', '#9c27b0']
    }]
  };

  const lossRatioData = {
    labels: analytics?.lossRatioTrend?.map(d => d.month) || [],
    datasets: [
      {
        label: 'Gross Loss Ratio',
        data: analytics?.lossRatioTrend?.map(d => d.gross) || [],
        borderColor: '#ff9800',
        tension: 0.4
      },
      {
        label: 'Net Loss Ratio',
        data: analytics?.lossRatioTrend?.map(d => d.net) || [],
        borderColor: '#4caf50',
        tension: 0.4
      }
    ]
  };

  return (
    <div className="reinsurance-analytics p-3">
      <Toast ref={toast} />
      <Card title={t('reinsurance.analyticsDashboard')}>
        <div className="grid">
          <div className="col-12 md:col-6">
            <Card title={t('reinsurance.treatyUtilizationChart')}>
              <Chart type="bar" data={treatyUtilizationData} />
            </Card>
          </div>
          <div className="col-12 md:col-6">
            <Card title={t('reinsurance.lossRatioTrend')}>
              <Chart type="line" data={lossRatioData} />
            </Card>
          </div>
          <div className="col-12 md:col-4">
            <Card title={t('reinsurance.retentionOptimization')}>
              <div className="text-center">
                <h3>{t('reinsurance.currentVsRecommended')}</h3>
                <div className="flex justify-content-around mt-3">
                  <div>
                    <p className="text-secondary">{t('reinsurance.current')}</p>
                    <Knob value={Math.round(retention.current?.retention ?? 0)} readOnly valueColor="#ff9800" />
                    <p>{t('reinsurance.profitability')}: {percent(retention.current?.profitability)}</p>
                  </div>
                  <div>
                    <p className="text-secondary">{t('reinsurance.recommended')}</p>
                    <Knob value={Math.round(retention.recommended?.retention ?? 0)} readOnly valueColor="#4caf50" />
                    <p>{t('reinsurance.profitability')}: {percent(retention.recommended?.profitability)}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
          <div className="col-12 md:col-4">
            <Card title={t('reinsurance.recoveryPerformance')}>
              <div className="text-center">
                <Knob value={Math.round(recoveryMetrics.recoveryRate)} size={120} readOnly valueColor="#4caf50" />
                <h4>{t('reinsurance.recoveryRate')}</h4>
                <p>{formatCurrency(recoveryMetrics.totalRecovered)} / {formatCurrency(recoveryMetrics.totalClaimed)}</p>
                <p className="text-secondary">{t('reinsurance.avgTimeDays', { days: recoveryMetrics.averageTime })}</p>
              </div>
            </Card>
          </div>
          <div className="col-12 md:col-4">
            <Card title={t('reinsurance.keyMetrics')}>
              <div className="metric-list">
                <div className="flex justify-content-between mb-2">
                  <span>{t('reinsurance.grossToNetRatio')}</span>
                  <strong>{percent(retention.current?.retention)}</strong>
                </div>
                <div className="flex justify-content-between mb-2">
                  <span>{t('reinsurance.riCostRatio')}</span>
                  <strong>{percent(retention.current?.cession)}</strong>
                </div>
                <div className="flex justify-content-between mb-2">
                  <span>{t('reinsurance.treatyROI')}</span>
                  <strong>{percent(retention.current?.profitability)}</strong>
                </div>
                <div className="flex justify-content-between">
                  <span>{t('reinsurance.catExposure')}</span>
                  <strong>{formatCurrency(analytics?.catastropheExposure?.totalExposure ?? 0)}</strong>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
};
