import React, { useState } from "react";
import "./index.scss";
import { Button } from "primereact/button";
import SvgAdd from "../../../assets/agentIcon/SvgAdd";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/agentIcon/SvgDots";
import ClientViewCard from "./clientViewCard";
import { Dropdown } from "primereact/dropdown";
import SvgMotor from "../../../assets/agentIcon/SvgMotor";
import SvgTravel from "../../../assets/agentIcon/SvgTravel";
import SvgHome from "../../../assets/agentIcon/SvgHome";
import { useNavigate, useParams } from "react-router-dom";

const LeadListing = ({ action }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const navigate = useNavigate();
  const { id: clientId } = useParams();

  const items = [
    { label: "Clients", url: "/agent/clientlisting" },
    { label: `Client ID : ${clientId || '12345678'}` }
  ];
  const Initiate = { label: "Home" };

  return (
    <div className="client__listing__card__container">
      <div class="grid mt-3">
        <div class="col-12 md:col-6 lg:col-6">
          <label className="leadlisting__overal__container__title">
            Clients
          </label>
        </div>
      </div>
      <div>
        <BreadCrumb
          model={items}
          home={Initiate}
          className="breadCrums"
          separatorIcon={<SvgDot color={"#000"} />}
        />
      </div>
      <ClientViewCard action={action} clientId={clientId} />
    </div>
  );
};

export default LeadListing;
