import React from 'react'
import { useTranslation } from 'react-i18next'

const Endorsementpaymentapproval = () => {
  const { t } = useTranslation()
  return (
    <div>
      {t("endorsement.paymentApprovalTitle")}
    </div>
  )
}

export default Endorsementpaymentapproval
