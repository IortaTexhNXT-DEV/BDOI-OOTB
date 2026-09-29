import { useMemo, useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "primereact/card";
import "./index.scss";
import SvgLeftArrow from "../../../assets/agentIcon/SvgLeftArrow";
import SvgDigital from "../../../assets/agentIcon/SvgDigital";
import SvgStore from "../../../assets/agentIcon/SvgStore";
import SvgDebit from "../../../assets/agentIcon/SvgDebit";
import SvgInternet from "../../../assets/agentIcon/SvgInternet";

import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import DocumentUpload from "./Modal/DocumentUpload";
import SvgPaymentLinkIcon from "../../../assets/agentIcon/SvgPaymentLinkIcon";
import ShareOption from "./Modal/ShareOption";
import InternetBankingList from "./Modal/InternetBankingList";
import { getpolicyDetailedMiddleware } from "../policyDetailedView/store/policyDetailedMiddleware";
import clientService from "../../../services/clientService";

const PaymentOptions = () => {
  const { t } = useTranslation();
  const fileUploadRef = useRef(null);
  const [uploadImage, setuploadImage] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalVisibleShare, setModalVisibleShare] = useState(false);
  const [modalVisibleBankList, setModalVisibleBankList] = useState(false);
  const [clientData, setClientData] = useState(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { state } = useLocation();
  const { policyId, quotationId } = useParams();

  // Extract endorsement-related state
  const fromEndorsement = state?.fromEndorsement;
  const endorsementId = state?.endorsementId;

  const { policydetailedlist } = useSelector(
    ({ policyDetailedViewMainReducers }) => ({
      policydetailedlist: policyDetailedViewMainReducers?.policydetailedlist,
      loadingPolicyDetails: policyDetailedViewMainReducers?.loading,
    })
  );

  const policyData =
    state?.policy || state?.policyDetails || policydetailedlist;

  const clientName =
    state?.clientName ||
    state?.ClientName ||
    policyData?.insuredName ||
    policyData?.ClientName ||
    policydetailedlist?.ClientName ||
    policydetailedlist?.clientName;
  const clientId =
    state?.clientId ||
    state?.ClientId ||
    policyData?.clientId ||
    policydetailedlist?.ClientId ||
    policydetailedlist?.clientId;

  const grossPremium =
    policyData?.grossPremium ||
    state?.GrossPremium ||
    state?.grossPremium ||
    policydetailedlist?.GrossPremium ||
    policydetailedlist?.grossPremium ||
    policydetailedlist?.quotation?.grossPremium ||
    "0.00";

  const displayTitle = useMemo(() => {
    const parts = [];

    if (clientName) {
      parts.push(clientName);
    }
    if (state?.leadNumber) {
      parts.push(`${t("agent.leadId")} : ${state?.leadNumber}`);
    }
    if (clientData?.generatedClientId) {
      parts.push(`${t("agent.clientId")} : ${clientData?.generatedClientId}`);
    } else if (clientId) {
      parts.push(`${t("agent.clientId")} : ${clientId}`);
    }

    return parts.join(" / ") || t("agent.paymentOptions");
  }, [clientName, clientData, clientId, t]);

  // Auto-proceed to payment confirmation for both quote flow and waiting page flow
  useEffect(() => {
    if (!policyId) {
      return;
    }

    if (!state?.policy && !policydetailedlist?.policyId) {
      dispatch(getpolicyDetailedMiddleware({ policyId }));
    }

    if (clientId) {
      getClientById(clientId);
    }
  }, [
    dispatch,
    policyId,
    state?.policy,
    policydetailedlist?.policyId,
    clientId,
  ]);

  const getClientById = async (clientId) => {
    const response = await clientService.getClientById(clientId);
    if (response.success && response.data) {
      const payload = response.data?.data || response.data;
      setClientData(payload);
    } else {
      setClientData(null);
    }
  };
  useEffect(() => {
    // Quote and policy flows: no simulated payment. The payment screen asks how the client pays (pay later, bank
    // transfer, cheque, online, cash) and records it for finance to verify, so go straight there.
    if (!fromEndorsement && (quotationId || policyId)) {
      handleSubmit(null, { replace: true });
      return undefined;
    }

    // Endorsement payment flow (owned by the endorsement module): unchanged
    if (
      policyId &&
      fromEndorsement &&
      endorsementId &&
      clientData?.generatedClientId
    ) {
      const timer = setTimeout(() => {
        handleSubmit("Direct Debit");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [
    quotationId,
    policyId,
    state?.fromWaitingPage,
    state?.fromPolicyDetail,
    state?.fromUploadPolicy,
    state?.fromEndorsement,
    endorsementId,
    clientData,
  ]);

  const handleUppendImg = (name, src) => {
    setuploadImage(src?.objectURL);
  };
  const handleMOdalOpen = () => {
    setModalVisible(true);
  };

  const handleCancelUplaoded = () => {
    setuploadImage(null);
    fileUploadRef.current?.clear();
  };

  // Wrapper for DocumentUpload: close modal, then proceed with Direct Debit
  const handleDocumentSubmit = () => {
    setModalVisible(false);
    handleSubmit("Direct Debit");
  };

  const handleSubmit = (paymentMethod, navOptions = {}) => {
    // Handle endorsement payment flow differently
    if (fromEndorsement && endorsementId) {
      // For endorsement, go directly to client view after payment
      const clientTargetId = state?.clientId || clientId;
      navigate(`/agent/clientview/${clientTargetId}`, {
        state: {
          ...state,
          paymentComplete: true,
          endorsementId,
          fromEndorsementPayment: true,
        },
      });
      return;
    }

    // Determine if this is a quote-to-policy flow or existing policy payment
    const isQuoteFlow = !!quotationId && !policyId;
    const confirmationRoute = isQuoteFlow
      ? "/agent/quote/paymentconfirmation"
      : "/agent/policy/paymentconfirmation";

    // The policy payment flow needs the complete policy record.
    const completePolicyData = isQuoteFlow
      ? policyData
      : policydetailedlist || policyData;

    // Policy number only; the id is not a policy number.
    const actualPolicyNumber =
      completePolicyData?.policyNumber ||
      state?.policyNumber ||
      state?.PolicyNumber;

    const actualGrossPremium = completePolicyData?.grossPremium || grossPremium;

    const actualClientId = completePolicyData?.clientId || clientId;

    const actualClientName =
      completePolicyData?.insuredName ||
      completePolicyData?.ClientName ||
      clientName;

    navigate(confirmationRoute, {
      ...navOptions,
      state: {
        ...state,
        policyId: policyId || state?.policyId,
        quotationId: quotationId,
        policy: completePolicyData, // Pass complete policy object
        policyData: completePolicyData, // Also pass as policyData for consistency
        clientId: actualClientId,
        clientName: actualClientName,
        clientNumber: clientData?.generatedClientId || clientId,
        policyNumber: actualPolicyNumber,
        PolicyNumber: actualPolicyNumber, // Both cases for compatibility
        grossPremium: actualGrossPremium,
        GrossPremium: actualGrossPremium, // Both cases for compatibility
        paymentMethod: paymentMethod || null,
        isQuoteFlow: isQuoteFlow,
      },
    });
  };
  const handleCommonAction = () => {
    navigate(-1);
  };
  const handleShareOption = () => {
    setModalVisibleShare(true);
  };
  const handleBankingList = () => {
    setModalVisibleBankList(true);
  };

  return (
    <div>
      <DocumentUpload
        modalVisible={modalVisible}
        handleUppendImg={handleUppendImg}
        uploadImage={uploadImage}
        fileUploadRef={fileUploadRef}
        handleSubmit={handleDocumentSubmit}
        handleCancelUplaoded={handleCancelUplaoded}
        setModalVisible={setModalVisible}
      />
      <ShareOption
        modalVisible={modalVisibleShare}
        setModalVisible={setModalVisibleShare}
      />
      <InternetBankingList
        modalVisible={modalVisibleBankList}
        setModalVisible={setModalVisibleBankList}
      />
      <div className="overall__payment__option__container">
        <div className="header__title">{t("agent.clients")}</div>
        <div className="mt-3">
          <div
            onClick={handleCommonAction}
            className="left__arrow cursor-pointer"
          >
            <SvgLeftArrow />
            <div className="left__arrow__text">{displayTitle}</div>
          </div>
        </div>
        <Card className="mt-4">
          <div className="table__header">{t("agent.paymentOptions")}</div>

          <div className="grid mt-2">
            <div className="col-6">
              <div className="atm__text cursor-pointer">
                <SvgDigital />
                <div className="input__text__style">{t("agent.digiBank")}</div>
              </div>
            </div>
            <div className="col-6">
              <div className="atm__text cursor-pointer">
                <SvgStore />
                <div className="input__text__style">{t("agent.convenienceStore")}</div>
              </div>
            </div>
            <div className="col-6">
              <div
                className="atm__text cursor-pointer"
                onClick={
                  // Fire/quote flow: go directly to payment confirmation (mock payment, no doc needed)
                  quotationId && !policyId ? handleDocumentSubmit : handleMOdalOpen
                }
              >
                <SvgDebit />
                <div className="input__text__style">{t("agent.directDebit")}</div>
              </div>
            </div>
            <div className="col-6">
              <div
                className="atm__text cursor-pointer"
                onClick={handleBankingList}
              >
                <SvgInternet />
                <div className="input__text__style">{t("agent.internetBanking")}</div>
              </div>
            </div>
            <div className="col-6">
              <div
                className="atm__text cursor-pointer"
                onClick={handleShareOption}
              >
                <SvgPaymentLinkIcon />
                <div className="input__text__style">{t("agent.shareToCustomer")}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PaymentOptions;
