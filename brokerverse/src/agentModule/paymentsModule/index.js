import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import NavBar from "../../components/NavBar";
import { TabPanel, TabView } from "primereact/tabview";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import SvgFilters from "../../assets/icons/SvgFilters";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { Column } from "primereact/column";
import { Menu } from "primereact/menu";
import { useNavigate } from "react-router-dom";
import { Card } from "primereact/card";
import PaymentCard from "./paymentCard";
import { Paginator } from "primereact/paginator";
import "./index.scss";
import TableDropdownField from "../component/tableDropDwonField";
import SvgGross from "../../assets/agentIcon/SvgGross";
import SvgCollectedPremium from "../../assets/agentIcon/SvgCollectedPremium";
import SvgCollected from "../../assets/agentIcon/SvgCollected";
import SvgReceivable from "../../assets/agentIcon/SvgReceivable";
import SvgCommission from "../../assets/agentIcon/SvgCommission";
import SvgReceivables from "../../assets/agentIcon/SvgReceivables";
import { useDispatch, useSelector } from "react-redux";
import { postpaymentdataMiddleWare } from "./store/paymentMiddleware";
import SvgDropdownicon from "../../assets/icons/SvgDropdownicon";
import SvgDownArrow from "../../assets/agentIcon/SvgDownArrow";
import PyamentTabelCard from "./PaymentTabel";

const Payments = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [search, setSearch] = useState("");
  const menuRight = useRef(null);
  const navigate = useNavigate();
  const [endrosementModal, setEndrosementModal] = useState(false);

  const renderPaymentStatus = (rowData) => {
    return <div>{rowData?.payment}</div>;
  };
  const handleMenuToggle = (event, menuRef) => {
    menuRef.current.toggle(event);
  };
  const menuItems = [
    {
      label: t("payments.view"),
      command: () => handleMenuClick("view"),
      icon: "pi pi-refresh",
    },
    {
      label: t("payments.claim"),
      command: () => handleMenuClick("claim"),
      icon: "pi pi-refresh",
    },
    {
      label: t("payments.renewal"),
      command: () => handleMenuClick("renewal"),
      icon: "pi pi-refresh",
    },
    {
      label: t("payments.endorsement"),
      command: () => handleMenuClick("endrosement"),
      icon: "pi pi-refresh",
    },
  ];
  const headerStyle = {
    textAlign: "end",
  };
  // const template2 = {
  //   layout:
  //     "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
  //   RowsPerPageDropdown: (options) => {
  //     const dropdownOptions = [
  //       { label: 5, value: 5 },
  //       { label: 10, value: 10 },
  //       { label: 20, value: 20 },
  //       { label: 120, value: 120 },
  //     ];

  //     return (
  //       <div className="table__selector">
  //         <React.Fragment>
  //           <span style={{ color: "var(--text-color)", userSelect: "none" }}>
  //             Row count :{" "}
  //           </span>
  //           <Dropdown
  //             value={options.value}
  //             className="pagedropdown_container"
  //             options={dropdownOptions}
  //             onChange={options.onChange}
  //           />
  //         </React.Fragment>
  //       </div>
  //     );
  //   },
  // };
  const handleMenuClick = (menuItem) => {
    if (menuItem == "view") {
      navigate("/agent/claimrequest/claimdetails");
    }
    if (menuItem == "endrosement") {
      setEndrosementModal(true);
    }
  };

  const renderEditButton = (rowData) => {
    return (
      <div className="card flex justify-content-center">
        <Menu
          model={menuItems}
          popup
          ref={menuRight}
          id="popup_menu_right"
          popupAlignment="right"
        />

        <Button
          icon="pi pi-align-right"
          className="mr-2"
          onClick={(event) => handleMenuToggle(event, menuRight)}
          aria-controls="popup_menu_right"
          aria-haspopup
        />
      </div>
      // <div className="action__icon">
      //   <Button
      //     icon={<SvgEditIcon />}
      //     onClick={() => handleEdit(rowData.id)}
      //     className="action__button"
      //   />
      // </div>
    );
  };
  const dispatch = useDispatch();
  const totals = useSelector(
    ({ agentPaymentMainReducers }) => agentPaymentMainReducers?.postpaymentdata || {}
  );
  useEffect(() => {
    dispatch(postpaymentdataMiddleWare());
  }, [dispatch]);
  // const [globalFilter, setGlobalFilter] = useState("Name");
  // const cities = [
  //   { name: "Name", code: "Name" },
  //   { name: "ClientID", code: "ClientID" },
  //   { name: "Gross Premium", code: "Gross Premium" },
  // ];
  // const [status, setStatus] = useState("PAID");

  // useEffect(() => {
  //   if (globalFilter && search) {
  //     dispatch(
  //       getPaymentSearchDataMiddleWare({
  //         field: globalFilter,
  //         value: search,
  //         // status1: status,
  //       })
  //     );
  //   }
  // }, [search]);

  // console.log(status, "status");

  const template2 = {
    layout: "RowsPerPageDropdown CurrentPageReport PrevPageLink  NextPageLink ",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 5, value: 5 },
        { label: 10, value: 10 },
        { label: 20, value: 20 },
        { label: 120, value: 120 },
      ];

      return (
        <div className="table__selector">
          <React.Fragment>
            <span style={{ color: "var(--text-color)", userSelect: "none" }}>
              Rows per page:{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdown_container"
              options={dropdownOptions}
              onChange={options.onChange}
            />
          </React.Fragment>
        </div>
      );
    },
  };
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
