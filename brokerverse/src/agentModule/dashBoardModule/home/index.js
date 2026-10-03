import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgAdd from "../../../assets/agentIcon/SvgAdd";
import TopCard from "./topCards";
import CenterCard from "./centerCards";
import BottomCard from "./bottomCards";
import SvgMotor from "../../../assets/agentIcon/SvgMotor";
import SvgTravel from "../../../assets/agentIcon/SvgTravel";
import SvgHome from "../../../assets/agentIcon/SvgHome";
import SvgFire from "../../../assets/agentIcon/SvgFire";
import { Dialog } from "primereact/dialog";
import SvgSearch from "../../../assets/agentIcon/SvgSearch";
import { useNavigate } from "react-router-dom";
import { Dropdown } from "primereact/dropdown";
import { useDispatch, useSelector } from "react-redux";

import SvgFrame from "../../../assets/agentIcon/SvgFrame";
import { InputText } from "primereact/inputtext";
import { getClientTableMiddleware } from "../../quoteModule/clientListing/store/clientsMiddleware";
import EmployeeBenefitIcon from "../../EmployeeFlow/EmployeeBenefitIcon";
import { getDashboardDataMiddleware } from "./store/homeMiddleware";

const Dashboard = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [existclient, setexistclient] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedQuoteType, setSelectedQuoteType] = useState("");
  const navigate = useNavigate();
  const handleClickMotor = () => {
    setSelectedQuoteType("Motor");
    setVisible(true);
  };

  const handleClickEmpBenefit = () => {
    setSelectedQuoteType("EmployeeBenefit");
    setVisible(true);
  };

  const handleClickFireAndAlliedPerils = () => {
    setSelectedQuoteType("FireAndAlliedPerils");
    setVisible(true);
  };


  const { userDetails, commissionList } = useSelector(({ homeReducers }) => {
    return {
      userDetails: homeReducers?.dashboardDetails?.userDetails,
      commissionList: homeReducers?.dashboardDetails?.commission,
    };
  });

  const clientListTable = useSelector(({ clientsReducers }) => clientsReducers?.clientListTable) || [];
  const dropdownOptions = [
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
            handleClickMotor();
          }}
        >
          <div>
            <SvgMotor />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("dashboard.Motor")}
          </div>
        </div>
      ),
      value: "Motor",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
            handleClickFireAndAlliedPerils();
          }}
        >
          <div>
            <SvgFire />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("dashboard.Fire and Allied Perils")}
          </div>
        </div>
      ),
      value: "FireAndAlliedPerils",
    },
    {
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div>
            <SvgTravel />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("dashboard.Travel")}
          </div>
        </div>
      ),
      value: "Travel",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
            handleClickEmpBenefit();
          }}
        >
          <div>
            <EmployeeBenefitIcon />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("dashboard.Employee Benefit")}
          </div>
        </div>
      ),
      value: "EmployeeBenefit",
    },
    {
      label: (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div>
            <SvgHome />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("dashboard.Property")}
          </div>
        </div>
      ),
      value: "Property",
    },
  ];
  const [search, setSearch] = useState("");
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getDashboardDataMiddleware());
  }, [dispatch]);
  // The existing-client picker lists the first page of clients.
  useEffect(() => {
    if (existclient) dispatch(getClientTableMiddleware({ page: 1, pageSize: 50 }));
  }, [existclient, dispatch]);
  const clientMatches = (client) =>
    !search || [client.DisplayName, client.LeadID].some((v) => String(v || "").toLowerCase().includes(search.toLowerCase()));

  const handleclick = () => {
    if (selectedQuoteType === "Motor") {
      navigate("/agent/createlead");
    } else if (selectedQuoteType === "EmployeeBenefit") {
      navigate("/agent/createlead/employee-benefit");
    } else if (selectedQuoteType === "FireAndAlliedPerils") {
      navigate("/agent/createlead/fire-allied-perils");
    }
  };

  const openClient = (client) => {
    setexistclient(false);
    navigate(`/agent/clientview/${client.id}`);
  };

  return (
    <div className="dasboard__container">
      <div className="grid  mt-2">
        <div className="col-12 md:col-6 lg:col-6">
          <div className="dasboard__container__title">{t("dashboard.goodDay")}</div>
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <div className="btn_lable_save_container">
            <Dropdown
              value={selectedOption}
              options={dropdownOptions}
              placeholder={t("dashboard.createQuote")}
              onChange={(e) => {
                const value = e.value;
                setSelectedOption(value);

                if (value === "Motor") {
                  handleClickMotor();
                } else if (value === "EmployeeBenefit") {
                  handleClickEmpBenefit();
                } else if (value === "FireAndAlliedPerils") {
                  handleClickFireAndAlliedPerils();
                }
              }}
              dropdownIcon={<SvgAdd />}
            />
          </div>
        </div>
      </div>
      <TopCard detail={userDetails} />
      <CenterCard commission={commissionList} />
      <BottomCard detail={userDetails} />
      <div className="home__dialog__container__control">
        <Dialog
          className="dailog__box__container agent__flow__common__dialog__container"
          visible={visible}
          style={{ width: "30vw" }}
          onHide={() => setVisible(false)}
          dismissableMask={true}
        >
          <div className="dailog__box__container__title">
            {t("dashboard.chooseQuoteFor")}
          </div>
          <div className="dailog__box__inputs__container mt-4">
            <div
              className="dailog__box__inputs"
              onClick={() => {
                handleclick();
              }}
            >
              {t("dashboard.newLead")}
            </div>
            <div
              className="dailog__box__inputs__existing__container mt-3 mb-6"
              onClick={() => setexistclient(true)}
            >
              <div className="dailog__box__inputs__existing">
                {t("dashboard.existingClient")}
              </div>
              <div className="dailog__box__inputs__svg">
                <SvgSearch />
              </div>
            </div>
          </div>
        </Dialog>
        <Dialog
          header={t("dashboard.search")}
          visible={existclient}
          style={{ width: "40vw" }}
          onHide={() => setexistclient(false)}
          dismissableMask={true}
          className="agent__flow__common__dialog__container"
        >
          <div className="dialog__existingclient__container">
            <div className="dialog__existingclient__header__container">
              <SvgFrame />
              <div style={{ display: "flex" }}>
                <span className="dialog__existingclient___tip">{t("dashboard.tip")}</span>
                <div className="dialog__existingclient___search">
                  {t("dashboard.searchByClient")}
                </div>
              </div>
            </div>
            <div class="grid">
              <div class="col-12 md:col-12 lg:col-12">
                <span className="p-input-icon-left" style={{ width: "100%" }}>
                  <i className="pi pi-search" />
                  <InputText
                    placeholder={t("dashboard.search")}
                    style={{ width: "100%", borderRadius: "10px" }}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </span>
              </div>
            </div>

            {clientListTable.filter(clientMatches).map((data) => (
              <div key={data.id} className="dialog__existingclient__carddata" onClick={() => openClient(data)}>
                <div className="dialog__existingclient__carddata__name">{data?.DisplayName}</div>
                <div className="dialog__existingclient__carddata__id">
                  {t("dashboard.clientId")}: {data?.LeadID}
                </div>
              </div>
            ))}
          </div>
        </Dialog>
      </div>
    </div>
  );
};

export default Dashboard;
