import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { MultiSelect } from "primereact/multiselect";
import { TabView, TabPanel } from "primereact/tabview";
import { Tag } from "primereact/tag";
import packagesService from "../../services/packagesService";
import { notifyError, notifySuccess } from "../../utility/dialogs";
import { formatDate } from "../../utility/dateFormat";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { PageHeader } from "../Placement/shared";
import { PAYMENT_METHODS, StatusTag } from "./common";
import "../Placement/index.scss";
import "../Administration/index.scss";
import "./index.scss";

/** One gateway's settings card (the credentials themselves live in the server's secret store, never here). */
const GatewayCard = ({ gateway, onSaved }) => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`packagedProducts.gateways.${key}`, opts);
  const [g, setG] = useState(gateway);
  const [saving, setSaving] = useState(false);
  useEffect(() => setG(gateway), [gateway]);
  const set = (patch) => setG((x) => ({ ...x, ...patch }));
  const save = async () => {
    setSaving(true);
    try {
      await packagesService.updateGateway(g.code, { enabled: g.enabled, mode: g.mode, methods: g.methods, feeHandling: g.feeHandling, feePercent: g.feePercent || 0, feeFixed: g.feeFixed || 0,
        linkValidityHours: g.linkValidityHours || null, autoIssue: g.autoIssue, bankAccountCode: g.bankAccountCode || null });
      notifySuccess(k("saved", { name: g.name }));
      onSaved();
    } catch (e) {
      notifyError(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="placement-card pkg-gateway">
      <div className="pkg-gateway-head">
        <div>
          <h3>{g.name}</h3>
          <span className="muted">{g.code} / {t(`packagedProducts.providers.${g.provider}`, { defaultValue: g.provider })}</span>
        </div>
        <Tag value={g.enabled ? k("enabled") : k("disabled")} severity={g.enabled ? "success" : "secondary"} />
      </div>
      <div className="pkg-credentials">
        {g.provider === "sandbox" ? <Tag value={k("noCredentials")} severity="info" /> : (g.credentials || []).map((c) => (
          <Tag key={c.name} value={`${c.name}: ${c.present ? k("present") : k("missing")}`} severity={c.present ? "success" : "warning"} icon={c.present ? "pi pi-lock" : "pi pi-exclamation-triangle"} />
        ))}
      </div>
      <div className="admin__grid">
        <div className="admin__field"><label htmlFor={`${g.code}-on`}>{k("enabled")}</label><InputSwitch inputId={`${g.code}-on`} checked={Boolean(g.enabled)} onChange={(e) => set({ enabled: e.value })} /></div>
        <div className="admin__field"><label htmlFor={`${g.code}-mode`}>{k("mode")}</label>
          <Dropdown inputId={`${g.code}-mode`} value={g.mode} options={["sandbox", "live"].map((m) => ({ label: k(`modes.${m}`), value: m, disabled: m === "live" && g.provider === "sandbox" }))} onChange={(e) => set({ mode: e.value })} /></div>
        <div className="admin__field"><label htmlFor={`${g.code}-methods`}>{k("methods")}</label>
          <MultiSelect inputId={`${g.code}-methods`} value={g.methods} display="chip" options={PAYMENT_METHODS.map((m) => ({ label: t(`packagedProducts.paymentMethods.${m}`, { defaultValue: m }), value: m }))} onChange={(e) => set({ methods: e.value })} /></div>
        <div className="admin__field"><label htmlFor={`${g.code}-fee`}>{k("feeHandling")}</label>
          <Dropdown inputId={`${g.code}-fee`} value={g.feeHandling} options={["absorb", "pass_on"].map((f) => ({ label: k(`fees.${f}`), value: f }))} onChange={(e) => set({ feeHandling: e.value })} /></div>
        <div className="admin__field"><label htmlFor={`${g.code}-pct`}>{k("feePercent")}</label><InputNumber inputId={`${g.code}-pct`} value={g.feePercent} suffix="%" maxFractionDigits={4} min={0} onValueChange={(e) => set({ feePercent: e.value })} /></div>
        <div className="admin__field"><label htmlFor={`${g.code}-fixed`}>{k("feeFixed")}</label><InputNumber inputId={`${g.code}-fixed`} value={g.feeFixed} minFractionDigits={2} maxFractionDigits={2} min={0} onValueChange={(e) => set({ feeFixed: e.value })} /></div>
        <div className="admin__field"><label htmlFor={`${g.code}-hours`}>{k("validity")}</label><InputNumber inputId={`${g.code}-hours`} value={g.linkValidityHours} min={1} max={2160} placeholder={k("validityDefault")} onValueChange={(e) => set({ linkValidityHours: e.value })} /></div>
        <div className="admin__field"><label htmlFor={`${g.code}-auto`}>{k("autoIssue")}</label><InputSwitch inputId={`${g.code}-auto`} checked={Boolean(g.autoIssue)} onChange={(e) => set({ autoIssue: e.value })} /></div>
        <div className="admin__field"><label htmlFor={`${g.code}-bank`}>{k("bankAccount")}</label><InputText id={`${g.code}-bank`} value={g.bankAccountCode || ""} onChange={(e) => set({ bankAccountCode: e.target.value })} /></div>
      </div>
      {g.remarks && <p className="muted">{g.remarks}</p>}
      <div className="pkg-actions"><Button label={t("common.save")} icon="pi pi-check" loading={saving} onClick={save} /></div>
    </div>
  );
};

/**
 * Master > Packaged Products > Payment Gateways: Dragonpay, PayMongo and the sandbox gateway (enabled, sandbox or live,
 * payment methods, fee handling, link validity, automatic issuance of package policies) and the payments log of every
 * notification received.
 */
const PaymentGateways = () => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`packagedProducts.gateways.${key}`, opts);
  const { formatCurrency } = useFormatCurrency();
  const [gateways, setGateways] = useState([]);
  const [events, setEvents] = useState({ rows: [], total: 0 });
  const [page, setPage] = useState({ first: 0, rows: 20 });

  const load = () => packagesService.listGateways().then(setGateways).catch((e) => notifyError(e.message));
  const loadEvents = () => packagesService.listPaymentEvents({ page: page.first / page.rows + 1, perPage: page.rows })
    .then((r) => setEvents({ rows: r.data || [], total: r.total || 0 })).catch(() => setEvents({ rows: [], total: 0 }));
  useEffect(() => { load(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadEvents(); }, [page.first, page.rows]);

  return (
    <div className="placement-page pkg-page">
      <PageHeader title={k("title")} />
      <TabView>
        <TabPanel header={k("gatewaysTab")}>
          <p className="muted">{k("secretsNote")}</p>
          <div className="grid">
            {gateways.map((g) => <div key={g.code} className="col-12 xl:col-6"><GatewayCard gateway={g} onSaved={load} /></div>)}
          </div>
        </TabPanel>
        <TabPanel header={k("logTab")}>
          <DataTable value={events.rows} lazy paginator first={page.first} rows={page.rows} totalRecords={events.total} onPage={(e) => setPage({ first: e.first, rows: e.rows })}
            dataKey="id" size="small" stripedRows emptyMessage={k("noEvents")} responsiveLayout="scroll">
            <Column header={k("received")} body={(e) => formatDate(e.receivedAt, { withTime: true })} />
            <Column field="gatewayCode" header={k("gateway")} />
            <Column field="linkNumber" header={k("link")} body={(e) => e.linkNumber || "-"} />
            <Column field="eventType" header={k("event")} />
            <Column header={k("signature")} body={(e) => <Tag value={e.signatureValid ? k("valid") : k("invalid")} severity={e.signatureValid ? "success" : "danger"} />} />
            <Column header={k("status")} body={(e) => (e.status ? <StatusTag status={e.status} /> : "-")} />
            <Column header={k("amount")} body={(e) => (e.amount === null ? "-" : formatCurrency(e.amount))} className="num" headerClassName="num" />
            <Column header={k("error")} body={(e) => e.error || ""} />
          </DataTable>
        </TabPanel>
      </TabView>
    </div>
  );
};

export default PaymentGateways;
