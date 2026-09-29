import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import NavBar from "../../../../components/NavBar";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgFilters from "../../../../assets/icons/SvgFilters";
import SvgAdd from "../../../../assets/icons/SvgAdd";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import SvgUpload from "../../../../assets/icons/SvgUpload";
import SvgMenudots from "../../../../assets/icons/SvgMenudots";
import { TieredMenu } from "primereact/tieredmenu";
import { Dialog } from "primereact/dialog";
import InputField from "../../../../components/InputField";
import SvgTable from "../../../../assets/icons/SvgTable";
import SvgEyeIcon from "../../../../assets/icons/SvgEyeIcon";
import SvgEditicon from "../../../../assets/icons/SvgEdit";
import { useDispatch, useSelector } from "react-redux";
import {
  getCityListByIdMiddleware,
  getSearchCityMiddleware,
  getCityMiddleware,
} from "./store/cityMiddleware";
import { useFormik } from "formik";
import SvgEditicons from "../../../../assets/icons/SvgEditicons";
import MasterStatusToggle from "../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";

const City = () => {
  const { t } = useTranslation();
  const menu = useRef(null);
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getCityMiddleware());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getCityMiddleware());
  }, [dispatch]);
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [visibleview, setVisibleview] = useState(false);

  const { cityTableList, SearchCity, loading } = useSelector(
    ({ cityReducers }) => {
      return {
        loading: cityReducers?.loading,
        cityTableList: cityReducers?.cityTableList,
        SearchCity: cityReducers?.SearchCity,
      };
    }
  );
  const handleEdit = (rowData) => {
    dispatch(getCityListByIdMiddleware(rowData));
    navigate(`/master/generals/location/city/edit`);
  };

  const handleadd = () => {
    navigate(`/master/generals/location/city/add`);
  };
  const handleView = (rowData) => {
    dispatch(getCityListByIdMiddleware(rowData));
    navigate(`/master/generals/location/city/view`);
  };

  const handleSubmit = (values) => {
    dispatch(getSearchCityMiddleware({ textSearch: values.search }));
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(getSearchCityMiddleware({ textSearch: formik.values.search }));
    }
  }, [formik.values.search]);
  const isEmpty = cityTableList.length === 0;

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
        { label: 5, value: 5 },
        { label: 10, value: 10 },
        { label: 20, value: 20 },
        { label: 120, value: 120 },
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
    // backgroundColor: 'red',
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
    justifyContent: "center",
    alignItem: "center",
  };

  const items = [{ label: t("generalMasters.location") }, { label: t("generalMasters.city") }];

  const home = { label: t("generalMasters.master") };
  const [first, setFirst] = useState(0);
  const [rows, setRows] = useState(5);
  const [globalFilter, setGlobalFilter] = useState("");

  const onPageChange = (event) => {
    setFirst(event.first);
    setRows(event.rows);
  };

  const onGlobalFilterChange = (event) => {
    setGlobalFilter(event.target.value);
  };

  const handlePolicy = () => {
    navigate("/createvoucher");
  };
  const handleArrowClick = () => {
    navigate("/policyreceiptsview");
  };
  const handleEditClick = () => {
    navigate("/otherreceiptsview");
  };

  return (
    <div className="overall__city__container">
      <Toast ref={statusToast} />
      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("generalMasters.city")}</label>
          <BreadCrumb
            model={items}
            home={home}
            className="breadcrumbs_container"
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
        <div className="filterbutton_container">
          <Button
            type="button"
            label={t("generalMasters.upload")}
            className="uploadbutton_container"
            icon={<SvgUpload />}
            outlined
          />

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
                placeholder={t("generalMasters.searchByCityName")}
                className="searchinput_left"
                value={formik.values.search}
                onChange={formik.handleChange("search")}
              />
            </span>
          </div>
          {/* </div> */}
        </div>
        <div className="subheading_conatiner">{t("generalMasters.cityList")}</div>

        {/* </div> */}

        <div className="card">
          <DataTable
            value={formik.values.search !== "" ? SearchCity : cityTableList}
            tableStyle={{ minWidth: "50rem", color: "#2e2e2e" }}
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            scrollable={true}
            scrollHeight="40vh"
            emptyMessage={isEmpty ? emptyTableIcon : null}
          >
            <Column
              field="CityCode"
              body={(rowData) => rowData.CityCode?.toUpperCase()}
              header={t("generalMasters.cityCode")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="CityName"
              body={(rowData) => rowData.CityName?.toUpperCase()}
              header={t("generalMasters.cityName")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="State"
              body={(rowData) => rowData.State?.toUpperCase()}
              header={t("generalMasters.state")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="Modifiedby"
              body={(rowData) => rowData.Modifiedby?.toUpperCase()}
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
              body={(columnData) => <MasterStatusToggle type="city" record={columnData} onChanged={reloadList} onError={showStatusError} />}
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

      <Dialog
        header={t("generalMasters.bankDetails")}
        visible={visible}
        style={{ width: "60vw" }}
        onHide={() => setVisible(false)}
      >
        <div class="grid">
          <div class="col-12 md:col-3 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.bankCode")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputField
              classNames="field__container"
              label={t("generalMasters.bankName")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-3 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.bankBranch")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.ifscCode")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine1")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine2")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine3")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.city")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.state")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.country")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.phoneNumber")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.fax")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.emailId")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            label={t("generalMasters.update")}
            className="dialog_updatebutton_view"
            onClick={() => setVisible(false)}
          />
        </div>
      </Dialog>

      <Dialog
        header={t("generalMasters.bankDetails")}
        visible={visibleview}
        style={{ width: "60vw" }}
        onHide={() => setVisibleview(false)}
      >
        <div class="grid">
          <div class="col-12 md:col-3 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.bankCode")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputField
              classNames="field__container"
              label={t("generalMasters.bankName")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-3 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.bankBranch")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.ifscCode")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine1")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine2")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine3")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.city")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.state")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.country")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.phoneNumber")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.fax")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.emailId")}
              placeholder={t("generalMasters.enter")}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default City;
