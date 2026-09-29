import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SvgIconeye from "../../../../../assets/icons/SvgIconeye";
import SvgEdit from "../../../../../assets/icons/SvgEdits";
import SvgTable from "../../../../../assets/icons/SvgTable";
import { InputSwitch } from "primereact/inputswitch";
import { useSelector, useDispatch } from "react-redux";
import { useFormik } from "formik";
import { getSearchInsuranceProductMiddleware, getInsuranceProductListMiddleWare } from "../store/insuranceProductMiddleware";
import MasterStatusToggle from "../../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import { formatDate as formatAppDate } from "../../../../../utility/dateFormat";

const TableData = ({ navigate }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getInsuranceProductListMiddleWare());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getInsuranceProductListMiddleWare());
  }, [dispatch]);
  const { InsuranceProductList, loading, SearchTableList } = useSelector(
    ({ insuranceProductReducers }) => {
      return {
        loading: insuranceProductReducers?.loading,
        InsuranceProductList: insuranceProductReducers?.InsuranceProductList,
        SearchTableList: insuranceProductReducers?.searchInsuranceProductList,
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
        { label: 5, value: 5 },
        { label: 10, value: 10 },
        { label: 20, value: 20 },
        { label: 120, value: 120 },
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
          className="action__button p-0"
        />
        <Button
          icon={<SvgEdit />}
          onClick={() => handleEdit(rowData.id)}
          className="action__button p-0 w-auto"
        />
      </div>
    );
  };

  const handleView = (id) => {
    navigate(`/master/generals/insurancemanagement/productmaster/view/${id}`);
  };
  const handleEdit = (id) => {
    navigate(`/master/generals/insurancemanagement/productmaster/edit/${id}`);
  };
  const handleSubmit = (values) => {
    dispatch(
      getSearchInsuranceProductMiddleware({ textSearch: values.search })
    );
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(
        getSearchInsuranceProductMiddleware({
          textSearch: formik.values.search,
        })
      );
    }
  }, [formik.values.search]);
  return (
    <div className="product__master__table__container">
      <Toast ref={statusToast} />
      <div className="grid m-0 header_search_container">
        <div class="col-12 md:col-12 lg:col-12 xl:col-12 p-0">
          <span className="p-input-icon-left w-full">
            <i className="pi pi-search" />
            <InputText
              placeholder="Search By Product Code"
              className="searchinput__field"
              value={formik.values.search}
              onChange={formik.handleChange("search")}
            />
          </span>
        </div>
        <div className="p-0 col-12">
          <div className="table__title">Product List</div>
        </div>
      </div>
      <DataTable
        value={
          formik.values.search !== "" ? SearchTableList : InsuranceProductList
        }
        paginator
        rows={5}
        rowsPerPageOptions={[5, 10, 25, 50]}
        currentPageReportTemplate="{first} - {last} of {totalRecords}"
        paginatorTemplate={template2}
        className="reversal__table__main"
        emptyMessage={emptyTableIcon}
        scrollable={true}
        scrollHeight="40vh"
      >
        <Column
          field="productCode"
          header="Product Code"
          className="fieldvalue_container"
          sortable
        ></Column>
        <Column
          field="productName"
          header="Product Name"
          className="fieldvalue_container"
          body={(rowData) => rowData.productName?.toUpperCase()}
        ></Column>
        <Column
          field="lineofBusiness"
          header="Line of Business"
          className="fieldvalue_container"
          body={(rowData) => rowData.lineofBusiness?.toUpperCase()}
        ></Column>
        <Column
          field="commissionCode"
          header="Commission Code"
          className="fieldvalue_container"
          body={(rowData) => rowData.commissionCode?.toUpperCase()}
        ></Column>
        <Column
          field="modifiedby"
          header="Modified by"
          className="fieldvalue_container"
          body={(rowData) => rowData.modifiedby?.toUpperCase()}
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
          body={(columnData) => <MasterStatusToggle type="product" record={columnData} onChanged={reloadList} onError={showStatusError} />}
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
    </div>
  );
};

export default TableData;
