import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import clientService from "../../../services/clientService";
import { getRequest } from "../../../utility/commonServices";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { formatDate } from "../../../utility/dateFormat";
import StatCards from "../../../components/StatCards";
import { PageHeader, StatusChip } from "../../../components/RecordPage";
import ClientTabs from "./clientViewCard";
import "./index.scss";

const KYC_SEVERITY = { complete: "success", pending: "warning", incomplete: "warning", expired: "danger" };

/**
 * Operations > Clients > client: the client 360 view. Header with the client's name, code, type, KYC status and
 * contact; the figures of the relationship (policies in force and their premium, open claims, open renewals, unpaid
 * balance); the client's policies, quotations, claims, renewals, endorsements, receipts, KYC documents, activities
 * and history under tabs.
 */
const ClientView = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const { id: clientId } = useParams();
  const [client, setClient] = useState(null);
  const [summary, setSummary] = useState(null);
  const toList = () => navigate("/agent/clientlisting");

  const load = useCallback(async () => {
    const r = await clientService.getClientById(clientId);
    if (r.success) {
      const payload = r.data?.data || r.data;
      setClient(payload?.client || payload);
    }
    getRequest(`clients/${encodeURIComponent(clientId)}/summary`).then((s) => setSummary(s.data?.data || null)).catch(() => setSummary(null));
  }, [clientId]);
  useEffect(() => { load(); }, [load]);

  const name = client?.displayName || client?.fullName || [client?.firstName, client?.lastName].filter(Boolean).join(" ") || client?.companyName;
  const code = client?.clientCode || client?.generatedClientId;
  const type = String(client?.clientType || "").toLowerCase();
  const figures = [
    { key: "policies", label: t("client360.figures.activePolicies"), value: summary?.activePolicies ?? null, note: t("client360.figures.ofPolicies", { count: summary?.counts?.policies ?? 0 }) },
    { key: "premium", label: t("client360.figures.premium"), value: summary ? formatCurrency(summary.activePremium) : null, note: t("client360.figures.premiumNote") },
    { key: "claims", label: t("client360.figures.openClaims"), value: summary?.openClaims ?? null, note: t("client360.figures.ofClaims", { count: summary?.counts?.claims ?? 0 }) },
    { key: "renewals", label: t("client360.figures.renewalsDue"), value: summary?.openRenewals ?? null,
      note: summary?.nextExpiry ? t("client360.figures.nextExpiry", { date: formatDate(summary.nextExpiry) }) : t("client360.figures.noneDue") },
    { key: "balance", label: t("client360.figures.outstanding"), value: summary ? formatCurrency(summary.outstanding) : null,
      note: summary?.overdueBills ? t("client360.figures.overdue", { count: summary.overdueBills }) : t("client360.figures.noOverdue") },
  ];

  const sep = <span className="bv-page-header__sep" aria-hidden="true">·</span>;
  return (
    <div className="bv-ops-page client360">
      <PageHeader
        title={name || t("clientView.loading")}
        crumbs={[{ label: t("sidebar.Operations") }, { label: t("clients.title"), onClick: toList }, { label: code || t("clients.client", { defaultValue: "Client" }) }]}
        meta={client ? (
          <>
            {code ? <span className="bv-page-header__code">{code}</span> : null}
            {type ? <StatusChip label={t(`client360.type.${type}`, type)} severity="secondary" /> : null}
            {client.kycStatus ? <StatusChip label={t(`onboarding.kycStatus.${client.kycStatus}`, { defaultValue: client.kycStatus })} severity={KYC_SEVERITY[client.kycStatus] || "info"} /> : null}
            {client.status && client.status !== "active" ? <StatusChip status={client.status} /> : null}
            {client.contactNumber ? <>{sep}<span><i className="pi pi-phone mr-1" aria-hidden="true" />{client.contactNumber}</span></> : null}
            {client.emailId ? <>{sep}<span><i className="pi pi-envelope mr-1" aria-hidden="true" />{client.emailId}</span></> : null}
            {client.city || client.province ? <>{sep}<span>{[client.city, client.province].filter(Boolean).join(", ")}</span></> : null}
          </>
        ) : null}
        actions={(
          <>
            <Button icon="pi pi-arrow-left" outlined label={t("client360.back")} onClick={toList} />
            <Button icon="pi pi-id-card" label={t("onboarding.identification")} onClick={() => navigate(`/agent/client-onboarding/${clientId}`)} />
          </>
        )} />
      <StatCards items={figures} />
      <ClientTabs clientId={clientId} leadId={client?.leadId || null} counts={summary?.counts} onOnboarding={() => navigate(`/agent/client-onboarding/${clientId}`)} />
    </div>
  );
};

export default ClientView;
