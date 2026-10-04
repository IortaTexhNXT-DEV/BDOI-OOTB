import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SignatureCapture from "../../../../../components/SignatureCapture";
import SvgIconeye from "../../../../../assets/icons/SvgIconeye";
import SvgEdit from "../../../../../assets/icons/SvgEdits";
import SvgTable from "../../../../../assets/icons/SvgTable";
import { useSelector, useDispatch } from "react-redux";
import { useFormik } from "formik";
import { getSearchInsuranceSignatoriesMiddleware, getInsuranceSignatoriesMiddleWare } from "../store/insuranceSignatoriesMiddleware";
import MasterStatusToggle from "../../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import { formatDate as formatAppDate } from "../../../../../utility/dateFormat";

const TableData = ({ navigate }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  // E-signature of a signatory (capture, versions, revoke): components/SignatureCapture
  const [signatureOf, setSignatureOf] = useState(null);
  const reloadList = () => dispatch(getInsuranceSignatoriesMiddleWare());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getInsuranceSignatoriesMiddleWare());
  }, [dispatch]);
  const { InsuranceSignatoriesList, SearchTableList } = useSelector(
    ({ insuranceSignatoriesReducers }) => {
      return {
        loading: insuranceSignatoriesReducers?.loading,
        InsuranceSignatoriesList:
          insuranceSignatoriesReducers?.InsuranceSignatoriesList,
        SearchTableList: insuranceSignatoriesReducers?.SearchTableList,
      };
    }
  );

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">No data entered</div>
    </div>
  );
  const template2 = {
    layout:
      "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
      ];

      return (
        <div className="table__selector">
          <React.Fragment>
            <span style={{ color: "var(--text-color)", userSelect: "none" }}>
              {t("generalMasters.rowCount")}{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdown_container"
              options={dropdownOptions}
              onChange={options.onChange}
            />
          </React.Fragment>
        </div>
      );
    },
  };
  const renderActionButton = (rowData) => {
    return (
      <div className="action__button__container">
        <Button
          icon={<SvgIconeye />}
          onClick={() => handleView(rowData.id)}
          className="action__button p-0" aria-label="View" tooltip="View" tooltipOptions={{ position: "top" }} />
        <Button
          icon={<SvgEdit />}
          onClick={() => handleEdit(rowData.id)}
          className="action__button p-0 w-auto" aria-label="Edit" tooltip="Edit" tooltipOptions={{ position: "top" }} />
        <Button
          icon="pi pi-pencil"
          onClick={() => setSignatureOf(rowData)}
          className="action__button p-0 w-auto" aria-label={t("signature.title", "E-signature")} tooltip={t("signature.title", "E-signature")} tooltipOptions={{ position: "top" }} />
      </div>
    );
  };

  const handleView = (id) => {
    navigate(`/master/generals/insurancemanagement/signatories/view/${id}`);
  };
  const handleEdit = (id) => {
    navigate(`/master/generals/insurancemanagement/signatories/edit/${id}`);
  };
  const handleSubmit = (values) => {
    dispatch(
      getSearchInsuranceSignatoriesMiddleware({ textSearch: values.search })
    );
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(
        getSearchInsuranceSignatoriesMiddleware({
          textSearch: formik.values.search,
        })
      );
    }
  }, [formik.values.search]);

  return (
    <div className="signatories__master__table__container">
      <Toast ref={statusToast} />
      <div className="grid m-0 header_search_container">
        <div class="col-12 md:col-12 lg:col-12 xl:col-12 p-0">
          <span className="p-input-icon-left w-full">
            <i className="pi pi-search" />
            <InputText
              placeholder="Search By Signatories Code"
              className="searchinput__field"
              value={formik.values.search}
              onChange={formik.handleChange("search")}
            />
          </span>
        </div>
        <div className="p-0 col-12">
          <div className="table__title">Signatories List</div>
        </div>
      </div>
      <DataTable
        value={
          formik.values.search !== ""
            ? SearchTableList
            : InsuranceSignatoriesList
        }
        paginator
        rows={20}
        rowsPerPageOptions={[20, 50, 100]}
        currentPageReportTemplate="{first} - {last} of {totalRecords}"
        paginatorTemplate={template2}
        className="reversal__table__main"
        emptyMessage={emptyTableIcon}
        scrollable={true}
        scrollHeight="40vh"
      >
        <Column
          field="signatoryCode"
          header="Signatories Code"
          className="fieldvalue_container"
          sortable
          body={(rowData) => rowData.signatoryCode?.toUpperCase()}
        ></Column>
        <Column
          field="signatoryName"
          header="Signatory Name"
          className="fieldvalue_container"
          body={(rowData) => rowData.signatoryName}
        ></Column>
        <Column
          field="modifiedBy"
          header="Modified by"
          className="fieldvalue_container"
          body={(rowData) => rowData.modifiedBy}
        ></Column>
        <Column body={(row) => formatAppDate(row.modifiedOn)}
          field="modifiedOn"
          header="Modified On"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="status"
          header="status"
          className="fieldvalue_container"
          body={(columnData) => <MasterStatusToggle type="signatory" record={columnData} onChanged={reloadList} onError={showStatusError} />}
        ></Column>
        <Column
          style={{
            padding: "20px 1rem 17px 0px",
          }}
          field="id"
          body={renderActionButton}
          header="Action"
          className="fieldvalue_container"
        ></Column>
      </DataTable>
      <SignatureCapture visible={!!signatureOf} onHide={() => setSignatureOf(null)} ownerType="signatory" ownerId={signatureOf?.id} ownerName={signatureOf?.signatoryName} />
    </div>
  );
};

export default TableData;
