import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import SvgUpload from "../../../../assets/icons/SvgUpload";
import SvgTable from "../../../../assets/icons/SvgTable";
import SvgEyeIcon from "../../../../assets/icons/SvgEyeIcon";
import { useDispatch, useSelector } from "react-redux";
import {
  getSearchStateMiddleware,
  getStateListByIdMiddleware,
  getStateMiddleware,
} from "./store/stateMiddleware";
import { useFormik } from "formik";
import SvgEditicons from "../../../../assets/icons/SvgEditicons";
import MasterStatusToggle from "../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";
import ImportDialog, { masterTarget } from "../../../../components/ImportDialog";

const UPLOAD_TARGETS = [masterTarget("state", "Provinces")];

const State = () => {
  const { t } = useTranslation();
  const [showUpload, setShowUpload] = useState(false);
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getStateMiddleware());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getStateMiddleware());
  }, [dispatch]);
  const navigate = useNavigate();

  const { stateTableList, getSearchState } = useSelector(
    ({ stateReducers }) => {
      return {
        loading: stateReducers?.loading,
        stateTableList: stateReducers?.stateTableList,
        getSearchState: stateReducers?.getSearchState,
      };
    }
  );

  const handleEdit = (rowData) => {
    dispatch(getStateListByIdMiddleware(rowData));
    navigate(`/master/generals/location/state/edit`);
  };

  const handleView = (rowData) => {
    dispatch(getStateListByIdMiddleware(rowData));
    navigate(`/master/generals/location/state/view`);
  };
  const handleadd = (rowData) => {
    navigate(`/master/generals/location/state/add`);
  };

  const handleSubmit = (values) => {
    dispatch(getSearchStateMiddleware({ textSearch: values.search }));
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(getSearchStateMiddleware({ textSearch: formik.values.search }));
    }
  }, [formik.values.search]);

  const isEmpty = stateTableList.length === 0;

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">{t("generalMasters.noDataEntered")}</div>
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
        <React.Fragment>
          <span
            className="mx-1"
            style={{ color: "var(--text-color)", userSelect: "none" }}
          >
            {t("generalMasters.rowCount")}{" "}
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
    // width: '10rem',
    // backgroundColor: 'var(--color-danger)',
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
  };
  const headeraction = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
    display: "flex",
    justifyContent: "space-around",
    alignItem: "center",
  };

  const items = [{ label: t("generalMasters.location") }, { label: t("generalMasters.state") }];

  const home = { label: t("generalMasters.master") };

  return (
    <div className="overall__state__container">
      <Toast ref={statusToast} />
      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("generalMasters.state")}</label>
          <BreadCrumb
            model={items}
            home={home}
            className="breadcrumbs_container"
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
        <div className="filterbutton_container">
          <Button onClick={() => setShowUpload(true)}
            type="button"
            label={t("generalMasters.upload")}
            className="uploadbutton_container"
            icon={<SvgUpload />}
            outlined
          />

          <ImportDialog visible={showUpload} onHide={() => setShowUpload(false)} title={t("generalMasters.uploadProvinces")} targets={UPLOAD_TARGETS} onDone={reloadList} />
          <Button
            type="button"
            label={t("generalMasters.add")}
            className="addbutton_container"
            icon={<SvgAdd />}
            onClick={handleadd}
          />
        </div>
      </div>

      <Card className="overallcard_container">
        {/* <div className="searchiput_container"> */}

        <div className="header_search_container">
          <div class="col-12 md:col-12 lg:col-12">
            {/* <div class="text-center p-3 border-round-sm bg-primary font-bold"> */}
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder={t("generalMasters.searchByStateName")}
                className="searchinput_left"
                value={formik.values.search}
                onChange={formik.handleChange("search")}
              />
            </span>
          </div>
          {/* </div> */}
        </div>
        <div className="subheading_conatiner">{t("generalMasters.stateList")}</div>

        {/* </div> */}

        <div className="card">
          <DataTable
            value={
              formik.values.search !== "" ? getSearchState : stateTableList
            }
            tableStyle={{ minWidth: "50rem", color: "var(--text-color)" }}
            paginator
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            scrollable={true}
            scrollHeight="40vh"
            emptyMessage={isEmpty ? emptyTableIcon : null}
          >
            <Column
              field="StateCode"
              body={(rowData) => rowData.StateCode?.toUpperCase()}
              header={t("generalMasters.stateCode")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="StateName"
              body={(rowData) => rowData.StateName}
              header={t("generalMasters.stateName")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="Region"
              body={(rowData) => rowData.Region}
              header={t("generalMasters.region")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="Country"
              body={(rowData) => rowData.Country?.toUpperCase()}
              header={t("generalMasters.country")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="Modifiedby"
              body={(rowData) => rowData.Modifiedby}
              header={t("generalMasters.modifiedBy")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column body={(row) => formatAppDate(row.ModifiedOn)}
              field="ModifiedOn"
              header={t("generalMasters.modifiedOn")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              body={(columnData) => <MasterStatusToggle type="state" record={columnData} onChanged={reloadList} onError={showStatusError} />}
              header={t("common.status")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              body={(rowData) => (
                <div className="action_icons">
                  <SvgEyeIcon onClick={() => handleView(rowData)} />
                  <SvgEditicons onClick={() => handleEdit(rowData)} />
                </div>
              )}
              header={t("common.actions")}
              headerStyle={headeraction}
              className="fieldvalue_container"
            ></Column>
          </DataTable>
        </div>
      </Card>
    </div>
  );
};

export default State;
