import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import "../CommissionTabel/index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { useNavigate } from "react-router-dom";
import MasterStatusToggle from "../../common/MasterStatusToggle";
import { Toast } from "primereact/toast";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import { useDispatch } from "react-redux";
import { getCommission, getCommissionView, getPatchCommissionEditMiddleware } from "../store/commissionMiddleWare";
import SvgEditicons from "../../../../assets/icons/SvgEditicons";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";

const CommissionTabel = ({ handleEdit, newDataTable, commissionList, getCommissionEdit }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const handleNavigateView = (columnData) => {
        dispatch(getCommissionView(columnData))

        navigate(`/master/generals/commission/viewcommission/${columnData.id}`)
    }
    const handleEditNavigate = (columnData) => {
        dispatch(getPatchCommissionEditMiddleware(columnData))
        navigate(`/master/generals/commission/editcommission`)
    }


    const headerStyle = {
        // width: '10rem',
        // backgroundColor: 'var(--color-danger)',
        fontSize: 16,
        fontFamily: "Nunito, Arial, sans-serif",
        fontWeight: 500,
        padding: "1rem",
        color: '#000',
        border: 'none'
    };
    const headeraction = {
        fontSize: 16,
        fontFamily: "Nunito, Arial, sans-serif",
        fontWeight: 500,
        padding: "1rem",
        color: '#000',
        border: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItem: 'center'
    }

    const template2 = {
        layout: 'RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink',
        RowsPerPageDropdown: (options) => {
            const dropdownOptions = [
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
      ];

            return (
                <React.Fragment >
                    <span className="mx-1" style={{ color: 'var(--text-color)', userSelect: 'none' }} >
                        {t("generalMasters.rowCount")}{' '}
                    </span>
                    <Dropdown value={options.value} className="pagedropdown_container" options={dropdownOptions} onChange={options.onChange} />
                </React.Fragment>
            );
        },
    };


    const statusToast = useRef(null);
    const renderToggleButton = (rowData) => (
        <MasterStatusToggle
            type="commission"
            record={rowData}
            onChanged={() => dispatch(getCommission())}
            onError={(error) => statusToast.current?.show({ severity: "error", detail: error.message })}
        />
    );

    return (
        <div className="petty__cash__table__container">
            <Toast ref={statusToast} />
            <DataTable
                value={commissionList}
                style={{ overflowY: 'auto', maxWidth: '100%' }}
                responsive={true}
                className='table__view__Journal__Voture'
                scrollable={true}
                scrollHeight="40vh"
                paginator
                paginatorLeft
                rows={20}
                rowsPerPageOptions={[20, 50, 100]}
                currentPageReportTemplate="{first} - {last} of {totalRecords}"
                paginatorTemplate={template2}

            >
                <Column
                    field="commissionCode"
                    header="Commission Code"
                    className="fieldvalue_container"
                    headerStyle={headerStyle}
                    sortable
                    body={(rowData) => rowData.commissionCode?.toUpperCase()}

                ></Column>
                    <Column
                    field="insuranceCompany"
                    header="Insurance Company"
                    className="fieldvalue_container"
                    headerStyle={headerStyle}
                    sortable
                    body={(rowData) => rowData.insuranceCompany?.toUpperCase()}

                ></Column>

                <Column
                    field="product"
                    header="Product"
                    className="fieldvalue_container"
                    headerStyle={headerStyle}
                    sortable
                    body={(rowData) => rowData.product?.toUpperCase()}
                ></Column>

                <Column
                    field="selectCover"
                    header="Covers"
                    className="fieldvalue_container"
                    headerStyle={headerStyle}
                    body={(rowData) => rowData.selectCover?.toUpperCase()}

                ></Column>
                <Column body={(row) => formatAppDate(row.effectiveFrom)}
                    field="effectiveFrom"
                    header="Effective From"
                    className="fieldvalue_container"

                    headerStyle={headerStyle}
                ></Column>
                <Column body={(row) => formatAppDate(row.effectiveTo)}
                    field="effectiveTo"
                    header="Effective To"
                    className="fieldvalue_container"
                    headerStyle={headerStyle}

                ></Column>

                <Column
                    body={renderToggleButton}
                    headerStyle={headerStyle}
                    field="status"
                    header="Status"

                    className="fieldvalue_container"
                ></Column>
                <Column
                    body={(columnData) => (
                        <div style={{ display: 'flex', justifyContent: 'space-between', cursor: "pointer" }}>
                            <SvgIconeye onClick={() => handleNavigateView(columnData)} />
                            <SvgEditicons onClick={() => handleEditNavigate(columnData)} />
                        </div>
                    )}
                    header="Action"
                    className="fieldvalue_container"
                    headerStyle={headeraction}

                ></Column>
            </DataTable>
        </div>
    );
};

export default CommissionTabel;
