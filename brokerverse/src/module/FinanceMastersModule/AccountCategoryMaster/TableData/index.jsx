import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import SvgEdit from "../../../../assets/icons/SvgEdits";
import SvgTable from "../../../../assets/icons/SvgTable";
import { useDispatch, useSelector } from "react-redux";
import { getAccountCategorySearchList, getAccountCategoryList } from "../store/accountCategoryMeddleware";
import MasterStatusToggle from "../../../GeneralMasters/common/MasterStatusToggle";
import { Toast } from "primereact/toast";

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
              {t("financeMasters.rowCount")}{" "}
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
          onClick={() => handleViewAction(rowData)}
          className="action__button p-0"
        />
        <Button
          icon={<SvgEdit />}
          onClick={() => handleEditAction(rowData)}
          className="action__button p-0 w-auto"
        />
      </div>
    );
  };

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
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "20px 1rem 17px 0px",
          }}
          field="id"
          body={renderActionButton}
          header={t("financeMasters.action")}
          className="fieldvalue_container"
        ></Column>
      </DataTable>
    </div>
  );
};

export default TableData;
