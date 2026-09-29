import React from 'react';
import { useTranslation } from 'react-i18next';
import InputTextField from '../../component/inputText';
import DatepickerField from '../../component/datePicker';
import SvgBlueArrow from '../../../assets/agentIcon/SvgBlueArrow';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { useNavigate } from 'react-router-dom';

const PaymentDetails = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleclick = () => {
        navigate("/agent/policy/paymentconfirmation");
    }

    return (
        <div className='policy__detail__view__card__container mt-4'>
            <Card>
                <div className="policy__details__card__view__container__title">
                    {t("paymentDetails.policyDetails")}
                </div>
                <div className="grid mt-2">
                    <div className="col-12 md:col-6 lg:col-6">
                        <InputTextField
                            label={t("paymentDetails.policyNumber")}
                        />
                    </div>
                </div>

                <div className="grid mt-2">
                    <div className="col-12 md:col-6 lg:col-6">
                        <DatepickerField label={t("paymentDetails.production")} />
                    </div>
                    <div className="col-12 md:col-6 lg:col-6">
                        <DatepickerField label={t("paymentDetails.inception")} />
                    </div>
                </div>


                <div className="grid mt-2">
                    <div className="col-12 md:col-6 lg:col-6">
                        <DatepickerField label={t("paymentDetails.issuedDate")} />
                    </div>
                    <div className="col-12 md:col-6 lg:col-6">
                        <DatepickerField label={t("paymentDetails.expiry")} />
                    </div>
                </div>

                <div className='policy__detail__view__title mt-2'>
                    {t("paymentDetails.documents")}
                </div>
                <div className="grid mt-2">
                    <div className="col-12 md:col-6 lg:col-6">
                        <div className='policy__detail__view__box'>
                            <div className="grid mt-2">
                                <div className="col-12 md:col-6 lg:col-6">
                                    <div className='policy__detail__view__box__title'>{t("paymentDetails.policy")}</div>
                                </div>
                                <div className="col-12 md:col-6 lg:col-6">
                                    <div className='policy__detail__view__box__container'>
                                        <div className='policy__detail__view__box__sub__title'>{t("paymentDetails.view")}</div>
                                        <SvgBlueArrow />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 md:col-6 lg:col-6">
                        <div className='policy__detail__view__box'>
                            <div className="grid mt-2">
                                <div className="col-12 md:col-6 lg:col-6">
                                    <div className='policy__detail__view__box__title'>{t("paymentDetails.invoice")}</div>
                                </div>
                                <div className="col-12 md:col-6 lg:col-6">
                                    <div className='policy__detail__view__box__container'>
                                        <div className='policy__detail__view__box__sub__title'>{t("paymentDetails.view")}</div>
                                        <SvgBlueArrow />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className='policy__detail__view__btn__container mt-4'>
                    <div className="paylater__btn__container">
                        <Button className="back__btn">{t("paymentDetails.payLater")}</Button>
                    </div>
                    <div className="proceed__btn__container">
                        <Button className="next__btn" onClick={handleclick}>{t("paymentDetails.proceedToPayment")}</Button>
                    </div>
                </div>
            </Card>
        </div>);
}

export default PaymentDetails