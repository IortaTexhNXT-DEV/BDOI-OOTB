import { useEffect } from "react";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { Card } from "primereact/card";
import "./index.scss";
import SvgGross from "../../assets/agentIcon/SvgGross";
import SvgCollected from "../../assets/agentIcon/SvgCollected";
import SvgCommission from "../../assets/agentIcon/SvgCommission";
import SvgReceivables from "../../assets/agentIcon/SvgReceivables";
import { useDispatch, useSelector } from "react-redux";
import { postpaymentdataMiddleWare } from "./store/paymentMiddleware";
import PyamentTabelCard from "./PaymentTabel";

const Payments = () => {
  const { formatCurrency } = useFormatCurrency();

  // const template2 = {
  //   layout:
  //     "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
  //   RowsPerPageDropdown: (options) => {
  //     const dropdownOptions = [
  //     ];


  const dispatch = useDispatch();
  const totals = useSelector(
    ({ agentPaymentMainReducers }) => agentPaymentMainReducers?.postpaymentdata || {}
  );
  useEffect(() => {
    dispatch(postpaymentdataMiddleWare());
  }, [dispatch]);

  return (
    <div>
      <div className="payment__dashboard__container">
        <div className="payment__heading">Payments</div>
        <div class="grid">
          <div class="col-12 md:col-6 lg:col-3">
            <Card className="paymentcard_eachcontainer">
              <SvgGross />
              <div className="price__listing">{formatCurrency(totals.gross || 0)}</div>
              <div>Gross Premium</div>
            </Card>
          </div>

          <div class="col-12 md:col-6 lg:col-3">
            <Card className="paymentcard_eachcontainer">
              <SvgCollected />
              <div className="price__listing">{formatCurrency(totals.collected || 0)}</div>
              <div>Collected Premium</div>
            </Card>
          </div>

          <div class="col-12 md:col-6 lg:col-3">
            <Card className="paymentcard_eachcontainer">
              <SvgReceivables />
              <div className="price__listing">{formatCurrency(totals.receivables || 0)}</div>
              <div>Receivables</div>
            </Card>
          </div>
          <div class="col-12 md:col-6 lg:col-3">
            <Card className="paymentcard_eachcontainer">
              <div className="mt-3">
                <SvgCommission />
              </div>
              <div className="price__listing">{formatCurrency(totals.commission || 0)}</div>
              <div>Earned Commission</div>
            </Card>
          </div>
        </div>
        <PyamentTabelCard />
      </div>
    </div>
  );
};

export default Payments;
