import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { TabView, TabPanel } from "primereact/tabview";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Checkbox } from "primereact/checkbox";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import remittanceService from "../../../services/remittanceService";
import { calendarDateFormat, dateBody, isoDate, isoMonth, loadMasterOptions, showError, showSuccess, statusSeverity } from "../shared";
import "./index.scss";

const emptyAdjustment = { agencyCode: null, adjustmentType: null, amount: null, reason: "" };
const sum = (rows, field) => rows.reduce((s, r) => s + Number(r[field] || 0), 0);

const AgencyBillProcessing = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const toast = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedAgencies, setSelectedAgencies] = useState([]);
  const [billPeriod, setBillPeriod] = useState(new Date());
  const [billRunDate, setBillRunDate] = useState(new Date());
  const [billType, setBillType] = useState("Regular");
  const [agencyType, setAgencyType] = useState("All");
  const [agencies, setAgencies] = useState([]);
  const [agencyBills, setAgencyBills] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [adjustmentTypes, setAdjustmentTypes] = useState([]);
  const [newAdjustment, setNewAdjustment] = useState(emptyAdjustment);
  const [sendToAgencies, setSendToAgencies] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadAgencies = async () => {
    setLoading(true);
    try {
      setAgencies(await remittanceService.agencies(isoMonth(billPeriod)));
      setSelectedAgencies([]);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  };

  const loadBills = async () => {
    try {
      setAgencyBills(await remittanceService.listAgencyBills({ perPage: 200 }));
    } catch (e) {
      showError(toast, e);
    }
  };

  const loadAdjustments = async () => {
    try {
      setAdjustments(await remittanceService.listAdjustments({ perPage: 200 }));
    } catch (e) {
      showError(toast, e);
    }
  };

  useEffect(() => {
    loadAgencies();
    loadBills();
    loadAdjustments();
    loadMasterOptions("remittance-adjustment-type")
      .then((rows) => setAdjustmentTypes(rows.map((r) => ({ label: r.label, value: r.label }))))
      .catch((e) => showError(toast, e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleAgencies = agencyType === "All" ? agencies : agencies.filter((a) => a.agencyType === agencyType);
  const agencyTypeOptions = [{ label: "All", value: "All" }, ...[...new Set(agencies.map((a) => a.agencyType))].map((v) => ({ label: v, value: v }))];
  const agencyNames = new Set(agencies.map((a) => a.agencyName));
  const agencyAdjustments = adjustments.filter((a) => agencyNames.has(a.clientName));
  const selectedNames = new Set(selectedAgencies.map((a) => a.agencyName));
  const selectedAdjustmentTotal = sum(agencyAdjustments.filter((a) => selectedNames.has(a.clientName)), "adjustmentAmount");
  const totals = {
    premium: sum(selectedAgencies, "grossPremium"),
    commission: sum(selectedAgencies, "commission"),
    previousBalance: sum(selectedAgencies, "previousBalance"),
  };
  const netPayable = totals.premium - totals.commission + totals.previousBalance + selectedAdjustmentTotal;

  const statusBodyTemplate = (rowData) => <Tag value={rowData.status} severity={statusSeverity(rowData.statusCode || rowData.status)} />;

  const validate = () => {
    if (!selectedAgencies.length) {
      toast.current.show({ severity: "warn", summary: t("remittance.validationFailed"), detail: t("remittance.selectAgencies"), life: 3000 });
      return false;
    }
    if (!billPeriod || !billRunDate) {
      toast.current.show({ severity: "warn", summary: t("remittance.validationFailed"), detail: t("remittance.billPeriod"), life: 3000 });
      return false;
    }
    return true;
  };

  const handleValidate = () => {
    if (validate()) showSuccess(toast, `${selectedAgencies.length} agencies ready for billing`, t("remittance.validationSuccessful"));
  };

  const generateBills = async ({ submit }) => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await remittanceService.generateAgencyBills({
        billPeriod: isoMonth(billPeriod),
        billRunDate: isoDate(billRunDate),
        agencyCodes: selectedAgencies.map((a) => a.agencyCode),
        billType,
      });
      const bills = result.agencyBills || [];
      if (sendToAgencies) await Promise.all(bills.map((b) => remittanceService.sendBill(b.id, { deliveryMethod: ["email"] })));
      if (submit) await remittanceService.processRemittances(bills.map((b) => b.id));
      const skipped = (result.skipped || []).map((s) => `${s.agencyCode}: ${s.reason}`).join("; ");
      showSuccess(toast, `${bills.length} bill(s) ${submit ? "submitted for approval" : "saved as draft"}${skipped ? `. Skipped ${skipped}` : ""}`);
      await Promise.all([loadBills(), loadAgencies()]);
      setActiveIndex(1);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendBill = async (bill) => {
    try {
      const out = await remittanceService.sendBill(bill.id, { deliveryMethod: ["email"] });
      showSuccess(toast, `${bill.billNumber} sent${out.emailedTo ? ` to ${out.emailedTo}` : ""}`);
      loadBills();
    } catch (e) {
      showError(toast, e);
    }
  };

  const handleAddAdjustment = async () => {
    const agency = agencies.find((a) => a.agencyCode === newAdjustment.agencyCode);
    try {
      await remittanceService.createAdjustment({
        adjustmentType: newAdjustment.adjustmentType,
        adjustmentAmount: newAdjustment.amount,
        reason: newAdjustment.reason,
        description: agency ? `Agency bill adjustment - ${agency.agencyName}` : "",
        clientName: agency?.agencyName,
        effectiveDate: isoDate(billRunDate),
      });
      showSuccess(toast, t("remittance.addAdjustment"));
      setNewAdjustment(emptyAdjustment);
      loadAdjustments();
    } catch (e) {
      showError(toast, e);
    }
  };

  const handleCancel = () => {
    setSelectedAgencies([]);
    setNewAdjustment(emptyAdjustment);
    setActiveIndex(0);
  };

  return (
    <div className="agency-bill-processing">
      <Toast ref={toast} />
      <h2>{t("remittance.agencyBillProcessing")}</h2>

      <div className="header-section">
        <div className="p-fluid formgrid grid">
          <div className="p-field field col-12 md:col-3">
            <label>{t("remittance.billPeriod")}</label>
            <Calendar value={billPeriod} onChange={(e) => setBillPeriod(e.value)} view="month" dateFormat="mm/yy" />
          </div>
          <div className="p-field field col-12 md:col-3">
            <label>{t("remittance.billRunDate")}</label>
            <Calendar value={billRunDate} onChange={(e) => setBillRunDate(e.value)} dateFormat={calendarDateFormat()} />
          </div>
          <div className="p-field field col-12 md:col-3">
            <label>{t("remittance.billType")}</label>
            <Dropdown value={billType} options={[
              { label: t("remittance.regular"), value: "Regular" },
              { label: t("remittance.supplementary"), value: "Supplementary" },
              { label: t("remittance.adjustment"), value: "Adjustment" }
            ]} onChange={(e) => setBillType(e.value)} />
          </div>
          <div className="p-field field col-12 md:col-3">
            <label>{t("remittance.status")}</label>
            <Tag value="Draft" severity="warning" style={{ marginTop: '1.5rem' }} />
          </div>
        </div>
      </div>

      <Card className="mt-4">
        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header={t("remittance.selectAgencies")}>
            <div className="filter-section mb-3">
              <Dropdown placeholder={t("remittance.agencyType")} value={agencyType} options={agencyTypeOptions}
                onChange={(e) => setAgencyType(e.value)} className="mr-2" />
              <Button label={t("remittance.loadAgencies")} icon="pi pi-refresh" onClick={loadAgencies} loading={loading} />
            </div>

            <DataTable
              value={visibleAgencies}
              loading={loading}
              selection={selectedAgencies}
              onSelectionChange={(e) => setSelectedAgencies(e.value)}
              dataKey="id"
              stripedRows
            >
              <Column selectionMode="multiple" style={{ width: '3rem' }} />
              <Column field="agencyCode" header={t("remittance.agencyCode")} />
              <Column field="agencyName" header={t("remittance.agencyName")} />
              <Column field="agencyType" header={t("remittance.type")} />
              <Column field="policyCount" header={t("remittance.policies")} />
              <Column field="grossPremium" header={t("remittance.grossPremium")} body={(data) => formatCurrency(data.grossPremium)} />
              <Column field="commission" header={t("remittance.commission")} body={(data) => formatCurrency(data.commission)} />
              <Column field="previousBalance" header={t("remittance.previousBalance")} body={(data) => formatCurrency(data.previousBalance)} />
              <Column field="totalDue" header={t("remittance.totalDue")} body={(data) => <strong>{formatCurrency(data.totalDue)}</strong>} />
            </DataTable>
          </TabPanel>

          <TabPanel header={t("remittance.billDetails")}>
            <div className="summary-cards mb-4">
              <Card className="summary-card">
                <div className="card-content">
                  <i className="pi pi-building" />
                  <div>
                    <div className="value">{selectedAgencies.length}</div>
                    <div className="label">{t("remittance.totalAgencies")}</div>
                  </div>
                </div>
              </Card>
              <Card className="summary-card">
                <div className="card-content">
                  <i className="pi pi-wallet" />
                  <div>
                    <div className="value">{formatCurrency(totals.premium)}</div>
                    <div className="label">{t("remittance.totalPremium")}</div>
                  </div>
                </div>
              </Card>
              <Card className="summary-card">
                <div className="card-content">
                  <i className="pi pi-percentage" />
                  <div>
                    <div className="value">{formatCurrency(totals.commission)}</div>
                    <div className="label">{t("remittance.totalCommission")}</div>
                  </div>
                </div>
              </Card>
              <Card className="summary-card highlight">
                <div className="card-content">
                  <i className="pi pi-calculator" />
                  <div>
                    <div className="value">{formatCurrency(netPayable)}</div>
                    <div className="label">{t("remittance.netPayable")}</div>
                  </div>
                </div>
              </Card>
            </div>

            <DataTable value={agencyBills} stripedRows>
              <Column field="agencyCode" header={t("remittance.agencyCode")} />
              <Column field="agencyName" header={t("remittance.agencyName")} />
              <Column field="billNumber" header={t("remittance.billNumber")} />
              <Column field="billDate" body={dateBody("billDate")} header={t("remittance.billDate")} />
              <Column field="dueDate" body={dateBody("dueDate")} header={t("remittance.dueDate")} />
              <Column field="billAmount" header={t("remittance.billAmount")} body={(data) => formatCurrency(data.billAmount)} />
              <Column field="status" header={t("remittance.status")} body={statusBodyTemplate} />
              <Column header={t("remittance.actions")} body={(rowData) => (
                <div className="action-buttons">
                  <Button icon="pi pi-send" className="p-button-rounded p-button-text" tooltip={t("remittance.sendToAgencies")}
                    onClick={() => handleSendBill(rowData)} disabled={["rejected", "cancelled"].includes(rowData.statusCode)} aria-label={t("remittance.sendToAgencies")}
                    />
                  <Button icon="pi pi-print" className="p-button-rounded p-button-text" tooltip={t("remittance.print")} onClick={() => window.print()} aria-label={t("remittance.print")} />
                </div>
              )} />
            </DataTable>
          </TabPanel>

          <TabPanel header={t("remittance.remittanceAdjustments")}>
            <div className="adjustment-form mb-4">
              <h4>{t("remittance.addAdjustment")}</h4>
              <div className="p-fluid formgrid grid">
                <div className="p-field field col-12 md:col-6">
                  <label>{t("remittance.agencyName")}</label>
                  <Dropdown placeholder={t("remittance.selectAgency")} value={newAdjustment.agencyCode}
                    options={selectedAgencies.map(a => ({ label: a.agencyName, value: a.agencyCode }))}
                    onChange={(e) => setNewAdjustment({ ...newAdjustment, agencyCode: e.value })} />
                </div>
                <div className="p-field field col-12 md:col-6">
                  <label>{t("remittance.adjustmentType")}</label>
                  <Dropdown placeholder={t("remittance.selectType")} value={newAdjustment.adjustmentType} options={adjustmentTypes}
                    onChange={(e) => setNewAdjustment({ ...newAdjustment, adjustmentType: e.value })} />
                </div>
                <div className="p-field field col-12 md:col-6">
                  <label>{t("remittance.amount")}</label>
                  <InputNumber mode="currency" currency={currencyCode} value={newAdjustment.amount}
                    onValueChange={(e) => setNewAdjustment({ ...newAdjustment, amount: e.value })} />
                </div>
                <div className="p-field field col-12 md:col-6">
                  <label>{t("remittance.reason")}</label>
                  <InputTextarea rows={2} value={newAdjustment.reason}
                    onChange={(e) => setNewAdjustment({ ...newAdjustment, reason: e.target.value })} />
                </div>
              </div>
              <Button label={t("remittance.addAdjustmentButton")} icon="pi pi-plus" className="p-button-secondary" onClick={handleAddAdjustment}
                disabled={!newAdjustment.agencyCode || !newAdjustment.adjustmentType || !newAdjustment.amount || !newAdjustment.reason} />
            </div>

            <DataTable value={agencyAdjustments} stripedRows>
              <Column field="clientName" header={t("remittance.agency")} />
              <Column field="adjustmentType" header={t("remittance.type")} />
              <Column field="adjustmentAmount" header={t("remittance.amount")} body={(data) => formatCurrency(data.adjustmentAmount)} />
              <Column field="reason" header={t("remittance.reason")} />
              <Column field="status" header={t("remittance.status")} body={statusBodyTemplate} />
            </DataTable>
          </TabPanel>

          <TabPanel header={t("remittance.finalize")}>
            <div className="final-summary">
              <Card title={t("remittance.finalBillSummary")}>
                <table className="summary-table">
                  <tbody>
                    <tr>
                      <td>{t("remittance.totalGrossPremium")}</td>
                      <td className="text-right">{formatCurrency(totals.premium)}</td>
                    </tr>
                    <tr>
                      <td>{t("remittance.totalCommissionEarned")}</td>
                      <td className="text-right">-{formatCurrency(totals.commission)}</td>
                    </tr>
                    <tr>
                      <td>{t("remittance.previousBalance")}</td>
                      <td className="text-right">{formatCurrency(totals.previousBalance)}</td>
                    </tr>
                    <tr>
                      <td>{t("remittance.adjustments")}</td>
                      <td className="text-right">{formatCurrency(selectedAdjustmentTotal)}</td>
                    </tr>
                    <tr className="total-row">
                      <td><strong>{t("remittance.netAmountPayable")}</strong></td>
                      <td className="text-right"><strong>{formatCurrency(netPayable)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </Card>

              <div className="processing-options mt-4">
                <h4>{t("remittance.processingOptions")}</h4>
                <div className="p-fluid formgrid grid">
                  <div className="p-field field col-12 md:col-6">
                    <div className="checkbox-wrapper">
                      <Checkbox checked={true} />
                      <label>{t("remittance.generateBills")}</label>
                    </div>
                  </div>
                  <div className="p-field field col-12 md:col-6">
                    <div className="checkbox-wrapper">
                      <Checkbox checked={sendToAgencies} onChange={(e) => setSendToAgencies(e.checked)} />
                      <label>{t("remittance.sendToAgencies")}</label>
                    </div>
                  </div>
                  <div className="p-field field col-12 md:col-6">
                    <div className="checkbox-wrapper">
                      <Checkbox checked={true} />
                      <label>{t("remittance.createGLEntries")}</label>
                    </div>
                  </div>
                  <div className="p-field field col-12 md:col-6">
                    <div className="checkbox-wrapper">
                      <Checkbox checked={false} />
                      <label>{t("remittance.postToAccounts")}</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabView>

        <div className="action-bar mt-4">
          <Button label={t("remittance.saveDraft")} className="p-button-secondary mr-2" onClick={() => generateBills({ submit: false })} disabled={loading} />
          <Button label={t("remittance.validate")} icon="pi pi-check" className="p-button-secondary mr-2" onClick={handleValidate} />
          <Button label={t("remittance.processBills")} icon="pi pi-forward" className="p-button-primary mr-2" onClick={() => generateBills({ submit: true })} loading={loading} />
          <Button label={t("common.cancel")} className="p-button-text" onClick={handleCancel} />
        </div>
      </Card>
    </div>
  );
};

export default AgencyBillProcessing;
