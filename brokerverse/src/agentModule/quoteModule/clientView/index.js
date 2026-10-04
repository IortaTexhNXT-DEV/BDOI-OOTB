import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import SvgDot from "../../../assets/agentIcon/SvgDots";
import ClientViewCard from "./clientViewCard";
import ActivityPanel from "../../../components/SalesActivities/ActivityPanel";
import { useNavigate, useParams } from "react-router-dom";

const ClientView = ({ action }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: clientId } = useParams();
  // the header shows the client code (CL-...), never the internal record id of the address
  const [clientCode, setClientCode] = useState(null);
  // back to the list: it reopens with the tab, search and page it was left with
  const toList = () => navigate("/agent/clientlisting");

  const items = [
    { label: t("clients.title"), command: toList, className: "bv-crumb-link" },
    { label: clientCode || t("clients.client", { defaultValue: "Client" }) },
  ];
  const Initiate = { label: t("sidebar.Operations") };

  return (
    <div className="client__listing__card__container">
      <div className="grid mt-3">
        <div className="col-12 flex align-items-center gap-2">
          <Button icon="pi pi-arrow-left" text rounded aria-label={t("common.back", { defaultValue: "Back" })} tooltip={t("common.back", { defaultValue: "Back" })} onClick={toList} />
          <label className="leadlisting__overal__container__title">
            {clientCode ? `${t("clients.client", { defaultValue: "Client" })} ${clientCode}` : t("clients.title")}
          </label>
          {/* identification and due diligence of the client (onboarding screen) */}
          <Button icon="pi pi-id-card" outlined className="ml-auto" label={t("onboarding.identification")} onClick={() => navigate(`/agent/client-onboarding/${clientId}`)} />
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
      {/* calls, meetings, e-mails and visits of the account executives with this client, and the open next step */}
      {clientId && <ActivityPanel entity="client" recordId={String(clientId)} />}
    </div>
  );
};

export default ClientView;
