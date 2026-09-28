import React from 'react';
import '../Register/index.scss';
import InputField from '../../../components/InputField';
import { Button } from 'primereact/button';
import { useTranslation } from 'react-i18next';

const VerfyCode = () => {
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
                <div className="col-12 md:col-12 lg:col-12  ">
                    <div className='logo__icon'>
                        <img src="/BDO_insure_logo.png.png" alt="BDO" />
                    </div>
                </div>
                <div className="col-12 md:col-12 lg:col-12  ">
                    <div className='login__header'>{t('login.verifyCode')}</div>
                </div>
                <div className="col-12 md:col-12 lg:col-12 m-1">
                    <div className='code__text'>{t('login.code')}</div>
                </div>

                <div style={{display:'flex'}} className="col-12 md:col-12 lg:col-12 verify__view d-flex justify-content-center align-items-center">
                    <div className="col-2 md:col-2 lg:col-2 input__container">
                        <InputField classNames='input__filed' />
                    </div>
                    <div className="col-2 md:col-2 lg:col-2 input__container">
                        <InputField classNames='input__filed' />
                    </div>
                    <div className="col-2 md:col-2 lg:col-2 input__container">
                        <InputField classNames='input__filed' />
                    </div>
                    <div className="col-2 md:col-2 lg:col-2 input__container">
                        <InputField classNames='input__filed' />
                    </div>
                    <div className="col-2 md:col-2 lg:col-2 input__container">
                        <InputField classNames='input__filed' />
                    </div>
                    <div className="col-2 md:col-2 lg:col-2 input__container">
                        <InputField classNames='input__filed' />
                    </div>
                </div>

                <div className="col-12 md:col-12 lg:col-12  ">
                    <Button
                        className='login__button'
                        label={t('login.verify')}
                    />
                </div>
            </div>
        </div>
    );
}

export default VerfyCode;
