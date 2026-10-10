import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../assets/icons/SvgDot";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Dialog } from "primereact/dialog";
import DetailDialog from "../../../components/DetailDialog";
import DetailHeader from "../../../components/DetailHeader";
import DetailSection from "../../../components/DetailSection";
import KeyValueGrid from "../../../components/KeyValueGrid";
import InputField from "../../../components/InputField";
import SvgTable from "../../../assets/icons/SvgTable";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import {
  getBankSearchList,
  patchBankDetailEdit,
  getBankList,
} from "./store/bankMasterMiddleware";
import MasterStatusToggle from "../../GeneralMasters/common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import ImportDialog, { masterTarget } from "../../../components/ImportDialog";
import PageActions from "../../../components/PageActions";
import RowActions, { actionsColumn } from "../../../components/RowActions";

const UPLOAD_TARGETS = [masterTarget("bank", "Banks"), masterTarget("bank-account", "Bank accounts")];

const BankMaster = () => {
  const { t } = useTranslation();
  const [showUpload, setShowUpload] = useState(false);
  const [visible, setVisible] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [, setDialog] = useState({});
  const [search, setSearch] = useState("");
  const dispatch = useDispatch();
  const statusToast = useRef(null);
  const reloadList = () => dispatch(getBankList());
  const showStatusError = (error) =>
    statusToast.current?.show({ severity: "error", detail: error.message });
  useEffect(() => {
    dispatch(getBankList());
  }, [dispatch]);
  const navigate = useNavigate();
  const fillBankForm = (rowData) => {
    formik.setValues({
      ...formik.values,
      id: rowData?.id,
      bankCode: rowData?.bankCode ?? "",
      bankName: rowData?.bankName ?? "",
      bankBranch: rowData?.bankBranch ?? "",
      ifscCode: rowData?.ifscCode ?? "",
      addressLine1: rowData?.AddressLine1 ?? "",
      addressLine2: rowData?.AddressLine2 ?? "",
      addressLine3: rowData?.AddressLine3 ?? "",
      city: rowData?.City ?? "",
      state: rowData?.state ?? "",
      country: rowData?.Country ?? "",
      mobile: rowData?.mobile ?? "",
      fax: rowData?.Fax ?? "",
      email: rowData?.email ?? "",
    });
  };

  const handleEdit = (rowData) => {
    setVisible(true);
    setDialog(rowData);
    fillBankForm(rowData);
  };

  const handleView = (rowData) => setViewing(rowData);

  const { bankList, BankSearchList } = useSelector(({ bankMasterReducer }) => {
    return {
      bankList: bankMasterReducer?.BankList,
      BankSearchList: bankMasterReducer?.BankSearchList,
    };
  });
  // useEffect(() => {
  //   if(Object.keys(currentDialog).length>0){
  //   }

  // }, [currentDialog])

  const initialState = {
    bankCode: "",
    bankName: "",
    bankBranch: "",
    ifscCode: "",
    addressLine1: "",
    addressLine2: "",
    addressLine3: "",
    city: "",
    state: "",
    country: "",
    mobile: "",
    fax: "",
    email: "",
  };
  const validate = (values) => {
    const errors = {};
    if (!values.dropdown) {
      errors.dropdown = t("financeMasters.selectAnyOne");
    }
    if (!values.client) {
      errors.client = t("financeMasters.enterHere");
    }
    if (!values.todayDate) {
      errors.todayDate = t("financeMasters.selectDate");
    }
    if (!values.from) {
      errors.from = t("financeMasters.selectDate");
    }
    if (!values.to) {
      errors.to = t("financeMasters.selectDate");
    }
    if (!values.textArea) {
      errors.textArea = t("financeMasters.writeNoteHere");
    }
    return errors;
  };

  const handleSubmit = () => {
    validate(formik.values);
  };

  const formik = useFormik({
    initialValues: initialState,
    validate,
    onSubmit: handleSubmit,
  });

  const handleUpdate = async () => {
    try {
      await dispatch(patchBankDetailEdit(formik.values)).unwrap();
      setVisible(false);
    } catch (error) {
      statusToast.current?.show({ severity: "error", detail: error });
    }
  };

  const isEmpty = !bankList?.length;

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
            {t("financeMasters.rowCount")}{" "}
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

  const handleadd = () => {
    navigate("/master/finance/bank/addbankmaster");
  };

  const headerStyle = {
    // width: '10rem',
    // backgroundColor: 'var(--color-danger)',
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "10px 6px",
    color: "#000",
    border: "none",
  };

  const items = [{ label: t("financeMasters.bank") }];

  const home = { label: t("financeMasters.master") };

  useEffect(() => {
    if (search?.length > 0) {
      dispatch(getBankSearchList(search));
    }
  }, [search]);

  return (
    <div className="overall__bankmaster__container">
      <Toast ref={statusToast} />
      <div className="overallfilter_container">
        <div>
          <label className="label_header">{t("financeMasters.bankMaster")}</label>
          <BreadCrumb
            model={items}
            home={home}
            className="breadcrumbs_container"
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
        <div className="filterbutton_container">
          <PageActions onUpload={() => setShowUpload(true)} onAdd={handleadd} />

          <ImportDialog visible={showUpload} onHide={() => setShowUpload(false)} title="Upload banks and bank accounts" targets={UPLOAD_TARGETS} onDone={reloadList} />
        </div>
      </div>

      <Card
      >
        {/* <div className="searchiput_container"> */}

        <div className="header_search_container">
          <div class="col-12 md:col-12 lg:col-12">
            {/* <div class="text-center p-3 border-round-sm bg-primary font-bold"> */}
            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                placeholder={t("financeMasters.searchBanks")}
                className="searchinput_left"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </div>
          {/* </div> */}
        </div>

        {/* </div> */}

        <div className="card">
          <DataTable
            value={search ? BankSearchList : bankList}
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
              field="bankCode"
              header={t("financeMasters.bankCode")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.bankCode?.toUpperCase()}
            ></Column>
            <Column
              field="bankName"
              header={t("financeMasters.bankName")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.bankName}
            ></Column>
            <Column
              field="bankBranch"
              header={t("financeMasters.bankBranch")}
              sortable
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.bankBranch?.toUpperCase()}
            ></Column>
            <Column
              field="ifscCode"
              header={t("financeMasters.ifscCode")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.ifscCode?.toUpperCase()}
            ></Column>
            <Column
              field="email"
              header={t("generalMasters.eMail")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="mobile"
              header={t("financeMasters.phone")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              body={(columnData) => <MasterStatusToggle type="bank" record={columnData} onChanged={reloadList} onError={showStatusError} />}
              header={t("common.status")}
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>

            <Column
              body={(rowData) => (
                <RowActions onView={() => handleView(rowData)} onEdit={() => handleEdit(rowData)} viewLabel={t("financeMasters.view")} editLabel={t("financeMasters.edit")}>
                  <Button type="button" icon="pi pi-wallet" text rounded onClick={() => navigate("/master/finance/bank/accountdataview")}
                    aria-label={t("financeMasters.addEditAccount")} tooltip={t("financeMasters.addEditAccount")} tooltipOptions={{ position: "top" }} />
                </RowActions>
              )}
              header={t("common.actions")}
              {...actionsColumn}
            />
          </DataTable>
        </div>
      </Card>

      <Dialog
        header={t("financeMasters.bankDetails")}
        visible={visible}
        style={{ width: "60vw", boxShadow: "none" }}
        onHide={() => setVisible(false)}
        className="master__flow__common__dialog__container"
      >
        <div class="grid">
          <div class="col-12 md:col-3 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("financeMasters.bankCode")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.bankCode}
              onChange={formik.handleChange("bankCode")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-6">
            <InputField
              classNames="field__container"
              label={t("financeMasters.bankName")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.bankName}
              onChange={formik.handleChange("bankName")}
            />
          </div>
          <div class="col-12 md:col-3 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("financeMasters.bankBranch")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.bankBranch}
              onChange={formik.handleChange("bankBranch")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("financeMasters.ifscCode")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.ifscCode}
              onChange={formik.handleChange("ifscCode")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("financeMasters.addressLine1")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.addressLine1}
              onChange={formik.handleChange("addressLine1")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("financeMasters.addressLine2")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.addressLine2}
              onChange={formik.handleChange("addressLine2")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("financeMasters.addressLine3")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.addressLine3}
              onChange={formik.handleChange("addressLine3")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.city")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.city}
              onChange={formik.handleChange("city")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("financeMasters.state")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.state}
              onChange={formik.handleChange("state")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("generalMasters.country")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.country}
              onChange={formik.handleChange("country")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("financeMasters.phoneNumber")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.mobile}
              onChange={formik.handleChange("mobile")}
            />
          </div>
        </div>

        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("financeMasters.fax")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.fax}
              onChange={formik.handleChange("fax")}
            />
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <InputField
              classNames="field__container"
              label={t("financeMasters.emailId")}
              placeholder={t("financeMasters.enter")}
              value={formik.values.email}
              onChange={formik.handleChange("email")}
            />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            label={t("financeMasters.update")}
            className="dialog_updatebutton_view"
            onClick={handleUpdate}
          />
        </div>
      </Dialog>

      {viewing ? (
        <DetailDialog visible onHide={() => setViewing(null)} header={t("financeMasters.bankDetails")} size="lg"
          footer={(
            <>
              <Button type="button" label={t("detailView.close")} outlined onClick={() => setViewing(null)} />
              <Button type="button" label={t("financeMasters.edit")} icon="pi pi-pencil" onClick={() => { const row = viewing; setViewing(null); handleEdit(row); }} />
            </>
          )}>
          <DetailHeader
            title={viewing.bankName || viewing.bankCode}
            subtitle={viewing.bankCode}
            status={viewing.status ? { code: String(viewing.status).toLowerCase(), label: String(viewing.status) } : null}
            meta={[
              { label: t("financeMasters.bankBranch"), value: viewing.bankBranch },
              { label: t("financeMasters.ifscCode"), value: viewing.ifscCode },
            ]}
          />
          <DetailSection title={t("financeMasters.address")}>
            <KeyValueGrid columns={3} items={[
              { label: t("financeMasters.addressLine1"), value: viewing.AddressLine1 },
              { label: t("financeMasters.addressLine2"), value: viewing.AddressLine2 },
              { label: t("financeMasters.addressLine3"), value: viewing.AddressLine3 },
              { label: t("generalMasters.city"), value: viewing.City },
              { label: t("financeMasters.state"), value: viewing.state },
              { label: t("generalMasters.country"), value: viewing.Country },
            ]} />
          </DetailSection>
          <DetailSection title={t("financeMasters.contact")}>
            <KeyValueGrid columns={3} items={[
              { label: t("financeMasters.phoneNumber"), value: viewing.mobile },
              { label: t("financeMasters.fax"), value: viewing.Fax },
              { label: t("financeMasters.emailId"), value: viewing.email },
            ]} />
          </DetailSection>
        </DetailDialog>
      ) : null}
    </div>
  );
};

export default BankMaster;
