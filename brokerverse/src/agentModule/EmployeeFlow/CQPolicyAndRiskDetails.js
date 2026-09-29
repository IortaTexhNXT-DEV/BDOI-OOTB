import { Card } from "primereact/card";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import {
    AccountCodes,
    InsurancePolicyTypes,
    ModelVariants,
    ModelYears,
    VehicleBrands,
    VehicleColors,
    VehicleModels, PolicyTypes,
    InstallmentType,
} from "./mockdataforpolicyDetails";
import useInsuranceCompanyOptions from "../component/useInsuranceCompanyOptions";
import SvgTable from "../../assets/icons/SvgTable";
import { Button } from "primereact/button";
import DropdownField from "../component/DropdwonField";
import DialogList from "../quoteModule/policyDetails/policyDetailsCard/DialogList";
import { Checkbox } from "primereact/checkbox";
import InputTextField from "../component/inputText";
import SvgUploadArrowIcon from "../../assets/agentIcon/SvgUpload";
import { postPolicyDetailsMiddleware } from "../quoteModule/policyDetails/store/policyDetailsMiddleware";
import './index.scss'
import SvgLeftArrow from "../../assets/agentIcon/SvgLeftArrow";
import ArrowUpToLineIcon from "./uploadIcon";

const CQPolicyAndRiskDetails = ({ action, flow, }) => {
    const InsuranceCompanyOptions = useInsuranceCompanyOptions();
    const { t } = useTranslation();
    const { type } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const initialValue = {
        InsuranceCompanyName: "",
        InsurancePolicyType: "",
        AccountCode: "",
        VehicleBrand: "",
        ModelYear: "",
        VehicleModel: "",
        ModelVariant: "",
        VehicleColor: "",
        SeatingCapacity: "", PaymentType: "", InstallmentType: "",
        Occupation: "",
        NoOfStaff: "",
        PlaceOfWork: "",
        EstimatedAnnualEarning: "",
        LimitPerPerson: "",
        LimitPerOccurrence: "",
        Remarks: "",
    };
    const handleclick = (values) => {
        dispatch(postPolicyDetailsMiddleware(values));
        {
            action === "quotedetails"
                ? navigate(`/agent/employee-benefit/create-quote-employeebulkupload`, { state: { coInsurance: checked, installemtType: formik.values?.InstallmentType } })
                : navigate(`/agent/employee-benefit/create-quote-employeebulkupload`, { state: { coInsurance: checked, installemtType: formik.values?.InstallmentType } });
        }
    };
    // const customValidation = (values) => {
    //   if (!values.PaymentType) {
    //   }
    //   if (!values.InstallmentType) {
    //   }

    //   return errors
    // }

    const formik = useFormik({
        initialValues: initialValue,
        // validate: customValidation,
        onSubmit: (values) => {
            handleclick(values);
        },
    });

    const { setFieldValue } = formik;
    useEffect(() => {
        if (action === "quotedetails" && InsuranceCompanyOptions.length > 0) {
            setFieldValue("InsuranceCompanyName", InsuranceCompanyOptions[0].value);
        }
    }, [action, InsuranceCompanyOptions, setFieldValue]);

    useEffect(() => {
        if (action === "quotedetails") {
            formik.setFieldValue(
                "InsurancePolicyType",
                InsurancePolicyTypes[0].value
            );
        }
        if (action === "quotedetails") {
            formik.setFieldValue("AccountCode", AccountCodes[0].value);
        }
        if (action === "quotedetails") {
            formik.setFieldValue("VehicleBrand", VehicleBrands[0].value);
        }
        if (action === "quotedetails") {
            formik.setFieldValue("ModelYear", ModelYears[0].value);
        }
        if (action === "quotedetails") {
            formik.setFieldValue("VehicleModel", VehicleModels[0].value);
        }
        if (action === "quotedetails") {
            formik.setFieldValue("ModelVariant", ModelVariants[0].value);
        }
        if (action === "quotedetails") {
            formik.setFieldValue("VehicleColor", VehicleColors[0].value);
        }
    }, []);
    {/* //changes */ }
    const [checked, setChecked] = useState(false);
    const [paychecked, setPayChecked] = useState(false);
    const [products, setProducts] = useState([]);
    const [visible, setVisible] = useState(false);

    const { TableList, leadtabledata, loading } = useSelector(
        ({ policydetailreducer, leadReducers }) => {
            return {
                loading: policydetailreducer?.loading,
                TableList: policydetailreducer?.TableList,
                leadtabledata: leadReducers?.leadtabledata
                // getSearchCountry: countryReducers?.getSearchCountry,
            };
        }
    );

    const category = leadtabledata[leadtabledata.length - 1]?.category

    const isEmpty = TableList.length === 0;

    const emptyTableIcon = (
        <div>
            <div className="empty-table-icon">
                <SvgTable />
            </div>
            <div className="no__data__found" style={{ textAlign: 'center' }}>{t("employeeBenefit.noDataEntered")}</div>
        </div>
    );
    const Handleinsurance = () => {
        setVisible(true)
    }
    const handleLeadNavigation = () => {
        navigate(-1)
    }

    return (
        <div className="policy__details__card__container mt-4">
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

            <Card style={{marginTop:"20px"}}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '14px',
                    }}
                >
                    <div
                        style={{
                            fontSize: '34px',
                            fontWeight: 600,
                            fontFamily: "Nunito, Arial, sans-serif",
                            lineHeight: '51px',
                            color: '#111927',
                        }}
                    >
                        {action === "quotedetails" ? t("employeeBenefit.editQuote") : t("employeeBenefit.createQuote")}
                    </div>

                    {category === "Corporate" && (
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                justifyContent: 'space-between',
                                gap: '13px',
                            }}
                        >
                            <Button
                                label="Upload"
                                icon={<ArrowUpToLineIcon />}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    backgroundColor: '#0072d8',
                                    gap: '8px',
                                    padding: '10px',
                                    color: '#fff',
                                    border: '1px solid #0072d8',
                                    borderRadius: '6px',
                                    fontFamily: "Nunito, Arial, sans-serif",
                                    fontSize: '16px',
                                    fontWeight: 400,
                                    lineHeight: '24px',
                                }}
                                className="card flex flex-wrap justify-content-spacebetween gap-13"
                            />
                        </div>
                    )}
                </div>

                {/* //changes */}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div className="policy__details__card__container__sub__title mt-2 mb-2">
                        {t("employeeBenefit.policyDetails")}
                    </div>
                    <div className="flex align-items-center">
                        <Checkbox onChange={e => setChecked(e.checked)} checked={checked}></Checkbox>
                        <label className="ml-2">{t("employeeBenefit.coInsurance")}</label>
                    </div>
                </div>
                <div className="grid mt-2">
                    <div className="col-12 md:col-12 lg:col-12">
                        <DropdownField
                            label={t("employeeBenefit.insuranceCompanyName")}
                            value={formik.values.InsuranceCompanyName}
                            options={InsuranceCompanyOptions}
                            onChange={(e) => {
                                formik.setFieldValue("InsuranceCompanyName", e.value);
                            }}
                            optionLabel="label"
                        />

                    </div>
                </div>

                {checked &&
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ paddingTop: 24, paddingBottom: 28, fontSize: 20, fontWeight: '400', fontFamily: "Nunito, Arial, sans-serif" }}>{t("employeeBenefit.participantDetails")}</div>
                            <Button style={{ marginTop: 24, marginBottom: 24 }} onClick={Handleinsurance}>
                                {t("employeeBenefit.addInsuranceCompany")}
                            </Button>

                        </div>

                        <div className="card" style={{ marginBottom: 24 }}>
                            <DataTable value={TableList} tableStyle={{ minWidth: '50rem' }} scrollable={true}
                                scrollHeight="26vh"
                                emptyMessage={isEmpty ? emptyTableIcon : null}
                            >
                                <Column header={t("employeeBenefit.participantName")} field="ParticipantName" style={{ paddingLeft: 20 }}></Column>
                                <Column header={t("employeeBenefit.siCurrency")} field="SumInsuredcurrency" style={{ paddingLeft: 20 }}></Column>
                                <Column header={t("employeeBenefit.premiumCurrency")} field="Premiumcurrencys" style={{ paddingLeft: 20 }}></Column>
                                <Column header={t("employeeBenefit.sharePercentage")} field="Sharepercentage" style={{ paddingLeft: 20 }}></Column>
                            </DataTable>
                        </div>

                    </div>
                }

                <div className="grid mt-2">
                    <div className="col-12 md:col-6 lg:col-6">
                        <DropdownField
                            label="Insurance Policy Type"
                            value={formik.values.InsurancePolicyType}
                            options={InsurancePolicyTypes}
                            onChange={(e) => {
                                formik.setFieldValue("InsurancePolicyType", e.value);
                            }}
                            optionLabel="label"
                        />
                        {formik.touched.InsurancePolicyType &&
                            formik.errors.InsurancePolicyType && (
                                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                    {formik.errors.InsurancePolicyType}
                                </div>
                            )}
                    </div>
                    <div className="col-12 md:col-6 lg:col-6">
                        <DropdownField
                            label={t("employeeBenefit.accountCode")}
                            value={formik.values.AccountCode}
                            options={AccountCodes}
                            onChange={(e) => {
                                formik.setFieldValue("AccountCode", e.value);
                            }}
                            optionLabel="label"
                        />
                        {formik.touched.AccountCode && formik.errors.AccountCode && (
                            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                {formik.errors.AccountCode}
                            </div>
                        )}
                    </div>
                </div>
                <div className="grid mt-2">
                    <div className="col-12 md:col-6 lg:col-6">
                        <DropdownField
                            label={t("employeeBenefit.paymentType")}
                            value={formik.values.PaymentType}
                            options={PolicyTypes}
                            onChange={(e) => {
                                formik.setFieldValue("PaymentType", e.value);
                            }}
                            optionLabel="label"
                        />
                        {formik.touched.PaymentType &&
                            formik.errors.PaymentType && (
                                <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                    {formik.errors.PaymentType}
                                </div>
                            )}
                    </div>
                    {formik.values.PaymentType === "Credit" && <div className="col-12 md:col-6 lg:col-6">
                        <div className="flex align-items-center" style={{ alignItems: 'center', display: 'flex', height: 64 }}>
                            <Checkbox onChange={e => setPayChecked(e.checked)} checked={paychecked}></Checkbox>
                            <label className="ml-2">{t("employeeBenefit.payInInstallments")}</label>
                        </div>
                    </div>}

                </div>

                {paychecked &&
                    <div className="grid mt-2">
                        <div className="col-12 md:col-6 lg:col-6">
                            <DropdownField
                                label={t("employeeBenefit.installmentType")}
                                value={formik.values.InstallmentType}
                                options={InstallmentType}
                                onChange={(e) => {
                                    formik.setFieldValue("InstallmentType", e.value);
                                }}
                                optionLabel="label"
                            />
                            {formik.touched.InstallmentType &&
                                formik.errors.InstallmentType && (
                                    <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                        {formik.errors.InstallmentType}
                                    </div>
                                )}
                        </div>
                    </div>
                }

                <div className="policy__details__card__sub__title mt-2">
                    Employees Details
                </div>

                <div className="grid mt-2">
                    <div className="col-12 md:col-6 lg:col-6">
                        <DropdownField
                            label={t("employeeBenefit.categoryOfEmployees")}
                            value={formik.values.VehicleBrand}
                            options={VehicleBrands}
                            onChange={(e) => {
                                formik.setFieldValue("VehicleBrand", e.value);
                            }}
                            optionLabel="label"
                        />
                        {formik.touched.VehicleBrand && formik.errors.VehicleBrand && (
                            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                {formik.errors.VehicleBrand}
                            </div>
                        )}
                    </div>
                    <div className="col-12 md:col-6 lg:col-6">

                        <InputTextField
                            label={t("employeeBenefit.occupation")}
                            value={formik.values.CompanyName}
                            onChange={formik.handleChange("Occupation")}
                        />
                        {formik.touched.CompanyName && formik.errors.CompanyName && (
                            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                {formik.errors.CompanyName}
                            </div>
                        )}

                    </div>
                </div>

                <div className="grid mt-2">
                    <div className="col-12 md:col-6 lg:col-6">

                        <InputTextField
                            label={t("employeeBenefit.noOfStaff")}
                            value={formik.values.CompanyName}
                            onChange={formik.handleChange("Occupation")}
                        />
                        {formik.touched.CompanyName && formik.errors.CompanyName && (
                            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                {formik.errors.CompanyName}
                            </div>
                        )}
                    </div>
                    <div className="col-12 md:col-6 lg:col-6">
                        <InputTextField
                            label={t("employeeBenefit.placeOfWork")}
                            value={formik.values.CompanyName}
                            onChange={formik.handleChange("PlaceOfWork")}
                        />
                        {formik.touched.CompanyName && formik.errors.CompanyName && (
                            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                {formik.errors.CompanyName}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid mt-2">
                    <div className="col-12 md:col-6 lg:col-6">
                        <InputTextField
                            label="Estimated Annual Earning"
                            value={formik.values.CompanyName}
                            onChange={formik.handleChange("EstimatedAnnualEarning")}
                        />
                        {formik.touched.CompanyName && formik.errors.CompanyName && (
                            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                {formik.errors.CompanyName}
                            </div>
                        )}
                    </div>
                    <div className="col-12 md:col-6 lg:col-6">
                        <DropdownField
                            label={t("employeeBenefit.geographicalLimit")}
                            value={formik.values.ModelYear}
                            options={ModelYears}
                            onChange={(e) => {
                                formik.setFieldValue("ModelYear", e.value);
                            }}
                            optionLabel="label"
                        />
                        {formik.touched.ModelYear && formik.errors.ModelYear && (
                            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                {formik.errors.ModelYear}
                            </div>
                        )}
                    </div>

                    <div className="col-12 md:col-6 lg:col-6">

                        <InputTextField
                            label={t("employeeBenefit.limitPerPerson")}
                            value={formik.values.CompanyName}
                            onChange={formik.handleChange("LimitPerPerson")}
                        />
                        {formik.touched.CompanyName && formik.errors.CompanyName && (
                            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                {formik.errors.CompanyName}
                            </div>
                        )}
                    </div>
                    <div className="col-12 md:col-6 lg:col-6">
                        <InputTextField
                            label="Limit per Occurrence*"
                            value={formik.values.CompanyName}
                            onChange={formik.handleChange("LimitPerOccurrence")}
                        />
                        {formik.touched.CompanyName && formik.errors.CompanyName && (
                            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                {formik.errors.CompanyName}
                            </div>
                        )}
                    </div>
                    <div className="col-12 md:col-6 lg:col-6">
                        <InputTextField
                            label={t("employeeBenefit.remarks")}
                            value={formik.values.CompanyName}
                            onChange={formik.handleChange("Remarks")}
                        />
                        {formik.touched.CompanyName && formik.errors.CompanyName && (
                            <div style={{ fontSize: 12, color: "red" }} className="mt-3">
                                {formik.errors.CompanyName}
                            </div>
                        )}
                    </div>

                </div>
                <div >
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                        }}
                    >
                        <Button
                            onClick={() => {
                                formik.handleSubmit();
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                backgroundColor: '#0072d8', 
                                color: '#fff',
                                border: '1px solid #0072d8',
                                borderRadius: '6px',
                                fontFamily: "Nunito, Arial, sans-serif",
                                fontSize: '16px',
                                fontWeight: 400,
                                lineHeight: '24px',
                            }}
                        >
                            Next
                        </Button>
                    </div>
                </div>

            </Card>

            <DialogList setVisible={setVisible} visible={visible} />
        </div>
    );
};

export default CQPolicyAndRiskDetails;
