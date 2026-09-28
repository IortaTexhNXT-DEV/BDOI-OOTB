import React from 'react';
import '../Register/index.scss';
import InputField from '../../../components/InputField';
import { Button } from 'primereact/button';
import { useTranslation } from 'react-i18next';

const ForgetPassward = () => {
    const { t } = useTranslation();
    return (
        <div className="grid m-0 container__login">
            <div className="col-12 md:col-8 left__side__login">
                <div>
                    <div className="p-mt-5 side__logo">
                        <div className="p-mt-1 welcome__text">
                            {t('login.welcomeTo')}
                        </div>
                        <img src="/BDO_insure_logo.png.png" alt="BDO" />
                        <div className="logo__cover___white">
                            {t('login.cover')}
                        </div>
                    </div>

                    <div className="welcome__content">
                        {t('login.productiveDashboard')}
                    </div>
                </div>
            </div>
            <div className="col-12 md:col-4 p-5">
                <div className="col-12 md:col-12 lg:col-12 ">
                    <div className='logo__icon'>
                        <img src="/BDO_insure_logo.png.png" alt="BDO" />
                    </div>
                </div>
                <div className="col-12 md:col-12 lg:col-12  ">
                    <div className='login__header'>{t('login.forgotPasswordTitle')}</div>
                </div>

                <div className="col-12 md:col-12 lg:col-12 ">
                    <InputField
                        classNames='input__filed'
                        placeholder={t('login.emailAddress')}
                    />
                </div>

                <div className="col-12 md:col-12 lg:col-12 ">
                    <Button
                        className='login__button'
                        label={t('login.sendResetLink')}
                    />
                </div>
            </div>
        </div>
    );
}

export default ForgetPassward;
