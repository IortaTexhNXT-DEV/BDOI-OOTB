import React, { useEffect, useRef, useState } from "react";
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
import { InputSwitch } from "primereact/inputswitch";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  getMainAccountDetailView,
  getMainAccountSearchList,
  getPatchMainAccountDetailEdit,
  getMainAccountList,
} from "../store/mainAccoutMiddleware";
import MasterStatusToggle from "../../../GeneralMasters/common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import { notifyError } from "../../../../utility/dialogs";

const TableData = ({ MainAccountList }) => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const location = useLocation();
  const tableView = location.state?.tableView || false;

  const { MainAccountSearchList, loading } = useSelector(
    ({ mainAccoutReducers }) => {
      return {
        loading: mainAccoutReducers?.loading,
        MainAccountSearchList: mainAccoutReducers?.MainAccountSearchList,
      };
    }
  );

  const headerStyle = {};
  const headeraction = {
    marginLeft: "14px",
  };
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
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getMainAccountList());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getMainAccountList());
  }, [dispatch]);
  const handleview = (rowData) => {
    if (rowData) {
      dispatch(getMainAccountDetailView(rowData));
      navigate("/master/finance/mainaccount/viewmainaccount");
    } else {
      notifyError("error");
    }
  };

  const handleEdit = (rowData) => {
    if (rowData) {
      dispatch(getPatchMainAccountDetailEdit(rowData));
      navigate("/master/finance/mainaccount/editmainaccount");
    } else {
      notifyError("error");
    }
  };
  const renderActionButton = (rowData) => {
    return (
      <div className="action__button__container">
        <Button
          icon={<SvgIconeye />}
          onClick={() => handleview(rowData)}
          className="action__button p-0"
        />
        <Button
          icon={<SvgEdit />}
          onClick={() => handleEdit(rowData, "Edit")}
          className="action__button p-0 w-auto"
        />
      </div>
    );
  };
  const renderStatusButton = (rowData) => {
    return (
      <div className="action__switch__container">
        <InputSwitch
          checked={rowData.status ? true : false}
          className={
            rowData.status
              ? "switch__action__input__active"
              : "switch__action__input__inactive"
          }
        />
      </div>
    );
  };

  useEffect(() => {
    if (search?.length > 0) {
      dispatch(getMainAccountSearchList(search));
    }
  }, [search]);

  return (
    <div className="master__main__table__container">
      <Toast ref={statusToast} />
      <div className="grid m-0 header_search_container">
        <div class="col-12 md:col-12 lg:col-12 xl:col-12 p-0">
          <span className="p-input-icon-left w-full">
            <i className="pi pi-search" />
            <InputText
              placeholder={t("financeMasters.searchByMainAccountCode")}
              className="searchinput__field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </span>
        </div>
        <div className="p-0 col-12">
          <div className="table__title">Main Account List</div>
        </div>
      </div>
      <DataTable
        // value={tableView ? Productdata : []}
        value={search ? MainAccountSearchList : MainAccountList}
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
          field="mainAccountCode"
          header="Main Account Code"
          className="fieldvalue_container"
          body={(rowData) => rowData.mainAccountCode?.toUpperCase()}
          // headerStyle={headerStyle}
          sortable
        ></Column>
        <Column
          field="description"
          header="Description"
          className="fieldvalue_container"
          body={(rowData) => rowData.description?.toUpperCase()}
        ></Column>
        <Column
          field="openEntry"
          header="Open Entry"
          className="fieldvalue_container"
          body={(rowData) => rowData.openEntry?.toUpperCase()}
        ></Column>
        <Column
          field="openEntryType"
          header="Open Entry Type"
          className="fieldvalue_container"
          body={(rowData) => rowData.openEntryType?.toUpperCase()}
        ></Column>
        <Column
          field="accountCategoryCode"
          header="Account Category Code"
          className="fieldvalue_container"
          body={(rowData) => rowData.accountCategoryCode?.toUpperCase()}
        ></Column>
        <Column
          field="status"
          header="status"
          className="fieldvalue_container"
          body={(columnData) => <MasterStatusToggle type="main-account" record={columnData} onChanged={reloadList} onError={showStatusError} />}
        ></Column>
        <Column
          headerStyle={headeraction}
          field="id"
          body={renderActionButton}
          header="Action"
          // className="fieldvalue_container"
        ></Column>
      </DataTable>
    </div>
  );
};

export default TableData;
