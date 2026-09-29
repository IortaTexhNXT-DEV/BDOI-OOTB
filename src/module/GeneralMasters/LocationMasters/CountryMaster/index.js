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
import { ProductService } from "./mock";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import SvgUpload from "../../../../assets/icons/SvgUpload";
import SvgMenudots from "../../../../assets/icons/SvgMenudots";
import { TieredMenu } from "primereact/tieredmenu";
import { Dialog } from "primereact/dialog";
import InputField from "../../../../components/InputField";
import ToggleButton from "../../../../components/ToggleButton";
import SvgTable from "../../../../assets/icons/SvgTable";
import SvgEyeIcon from "../../../../assets/icons/SvgEyeIcon";
import SvgEditicon from "../../../../assets/icons/SvgEdit";
import { useDispatch, useSelector } from "react-redux";
import {
  getCountryListByIdMiddleware,
  getSearchCountryMiddleware,
} from "./store/countryMiddleware";
import { useFormik } from "formik";
import SvgEditicons from "../../../../assets/icons/SvgEditicons";

const Country = () => {
  const { t } = useTranslation();
  const menu = useRef(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [visibleview, setVisibleview] = useState(false);
  const [search, setSearch] = useState("");

  const { countryTableList, getSearchCountry, loading } = useSelector(
    ({ countryReducers }) => {
      return {
        loading: countryReducers?.loading,
        countryTableList: countryReducers?.countryTableList,
        getSearchCountry: countryReducers?.getSearchCountry,
      };
    }
  );
  console.log(countryTableList, "countryTableList");

  const menuitems = [
    { label: t("generalMasters.edit"), command: () => setVisible(true) },
    { label: t("generalMasters.view"), command: () => setVisibleview(true) },
    {
      label: t("generalMasters.addEditAccount"),
      command: () => navigate("/master/finance/bank/accountdataview"),
    },
  ];

  const handleEdit = (rowData) => {
    dispatch(getCountryListByIdMiddleware(rowData));
    navigate(`/master/generals/location/country/edit`);
  };

  const handleadd = (id) => {
    navigate(`/master/generals/location/country/add`);
  };

  const handleView = (rowData) => {
    dispatch(getCountryListByIdMiddleware(rowData));
    navigate(`/master/generals/location/country/view`);
  };

  const handleSubmit = (values) => {
    console.log(values.search, "getSearchCountryMiddleware");
    dispatch(getSearchCountryMiddleware({ textSearch: values.search }));
  };
  const formik = useFormik({
    initialValues: { search: "" },
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (formik.values.search !== "") {
      dispatch(
        getSearchCountryMiddleware({ textSearch: formik.values.search })
      );
    }
  }, [formik.values.search]);
  const isEmpty = countryTableList.length === 0;

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
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
  };

  const headeraction = {
    fontSize: 16,
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
    display: "flex",
    justifyContent: "center",
    alignItem: "center",
  };

  const items = [{ label: t("generalMasters.location") }, { label: t("generalMasters.country") }];
  const renderToggleButton = () => {
    return (
      <div>
        <ToggleButton />
      </div>
    );
  };

  const home = { label: t("generalMasters.master") };

  return (
    <div className="overall__country__container">
      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("generalMasters.country")}</label>
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

      <Card
        style={{ marginTop: "20px", borderRadius: "20px" }}
        //   className="overallcard_container"
      >
        {/* <div className="searchiput_container"> */}

        <div className="header_search_container">
          <div class="col-12 md:col-12 lg:col-12">
            {/* <div class="text-center p-3 border-round-sm bg-primary font-bold"> */}
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder={t("generalMasters.searchByCountryName")}
                className="searchinput_left"
                value={formik.values.search}
                onChange={formik.handleChange("search")}
              />
            </span>
          </div>
          {/* </div> */}
        </div>
        <div className="subheading_conatiner">{t("generalMasters.countryList")}</div>

        {/* </div> */}

        <div className="card">
          <DataTable
            value={
              formik.values.search !== "" ? getSearchCountry : countryTableList
            }
            tableStyle={{ minWidth: "50rem", color: "#1C2536" }}
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            // paginatorTemplate="RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            scrollable={true}
            scrollHeight="40vh"
            emptyMessage={isEmpty ? emptyTableIcon : null}
          >
            <Column
              field="CountryName"
              body={(rowData) => rowData.CountryName?.toUpperCase()}
              header={t("generalMasters.countryName")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="ISOCode"
              body={(rowData) => rowData.ISOCode?.toUpperCase()}
              header={t("generalMasters.isoCode")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="PhoneCode"
              body={(rowData) => rowData.PhoneCode?.toUpperCase()}
              header={t("generalMasters.phoneCode")}
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
            <Column
              field="ModifiedOn"
              header={t("generalMasters.modifiedOn")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            {/* <Column field="name" header="Phone" headerStyle={headerStyle}  className='fieldvalue_container'></Column> */}
            <Column
              body={(rowData) => <ToggleButton id={rowData.id} />}
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
              className="fieldactionvalue_container"
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
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputField
              classNames="field__container"
              label={t("generalMasters.bankName")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-3 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.bankBranch")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.ifscCode")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine1")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine2")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine3")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.city")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.state")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.country")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.phoneNumber")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.fax")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.emailId")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
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
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputField
              classNames="field__container"
              label={t("generalMasters.bankName")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-3 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.bankBranch")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.ifscCode")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine1")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine2")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.addressLine3")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.city")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.state")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.country")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.phoneNumber")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.fax")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.emailId")}
              placeholder={t("generalMasters.enter")}
              // value={formik.values.EmailID}
              // onChange={formik.handleChange("EmailID")}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default Country;
