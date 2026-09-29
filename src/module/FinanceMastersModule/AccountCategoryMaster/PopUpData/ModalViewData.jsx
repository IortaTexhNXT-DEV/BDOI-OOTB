import React, { useState } from "react";
import { Dialog } from "primereact/dialog";
import "./index.scss";
import { useFormik } from "formik";
import DropDowns from "../../../../components/DropDowns";
import InputField from "../../../../components/InputField";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { useSelector } from "react-redux";

const ModalViewData = ({
  visible,
  setVisible,
  setEditID,
  handleSave,
  handleEdit,
}) => {
  const { AccountCategoryDetailView, loading } = useSelector(
    ({ accountCategoryReducer }) => {
      return {
        loading: accountCategoryReducer?.loading,
        AccountCategoryDetailView:
          accountCategoryReducer?.AccountCategoryDetailView,
      };
    }
  );

  return (
    <Dialog
      header={"Account Category Detail"}
      visible={visible}
      className="account__category__jv__Edit__modal__container master__flow__common__dialog__container"
      onHide={() => setVisible(false)}
      dismissableMask={true}
      style={{ boxShadow: "none" }} 
    >
      <div className="form__container">
        <div className="grid m-0 p-0">
          <div className="col-12 md:col-12 lg:col-4 xl:col-4 ">
            <InputField
              disabled={true}
              classNames="input__field__corrections"
              className="input__label__corrections"
              label="Account Category Code"
              placeholder="enter"
              value={AccountCategoryDetailView?.accountCategoryCode}
            />
          </div>
          <div className="col-12 md:col-12 lg:col-8 xl:col-8 ">
            <InputField
              disabled={true}
              classNames="input__field__corrections"
              className="input__label__corrections"
              label="Account Category Name"
              placeholder="enter"
              value={AccountCategoryDetailView?.accountCategoryName}
            />
          </div>
          <div className="col-12 md:col-12 lg:col-8 xl:col-8 ">
            <InputField
              disabled={true}
              classNames="input__field__corrections"
              className="input__label__corrections"
              label="Description"
              placeholder="enter"
              value="Account Category description"
            />
          </div>

          <div
            className="col-12 save__popup__correction"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "flex-end",
            }}
          ></div>
        </div>
      </div>
    </Dialog>
  );
};

export default ModalViewData;
