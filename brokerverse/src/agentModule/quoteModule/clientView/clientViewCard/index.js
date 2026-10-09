import React, { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { TabPanel, TabView } from "primereact/tabview";
import ActivityPanel from "../../../../components/SalesActivities/ActivityPanel";
import { AuditTimeline } from "../../../../components/AuditTrail";
import { SectionCard } from "../../../../components/RecordPage";
import { ClaimTab, DocumentTab, EndorsementTab, PolicyTab, QuotationTab, ReceiptTab, RenewalTab } from "./ClientRecordTables";

const TABS = ["policies", "quotations", "claims", "renewals", "endorsements", "receipts", "documents", "activity", "history"];

/** Tabs of the client view, each with its record count; a tab's table is loaded when the tab is first opened. */
const ClientTabs = ({ clientId, leadId, counts, onOnboarding }) => {
  const { t } = useTranslation();
  const [active, setActive] = useState(0);
  const [opened, setOpened] = useState([0]);
  const header = (key) => (counts && counts[key] !== undefined ? `${t(`client360.tabs.${key}`)} (${counts[key]})` : t(`client360.tabs.${key}`));
  const body = (key) => {
    switch (key) {
      case "policies": return <PolicyTab clientId={clientId} />;
      case "quotations": return <QuotationTab clientId={clientId} leadId={leadId} />;
      case "claims": return <ClaimTab clientId={clientId} />;
      case "renewals": return <RenewalTab clientId={clientId} />;
      case "endorsements": return <EndorsementTab clientId={clientId} />;
      case "receipts": return <ReceiptTab clientId={clientId} />;
      case "documents": return <DocumentTab clientId={clientId} onOnboarding={onOnboarding} />;
      case "activity": return <ActivityPanel entity="client" recordId={String(clientId)} />;
      default: return <AuditTimeline entity="client" recordId={clientId} />;
    }
  };
  return (
    <SectionCard className="client360-tabs">
      <TabView activeIndex={active} scrollable onTabChange={(e) => { setActive(e.index); setOpened((o) => (o.includes(e.index) ? o : [...o, e.index])); }}>
        {TABS.map((key, i) => (
          <TabPanel key={key} header={header(key)}>
            {opened.includes(i) ? body(key) : null}
          </TabPanel>
        ))}
      </TabView>
    </SectionCard>
  );
};

ClientTabs.propTypes = {
  clientId: PropTypes.string.isRequired,
  leadId: PropTypes.string,
  counts: PropTypes.object,
  onOnboarding: PropTypes.func.isRequired,
};
ClientTabs.defaultProps = { leadId: null, counts: null };

export default ClientTabs;
