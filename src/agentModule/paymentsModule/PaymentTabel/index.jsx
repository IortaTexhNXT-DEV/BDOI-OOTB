import { Card } from 'primereact/card'
import { TabPanel, TabView } from 'primereact/tabview'
import React from 'react'
import { useTranslation } from 'react-i18next'
import PaidListTabelData from './PaidListTabelData'
import PendingListTabelData from './PendingListTabelData'
import ReviewingListTabelData from './ReviewingListTabelData'
import { useSelector } from 'react-redux'

const PyamentTabelCard = () => {
    const { t } = useTranslation();
    const { paymenttabledata, paymentSearchList, loading,agentPaymentMainReducers,paymentPendingtabledata,paymentRewiwingtabledata } = useSelector(
        ({ agentPaymentMainReducers }) => {
            return {
                loading: agentPaymentMainReducers?.loading,
                paymenttabledata: agentPaymentMainReducers?.paymenttabledata,
                paymentSearchList: agentPaymentMainReducers?.paymentSearchList,
                paymentPendingtabledata:agentPaymentMainReducers?.paymentPendingtabledata,
                paymentRewiwingtabledata:agentPaymentMainReducers?.paymentRewiwingtabledata,
                paymentPaidSearchList:agentPaymentMainReducers?.paymentPaidSearchList
            };
        }
    );
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