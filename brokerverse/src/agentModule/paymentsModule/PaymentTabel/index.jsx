import { Card } from 'primereact/card'
import { TabPanel, TabView } from 'primereact/tabview'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import PaidListTabelData from './PaidListTabelData'
import PendingListTabelData from './PendingListTabelData'
import ReviewingListTabelData from './ReviewingListTabelData'
import { useDispatch } from 'react-redux'
import {
    getpaymentPendingtableMiddleware,
    getpaymentRewivingtableMiddleware,
    getpaymenttableMiddleware,
} from '../store/paymentMiddleware'

const PyamentTabelCard = () => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    useEffect(() => {
        dispatch(getpaymenttableMiddleware());
        dispatch(getpaymentPendingtableMiddleware());
        dispatch(getpaymentRewivingtableMiddleware());
    }, [dispatch]);
    return (
        <div className="lead__listing__card__container mt-4">
            <Card>
                <TabView>
                    <TabPanel header={t("payments.paid")}>
                        <PaidListTabelData/>
                    </TabPanel>
                    <TabPanel header={t("payments.pending")}>
                        <PendingListTabelData />
                    </TabPanel>
                    <TabPanel header={t("payments.reviewing")}>
                        <ReviewingListTabelData />
                    </TabPanel>
                </TabView>
            </Card>
        </div>
    )
}

export default PyamentTabelCard