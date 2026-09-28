import React from 'react';
import '../Register/index.scss';
import InputField from '../../../components/InputField';
import { Button } from 'primereact/button';
import SvgCheckBox from '../../../assets/icons/SvgCheckBox';
import { useTranslation } from 'react-i18next';

const Register = () => {
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
                        <span><img src="/BDO_insure_logo.png.png" alt="BDO" /> </span> <span className='cover__black'>{t('login.cover')}</span>
                    </div>
                </div>
                <div className="col-12 md:col-12 lg:col-12  ">
                    <div className='login__header'>{t('login.register')}</div>
                </div>
                <div className="col-12 md:col-12 lg:col-12  ">
                    <div className='dont__have__text'>{t('login.alreadyHaveAccount')}<span className='register'>{t('login.login')}</span></div>
                </div>
                <div className="col-12 md:col-12 lg:col-12  ">
                    <InputField
                        classNames='input__filed'
                        placeholder={t('common.name')}
                    />
                </div>
                <div className="col-12 md:col-12 lg:col-12  ">
                    <InputField
                        classNames='input__filed'
                        placeholder={t('login.emailAddress')}
                    />
                </div>
                <div className="col-12 md:col-12 lg:col-12  ">
                    <InputField
                        classNames='input__filed'
                        placeholder={t('login.password')}
                    />
                </div>
                <div className="col-12 md:col-12 lg:col-12  ">
                    <div className='dont__have__text'><span className='check__icon'><SvgCheckBox /></span> {t('login.readTerms')} <span className='register'>{t('login.termsAndConditions')}</span></div>
                </div>
                <div className="col-12 md:col-12 lg:col-12  ">
                    <Button
                        className='login__button'
                        label={t('login.register')}
                    />
                </div>
                <div className="col-12 md:col-12 lg:col-12  ">
                    <div className='forget__text'>{t('login.forgotPassword')}</div>
                </div>
            </div>
        </div>
    );
}

export default Register;
