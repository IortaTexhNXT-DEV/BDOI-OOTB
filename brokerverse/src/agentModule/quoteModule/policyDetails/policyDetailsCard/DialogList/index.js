import { Button } from 'primereact/button';
import { useTranslation } from 'react-i18next';
import InputTextField from '../../../../component/inputText';
import DropdownField from '../../../../component/DropdownField';
import { Dialog } from 'primereact/dialog';
import { getDisplayCurrencyConfig } from "../../../../../utility/currencyConverter";
import useMasterOptions from "../../../../../module/GeneralMasters/common/useMasterOptions";
import useInsuranceCompanyOptions from "../../../../component/useInsuranceCompanyOptions";

import { useDispatch, useSelector } from "react-redux";
import { postModleDetailsMiddleware } from '../../store/policyDetailsMiddleware'
import { useFormik } from 'formik';

const DialogList = ({ setVisible, visible }) => {
  const { t } = useTranslation();
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
  const { TableList } = useSelector(
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
    setVisible(false)
    formik.resetForm()
    const valueWithId = {
      ...values,
      id: TableList?.length + 1,
    };
    dispatch(postModleDetailsMiddleware(valueWithId));
  };

  const validate = (values) => {
    const errors = {};
    if (!values.ParticipantName) errors.ParticipantName = t("tables.participantRequired");
    const share = Number(values.Sharepercentage);
    if (values.Sharepercentage === "" || Number.isNaN(share) || share <= 0 || share > 100) errors.Sharepercentage = t("tables.shareRange");
    return errors;
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    validateOnChange: false,
    onSubmit: (values) => {
      handleclick(values);
    },
  });

  const close = () => {
    setVisible(false);
    formik.resetForm();
  };

  const footer = (
    <>
      <Button type="button" label={t("common.cancel")} text onClick={close} />
      <Button type="button" label={t("common.save")} onClick={() => formik.handleSubmit()} />
    </>
  );

  return (
    <div>
      <Dialog header={t("tables.coInsuranceCompanyDetails")} visible={visible} style={{ width: '40rem' }} breakpoints={{ '960px': '90vw', '640px': '100vw' }} footer={footer} onHide={close}>
        <div className="grid mt-2">
          <div className="col-12 md:col-12 lg:col-12">
            <DropdownField
              label={t("tables.participantName")}
              value={formik.values.ParticipantName}
              options={InsurancePolicycontainer}
              onChange={(e) => {
                formik.setFieldValue("ParticipantName", e.value);
              }}
              optionLabel="label"
            />
            {formik.errors.ParticipantName && <small className="p-error">{formik.errors.ParticipantName}</small>}
          </div>
        </div>

        <div className="grid mt-2">
          <div className="col-12 md:col-6 lg:col-6">
            <DropdownField
              label={t("tables.sumInsuredCurrency")}
              value={formik.values.SumInsuredcurrency}
              options={pesoTypes}
              onChange={(e) => {
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
              value={formik.values.Sharepercentage}
              onChange={formik.handleChange("Sharepercentage")}
              keyfilter="num"
              error={formik.errors.Sharepercentage}
            />
          </div>
        </div>

      </Dialog>
    </div>
  )
}

export default DialogList