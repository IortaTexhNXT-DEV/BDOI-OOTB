import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import SvgTable from "../../../../../assets/icons/SvgTable";
import { useFormik } from "formik";
import { useSelector, useDispatch } from "react-redux";
import { getSearchInsuranceVehicleMiddleware, getInsuranceVehicleMiddleWare } from "../store/insuranceVehicleMiddleware";
import MasterStatusToggle from "../../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import RowActions, { actionsColumn } from "../../../../../components/RowActions";

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
  const { InsuranceVehicleList, SearchTableList } = useSelector(
    ({ insuranceVehicleReducers }) => {
      return {
        loading: insuranceVehicleReducers?.loading,
        InsuranceVehicleList: insuranceVehicleReducers?.InsuranceVehicleList,
        SearchTableList: insuranceVehicleReducers?.SearchTableList,
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
  const renderActionButton = (rowData) => <RowActions onView={() => handleView(rowData.id)} onEdit={() => handleEdit(rowData.id)} />;

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
              placeholder={t("generalMasters.searchCodeOrName", "Search code or name")}
              className="searchinput__field"
              value={formik.values.search}
              onChange={formik.handleChange("search")}
            />
          </span>
        </div>
      </div>
      <DataTable
        value={
          formik.values.search !== "" ? SearchTableList : InsuranceVehicleList
        }
        paginator
        rows={20}
        rowsPerPageOptions={[20, 50, 100]}
        className="reversal__table__main"
        emptyMessage={emptyTableIcon}
        scrollable={true}
      >
        <Column
          field="vehicleCode"
          header="Vehicle code"
          className="fieldvalue_container"
          sortable
        ></Column>
        <Column
          field="vehicleName"
          header="Vehicle name"
          className="fieldvalue_container"
          body={(rowData) => rowData.vehicleName}
        ></Column>
        <Column
          field="vehicleVariant"
          header="Vehicle variant"
          className="fieldvalue_container"
          body={(rowData) => rowData.vehicleVariant}
        ></Column>
        <Column
          field="vehicleModel"
          header="Vehicle model"
          className="fieldvalue_container"
          body={(rowData) => rowData.vehicleModel}
        ></Column>
        <Column
          field="vehicleBrand"
          header="Vehicle brand"
          className="fieldvalue_container"
          body={(rowData) => rowData.vehicleBrand}
        ></Column>

        <Column
          field="status"
          header="Status"
          className="fieldvalue_container"
          body={(columnData) => <MasterStatusToggle type="vehicle" record={columnData} onChanged={reloadList} onError={showStatusError} />}
        ></Column>
        <Column
          body={renderActionButton}
          header={t("common.actions")}
          {...actionsColumn}
        />
      </DataTable>
    </div>
  );
};

export default TableData;
