import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import SvgTable from "../../../../assets/icons/SvgTable";
import { useDispatch, useSelector } from "react-redux";
import { getAccountCategorySearchList, getAccountCategoryList } from "../store/accountCategoryMeddleware";
import MasterStatusToggle from "../../../GeneralMasters/common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import RowActions, { actionsColumn } from "../../../../components/RowActions";

const TableData = ({ handleViewAction, handleEditAction, EmptyTable }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getAccountCategoryList());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getAccountCategoryList());
  }, [dispatch]);
  const [search, setSearch] = useState("");
  const { AccountCategoryList, AccountCategorySearchList } =
    useSelector(({ accountCategoryReducer }) => {
      return {
        loading: accountCategoryReducer?.loading,
        AccountCategoryList: accountCategoryReducer?.AccountCategoryList,
        AccountCategorySearchList:
          accountCategoryReducer?.AccountCategorySearchList,
      };
    });
  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">{t("financeMasters.noDataEntered")}</div>
    </div>
  );
  const renderActionButton = (rowData) => <RowActions onView={() => handleViewAction(rowData)} onEdit={() => handleEditAction(rowData)} />;

  useEffect(() => {
    if (search?.length > 0) {
      dispatch(getAccountCategorySearchList(search));
    }
  }, [search]);

  return (
    <div className="master__account__table__container">
      <Toast ref={statusToast} />
      <div className="grid m-0 header_search_container">
        <div class="col-12 md:col-12 lg:col-12 xl:col-12 p-0">
          <span className="p-input-icon-left w-full">
            <i className="pi pi-search" />
            <InputText
              placeholder={t("financeMasters.searchByAccountCategoryCode")}
              className="searchinput__field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </div>
        <div className="p-0 col-12">
          <div className="table__title">{t("financeMasters.accountCategoryList")}</div>
        </div>
      </div>
      <DataTable
        value={search ? AccountCategorySearchList : AccountCategoryList}
        paginator
        rows={20}
        rowsPerPageOptions={[20, 50, 100]}
        className="reversal__table__main"
        emptyMessage={emptyTableIcon}
        scrollable={true}
      >
        <Column
          field="categoryCode"
          header={t("financeMasters.accountCategoryCodeHeader")}
          className="fieldvalue_container"
          body={(rowData) => rowData.categoryCode?.toUpperCase()}
          sortable
        ></Column>
        <Column
          field="categoryName"
          header={t("financeMasters.accountCategoryNameHeader")}
          className="fieldvalue_container"
          body={(rowData) => rowData.categoryName}
        ></Column>
        <Column
          field="status"
          header={t("financeMasters.status")}
          className="fieldvalue_container"
          body={(columnData) => <MasterStatusToggle type="account-category" record={columnData} onChanged={reloadList} onError={showStatusError} />}
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
