import { Card } from "primereact/card";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FileUpload } from "primereact/fileupload";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";
import { useFormik } from "formik";
import { useDispatch, useSelector } from "react-redux";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import CustomToast from "../../components/Toast";
import InputTextField from "../component/inputText";
import DatepickerField from "../component/datePicker";
import SvgUpload from "../../assets/icons/SvgUpload";
import SvgUploadClose from "../../assets/agentIcon/SvgUploadClose";
import SvgTable from "../../assets/icons/SvgTable";
import customHistory from "../../routes/customHistory";
import { postUploadPolicyMiddleWare } from "../quoteModule/uploadPolicy/store/uploadPolicyMiddleWare";
import SvgLeftArrow from "../../assets/agentIcon/SvgLeftArrow";
import "./index.scss"

const PCuploadPolicy = ({ state }) => {
  const { t } = useTranslation();
  const [imageURL, setimageURL] = useState();
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleSubmit = (value) => {
    toastRef.current.showToast();
    dispatch(postUploadPolicyMiddleWare(value));
    setTimeout(() => {
      navigate("/agent/employee-benefit/client-policy-details", { state: state });
    }, 2000);
  };
  // const customValidation = (values) => {
  //   if (!values.PolicyNumber) {
  //   }
  //   if (!values.InsuranceCompany) {
  //   }
  //   if (!values.Production) {
  //   }
  //   if (!values.Inception) {
  //   }
  //   if (!values.IssuedDate) {
  //   }
  //   if (!values.Expiry) {
  //   }
  //   if (!values.file) {
  //   }

  //   return errors
  // }
  const initialValues = {
    PolicyNumber: "001",
    Production: new Date(),
    Inception: new Date(),
    IssuedDate: new Date(),
    Expiry: (() => {
      const currentDate = new Date();
      const oneYearLater = new Date(currentDate);
      oneYearLater.setFullYear(currentDate.getFullYear() + 1);
      return oneYearLater.toISOString().split('T')[0];
    })(),
    file: null,
  };
  const [, setExpieyDateData] = useState("")
  const handleUppendImg = (name, src) => {
    setimageURL(src.objectURL);
  };
  const handleBackNavigation = () => {
    customHistory.back();
  };
  const handleLeadNavigation = () => {
    navigate(-1)
  };

  const formik = useFormik({
    initialValues:
    {
      ...initialValues,
      Expiry: new Date(initialValues.Expiry)
    },
    onSubmit: handleSubmit,
  });
  const handleIssuedDateChange = (e) => {
    const issuedDate = e.target.value;
    const expiryDate = new Date(issuedDate);
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    setExpieyDateData(expiryDate)
    formik.setFieldValue("IssuedDate", issuedDate);
    formik.setFieldValue("Expiry", expiryDate);
  };
  const { TableList } = useSelector(
    ({ policydetailreducer }) => {
      return {
        loading: policydetailreducer?.loading,
        TableList: policydetailreducer?.TableList,
        // getSearchCountry: countryReducers?.getSearchCountry,
      };
    }
  );
  const isEmpty = TableList.length === 0;

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found" style={{ textAlign: 'center' }}>{t("employeeBenefit.noDataEntered")}</div>
    </div>
  );

  let flow = "nonrenewal"
  return (
    <div className="upload__policy__card__container mt-4">
      <CustomToast ref={toastRef} message={t("employeeBenefit.policyConvertedSuccess")} />
      <div className="order__summary__main__title">
        {flow === "renewal" ? t("employeeBenefit.client") : t("employeeBenefit.leads")}
      </div>
      <div
        onClick={handleLeadNavigation}
        className="order__summary__back__btn mt-3 cursor-pointer"
      >
        <SvgLeftArrow />
        <div className="order__summary__back__btn__title">
          {flow === "renewal"
            ? `Carson Darrin / ${t("employeeBenefit.clientIdLabel")} 12345678`
            : `${t("employeeBenefit.leadIdLabel")} 12345678`}
        </div>
      </div>

      <Card style={{ marginTop: "20px" }}>
        <div className="upload__policy__card__container__title">
          {t("employeeBenefit.uploadPolicy")}
        </div>

        <div className="card" style={{ marginBottom: 24, marginTop: 24 }}>
          <DataTable value={TableList} tableStyle={{ minWidth: '50rem' }} scrollable={true}
            scrollHeight="26vh"
            emptyMessage={isEmpty ? emptyTableIcon : null}
          >
            <Column header={t("employeeBenefit.participantName")} field="ParticipantName" style={{ paddingLeft: 20 }}></Column>
            <Column header={t("employeeBenefit.siCurrency")} field="SumInsuredcurrency" style={{ paddingLeft: 20 }}></Column>
            <Column header={t("employeeBenefit.premiumCurrency")} field="Premiumcurrencys" style={{ paddingLeft: 20 }}></Column>
            <Column header={t("employeeBenefit.sharePercentage")} field="Sharepercentage" style={{ paddingLeft: 20 }}></Column>
            {/* premium
: 
"9000"
sumInsured
: 
"32500" */}
            <Column header={t("employeeBenefit.sumInsured")} field="sumInsured" style={{ paddingLeft: 20 }}></Column>
            <Column header={t("employeeBenefit.premium")} field="premium" style={{ paddingLeft: 20 }}></Column>
          </DataTable>
        </div>

        <div className="grid mt-2">

          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField label={t("employeeBenefit.policyNumberRequired")}
              value={formik.values.PolicyNumber}
              onChange={formik.handleChange("PolicyNumber")} />
            {formik.touched.PolicyNumber && formik.errors.PolicyNumber && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.PolicyNumber}
              </div>
            )}
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DatepickerField label={t("employeeBenefit.productionRequired")}
              value={formik.values.Production}
              onChange={(e) => {
                formik.setFieldValue("Production", e.target.value);
              }}
              dateFormat="yy-mm-dd"
            />
            {formik.touched.Production && formik.errors.Production && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.Production}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <DatepickerField label="Inception*"
              value={formik.values.Inception}

              onChange={(e) => {
                handleIssuedDateChange()
                formik.setFieldValue("Inception", e.target.value);
              }}
              dateFormat="yy-mm-dd"
            />
            {formik.touched.Inception && formik.errors.Inception && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.Inception}
              </div>
            )}
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DatepickerField
              label={t("employeeBenefit.issuedDateRequired")}
              value={formik.values.IssuedDate}
              onChange={handleIssuedDateChange}
              dateFormat="yy-mm-dd"
            />
            {formik.touched.IssuedDate && formik.errors.IssuedDate && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.IssuedDate}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <DatepickerField
              label={t("employeeBenefit.expiryRequired")}
              value={formik.values.Expiry}
              dateFormat="yy-mm-dd"
            />
            {formik.touched.Expiry && formik.errors.Expiry && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
                {formik.errors.Expiry}
              </div>
            )}
          </div>
        </div>

        <div className="upload__policy__card__sub__title mt-2">
          {t("employeeBenefit.uploadPolicyRequired")}
        </div>

        <div className="upload__card__container mt-2">
          <div className="file_icon_selector">
            <FileUpload
              url="./upload"
              auto
              customUpload
              mode="basic"
              name="demo"
              accept=".png,.jpg,.jpeg"
              maxFileSize={2000000}
              uploadHandler={(e) => {
                formik.setFieldValue("file", e.files[0]);
                handleUppendImg(e.options.props.name, e.files[0], "the data");
              }}
            />

            <div className="icon_click_option">
              <SvgUpload />
            </div>
            <div className="upload__caption text-center">Upload</div>
            <div className="upload__caption text-center">Maximum 2 MB</div>
          </div>
        </div>
        {formik.touched.file && formik.errors.file && (
          <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
            {formik.errors.file}
          </div>
        )}
        {imageURL === undefined ? null : (
          <div className="mt-4">
            <SvgUploadClose />
          </div>
        )}

        <div className="grid m-0">
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: '1rem', // equivalent to mt-4
              padding: 0,
            }}
            className="col-12 md:col-12 lg:col-12"
          >
            <div style={{ marginRight: '1rem', cursor: "pointer" }}>
              <p className="back__btn" onClick={handleBackNavigation}>
                Back
              </p>
            </div>
            <div>
              <Button
                className="complete__btn"
                onClick={() => {
                  formik.handleSubmit();
                }}
              >
                Complete
              </Button>
            </div>
          </div>
        </div>

      </Card>
    </div>
  );
};

export default PCuploadPolicy;
