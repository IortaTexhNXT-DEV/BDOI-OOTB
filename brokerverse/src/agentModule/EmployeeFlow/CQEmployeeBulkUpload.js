import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";
import SvgUploadArrowIcon from "./uploadIcon";
import './index.scss'
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgDownArrow from "../../assets/agentIcon/SvgDownArrow";
import { Dropdown } from "primereact/dropdown";
import React, { useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import InputTextField from '../../components/InputField';
import { useFormik } from "formik";
import "./index.scss";
import PlusIcon from "./PlusIcon";
import SvgDeleteIcon from "../../assets/icons/SvgDeleteIcon";
import SvgEdit from "../../assets/icons/SvgEdits";
import { useNavigate } from "react-router-dom"; 
import SvgLeftArrow from "../../assets/agentIcon/SvgLeftArrow";

const CQEmployeeBulkUpload = ({ action, flow, }) => {
    const { t } = useTranslation();
    const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
    const [employeeList, setEmployeeList] = useState([]);
    const fileInputRef = useRef(null);
    const [selectedFileName, setSelectedFileName] = useState("");
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
                        <span
                            className="table__selector__text"
                            style={{ color: "var(--text-color)", userSelect: "none" }}
                        >
                            {t("employeeBenefit.rowsPerPage")}{" "}
                        </span>
                        <Dropdown
                            value={options.value}
                            className="pagedropdown_container"
                            options={dropdownOptions}
                            onChange={options.onChange}
                            dropdownIcon={<SvgDownArrow />}
                        />
                    </React.Fragment>
                </div>
            );
        },
    };

    const formik = useFormik({
        initialValues: {
            EmployeeID: '',
            Name: '',
            DateofBirth: '',
            Gender: '',
            Occupation: '',
            Salary: '',
            PlanClass: '',
            SumInsured: '',
            Remarks: '',
        },
        onSubmit: (values) => {
            const errors = {};

            if (!values.EmployeeID.trim()) errors.EmployeeID = t("employeeBenefit.employeeIdRequired");
            if (!values.Name.trim()) errors.Name = t("employeeBenefit.nameRequired");
            if (!values.DateofBirth) errors.DateofBirth = t("employeeBenefit.dateOfBirthRequired");
            if (!values.Gender.trim()) errors.Gender = t("employeeBenefit.genderRequired");
            if (!values.Occupation.trim()) errors.Occupation = t("employeeBenefit.occupationRequired");
            if (!values.Salary.trim()) errors.Salary = t("employeeBenefit.salaryRequired");
            if (!values.PlanClass.trim()) errors.PlanClass = t("employeeBenefit.planClassRequired");
            if (!values.SumInsured.trim()) errors.SumInsured = t("employeeBenefit.sumInsuredRequired");
            if (!values.Remarks.trim()) errors.Remarks = t("employeeBenefit.remarksRequired");

            if (Object.keys(errors).length > 0) {
                formik.setErrors(errors);
                return;
            }

            setEmployeeList(prevList => [...prevList, values]);

            setShowAddEmployeeModal(false);
            formik.resetForm();
        }
    });

    const renderEmployeeID = (rowData) => (
        <div className="category__text">{rowData.EmployeeID?.toUpperCase()}</div>
    );

    const renderName = (rowData) => (
        <div className="category__text">{rowData.Name?.toUpperCase()}</div>
    );

    const renderDOB = (rowData) => (
        <div className="category__text">{rowData.DateofBirth}</div>
    );
    const renderSerialNumber = (rowData, { rowIndex }) => (
        <div className="category__text">{rowIndex + 1}</div>
    );




    const handleDummyUpload = () => {
        const dummyData = [
            {
                EmployeeID: 'EMP001',
                Name: 'Alice Smith',
                DateofBirth: '1990-01-01',
                Gender: 'Female',
                Occupation: 'Engineer',
                Salary: '50000',
                PlanClass: 'A',
                SumInsured: '100000',
                Remarks: 'Healthy'
            },
            {
                EmployeeID: 'EMP002',
                Name: 'Bob Johnson',
                DateofBirth: '1988-05-12',
                Gender: 'Male',
                Occupation: 'Designer',
                Salary: '48000',
                PlanClass: 'B',
                SumInsured: '95000',
                Remarks: 'No issues'
            },
            {
                EmployeeID: 'EMP003',
                Name: 'Charlie Brown',
                DateofBirth: '1992-09-23',
                Gender: 'Male',
                Occupation: 'Developer',
                Salary: '60000',
                PlanClass: 'A',
                SumInsured: '120000',
                Remarks: 'Remote worker'
            },
            {
                EmployeeID: 'EMP004',
                Name: 'Diana Prince',
                DateofBirth: '1995-03-15',
                Gender: 'Female',
                Occupation: 'Analyst',
                Salary: '55000',
                PlanClass: 'C',
                SumInsured: '110000',
                Remarks: 'Recent hire'
            },
            {
                EmployeeID: 'EMP005',
                Name: 'Ethan Hunt',
                DateofBirth: '1985-11-30',
                Gender: 'Male',
                Occupation: 'Agent',
                Salary: '75000',
                PlanClass: 'A',
                SumInsured: '150000',
                Remarks: 'Top performer'
            }
        ];

        setEmployeeList((prevList) => [...prevList, ...dummyData]);
        setShowBulkUploadModal(false);
    };

    const navigate = useNavigate();

    const handleBack = () => {
        navigate(-1);
    };
    const handleLeadNavigation = () => {
        navigate(-1);
    };

    return (
        <div>

            <div className="order__summary__main__title">
                {flow === "renewal" ? "Client" : "Leads"}
            </div>
            <div
                onClick={handleLeadNavigation}
                className="order__summary__back__btn mt-3 cursor-pointer"
            >
                 <SvgLeftArrow />

                <div className="order__summary__back__btn__title">
                    {flow === "renewal"
                        ? "Carson Darrin / Client ID : 12345678"
                        : "Lead ID : 12345678"}
                </div>
            </div>

            <Card style={{ minHeight: '65vh',marginTop:"20px" }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
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
                        {action === "quotedetails" ? "Edit Quote" : "Create Quote"}
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '13px',
                        }}
                    >
                        <Button
                            label="Bulk Upload"
                            icon={<SvgUploadArrowIcon />}
                            onClick={() => setShowBulkUploadModal(true)}
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
                        />
                        <Button
                            label="Add Employee"
                            onClick={() => setShowAddEmployeeModal(true)}
                            icon={<PlusIcon />}
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
                        />
                    </div>

                </div>

                <div style={{ paddingTop: '40px' }} className="lead__table__container">

                    <DataTable
                        value={employeeList}
                        paginator
                        rows={5}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        currentPageReportTemplate="{first} - {last} of {totalRecords}"
                        paginatorTemplate={template2}
                        className="corrections__table__main"
                        dataKey="EmployeeID"
                        emptyMessage={
                            <div style={{
                                textAlign: 'center',
                                width: '100%',
                                padding: '50px 0',
                                fontSize: '18px',
                                fontWeight: '500',
                                color: '#888'
                            }}>
                                No employees added yet.
                            </div>
                        }
                    >
                        <Column body={renderSerialNumber} header="S.No" />
                        <Column body={renderEmployeeID} header="Employee ID" />
                        <Column body={renderName} header="Name" />
                        <Column body={renderDOB} header="Date of Birth" />
                        <Column body={(rowData) => <div>{rowData.Gender}</div>} header="Gender" />
                        <Column body={(rowData) => <div>{rowData.Occupation}</div>} header="Occupation" />
                        <Column body={(rowData) => <div>{rowData.Salary}</div>} header="Salary" />
                        <Column
                            header="Actions"
                            body={(rowData, { rowIndex }) => (
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <Button
                                        icon={<SvgEdit />}
                                    />
                                    <Button
                                        icon={<SvgDeleteIcon />}
                                        severity="danger"
                                    />
                                </div>
                            )}
                            style={{ textAlign: 'center', width: '150px' }}
                        />
                    </DataTable>

                </div>

                <div >

                    <div className="bottom__button__wrapper" style={{ display: 'flex', alignItems: 'center' }}>
                        <div onClick={handleBack} style={{ color: 'black', cursor: 'pointer', marginInline: '25px' }}>
                            Back
                        </div>
                        <Button
                            onClick={() => {
                                // handle next click
                                navigate('/agent/employee-benefit/create-quote-Coverage-details')
                            }}
                            label="Next"
                            className="next__button"
                        />
                    </div>

                </div>

                <Dialog
                    header="Add Employee"
                    visible={showAddEmployeeModal}
                    style={{ width: '50vw' }}
                    onHide={() => setShowAddEmployeeModal(false)}
                    className="policy__details__card__container"
                >
                    <form onSubmit={formik.handleSubmit}>
                        <InputTextField
                            label="Employee ID*"
                            value={formik.values.EmployeeID}
                            onChange={formik.handleChange('EmployeeID')}
                        />
                        {formik.errors.EmployeeID && (
                            <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{formik.errors.EmployeeID}</div>
                        )}

                        <InputTextField
                            label="Name*"
                            value={formik.values.Name}
                            onChange={formik.handleChange('Name')}
                        />
                        {formik.errors.Name && (
                            <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{formik.errors.Name}</div>
                        )}

                        <div className="field">
                            <label>Date of Birth*</label>
                            <input
                                type="date"
                                name="DateofBirth"
                                value={formik.values.DateofBirth}
                                onChange={formik.handleChange}
                                className="w-full"
                                style={{
                                    padding: '10px',
                                    borderRadius: '6px',
                                    border: '1px solid #ccc',
                                    fontSize: '16px',
                                    width: '100%',
                                }}
                            />
                            {formik.errors.DateofBirth && (
                                <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{formik.errors.DateofBirth}</div>
                            )}
                        </div>

                        <div className="field">
                            <label>Gender*</label>
                            <Dropdown
                                value={formik.values.Gender}
                                options={[
                                    { label: 'Male', value: 'Male' },
                                    { label: 'Female', value: 'Female' },
                                    { label: 'Other', value: 'Other' },
                                ]}
                                onChange={(e) => formik.setFieldValue('Gender', e.value)}
                                placeholder="Select Gender"
                                className="w-full"
                            />
                            {formik.errors.Gender && (
                                <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{formik.errors.Gender}</div>
                            )}
                        </div>

                        <InputTextField
                            label="Occupation*"
                            value={formik.values.Occupation}
                            onChange={formik.handleChange('Occupation')}
                        />
                        {formik.errors.Occupation && (
                            <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{formik.errors.Occupation}</div>
                        )}

                        <InputTextField
                            label="Salary*"
                            value={formik.values.Salary}
                            onChange={formik.handleChange('Salary')}
                        />
                        {formik.errors.Salary && (
                            <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{formik.errors.Salary}</div>
                        )}

                        <InputTextField
                            label="Plan/Class*"
                            value={formik.values.PlanClass}
                            onChange={formik.handleChange('PlanClass')}
                        />
                        {formik.errors.PlanClass && (
                            <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{formik.errors.PlanClass}</div>
                        )}

                        <InputTextField
                            label="Sum Insured*"
                            value={formik.values.SumInsured}
                            onChange={formik.handleChange('SumInsured')}
                        />
                        {formik.errors.SumInsured && (
                            <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{formik.errors.SumInsured}</div>
                        )}

                        <InputTextField
                            label="Remarks*"
                            value={formik.values.Remarks}
                            onChange={formik.handleChange('Remarks')}
                        />
                        {formik.errors.Remarks && (
                            <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>{formik.errors.Remarks}</div>
                        )}

                        <div style={{ marginTop: '20px', textAlign: 'right' }}>
                            <Button
                                type="submit"
                                label="Submit"
                                style={{
                                    backgroundColor: '#0072d8',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '10px 20px',
                                    fontSize: '16px',
                                }}
                            />
                        </div>
                    </form>
                </Dialog>

                <Dialog
                    header="Bulk Upload Employees"
                    visible={showBulkUploadModal}
                    style={{ width: '40vw' }}
                    onHide={() => setShowBulkUploadModal(false)}
                    className="policy__details__card__container"
                >
                    <div style={{ padding: '20px' }}>
                        <p style={{ marginBottom: '16px' }}>
                            Please upload a CSV file containing employee data in the correct format.
                        </p>

                        <div style={{ marginBottom: '16px' }}>
                            <input
                                type="file"
                                accept=".csv"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                        setSelectedFileName(file.name);
                                    }
                                }}
                            />

                            <div
                                onClick={() => fileInputRef.current.click()}
                                style={{
                                    border: '2px dashed #0072d8',
                                    padding: '20px',
                                    borderRadius: '10px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    backgroundColor: '#f9f9ff',
                                    color: '#333',
                                }}
                            >
                                <div style={{ fontSize: '16px', fontWeight: '500' }}>
                                    {selectedFileName ? (
                                        <span>Selected File: <strong>{selectedFileName}</strong></span>
                                    ) : (
                                        <span>Click to upload CSV file</span>
                                    )}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666' }}>Only .csv files allowed</div>
                            </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <Button
                                label="Upload"
                                icon={<SvgUploadArrowIcon />}
                                style={{
                                    backgroundColor: '#0072d8',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '10px 20px',
                                    fontSize: '16px',
                                }}
                                onClick={handleDummyUpload}
                            />
                        </div>
                    </div>
                </Dialog>

            </Card>

        </div>
    );
};

export default CQEmployeeBulkUpload;
