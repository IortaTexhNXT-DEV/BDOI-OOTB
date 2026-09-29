import React, { useState, useRef, useEffect } from "react";
import "../index.scss";
import { useFormik } from "formik";
import InputField from "../../../../../components/InputField";
import { Button } from "primereact/button";
import { useDispatch, useSelector } from "react-redux";
import { postEditRequestMiddleware} from "../../store/pettyCashRequestMiddleware";
import { Dialog } from "primereact/dialog";


const initialValues = {
    Narration: "",
    Amount: "",
   
  };
  


const AddDialog = ({visible,setVisible}) => {
    const dispatch = useDispatch();
    const customValidation = (values) => {
        const errors = {};
    
        if (!values.Narration) {
          errors.Narration = "This field Code is required";
        }
        if (!values.Amount) {
          errors.Amount = "This field is required";
        }
        
        
        return errors;
      };


      const handleSubmit = (value) => {
        // const valueWithId = {
        //     ...value,
        //     id: editrequestDetails?.length + 1,
        // };
        console.log("first12", value)
        dispatch(postEditRequestMiddleware(value));
        setVisible(false)
        formik.setFieldValue("Narration",);
    formik.setFieldValue("Amount",);
    };

    const formik = useFormik({
        initialValues: initialValues,
        validate: customValidation,
        onSubmit: handleSubmit,
      });
    return (
        <div>
            <Dialog
                header="Add Request Item"
                visible={visible}
                style={{ width: "50vw",boxShadow:"none" }}
                onHide={() => setVisible(false)}
                headerStyle={{
                    color: "#343434",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 16,
                    fontWeight: 500,
                    // lineHeight: "150%",
                }}
                className="dailog__container master__flow__common__dialog__container"
               
            >
                
                    <div className="grid">
                        <div className="col-12 md:col-8 lg:col-8">
                            <InputField
                                // classNames="input__filed"
                                classNames="fielduniqueone__container"
                                label="Narration"
                                placeholder="Enter"
                                textColor={"#111927"}
                                textSize={"16"}
                                textWeight={500}
                                value={formik.values.Narration}
                                onChange={formik.handleChange("Narration")}
                                error={formik.touched.Narration && formik.errors.Narration}
                            />
                        </div>
                        <div className="col-12 md:col-4 lg:col-4">
                            <InputField
                                classNames="fielduniqueone__container"
                                label="Amount"
                                placeholder="Enter"
                                textColor={"#111927"}
                                textSize={"16"}
                                textWeight={500}
                                value={formik.values.Amount}
                                onChange={formik.handleChange("Amount")}
                                // error={formik.touched.Amount && formik.errors.Amount}
                            />
                        </div>
                    </div>
              
                <div className="grid">
                    <div className="col-12 md:col-12 lg:col-12 bt__container">
                        <Button
                            label="Save"
                            className="add__btn"
                        onClick={() => {
                          formik.handleSubmit();
                        }}
                        />
                    </div>
                </div>
            </Dialog>
        </div>
    )
}

export default AddDialog