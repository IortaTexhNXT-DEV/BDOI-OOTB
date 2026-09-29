import { Card } from "primereact/card";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TabView, TabPanel } from "primereact/tabview";
import ClientListingViewPolicyTable from "./ClientListingViewPolicyTable";
import ClientListingViewClaimTable from "./ClientListingViewClaimTable";
import ClientListingViewRenewalTable from "./ClientListingViewRenewaleTable";
import ClientListingViewEndorsementTable from "./ClientListingViewEndorsementTable";

import "../../clientView/index.scss";
import SvgLeftArrow from "../../../../assets/agentIcon/SvgLeftArrow";
import { useNavigate } from "react-router-dom";
import clientService from "../../../../services/clientService";
import logger from "../../../../utility/logger";

const ClientListingCard = ({ action, clientId, onClient }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [clientName, setClientName] = useState(t("clientView.clientDetails"));
  const [isLoadingClient, setIsLoadingClient] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchClientDetails = async () => {
      if (!clientId) {
        setClientName(t("clientView.clientDetails"));
        return;
      }

      // Check if clientId is a valid format (not empty string, not just whitespace)
      if (typeof clientId === "string" && clientId.trim() === "") {
        setClientName(t("clientView.clientDetails"));
        return;
      }

      setIsLoadingClient(true);

      try {
        const response = await clientService.getClientById(clientId);

        if (!isMounted) {
          return;
        }

        if (response.success && response.data) {
          const payload = response.data?.data || response.data;
          onClient?.(payload?.client || payload);

          const firstName =
            payload?.firstName || payload?.client?.firstName || null;
          const lastName =
            payload?.lastName || payload?.client?.lastName || null;

          const fullName = [firstName, lastName]
            .filter(Boolean)
            .join(" ")
            .trim();

          const fallbackName =
            payload?.preferredName ||
            payload?.name ||
            payload?.clientName ||
            payload?.insuredName ||
            payload?.companyName ||
            null;

          setClientName(fullName || fallbackName || t("clientView.clientDetails"));
        } else {
          setClientName(t("clientView.clientDetails"));
        }
      } catch (error) {
        if (isMounted) {
          logger.error("Failed to load client details:", error);
          logger.error("Error details:", {
            message: error.message,
            name: error.name,
            stack: error.stack,
          });
          setClientName(t("clientView.clientDetails"));
        }
      } finally {
        if (isMounted) {
          setIsLoadingClient(false);
        }
      }
    };

    fetchClientDetails();

    return () => {
      isMounted = false;
    };
  }, [clientId]);

  const handleClientNavigation = () => {
    navigate("/agent/clientlisting");
  };
  return (
    <div className="client__listing__card__container mt-4">
      <Card style={{ borderRadius: "20px" }}>
        <div
          onClick={handleClientNavigation}
          className="cursor-pointer arrow__outer"
        >
          <SvgLeftArrow />
          <div className="carson__style">
            {isLoadingClient ? t("clientView.loading") : clientName}
          </div>
        </div>
        <TabView>
          <TabPanel header={t("clientView.tabPolicy")} className="policy__header">
            <ClientListingViewPolicyTable action={action} clientId={clientId} />
          </TabPanel>
          <TabPanel header={t("clientView.tabClaim")} className="policy__header">
            <ClientListingViewClaimTable clientId={clientId} />
          </TabPanel>
          <TabPanel header={t("clientView.tabRenewal")} className="policy__header">
            <ClientListingViewRenewalTable clientId={clientId} />
          </TabPanel>
          <TabPanel header={t("clientView.tabEndorsement")} className="policy__header">
            <ClientListingViewEndorsementTable clientId={clientId} />
          </TabPanel>
        </TabView>
      </Card>
    </div>
  );
};

export default ClientListingCard;
