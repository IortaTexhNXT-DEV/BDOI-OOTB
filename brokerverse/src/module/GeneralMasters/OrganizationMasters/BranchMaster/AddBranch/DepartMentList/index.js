import { useState, useEffect, useRef } from "react";
import { Toast } from "primereact/toast";
import SvgAdd from "../../../../../../assets/icons/SvgAdd";
import { Button } from "primereact/button";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import SvgTable from "../../../../../../assets/icons/SvgTable";
import { Dropdown } from "primereact/dropdown";
import { Dialog } from "primereact/dialog";
import InputField from "../../../../../../components/InputField";
import { useDispatch, useSelector } from "react-redux";
import { useFormik } from "formik";
import {
  getDepartmentListMiddleware,
  getDepatmentEditData,
  getDepatmentView,
  postAddDepartment,
  postPatchDepatmentEdit,
} from "../../store/branchMiddleware";
import SvgIconeye from "../../../../../../assets/icons/SvgIconeye";
import SvgEditicons from "../../../../../../assets/icons/SvgEditicons";

const DepartMentList = ({ action, branchCode }) => {
  const { departmentList, depatmentView, getDepartmentPatch } =
    useSelector(({ organizationBranchMainReducers }) => {
      return {
        loading: organizationBranchMainReducers?.loading,
        departmentList: organizationBranchMainReducers?.departmentList,
        depatmentView: organizationBranchMainReducers?.depatmentView,
        getDepartmentPatch: organizationBranchMainReducers?.getDepartmentPatch,
      };
    });
  const toastRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [visibleView, setVisibleView] = useState(false);
  const [visibleedit, setVisibleEdit] = useState(false);
  const isEmpty = !departmentList?.length;

  const emptyTableIcon = (
    <div>
      <div className="empty-table-icon">
        <SvgTable />
      </div>
      <div className="no__data__found">No data entered</div>
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
        <div className="table__selector">
          {/* <React.Fragment> */}
          <span style={{ color: "var(--text-color)", userSelect: "none" }}>
            Row count :{" "}
          </span>
          <Dropdown
            value={options.value}
            className="pagedropdown_container"
            options={dropdownOptions}
            onChange={options.onChange}
          />
          {/* </React.Fragment> */}
        </div>
      );
    },
  };

  const handleView = (columnData) => {
    dispatch(getDepatmentView(columnData));
    setVisibleView(true);
  };
  const handleEdit = (columnData) => {
    dispatch(getDepatmentEditData(columnData));
    setVisibleEdit(true);
  };
  const headerStyle = {
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
    // padding: 6,
    color: "#000",
    border: "none",
    display: "flex",
    justifyContent: "center",
    alignItem: "center",
  };
  const dispatch = useDispatch();
  const loadDepartments = () => {
    if (branchCode) dispatch(getDepartmentListMiddleware({ BranchCode: branchCode }));
  };
  useEffect(loadDepartments, [dispatch, branchCode]); // eslint-disable-line react-hooks/exhaustive-deps
  const initialValues = {
    DepartmentCode: "",
    DepartmentName: "",
    Description: "",
  };
  const handleSubmit = async (values) => {
    const thunk = values?.id ? postPatchDepatmentEdit : postAddDepartment;
    try {
      await dispatch(thunk({ ...values, BranchCode: branchCode })).unwrap();
      setVisible(false);
      setVisibleEdit(false);
      loadDepartments();
    } catch (error) {
      toastRef.current?.show({ severity: "error", detail: error });
    }
  };
  const customValidation = (values) => {
    const errors = {};

    if (!values.DepartmentCode) {
      errors.DepartmentCode = "This field is required";
    }
    if (!values.DepartmentName) {
      errors.DepartmentName = "This field is required";
    }
    if (!values.Description) {
      errors.Description = "This field is required";
    }
    return errors;
  };
  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    onSubmit: handleSubmit,
  });


  const setFormikValues = () => {
    const DepartmentCodeData = getDepartmentPatch?.DepartmentCode;
    const updatedValues = {
      id: getDepartmentPatch.id,
      DepartmentCode: DepartmentCodeData,
      DepartmentName: getDepartmentPatch?.DepartmentName,
      Description: getDepartmentPatch?.Description,
    };

    formik.setValues({ ...formik.values, ...updatedValues });
  };

  useEffect(() => {
    setFormikValues();
  }, [getDepartmentPatch]);

  return (
    <div className="overall_list">
      <Toast ref={toastRef} />
      <div className="cardlist_container">
        <div className="subhead_list">
          <label className="head_lable">Department List</label>

          {action === "view" ? (
            ""
          ) : (
            <Button
              label="Add"
              icon={<SvgAdd />}
              onClick={() => {
                formik.resetForm();
                setVisible(true);
              }}
            />
          )}
        </div>

        <DataTable
          value={departmentList}
          tableStyle={{ minWidth: "50rem", marginTop: "1rem" }}
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
            field="DepartmentCode"
            body={(rowData) => rowData.DepartmentCode?.toUpperCase()}
            header="Department Code"
            headerStyle={headerStyle}
          ></Column>
          <Column
            field="DepartmentName"
            body={(rowData) => rowData.DepartmentName}
            header="Department Name"
            headerStyle={headerStyle}
          ></Column>
          <Column
            field="status"
            body={(rowData) => rowData.status?.toUpperCase()}
            header="Status"
            headerStyle={headerStyle}
          ></Column>
          <Column
            body={(columnData) => (
              <div className="action_icons">
                <SvgIconeye onClick={() => handleView(columnData)} />
                <span>
                  {action === "view" ? (
                    ""
                  ) : (
                    <SvgEditicons onClick={() => handleEdit(columnData)} />
                  )}
                </span>
              </div>
            )}
            header="Action"
            headerStyle={headeraction}
            className="fieldactionvalue_container"
          ></Column>
        </DataTable>
      </div>
      <Dialog
        header="Add Department"
        visible={visible}
        style={{ width: "40vw", boxShadow: "none" }}
        onHide={() => setVisible(false)}
        className="dialog__addstyle master__flow__common__dialog__container"
      >
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="Department Code"
                placeholder={"Enter"}
                value={formik.values.DepartmentCode}
                onChange={formik.handleChange("DepartmentCode")}
              />
              {formik.touched.DepartmentCode &&
                formik.errors.DepartmentCode && (
                  <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                    {formik.errors.DepartmentCode}
                  </div>
                )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="Department Name"
                placeholder={"Enter"}
                value={formik.values.DepartmentName}
                onChange={formik.handleChange("DepartmentName")}
              />
              {formik.touched.DepartmentName &&
                formik.errors.DepartmentName && (
                  <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                    {formik.errors.DepartmentName}
                  </div>
                )}
            </div>
          </div>
        </div>
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-12 lg-col-12">
            <div>
              <InputField
                classNames="field__container"
                label="Description"
                placeholder={"Enter"}
                value={formik.values.Description}
                onChange={formik.handleChange("Description")}
              />
              {formik.touched.Description && formik.errors.Description && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.Description}
                </div>
              )}
            </div>
          </div>

          <div className="nexttextlable_container">
            <Button
              className="submittextlabel_button p-2"
              label="Save"
              onClick={formik.handleSubmit}
            />
          </div>
        </div>
      </Dialog>
      <Dialog
        header="Department Details"
        visible={visibleView}
        style={{ width: "40vw", boxShadow: "none" }}
        onHide={() => setVisibleView(false)}
        className="master__flow__common__dialog__container"
      >
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="Department Code"
                placeholder={"Enter"}
                value={depatmentView.DepartmentCode}
              />
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="Department Name"
                placeholder={"Enter"}
                value={depatmentView.DepartmentName}
              />
            </div>
          </div>
        </div>
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-12 lg-col-12">
            <div>
              <InputField
                classNames="field__container"
                label="Description"
                placeholder={"Enter"}
                value={depatmentView.Description}
              />
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        header="Edit Details"
        visible={visibleedit}
        style={{ width: "40vw", boxShadow: "none" }}
        className="master__flow__common__dialog__container"
        onHide={() => setVisibleEdit(false)}
      >
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="Department Code"
                placeholder={"Enter"}
                value={formik.values.DepartmentCode}
                onChange={formik.handleChange("DepartmentCode")}
              />
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label="Department Name"
                placeholder={"Enter"}
                value={formik.values.DepartmentName}
                onChange={formik.handleChange("DepartmentName")}
              />
            </div>
          </div>
        </div>
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-12 lg-col-12">
            <div>
              <InputField
                classNames="field__container"
                label="Description"
                placeholder={"Enter"}
                value={formik.values.Description}
                onChange={formik.handleChange("Description")}
              />
            </div>
          </div>
        </div>
        <div className="nexttextlable_container">
          <Button
            className="submittextlabel_button p-2"
            label="Update"
            onClick={formik.handleSubmit}
          />
        </div>
      </Dialog>
    </div>
  );
};

export default DepartMentList;
