import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { BreadCrumb } from "primereact/breadcrumb";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import StatCards from "../../components/StatCards";
import SvgDot from "../../assets/agentIcon/SvgDots";
import { postpaymentdataMiddleWare } from "./store/paymentMiddleware";
import PaymentTableCard from "./PaymentTabel";
import "./index.scss";

/** Operations > Payments: premium totals and the premium bills by payment status. */
const Payments = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const dispatch = useDispatch();
  const totals = useSelector(({ agentPaymentMainReducers }) => agentPaymentMainReducers?.postpaymentdata || null);
  useEffect(() => {
    dispatch(postpaymentdataMiddleWare());
  }, [dispatch]);
  const loaded = totals && Object.keys(totals).length > 0;
  const money = (v) => (loaded ? formatCurrency(v || 0) : null);

  return (
    <div className="payment__dashboard__container">
      <div className="payment__heading">{t("payments.title", { defaultValue: "Payments" })}</div>
      <BreadCrumb model={[{ label: t("payments.title", { defaultValue: "Payments" }) }]} home={{ label: t("sidebar.Operations") }} className="breadCrums" separatorIcon={<SvgDot color={"#000"} />} />
      <StatCards items={[
        { key: "gross", label: t("dashboard.grossPremium"), value: money(totals?.gross) },
        { key: "collected", label: t("dashboard.collectedPremium"), value: money(totals?.collected) },
        { key: "receivables", label: t("dashboard.receivables"), value: money(totals?.receivables) },
        { key: "commission", label: t("dashboard.earnedCommission"), value: money(totals?.commission) },
      ]} />
      <PaymentTableCard />
    </div>
  );
};

export default Payments;
