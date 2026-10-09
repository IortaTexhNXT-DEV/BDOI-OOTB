import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Dialog } from "primereact/dialog";
import InputField from "../../../../components/InputField";
import SvgTable from "../../../../assets/icons/SvgTable";
import { useDispatch, useSelector } from "react-redux";
import {
  getCityListByIdMiddleware,
  getSearchCityMiddleware,
  getCityMiddleware,
} from "./store/cityMiddleware";
import { useFormik } from "formik";
import MasterStatusToggle from "../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";
import ImportDialog, { masterTarget } from "../../../../components/ImportDialog";
import useMasterOptions from "../../common/useMasterOptions";
import RowActions, { actionsColumn } from "../../../../components/RowActions";
import PageActions from "../../../../components/PageActions";

const UPLOAD_TARGETS = [masterTarget("city", "Cities and municipalities")];

const City = () => {
  const { t } = useTranslation();
  const [showUpload, setShowUpload] = useState(false);
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  // 1,642 cities and municipalities: the list is filtered by province (all provinces: the first 500 by name)
  const [province, setProvince] = useState("");
  const provinceOptions = useMasterOptions("state");
  const reloadList = () => dispatch(getCityMiddleware(province ? { State: province } : {}));
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getCityMiddleware(province ? { State: province } : {}));
  }, [dispatch, province]);
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [visibleview, setVisibleview] = useState(false);

  const { cityTableList, SearchCity } = useSelector(
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

  const items = [{ label: t("generalMasters.location") }, { label: t("generalMasters.city") }];

  const home = { label: t("generalMasters.master") };

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
          <PageActions onUpload={() => setShowUpload(true)} onAdd={handleadd} />

          <ImportDialog visible={showUpload} onHide={() => setShowUpload(false)} title={t("generalMasters.uploadCities")} targets={UPLOAD_TARGETS} onDone={reloadList} />
        </div>
      </div>

      <Card className="overallcard_container">
        {/* <div className="searchiput_container"> */}

        <div className="header_search_container">
          <div class="col-12 md:col-4 lg:col-3">
            <Dropdown
              value={province}
              options={provinceOptions}
              optionLabel="label"
              optionValue="label"
              onChange={(e) => setProvince(e.value || "")}
              placeholder={t("generalMasters.allProvinces")}
              filter
              showClear
              className="w-full"
              aria-label={t("generalMasters.state")}
            />
          </div>
          <div class="col-12 md:col-8 lg:col-9">
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
            rows={20}
            rowsPerPageOptions={[20, 50, 100]}
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
              body={(rowData) => rowData.CityName}
              header={t("generalMasters.cityName")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="State"
              body={(rowData) => rowData.State}
              header={t("generalMasters.state")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="CityClass"
              header={t("generalMasters.cityClass")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="PostalCode"
              header={t("generalMasters.zipCode")}
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
              body={(columnData) => <MasterStatusToggle type="city" record={columnData} onChanged={reloadList} onError={showStatusError} />}
              header={t("common.status")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              body={(rowData) => <RowActions onView={() => handleView(rowData)} onEdit={() => handleEdit(rowData)} />}
              header={t("common.actions")}
              {...actionsColumn}
            />
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
