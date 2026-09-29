import { Button } from 'primereact/button';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import InputTextField from '../../../../component/inputText';
import DropdownField from '../../../../component/DropdwonField';
import { Dialog } from 'primereact/dialog';
import { getDisplayCurrencyConfig } from "../../../../../utility/currencyConverter";
import useMasterOptions from "../../../../../module/GeneralMasters/common/useMasterOptions";
import useInsuranceCompanyOptions from "../../../../component/useInsuranceCompanyOptions";

import { useDispatch, useSelector } from "react-redux";
import { postModleDetailsMiddleware } from '../../store/policyDetailsMiddleware'
import { useFormik } from 'formik';

const DialogList = ({ setVisible, visible }) => {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  // Participants from the Insurance Company master; currencies from the Currency master (default: display currency)
  const InsurancePolicycontainer = useInsuranceCompanyOptions();
  const currencyOptions = useMasterOptions("currency", { valueKey: "code", labelKey: "code" });
  const pesoTypes = currencyOptions;
  const PremiumCurrency = currencyOptions;

  const initialValue = {
    ParticipantName: "",
    SumInsuredcurrency: getDisplayCurrencyConfig().currency,
    Premiumcurrencys: getDisplayCurrencyConfig().currency,
    Sharepercentage: ""
  };
  const { TableList, loading } = useSelector(
    ({ policydetailreducer }) => {
      return {
        loading: policydetailreducer?.loading,
        TableList: policydetailreducer?.TableList,
        // getSearchCountry: countryReducers?.getSearchCountry,
      };
    }
  );
  const dispatch = useDispatch();
  const handleclick = (values) => {

    console.log(values, "action");
    setVisible(false)
    formik.resetForm()
    const valueWithId = {
      ...values,
      id: TableList?.length + 1,
    };
    console.log(valueWithId, "action with valuesP")
    dispatch(postModleDetailsMiddleware(valueWithId));
    // {
    //   action === "quotedetails"
    //     ? navigate(`/agent/createquote/coveragedetails/coveragedetail/${123}`)
    //     : navigate(`/agent/createquote/coveragedetails/coveragecreate/${123}`);
    // }
  };


  const formik = useFormik({
    initialValues: initialValue,
    // validate: customValidation,
    onSubmit: (values) => {
      handleclick(values);
    },
  });


  return (
    <div>
      <Dialog header={t("tables.coInsuranceCompanyDetails")} visible={visible} style={{ width: '50vw' }} onHide={() => setVisible(false)}>
        <div className="grid mt-2">
          <div className="col-12 md:col-12 lg:col-12">
            <DropdownField
              label={t("tables.participantName")}
              value={formik.values.ParticipantName}
              options={InsurancePolicycontainer}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("ParticipantName", e.value);
              }}
              optionLabel="label"
            />

          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("tables.sumInsuredCurrency")}
              value={formik.values.SumInsuredcurrency}
              options={pesoTypes}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("SumInsuredcurrency", e.value);
              }}
              optionLabel="label"
            />

          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("tables.premiumCurrency")}
              value={formik.values.Premiumcurrencys}
              options={PremiumCurrency}
              onChange={(e) => {
                console.log(e.value);
                formik.setFieldValue("Premiumcurrencys", e.value);
              }}
              optionLabel="label"
            />

          </div>
        </div>
        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <InputTextField
              label={t("tables.sharePercent")}
              // value={formik.values.SeatingCapacity}
              value={formik.values.Sharepercentage}
              onChange={formik.handleChange("Sharepercentage")}
            />
          </div>
        </div>
        <div className="next__btn__container" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <Button
            className="next__btn"
            onClick={() => {
              formik.handleSubmit();
            }}
          >
            {t("common.save")}
          </Button>
        </div>


      </Dialog>
    </div>
  )
}

export default DialogList