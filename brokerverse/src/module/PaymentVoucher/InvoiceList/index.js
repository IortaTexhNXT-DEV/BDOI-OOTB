import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { BreadCrumb } from "primereact/breadcrumb";
import { useNavigate, useParams } from "react-router-dom";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgBackicon from "../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { useDispatch } from "react-redux";
import { getDisbursementDetailsMiddleware } from "../store/paymentVocherMiddleware";

const InvoiceList = () => {
  const { t } = useTranslation();
  const { disbursementId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [disbursementData, setDisbursementData] = useState(null);
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(5);
  const [selectedInvoices, setSelectedInvoices] = useState([]);

  const home = { label: t("paymentVoucher.accounts") };
  const items = [
    {
      label: t("paymentVoucher.title"),
      command: () => navigate("/accounts/paymentvoucher"),
    },
    { label: t("paymentVoucher.createDisbursement") },
  ];

  // Fetch disbursement details on component mount
  useEffect(() => {
    console.log('=== INVOICE LIST COMPONENT MOUNTED ===');
    console.log('Disbursement ID from params:', disbursementId);
    
    const fetchDisbursementDetails = async () => {
      if (disbursementId) {
        console.log('Fetching disbursement details for ID:', disbursementId);
        setLoading(true);
        try {
          console.log('Dispatching getDisbursementDetailsMiddleware...');
          const result = await dispatch(getDisbursementDetailsMiddleware(disbursementId));
          console.log('Middleware result:', result);
          
          if (result.type.endsWith('/fulfilled')) {
            console.log('Successfully fetched disbursement data:', result.payload);
            setDisbursementData(result.payload);
          } else {
            console.error('Failed to fetch disbursement details:', result.error);
          }
        } catch (error) {
          console.error('Error fetching disbursement details:', error);
        } finally {
          setLoading(false);
        }
      } else {
        console.warn('No disbursement ID found in URL params');
      }
    };

    fetchDisbursementDetails();
  }, [disbursementId, dispatch]);

  // Transform invoice list data for the table
  const getInvoiceListData = () => {
    if (!disbursementData || !disbursementData.invoiceList) {
      return [];
    }

    return disbursementData.invoiceList.map((invoice, index) => ({
      id: invoice.invoiceListId || index,
      payables: invoice.payables,
      outstanding: invoice.outstanding,
      fcAmount: invoice.fcAmount || '-',
      lcAmount: invoice.lcAmount || '-',
      excessDiscounts: invoice.excess || '-',
      balAmount: invoice.balAmount || '-',
      vat: invoice.vat || '-',
      wht: invoice.wht || '-',
      totalAmount: invoice.totalAmount,
      checkbooks: invoice.checkbooks || []
    }));
  };

  const template2 = {
    layout:
      "RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 5, value: 5 },
        { label: 10, value: 10 },
        { label: 20, value: 20 },
        { label: 50, value: 50 },
      ];

      return (
        <React.Fragment>
          <span
            className="mx-1"
            style={{ color: "var(--text-color)", userSelect: "none" }}
          >
            {t("paymentVoucher.rowCount")}{" "}
          </span>
          <Dropdown
            value={options.value}
            className="pagedropdown_container"
            options={dropdownOptions}
            onChange={options.onChange}
          />
        </React.Fragment>
      );
    },
  };

  const headerStyle = {
    fontSize: 14,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 12,
    color: "#000",
    border: "none",
    backgroundColor: "#f5f5f5",
  };

  const handleNext = () => {
    navigate("/accounts/paymentvoucher");
  };

  if (loading) {
    return (
      <div className="overall__invoice__list__container">
        <div className="loading-message">{t("paymentVoucher.loadingDisbursementDetails")}</div>
      </div>
    );
  }

  if (!disbursementData) {
    return (
      <div className="overall__invoice__list__container">
        <div className="error-message">{t("paymentVoucher.failedToLoadDisbursementDetails")}</div>
      </div>
    );
  }

  return (
    <div className="overall__invoice__list__container">
      <div>
        <span onClick={() => navigate("/accounts/paymentvoucher")} style={{ cursor: 'pointer' }}>
          <SvgBackicon />
        </span>
        <label className="label_header">{t("paymentVoucher.createDisbursement")}</label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <Card className="mt-3">
        <div className="invoice-list-header">
          <h3>{t("paymentVoucher.invoiceList")}</h3>
        </div>

        <div className="invoice-table-wrapper">
          <DataTable
            value={getInvoiceListData()}
            selection={selectedInvoices}
            onSelectionChange={(e) => setSelectedInvoices(e.value)}
            dataKey="id"
            tableStyle={{ minWidth: "50rem", color: "#2e2e2e" }}
            paginator
            rows={rows}
            first={first}
            onPage={(e) => {
              setFirst(e.first);
              setRows(e.rows);
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
            totalRecords={disbursementData?.invoiceList?.length || 0}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            scrollable={true}
            scrollHeight="40vh"
          >
            <Column
              selectionMode="multiple"
              headerStyle={{ ...headerStyle, width: '50px', textAlign: 'center' }}
              bodyStyle={{ textAlign: 'center', verticalAlign: 'middle' }}
            ></Column>
            <Column
              field="payables"
              header={t("paymentVoucher.payables")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => formatCurrency(rowData.payables ?? 0)}
            ></Column>
            <Column
              field="outstanding"
              header={t("paymentVoucher.outstanding")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {`₱${parseFloat(rowData.outstanding || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  <span style={{ fontSize: '12px' }}>↕</span>
                </div>
              )}
            ></Column>
            <Column
              field="fcAmount"
              header={t("paymentVoucher.fcAmount")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="lcAmount"
              header={t("paymentVoucher.lcAmount")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="excessDiscounts"
              header={t("paymentVoucher.excessDiscounts")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="balAmount"
              header={t("paymentVoucher.balOsAmount")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="vat"
              header={t("paymentVoucher.vatPercent")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="wht"
              header={t("paymentVoucher.whtPercent")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="totalAmount"
              header={t("paymentVoucher.totalAmount")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => formatCurrency(rowData.totalAmount ?? 0)}
            ></Column>
          </DataTable>
        </div>
      </Card>

      {selectedInvoices && selectedInvoices.length > 0 && (
        <div className="next_container">
          <Button
            className="submit_button p-0"
            label={t("paymentVoucher.next")}
            onClick={handleNext}
          />
        </div>
      )}
    </div>
  );
};

export default InvoiceList;

