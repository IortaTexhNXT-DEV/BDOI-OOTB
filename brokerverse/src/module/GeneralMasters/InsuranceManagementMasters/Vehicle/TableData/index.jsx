import React, { useEffect, useState, useRef } from "react";
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
import { useFormik } from "formik";
import { useSelector, useDispatch } from "react-redux";
import { getSearchInsuranceVehicleMiddleware, getInsuranceVehicleMiddleWare } from "../store/insuranceVehicleMiddleware";
import MasterStatusToggle from "../../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";

const TableData = ({ navigate }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getInsuranceVehicleMiddleWare());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getInsuranceVehicleMiddleWare());
  }, [dispatch]);
  const { InsuranceVehicleList, loading, SearchTableList } = useSelector(
    ({ insuranceVehicleReducers }) => {
      return {
        loading: insuranceVehicleReducers?.loading,
        InsuranceVehicleList: insuranceVehicleReducers?.InsuranceVehicleList,
        SearchTableList: insuranceVehicleReducers?.SearchTableList,
      };
    }
  );
  const [products, setProducts] = useState([]);

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
    navigate(`/master/generals/insurancemanagement/vehicle/view/${id}`);
  };
  const handleEdit = (id) => {
    navigate(`/master/generals/insurancemanagement/vehicle/edit/${id}`);
  };
  const handleSubmit = (values) => {
    dispatch(
      getSearchInsuranceVehicleMiddleware({ textSearch: values.search })
    );
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(
        getSearchInsuranceVehicleMiddleware({
          textSearch: formik.values.search,
        })
      );
    }
  }, [formik.values.search]);
  return (
    <div className="vehicle__table__container">
      <Toast ref={statusToast} />
      <div className="grid m-0 header_search_container">
        <div class="col-12 md:col-12 lg:col-12 xl:col-12 p-0">
          <span className="p-input-icon-left w-full">
            <i className="pi pi-search" />
            <InputText
              placeholder="Search by Vehicle Code"
              className="searchinput__field"
              value={formik.values.search}
              onChange={formik.handleChange("search")}
            />
          </span>
        </div>
        <div className="p-0 col-12">
          <div className="table__title">Vehicle List</div>
        </div>
      </div>
      <DataTable
        value={
          formik.values.search !== "" ? SearchTableList : InsuranceVehicleList
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
          field="vehicleCode"
          header="Vehicle Code"
          className="fieldvalue_container"
          sortable
        ></Column>
        <Column
          field="vehicleName"
          header="Vehicle Name"
          className="fieldvalue_container"
          body={(rowData) => rowData.vehicleName?.toUpperCase()}
        ></Column>
        <Column
          field="vehicleVariant"
          header="Vehicle Variant"
          className="fieldvalue_container"
          body={(rowData) => rowData.vehicleVariant?.toUpperCase()}
        ></Column>
        <Column
          field="vehicleModel"
          header="Vehicle Model"
          className="fieldvalue_container"
          body={(rowData) => rowData.vehicleModel?.toUpperCase()}
        ></Column>
        <Column
          field="vehicleBrand"
          header="Vehicle Brand"
          className="fieldvalue_container"
          body={(rowData) => rowData.vehicleBrand?.toUpperCase()}
        ></Column>

        <Column
          field="status"
          header="status"
          className="fieldvalue_container"
          body={(columnData) => <MasterStatusToggle type="vehicle" record={columnData} onChanged={reloadList} onError={showStatusError} />}
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
