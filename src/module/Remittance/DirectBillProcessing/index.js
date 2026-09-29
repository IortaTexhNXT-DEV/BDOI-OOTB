import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Checkbox } from "primereact/checkbox";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { TabView, TabPanel } from "primereact/tabview";
import { MultiSelect } from "primereact/multiselect";
import { Tag } from "primereact/tag";
import { ProgressBar } from "primereact/progressbar";
import "./index.scss";

const DirectBillProcessing = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const [activeIndex, setActiveIndex] = useState(0);
  const [billRunNo] = useState("DBR-2025-00001");
  const [billPeriod, setBillPeriod] = useState(new Date());
  const [billDate, setBillDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const [status] = useState("Draft");

  // Selection criteria
  const [selectedInsurer, setSelectedInsurer] = useState(null);
  const [selectedProductLines, setSelectedProductLines] = useState([]);
  const [policyStatus, setPolicyStatus] = useState("Active");

  // Policies data
  const [policies, setPolicies] = useState([]);
  const [selectedPolicies, setSelectedPolicies] = useState([]);

  // Late charges
  const [applyLateCharges, setApplyLateCharges] = useState(false);
  const [lateChargeMethod, setLateChargeMethod] = useState("Percentage");

  // Bill options
  const [billFormat, setBillFormat] = useState("Standard");
  const [deliveryMethod, setDeliveryMethod] = useState(["email"]);
  const [includeStatement, setIncludeStatement] = useState(true);
  const [createGLEntries, setCreateGLEntries] = useState(true);

  const insurerOptions = [
    { label: "ABC Insurance Co", value: "ABC001" },
    { label: "XYZ Life Insurance", value: "XYZ002" },
    { label: "Global Health Insurance", value: "GHI003" },
    { label: "National General Insurance", value: "NGI004" }
  ];

  const productLineOptions = [
    { label: "Motor", value: "Motor" },
    { label: "Health", value: "Health" },
    { label: "Life", value: "Life" },
    { label: "Property", value: "Property" }
  ];

  const policyStatusOptions = [
    { label: "Active", value: "Active" },
    { label: "Grace Period", value: "Grace Period" },
    { label: "All", value: "All" }
  ];

  const loadPolicies = () => {
    // Mock policy data
    const mockPolicies = [
      {
        id: 1,
        selected: false,
        policyNo: "POL-2025-001",
        insuredName: "John Smith",
        product: "Motor",
        effectiveDate: "2025-01-01",
        premium: 1500,
        outstandingAmount: 1500,
        lastPaymentDate: "2024-12-01",
        billAmount: 1500
      },
      {
        id: 2,
        selected: false,
        policyNo: "POL-2025-002",
        insuredName: "Sarah Johnson",
        product: "Health",
        effectiveDate: "2025-01-15",
        premium: 800,
        outstandingAmount: 800,
        lastPaymentDate: "2024-12-15",
        billAmount: 800
      },
      {
        id: 3,
        selected: false,
        policyNo: "POL-2025-003",
        insuredName: "Michael Brown",
        product: "Life",
        effectiveDate: "2025-02-01",
        premium: 2000,
        outstandingAmount: 4000,
        lastPaymentDate: "2024-11-01",
        billAmount: 2000
      },
      {
        id: 4,
        selected: false,
        policyNo: "POL-2025-004",
        insuredName: "Emily Davis",
        product: "Property",
        effectiveDate: "2025-01-20",
        premium: 1200,
        outstandingAmount: 1200,
        lastPaymentDate: "2024-12-20",
        billAmount: 1200
      },
      {
        id: 5,
        selected: false,
        policyNo: "POL-2025-005",
        insuredName: "Robert Wilson",
        product: "Motor",
        effectiveDate: "2025-03-01",
        premium: 1800,
        outstandingAmount: 3600,
        lastPaymentDate: "2024-10-01",
        billAmount: 1800
      }
    ];
    setPolicies(mockPolicies);
  };

  const onPolicySelect = (e) => {
    const updatedPolicies = policies.map(policy =>
      policy.id === e.value.id ? { ...policy, selected: !policy.selected } : policy
    );
    setPolicies(updatedPolicies);
    setSelectedPolicies(updatedPolicies.filter(p => p.selected));
  };

  const onSelectAll = (e) => {
    const updatedPolicies = policies.map(policy => ({ ...policy, selected: e.checked }));
    setPolicies(updatedPolicies);
    setSelectedPolicies(e.checked ? updatedPolicies : []);
  };

  const getTotalAmount = () => {
    return selectedPolicies.reduce((sum, policy) => sum + policy.billAmount, 0);
  };

  const getPreviousBalance = () => {
    return selectedPolicies.reduce((sum, policy) => sum + (policy.outstandingAmount - policy.premium), 0);
  };

  const checkboxTemplate = (rowData) => {
    return (
      <Checkbox
        checked={rowData.selected}
        onChange={() => onPolicySelect({ value: rowData })}
      />
    );
  };

  const amountEditor = (options) => {
    return (
      <InputNumber
        value={options.value}
        onValueChange={(e) => options.editorCallback(e.value)}
        mode="currency"
        currency={currencyCode}
      />
    );
  };

  const statusBodyTemplate = () => {
    return <Tag value={status} severity="info" />;
  };

  const progressBarTemplate = () => {
    const progress = (activeIndex + 1) * 25;
    return (
      <div className="progress-container mb-3">
        <ProgressBar value={progress} showValue={false} />
        <div className="step-labels">
          <span className={activeIndex >= 0 ? "active" : ""}>Selection</span>
          <span className={activeIndex >= 1 ? "active" : ""}>Bill Details</span>
          <span className={activeIndex >= 2 ? "active" : ""}>Late Charges</span>
          <span className={activeIndex >= 3 ? "active" : ""}>Generate</span>
        </div>
      </div>
    );
  };

  // Group policies by insured
  const getInsuredBills = () => {
    const grouped = {};
    selectedPolicies.forEach(policy => {
      if (!grouped[policy.insuredName]) {
        grouped[policy.insuredName] = {
          insuredName: policy.insuredName,
          insuredCode: `INS-${policy.id}`,
          email: `${policy.insuredName.toLowerCase().replace(' ', '.')}@example.com`,
          policies: [],
          currentPremium: 0,
          previousDue: 0,
          totalDue: 0
        };
      }
      grouped[policy.insuredName].policies.push(policy);
      grouped[policy.insuredName].currentPremium += policy.premium;
      grouped[policy.insuredName].previousDue += policy.outstandingAmount - policy.premium;
      grouped[policy.insuredName].totalDue += policy.billAmount;
    });
    return Object.values(grouped);
  };

  const getOverduePolicies = () => {
    return selectedPolicies.filter(policy => {
      const lastPayment = new Date(policy.lastPaymentDate);
      const daysDiff = Math.floor((new Date() - lastPayment) / (1000 * 60 * 60 * 24));
      return daysDiff > 30;
    }).map(policy => ({
      ...policy,
      overdueDays: Math.floor((new Date() - new Date(policy.lastPaymentDate)) / (1000 * 60 * 60 * 24)) - 30,
      overdueAmount: policy.outstandingAmount - policy.premium,
      lateChargeRate: 2.5,
      lateCharge: ((policy.outstandingAmount - policy.premium) * 0.025),
      waive: false,
      remarks: ""
    }));
  };

  return (
    <div className="direct-bill-processing">
      <div className="header-section">
        <h2>{t("remittance.directBillProcessing")}</h2>
      </div>

      <Card className="header-card mb-3">
        <div className="grid">
          <div className="col-12 md:col-2">
            <label>Bill Run No</label>
            <div className="value-field">{billRunNo}</div>
          </div>
          <div className="col-12 md:col-2">
            <label>Bill Period</label>
            <Calendar
              value={billPeriod}
              onChange={(e) => setBillPeriod(e.value)}
              view="month"
              dateFormat="mm/yy"
              className="w-full"
            />
          </div>
          <div className="col-12 md:col-2">
            <label>Bill Date</label>
            <Calendar
              value={billDate}
              onChange={(e) => setBillDate(e.value)}
              dateFormat="dd/mm/yy"
              className="w-full"
            />
          </div>
          <div className="col-12 md:col-2">
            <label>Due Date</label>
            <Calendar
              value={dueDate}
              onChange={(e) => setDueDate(e.value)}
              dateFormat="dd/mm/yy"
              className="w-full"
            />
          </div>
          <div className="col-12 md:col-2">
            <label>Status</label>
            <div className="value-field">{statusBodyTemplate()}</div>
          </div>
        </div>
      </Card>

      <Card>
        {progressBarTemplate()}

        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header="1. Select Policies">
            <div className="filter-section mb-3">
              <div className="grid">
                <div className="col-12 md:col-3">
                  <label>Insurer *</label>
                  <Dropdown
                    value={selectedInsurer}
                    options={insurerOptions}
                    onChange={(e) => setSelectedInsurer(e.value)}
                    placeholder="Select Insurer"
                    className="w-full"
                  />
                </div>
                <div className="col-12 md:col-3">
                  <label>Product Line</label>
                  <MultiSelect
                    value={selectedProductLines}
                    options={productLineOptions}
                    onChange={(e) => setSelectedProductLines(e.value)}
                    placeholder="Select Products"
                    className="w-full"
                  />
                </div>
                <div className="col-12 md:col-2">
                  <label>Policy Status</label>
                  <Dropdown
                    value={policyStatus}
                    options={policyStatusOptions}
                    onChange={(e) => setPolicyStatus(e.value)}
                    className="w-full"
                  />
                </div>
                <div className="col-12 md:col-2">
                  <label>&nbsp;</label>
                  <Button
                    label="Load Policies"
                    icon="pi pi-refresh"
                    className="w-full p-button-primary"
                    onClick={loadPolicies}
                  />
                </div>
              </div>
            </div>

            <DataTable value={policies} className="policy-grid">
              <Column
                header={
                  <Checkbox
                    checked={policies.length > 0 && policies.every(p => p.selected)}
                    onChange={onSelectAll}
                  />
                }
                body={checkboxTemplate}
                style={{ width: "5%" }}
              />
              <Column field="policyNo" header="Policy No" style={{ width: "12%" }} />
              <Column field="insuredName" header="Insured Name" style={{ width: "18%" }} />
              <Column field="product" header="Product" style={{ width: "10%" }} />
              <Column field="effectiveDate" header="Effective Date" style={{ width: "10%" }} />
              <Column field="premium" header="Premium" style={{ width: "12%" }}
                body={(rowData) => formatCurrency(rowData.premium)} />
              <Column field="outstandingAmount" header="Outstanding" style={{ width: "12%" }}
                body={(rowData) => formatCurrency(rowData.outstandingAmount)} />
              <Column field="lastPaymentDate" header="Last Payment" style={{ width: "10%" }} />
              <Column field="billAmount" header="Bill Amount" style={{ width: "11%" }}
                editor={amountEditor}
                body={(rowData) => formatCurrency(rowData.billAmount)} />
            </DataTable>

            {selectedPolicies.length > 0 && (
              <div className="selection-summary mt-3">
                <Tag severity="success">
                  {selectedPolicies.length} policies selected |
                  Total: {formatCurrency(getTotalAmount())}
                </Tag>
              </div>
            )}
          </TabPanel>

          <TabPanel header="2. Bill Details">
            <div className="summary-cards mb-3">
              <div className="grid">
                <div className="col-12 md:col-3">
                  <Card className="summary-card">
                    <div className="card-title">Total Policies</div>
                    <div className="card-value">{selectedPolicies.length}</div>
                  </Card>
                </div>
                <div className="col-12 md:col-3">
                  <Card className="summary-card">
                    <div className="card-title">Total Premium</div>
                    <div className="card-value">{formatCurrency(getTotalAmount())}</div>
                  </Card>
                </div>
                <div className="col-12 md:col-3">
                  <Card className="summary-card">
                    <div className="card-title">Previous Balance</div>
                    <div className="card-value">{formatCurrency(getPreviousBalance())}</div>
                  </Card>
                </div>
                <div className="col-12 md:col-3">
                  <Card className="summary-card highlight">
                    <div className="card-title">Total Bill Amount</div>
                    <div className="card-value">
                      {formatCurrency(getTotalAmount() + getPreviousBalance())}
                    </div>
                  </Card>
                </div>
              </div>
            </div>

            <h3>Insured-wise Bills</h3>
            <DataTable value={getInsuredBills()} className="insured-bills-grid">
              <Column field="insuredCode" header="Insured Code" style={{ width: "10%" }} />
              <Column field="insuredName" header="Insured Name" style={{ width: "20%" }} />
              <Column field="email" header="Email" style={{ width: "15%" }} />
              <Column header="Policies" style={{ width: "8%" }}
                body={(rowData) => rowData.policies.length} />
              <Column field="currentPremium" header="Current Premium" style={{ width: "12%" }}
                body={(rowData) => formatCurrency(rowData.currentPremium)} />
              <Column field="previousDue" header="Previous Due" style={{ width: "12%" }}
                body={(rowData) => formatCurrency(rowData.previousDue)} />
              <Column field="totalDue" header="Total Due" style={{ width: "13%" }}
                body={(rowData) => <strong>{formatCurrency(rowData.totalDue)}</strong>} />
              <Column header="Actions" style={{ width: "10%" }}
                body={() => (
                  <div>
                    <Button icon="pi pi-pencil" className="p-button-text p-button-sm mr-1" />
                    <Button icon="pi pi-eye" className="p-button-text p-button-sm" />
                  </div>
                )} />
            </DataTable>
          </TabPanel>

          <TabPanel header="3. Late Charges">
            <div className="late-charge-section">
              <div className="grid mb-3">
                <div className="col-12 md:col-6">
                  <label>Apply Late Charges</label>
                  <div className="checkbox-container">
                    <Checkbox
                      checked={applyLateCharges}
                      onChange={(e) => setApplyLateCharges(e.checked)}
                    />
                    <span className="ml-2">Apply Late Charges</span>
                  </div>
                </div>
                {applyLateCharges && (
                  <div className="col-12 md:col-6">
                    <label>Late Charge Method</label>
                    <Dropdown
                      value={lateChargeMethod}
                      options={[
                        { label: "Flat Amount", value: "Flat Amount" },
                        { label: "Percentage", value: "Percentage" },
                        { label: "Slab-based", value: "Slab-based" }
                      ]}
                      onChange={(e) => setLateChargeMethod(e.value)}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {applyLateCharges && getOverduePolicies().length > 0 && (
                <>
                  <h3>Overdue Policies</h3>
                  <DataTable value={getOverduePolicies()} className="overdue-grid">
                    <Column field="policyNo" header="Policy No" style={{ width: "15%" }} />
                    <Column field="insuredName" header="Insured" style={{ width: "20%" }} />
                    <Column field="overdueAmount" header="Overdue Amount" style={{ width: "15%" }}
                      body={(rowData) => formatCurrency(rowData.overdueAmount)} />
                    <Column field="overdueDays" header="Days Overdue" style={{ width: "10%" }} />
                    <Column field="lateChargeRate" header="Rate/Amount" style={{ width: "12%" }}
                      body={(rowData) => `${rowData.lateChargeRate}%`} />
                    <Column field="lateCharge" header="Late Charge" style={{ width: "13%" }}
                      body={(rowData) => formatCurrency(rowData.lateCharge)} />
                    <Column field="waive" header="Waive" style={{ width: "8%" }}
                      body={(rowData) => (
                        <Checkbox checked={rowData.waive} />
                      )} />
                    <Column field="remarks" header="Remarks" style={{ width: "7%" }}
                      body={() => (
                        <Button icon="pi pi-comment" className="p-button-text p-button-sm" />
                      )} />
                  </DataTable>
                </>
              )}

              {(!applyLateCharges || getOverduePolicies().length === 0) && (
                <div className="no-late-charges">
                  <i className="pi pi-info-circle mr-2"></i>
                  {applyLateCharges
                    ? "No overdue policies found for late charge calculation."
                    : "Late charges are not being applied to this bill run."}
                </div>
              )}
            </div>
          </TabPanel>

          <TabPanel header="4. Generate Bills">
            <div className="generation-options">
              <div className="grid mb-3">
                <div className="col-12 md:col-6">
                  <label>Bill Format</label>
                  <Dropdown
                    value={billFormat}
                    options={[
                      { label: "Standard", value: "Standard" },
                      { label: "Detailed", value: "Detailed" },
                      { label: "Summary", value: "Summary" }
                    ]}
                    onChange={(e) => setBillFormat(e.value)}
                    className="w-full"
                  />
                </div>
                <div className="col-12 md:col-6">
                  <label>Delivery Method</label>
                  <div className="checkbox-group">
                    <div className="checkbox-item">
                      <Checkbox
                        inputId="email"
                        value="email"
                        checked={deliveryMethod.includes("email")}
                        onChange={(e) => {
                          const methods = e.checked
                            ? [...deliveryMethod, "email"]
                            : deliveryMethod.filter(m => m !== "email");
                          setDeliveryMethod(methods);
                        }}
                      />
                      <label htmlFor="email" className="ml-2">Email</label>
                    </div>
                    <div className="checkbox-item">
                      <Checkbox
                        inputId="print"
                        value="print"
                        checked={deliveryMethod.includes("print")}
                        onChange={(e) => {
                          const methods = e.checked
                            ? [...deliveryMethod, "print"]
                            : deliveryMethod.filter(m => m !== "print");
                          setDeliveryMethod(methods);
                        }}
                      />
                      <label htmlFor="print" className="ml-2">Print</label>
                    </div>
                    <div className="checkbox-item">
                      <Checkbox
                        inputId="portal"
                        value="portal"
                        checked={deliveryMethod.includes("portal")}
                        onChange={(e) => {
                          const methods = e.checked
                            ? [...deliveryMethod, "portal"]
                            : deliveryMethod.filter(m => m !== "portal");
                          setDeliveryMethod(methods);
                        }}
                      />
                      <label htmlFor="portal" className="ml-2">Customer Portal</label>
                    </div>
                  </div>
                </div>
                <div className="col-12 md:col-6">
                  <div className="checkbox-container">
                    <Checkbox
                      checked={includeStatement}
                      onChange={(e) => setIncludeStatement(e.checked)}
                    />
                    <label className="ml-2">Include Statement</label>
                  </div>
                </div>
                <div className="col-12 md:col-6">
                  <div className="checkbox-container">
                    <Checkbox
                      checked={createGLEntries}
                      onChange={(e) => setCreateGLEntries(e.checked)}
                    />
                    <label className="ml-2">Create GL Entries</label>
                  </div>
                </div>
              </div>

              <Card className="final-summary">
                <h3>Final Summary</h3>
                <div className="summary-table">
                  <div className="summary-row">
                    <span>Total Policies</span>
                    <span>{selectedPolicies.length}</span>
                  </div>
                  <div className="summary-row">
                    <span>Total Premium</span>
                    <span>{formatCurrency(getTotalAmount())}</span>
                  </div>
                  <div className="summary-row">
                    <span>Previous Balance</span>
                    <span>{formatCurrency(getPreviousBalance())}</span>
                  </div>
                  {applyLateCharges && (
                    <div className="summary-row">
                      <span>Late Charges</span>
                      <span>
                        {formatCurrency(getOverduePolicies().reduce((sum, p) => sum + p.lateCharge, 0))}
                      </span>
                    </div>
                  )}
                  <div className="summary-row">
                    <span>Adjustments</span>
                    <span>{formatCurrency(0)}</span>
                  </div>
                  <div className="divider"></div>
                  <div className="summary-row total">
                    <span>Total Bill Amount</span>
                    <span>
                      {formatCurrency(getTotalAmount() + getPreviousBalance() +
                        (applyLateCharges ? getOverduePolicies().reduce((sum, p) => sum + p.lateCharge, 0) : 0))}
                    </span>
                  </div>
                  <div className="divider"></div>
                  <div className="summary-row">
                    <span>Bills to Generate</span>
                    <span>{getInsuredBills().length}</span>
                  </div>
                  {deliveryMethod.includes("email") && (
                    <div className="summary-row">
                      <span>Emails to Send</span>
                      <span>{getInsuredBills().length}</span>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabPanel>
        </TabView>

        <div className="action-buttons mt-4">
          {activeIndex > 0 && (
            <Button
              label="Previous"
              icon="pi pi-arrow-left"
              className="p-button-secondary mr-2"
              onClick={() => setActiveIndex(activeIndex - 1)}
            />
          )}
          {activeIndex < 3 && (
            <Button
              label="Next"
              icon="pi pi-arrow-right"
              iconPos="right"
              className="p-button-primary mr-2"
              onClick={() => setActiveIndex(activeIndex + 1)}
            />
          )}
          <Button
            label="Save Draft"
            icon="pi pi-save"
            className="p-button-secondary mr-2"
          />
          {activeIndex === 3 && (
            <Button
              label="Generate Bills"
              icon="pi pi-check"
              className="p-button-success mr-2"
              disabled={selectedPolicies.length === 0}
            />
          )}
          <Button
            label="Cancel"
            icon="pi pi-times"
            className="p-button-text"
          />
        </div>
      </Card>
    </div>
  );
};

export default DirectBillProcessing;