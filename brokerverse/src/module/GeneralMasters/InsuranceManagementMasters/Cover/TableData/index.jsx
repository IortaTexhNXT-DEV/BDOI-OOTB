import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import SvgTable from "../../../../../assets/icons/SvgTable";
import { useSelector, useDispatch } from "react-redux";
import { useFormik } from "formik";
import { getSearchInsuranceCoverMiddleware, getInsuranceCoverMiddleWare } from "../store/insuranceCoverMiddleware";
import MasterStatusToggle from "../../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import { formatDate as formatAppDate } from "../../../../../utility/dateFormat";
import RowActions, { actionsColumn } from "../../../../../components/RowActions";

const TableData = ({ navigate }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getInsuranceCoverMiddleWare());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getInsuranceCoverMiddleWare());
  }, [dispatch]);
  const { InsuranceCoverList, SearchTableList } = useSelector(
    ({ insuranceCoverReducers }) => {
      return {
        loading: insuranceCoverReducers?.loading,
        InsuranceCoverList: insuranceCoverReducers?.InsuranceCoverList,
        SearchTableList: insuranceCoverReducers?.SearchTableList,
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
  const renderActionButton = (rowData) => <RowActions onView={() => handleView(rowData.id)} onEdit={() => handleEdit(rowData.id)} />;

  const handleView = (id) => {
    navigate(`/master/generals/insurancemanagement/cover/view/${id}`);
  };
  const handleEdit = (id) => {
    navigate(`/master/generals/insurancemanagement/cover/edit/${id}`);
  };
  const handleSubmit = (values) => {
    dispatch(getSearchInsuranceCoverMiddleware({ textSearch: values.search }));
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(
        getSearchInsuranceCoverMiddleware({
          textSearch: formik.values.search,
        })
      );
    }
  }, [formik.values.search]);
  return (
    <div className="cover__table__container">
      <Toast ref={statusToast} />
      <div className="grid m-0 header_search_container">
        <div class="col-12 md:col-12 lg:col-12 xl:col-12 p-0">
          <span className="p-input-icon-left w-full">
            <i className="pi pi-search" />
            <InputText
              placeholder="Search By Insurance Company  Code"
              className="searchinput__field"
              value={formik.values.search}
              onChange={formik.handleChange("search")}
            />
          </span>
        </div>
        <div className="p-0 col-12">
          <div className="table__title">Cover List</div>
        </div>
      </div>
      <DataTable
        value={
          formik.values.search !== "" ? SearchTableList : InsuranceCoverList
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
          field="coverCode"
          header="Cover Code"
          className="fieldvalue_container"
          sortable
        ></Column>
        <Column
          field="coverName"
          header="Cover Name"
          className="fieldvalue_container"
          body={(rowData) => rowData.coverName}
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
          body={(columnData) => <MasterStatusToggle type="cover" record={columnData} onChanged={reloadList} onError={showStatusError} />}
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
