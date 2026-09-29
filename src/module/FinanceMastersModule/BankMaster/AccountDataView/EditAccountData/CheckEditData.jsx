
import React, { useEffect } from 'react'
import "../EditAccountData/index.scss"
import { useFormik } from 'formik';
import { Dialog } from 'primereact/dialog';
import InputField from '../../../../../components/InputField';
import { Button } from 'primereact/button';
import { useDispatch } from 'react-redux';
import { postChequeDataMiddleWare, postChequeEditDataMiddleWare, updateChequeDataMiddleWare } from '../../store/bankMasterMiddleware';

const CheckEditData = ({  visible, visibleEdit, setVisible, setVisibleEdit, getEditChequeData }) => {
    console.log(getEditChequeData, "getEditChequeData");
    const initialValues = {
        chequeBookNo: "",
        chequeLeafBegining: "",
        chequeLeafEnd: ""
    }

    const dispatch = useDispatch()
    const handleSubmit = (values) => {
        // if (values) {

        // }
        // else {
       if(values){
        setVisible(false)
        dispatch(postChequeDataMiddleWare(values));
        formik.resetForm(); 
       }
        // }
    }
    const customValidation = (values) => {
        const errors = {};

        if (!values.chequeBookNo) {
            errors.chequeBookNo = "This field Code is required";
        }
        if (!values.chequeLeafBegining) {
            errors.chequeLeafBegining = "This field is required";
        }
        if (!values.chequeLeafEnd) {
            errors.chequeLeafEnd = "This field is required";
        }


        return errors;
    };

    const formik = useFormik({
        initialValues: initialValues,
        validate: customValidation,
        onSubmit: (values) => {

            handleSubmit(values);

        },
    });
    const handleUpdate = () => {
        setVisibleEdit(false);
        dispatch(postChequeEditDataMiddleWare(formik.values));
        formik.resetForm();
        
    }

    const setFormikValues = () => {
        const updatedValues = {
            id: getEditChequeData?.id,
            chequeBookNo: getEditChequeData?.chequeBookNo,
            chequeLeafBegining: getEditChequeData?.chequeLeafBegining,
            chequeLeafEnd: getEditChequeData?.chequeLeafEnd,
        };
        formik.setValues({ ...formik.values, ...updatedValues });
    };

    useEffect(() => {
        setFormikValues();
    }, [getEditChequeData]);

    return (
        <div>
            <Dialog
                header={"Edit Cheque book"}
                visible={visibleEdit}
                style={{ width: "50vw",boxShadow:"none" }}
                onHide={() => setVisibleEdit(false)}
                className='master__flow__common__dialog__container'
                
            >
                <div className="grid">
                    <div className="sm-col-12 col-12 md:col-6 lg-col-6">
                        <div>
                            <InputField
                                classNames="field__container"
                                label="Cheque Book Number"
                                placeholder={"Enter"}
                                value={formik.values.chequeBookNo}
                                onChange={formik.handleChange("chequeBookNo")}
                                error={formik.errors.chequeBookNo}
                            />
                        </div>
                    </div>
                    <div className="sm-col-12 col-12 md:col-6 lg-col-6">
                        <div>
                            <InputField
                                classNames="field__container"
                                label="Cheque Leaf Beginning"
                                placeholder={"Enter"}
                                value={formik.values.chequeLeafBegining}
                                onChange={formik.handleChange("chequeLeafBegining")}
                                error={formik.errors.chequeLeafBegining}
                            />
                        </div>
                    </div>
                </div>
                <div className="grid">
                    <div className="sm-col-12 col-12 md:col-6 lg-col-6">
                        <div>
                            <InputField
                                classNames="field__container"
                                label="Cheque Leaf End"
                                placeholder={"Enter"}
                                value={formik.values.chequeLeafEnd}
                                onChange={formik.handleChange("chequeLeafEnd")}
                                error={formik.errors.chequeLeafEnd}
                            />
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                    }}
                >
                    <Button
                        label={"Update"}
                        className="savebutton_container"
                        onClick={handleUpdate}
                    />
                </div>
            </Dialog>
            <Dialog
                header={"Add Cheque book"}
                visible={visible}
                style={{ width: "50vw",boxShadow:"none" }}
                onHide={() => setVisible(false)}
                className='master__flow__common__dialog__container'
               
            >
                <div className="grid">
                    <div className="sm-col-12 col-12 md:col-6 lg-col-6">
                        <div>
                            <InputField
                                classNames="field__container"
                                label="Cheque Book Number"
                                placeholder={"Enter"}
                                value={formik.values.chequeBookNo}
                                onChange={formik.handleChange("chequeBookNo")}
                                error={formik.errors.chequeBookNo}
                            />
                        </div>
                    </div>
                    <div className="sm-col-12 col-12 md:col-6 lg-col-6">
                        <div>
                            <InputField
                                classNames="field__container"
                                label="Cheque Leaf Beginning"
                                placeholder={"Enter"}
                                value={formik.values.chequeLeafBegining}
                                onChange={formik.handleChange("chequeLeafBegining")}
                                error={formik.errors.chequeLeafBegining}
                            />
                        </div>
                    </div>
                </div>
                <div className="grid">
                    <div className="sm-col-12 col-12 md:col-6 lg-col-6">
                        <div>
                            <InputField
                                classNames="field__container"
                                label="Cheque Leaf End"
                                placeholder={"Enter"}
                                value={formik.values.chequeLeafEnd}
                                onChange={formik.handleChange("chequeLeafEnd")}
                                error={formik.errors.chequeLeafEnd}
                            />
                        </div>
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                    }}
                >
                    <Button
                        label={"Save"}
                        className="savebutton_container"
                        onClick={formik.handleSubmit}
                    />
                </div>
            </Dialog>
        </div>
    )
}

export default CheckEditData;
