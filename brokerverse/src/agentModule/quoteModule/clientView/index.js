import { useState } from "react";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/agentIcon/SvgDots";
import ClientViewCard from "./clientViewCard";
import { useParams } from "react-router-dom";

const LeadListing = ({ action }) => {
  const { id: clientId } = useParams();
  // the header shows the client code (CL-...), never the internal record id of the address
  const [clientCode, setClientCode] = useState(null);

  const items = [
    { label: "Clients", url: "/agent/clientlisting" },
    { label: clientCode ? `Client: ${clientCode}` : "Client" }
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
      <ClientViewCard action={action} clientId={clientId} onClient={(c) => setClientCode(c?.clientCode || c?.generatedClientId || null)} />
    </div>
  );
};

export default LeadListing;
