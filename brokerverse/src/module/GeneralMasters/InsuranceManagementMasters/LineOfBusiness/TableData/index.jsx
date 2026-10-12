import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import SvgTable from "../../../../../assets/icons/SvgTable";
import { useFormik } from "formik";
import { useSelector, useDispatch } from "react-redux";
import { getSearchInsurancelineOfBusinessMiddleware, getInsurancelineOfBusinessListMiddleWare } from "../store/insuranceLineOfBusinessMiddleware";
import MasterStatusToggle from "../../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import { formatDate as formatAppDate } from "../../../../../utility/dateFormat";
import RowActions, { actionsColumn } from "../../../../../components/RowActions";

const TableData = ({ navigate }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getInsurancelineOfBusinessListMiddleWare());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getInsurancelineOfBusinessListMiddleWare());
  }, [dispatch]);
  const { InsuranceLineOfBusinessList, SearchTableList } = useSelector(
    ({ insuranceLineOfBusinessReducers }) => {
      return {
        loading: insuranceLineOfBusinessReducers?.loading,
        InsuranceLineOfBusinessList:
          insuranceLineOfBusinessReducers?.InsuranceLineOfBusinessList,
        SearchTableList: insuranceLineOfBusinessReducers?.SearchTableList,
      };
    }
  );

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">{t("generalMasters.noDataEntered")}</div>
    </div>
  );
  const renderActionButton = (rowData) => <RowActions onView={() => handleView(rowData.id)} onEdit={() => handleEdit(rowData.id)} />;
  const handleView = (id) => {
    navigate(`/master/generals/insurancemanagement/lineofbusiness/view/${id}`);
  };
  const handleEdit = (id) => {
    navigate(`/master/generals/insurancemanagement/lineofbusiness/edit/${id}`);
  };
  const handleSubmit = (values) => {
    dispatch(
      getSearchInsurancelineOfBusinessMiddleware({ textSearch: values.search })
    );
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(
        getSearchInsurancelineOfBusinessMiddleware({
          textSearch: formik.values.search,
        })
      );
    }
  }, [formik.values.search]);
  return (
    <div className="line__business__compnay_container">
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
          formik.values.search !== ""
            ? SearchTableList
            : InsuranceLineOfBusinessList
        }
        paginator
        rows={20}
        rowsPerPageOptions={[20, 50, 100]}
        className="reversal__table__main"
        emptyMessage={emptyTableIcon}
        scrollable={true}
      >
        <Column
          field="lineofBusinessCode"
          header="Line of business code"
          className="fieldvalue_container"
          sortable
          body={(rowData) => rowData.lineofBusinessCode}
        ></Column>
        <Column
          field="LOBName"
          header="LOB name"
          className="fieldvalue_container"
          body={(rowData) => rowData.LOBName}
        ></Column>

        <Column
          field="modifiedBy"
          header="Modified by"
          className="fieldvalue_container"
          body={(rowData) => rowData.modifiedBy}
        ></Column>
        <Column body={(row) => formatAppDate(row.modifiedOn)}
          field="modifiedOn"
          header="Modified on"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="status"
          header="Status"
          className="fieldvalue_container"
          body={(columnData) => <MasterStatusToggle type="line-of-business" record={columnData} onChanged={reloadList} onError={showStatusError} />}
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
