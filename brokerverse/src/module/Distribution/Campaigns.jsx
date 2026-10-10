import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import service from "../../services/distributionService";
import { hasPermission } from "../../utils/canOpen";
import RichTextEditor, { htmlIsEmpty } from "../../components/RichTextEditor";
import { openConfirm } from "../../components/ConfirmDialog";
import DetailDialog from "../../components/DetailDialog";
import DetailHeader from "../../components/DetailHeader";
import DetailSection from "../../components/DetailSection";
import KeyValueGrid from "../../components/KeyValueGrid";
import { Field, PageHeader, StatusTag, dateTime, fieldErrors, showError, showSuccess } from "./common";
import { lobChoices, useProductLines } from "../Sales/salesProducts";

const EMPTY_SEGMENT = { name: "", description: "", status: "active",
  criteria: { partyType: "both", lob: "", productId: null, province: "", city: "", channelId: "", clientType: "", leadStatus: "", expiringWithinDays: null } };
const OPT_OUT_LINK = '<a href="{{optOutLink}}">unsubscribe here</a>';
const EMPTY_TEMPLATE = { code: "", name: "", subject: "", status: "active",
  bodyHtml: `<p>Dear {{firstName}},</p><p><br></p><p>{{companyName}}</p><p style="font-size:12px">To stop receiving offers by e-mail, ${OPT_OUT_LINK}.</p>` };
const HAS_OPT_OUT = /\{\{\s*optOutLink\s*\}\}/;
const CONSENT_CHANNELS = ["Form", "E-mail", "Phone", "In person", "Website"];

/** Criteria without the empty values, as the API expects them. */
const cleanCriteria = (c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== "" && v !== null && v !== undefined));

/**
 * Operations > Sales & Marketing > Campaigns: e-mail campaigns to clients and prospects who agreed to receive offers.
 * A segment picks the audience (only people whose marketing consent is in force and who have an e-mail are reached),
 * a template the message (with the opt-out link); sending queues the e-mails to the outbox. Results show delivery,
 * exclusions by reason, opt-outs and the quotations and policies that followed. Marketing consents records the consent
 * (or refusal) a client or prospect gave, which decides who a campaign reaches.
 */
const Campaigns = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const write = hasPermission("write:campaigns");
  const [tab, setTab] = useState(0);
  const [campaigns, setCampaigns] = useState([]);
  const [segments, setSegments] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [channels, setChannels] = useState([]);
  const [status, setStatus] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [segment, setSegment] = useState(null);
  const [segmentPreview, setSegmentPreview] = useState(null);
  const [template, setTemplate] = useState(null);
  const [templatePreview, setTemplatePreview] = useState(null);
  const [schedule, setSchedule] = useState(null); // { id, at }
  const [results, setResults] = useState(null);
  const [errors, setErrors] = useState({});
  const [consents, setConsents] = useState([]);
  const [consentFilters, setConsentFilters] = useState({ search: "", partyType: null, status: null });
  const [consent, setConsent] = useState(null); // { party, granted, channel, evidence }
  // the active lines that have active products (the product pickers' lines); a segment keeps the line it was saved with
  const lines = useProductLines({ enabled: Boolean(segment) || tab === 1 });
  const segmentLobOptions = (lob) => {
    const options = lobChoices(lines);
    return lob && !options.some((o) => o.value === lob) ? [...options, { value: lob, label: lob }] : options;
  };
  const products = (lines || []).flatMap((l) => l.products.map((p) => ({ ...p, lineCode: l.code })));
  const productOptions = (lob) => products.filter((p) => !lob || p.lineCode === lob || p.lob === lob).map((p) => ({ value: Number(p.id), label: p.name }));
  const productName = (id) => products.find((p) => String(p.id) === String(id))?.name || null;

  const load = useCallback(async () => {
    try {
      const [c, s, tp] = await Promise.all([service.campaigns({ status: status || undefined }), service.segments(), service.campaignTemplates()]);
      setCampaigns(c);
      setSegments(s);
      setTemplates(tp);
    } catch (e) {
      showError(toast, e);
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { service.channelOptions().then(setChannels).catch(() => setChannels([])); }, []);

  const loadConsents = useCallback(async () => {
    try {
      setConsents(await service.marketingConsents({ search: consentFilters.search || undefined, partyType: consentFilters.partyType || undefined, status: consentFilters.status || undefined }));
    } catch (e) {
      showError(toast, e);
    }
  }, [consentFilters]);
  useEffect(() => { if (tab === 3) loadConsents(); }, [tab, loadConsents]);

  const act = async (fn, after) => {
    try {
      const r = await fn();
      if (r?.message) showSuccess(toast, r.message);
      if (after) after(r);
      load();
      return r;
    } catch (e) {
      setErrors(fieldErrors(e));
      showError(toast, e);
      return null;
    }
  };
  /** Opens a form (or closes it with null) without the messages of the one before. */
  const open = (setter) => (value) => { setErrors({}); setter(value); };
  const openCampaign = open(setCampaign);
  const openSegment = open(setSegment);
  const openTemplate = open(setTemplate);
  const openConsent = open(setConsent);
  /** Keeps the messages of the fields that are still wrong; false when one is. */
  const check = (out) => {
    setErrors(out);
    return !Object.keys(out).length;
  };
  const required = t("distribution.common.required", "Required");

  const saveCampaign = () => {
    if (!check({
      ...(campaign.name?.trim() ? {} : { name: required }),
      ...(campaign.segmentId ? {} : { segmentId: t("distribution.cp.segmentRequired", "Choose the segment") }),
      ...(campaign.templateId ? {} : { templateId: t("distribution.cp.templateRequired", "Choose the template") }),
    })) return null;
    return act(() => (campaign.id
      ? service.updateCampaign(campaign.id, { name: campaign.name.trim(), segmentId: campaign.segmentId, templateId: campaign.templateId, notes: campaign.notes || null })
      : service.createCampaign({ name: campaign.name.trim(), segmentId: campaign.segmentId, templateId: campaign.templateId, notes: campaign.notes || null })), () => openCampaign(null));
  };
  const campaignFacts = (row) => [
    { label: t("distribution.cp.number", "Campaign"), value: row.campaignNumber },
    { label: t("distribution.common.name", "Name"), value: row.name },
    { label: t("distribution.cp.segment", "Segment"), value: row.segmentName },
    { label: t("distribution.cp.template", "Template"), value: row.templateName },
  ];
  // the action runs in the confirmation (a failure stays there); the list is reloaded after it
  const confirmAct = async (options, fn) => {
    let result = null;
    if (!(await openConfirm({ ...options, onConfirm: async () => { result = await fn(); } }))) return;
    if (result?.message) showSuccess(toast, result.message);
    load();
  };
  const send = async (row) => {
    const criteria = segments.find((s) => s.id === row.segmentId)?.criteria;
    const audience = criteria ? await service.previewSegment(cleanCriteria(criteria)).then((r) => r.data).catch(() => null) : null;
    confirmAct({
      title: t("distribution.cp.sendTitle", "Send campaign"),
      message: t("distribution.cp.sendMessage", "The e-mails are queued to the outbox for every recipient who agreed to receive offers."),
      facts: [
        ...campaignFacts(row),
        { label: t("distribution.cp.matching", "Matching"), value: audience?.total, type: "number", hidden: !audience },
        { label: t("distribution.cp.reachable", "Reachable (consent and e-mail)"), value: audience?.eligible, type: "number", emphasis: true, hidden: !audience },
      ],
      confirmLabel: t("distribution.cp.sendAction", "Send campaign"),
    }, () => service.sendCampaign(row.id));
  };
  const cancel = (row) => confirmAct({
    title: t("distribution.cp.cancelCampaign", "Cancel campaign"),
    severity: "danger",
    message: t("distribution.cp.cancelMessage", "The campaign is not sent. A cancelled campaign cannot be scheduled again."),
    facts: [...campaignFacts(row), { label: t("distribution.cp.when", "Scheduled / sent"), value: row.scheduledAt, type: "datetime", hidden: !row.scheduledAt }],
    confirmLabel: t("distribution.cp.cancelCampaign", "Cancel campaign"),
    cancelLabel: t("distribution.common.back", "Back"),
  }, () => service.cancelCampaign(row.id));
  const openResults = async (row) => {
    try {
      setResults(await service.campaignResults(row.id));
    } catch (e) {
      showError(toast, e);
    }
  };

  const previewSegment = async () => {
    try {
      const r = await service.previewSegment(cleanCriteria(segment.criteria));
      setSegmentPreview(r.data);
    } catch (e) {
      showError(toast, e);
    }
  };
  const saveSegment = () => {
    if (!check(segment.name?.trim() ? {} : { name: required })) return null;
    const body = { name: segment.name.trim(), description: segment.description || null, status: segment.status, criteria: cleanCriteria(segment.criteria) };
    return act(() => (segment.id ? service.updateSegment(segment.id, body) : service.createSegment(body)), () => { openSegment(null); setSegmentPreview(null); });
  };
  const templateProblems = () => ({
    ...(template.code?.trim() ? {} : { code: required }),
    ...(template.name?.trim() ? {} : { name: required }),
    ...(template.subject?.trim() ? {} : { subject: t("distribution.cp.subjectRequired", "Enter the subject of the e-mail") }),
    ...(htmlIsEmpty(template.bodyHtml) ? { bodyHtml: t("distribution.cp.bodyRequired", "Write the message") } : {}),
  });
  const saveTemplate = () => {
    if (!check(templateProblems())) return null;
    const body = { code: template.code.trim(), name: template.name.trim(), subject: template.subject.trim(), bodyHtml: template.bodyHtml, status: template.status };
    return act(() => (template.id ? service.updateCampaignTemplate(template.id, body) : service.createCampaignTemplate(body)), () => openTemplate(null));
  };
  const showPreview = async (name, fn) => {
    try {
      const r = await fn();
      setTemplatePreview({ name, ...r.data });
    } catch (e) {
      showError(toast, e);
    }
  };
  const previewTemplate = (row) => showPreview(row.name, () => service.previewCampaignTemplate(row.id));
  const previewDraft = () => {
    const { subject, bodyHtml } = templateProblems();
    if (!check(subject || bodyHtml ? { ...(subject ? { subject } : {}), ...(bodyHtml ? { bodyHtml } : {}) } : {})) return;
    showPreview(template.name || t("distribution.cp.newTemplate", "New template"), () => service.previewCampaignTemplateDraft({ subject: template.subject.trim(), bodyHtml: template.bodyHtml }));
  };
  const saveConsent = () => {
    if (!check(consent.channel ? {} : { channel: t("distribution.cp.channelRequired", "Choose how the person told us") })) return null;
    const { party } = consent;
    return act(() => service.recordMarketingConsent({ partyType: party.partyType, partyId: party.partyId, granted: consent.granted, channel: consent.channel, evidence: consent.evidence || null }),
      () => { openConsent(null); loadConsents(); });
  };

  const setCriteria = (k, v) => setSegment((s) => ({ ...s, criteria: { ...s.criteria, [k]: v } }));
  const setLob = (lob) => setSegment((s) => ({ ...s, criteria: { ...s.criteria, lob, productId: productOptions(lob).some((o) => o.value === s.criteria.productId) ? s.criteria.productId : null } }));
  const statusOptions = ["draft", "scheduled", "sent", "cancelled"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }));
  const activeOptions = ["active", "inactive"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }));
  const partyOptions = ["both", "client", "lead"].map((v) => ({ value: v, label: t(`distribution.cp.party.${v}`, v) }));
  const consentStatusOptions = ["granted", "refused", "withdrawn", "not-recorded"].map((v) => ({ value: v, label: t(`distribution.status.${v}`, v) }));
  const segmentOptions = segments.filter((s) => s.status === "active").map((s) => ({ value: s.id, label: s.name }));
  const templateOptions = templates.filter((x) => x.status === "active").map((x) => ({ value: x.id, label: x.name }));
  const describe = (c = {}) => [t(`distribution.cp.party.${c.partyType || "both"}`, c.partyType || "both"), c.lob, c.productId ? productName(c.productId) || `#${c.productId}` : null,
    c.province, c.city, c.clientType, c.leadStatus,
    c.expiringWithinDays ? t("distribution.cp.expiring", "expiring within {{days}} days", { days: c.expiringWithinDays }) : null].filter(Boolean).join(" · ");
  const placeholders = [
    { name: "firstName", label: t("distribution.cp.ph.firstName", "First name") },
    { name: "fullName", label: t("distribution.cp.ph.fullName", "Full name") },
    { name: "companyName", label: t("distribution.cp.ph.companyName", "Company name") },
    { name: "optOutLink", label: t("distribution.cp.ph.optOutLink", "Opt-out link"), html: OPT_OUT_LINK },
  ];

  return (
    <div className="pe-page">
      <Toast ref={toast} />
      <PageHeader home={t("distribution.home.operations", "Operations")} section={t("distribution.home.sales", "Sales & Marketing")} title={t("distribution.cp.title", "Campaigns")}
        subtitle={t("distribution.cp.subtitle", "E-mail offers to clients and prospects who agreed to receive them; everyone else is left out and every e-mail carries an opt-out link.")}>
        {write && tab === 0 ? <Button label={t("distribution.cp.new", "New campaign")} icon="pi pi-plus" onClick={() => openCampaign({ name: "", segmentId: null, templateId: null, notes: "" })} /> : null}
        {write && tab === 1 ? <Button label={t("distribution.cp.newSegment", "New segment")} icon="pi pi-plus" onClick={() => { openSegment(EMPTY_SEGMENT); setSegmentPreview(null); }} /> : null}
        {write && tab === 2 ? <Button label={t("distribution.cp.newTemplate", "New template")} icon="pi pi-plus" onClick={() => openTemplate(EMPTY_TEMPLATE)} /> : null}
      </PageHeader>
      <div className="pe-card">
        <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
          <TabPanel header={t("distribution.cp.campaigns", "Campaigns")}>
            <div className="dist-toolbar">
              <Dropdown value={status} options={statusOptions} showClear placeholder={t("distribution.common.status", "Status")} onChange={(e) => setStatus(e.value || null)} />
            </div>
            <DataTable value={campaigns} dataKey="id" size="small" stripedRows paginator rows={20} emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="campaignNumber" header={t("distribution.cp.number", "Campaign")} />
              <Column field="name" header={t("distribution.common.name", "Name")} />
              <Column field="segmentName" header={t("distribution.cp.segment", "Segment")} />
              <Column field="templateName" header={t("distribution.cp.template", "Template")} />
              <Column header={t("distribution.cp.when", "Scheduled / sent")} body={(r) => dateTime(r.sentAt || r.scheduledAt)} />
              <Column header={t("distribution.cp.recipients", "Recipients")} body={(r) => (r.status === "sent" ? r.recipients : "")} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.cp.excluded", "Excluded")} body={(r) => (r.status === "sent" ? r.excluded : "")} className="bv-num" headerClassName="bv-num" />
              <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
              <Column body={(r) => (
                <div className="dist-actions">
                  {r.status === "sent" ? <Button icon="pi pi-chart-bar" text size="small" tooltip={t("distribution.cp.results", "Results")} aria-label={t("distribution.cp.results", "Results")} onClick={() => openResults(r)} /> : null}
                  {write && ["draft", "scheduled"].includes(r.status) ? (
                    <>
                      <Button icon="pi pi-pencil" text size="small" aria-label={t("distribution.common.edit", "Edit")} onClick={() => openCampaign(r)} />
                      <Button icon="pi pi-clock" text size="small" tooltip={t("distribution.cp.schedule", "Schedule")} aria-label={t("distribution.cp.schedule", "Schedule")}
                        onClick={() => setSchedule({ id: r.id, name: r.name, at: r.scheduledAt ? new Date(r.scheduledAt) : null })} />
                      <Button icon="pi pi-send" text size="small" tooltip={t("distribution.cp.sendNow", "Send now")} aria-label={t("distribution.cp.sendNow", "Send now")} onClick={() => send(r)} />
                      <Button icon="pi pi-times" text size="small" severity="danger" tooltip={t("distribution.common.cancel", "Cancel")} aria-label={t("distribution.cp.cancelCampaign", "Cancel campaign")} onClick={() => cancel(r)} />
                    </>
                  ) : null}
                </div>
              )} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("distribution.cp.segments", "Segments")}>
            <DataTable value={segments} dataKey="id" size="small" stripedRows emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="name" header={t("distribution.common.name", "Name")} />
              <Column header={t("distribution.cp.audience", "Audience")} body={(r) => describe(r.criteria)} />
              <Column field="description" header={t("distribution.common.description", "Description")} />
              <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
              <Column body={(r) => (write ? <Button icon="pi pi-pencil" text size="small" aria-label={t("distribution.common.edit", "Edit")}
                onClick={() => { openSegment({ ...r, criteria: { ...EMPTY_SEGMENT.criteria, ...r.criteria } }); setSegmentPreview(null); }} /> : null)} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("distribution.cp.templates", "Templates")}>
            <DataTable value={templates} dataKey="id" size="small" stripedRows emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="code" header={t("distribution.common.code", "Code")} />
              <Column field="name" header={t("distribution.common.name", "Name")} />
              <Column field="subject" header={t("distribution.cp.subject", "Subject")} />
              <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
              <Column body={(r) => (
                <div className="dist-actions">
                  <Button icon="pi pi-eye" text size="small" tooltip={t("distribution.cp.preview", "Preview")} aria-label={t("distribution.cp.preview", "Preview")} onClick={() => previewTemplate(r)} />
                  {write ? <Button icon="pi pi-pencil" text size="small" aria-label={t("distribution.common.edit", "Edit")} onClick={() => openTemplate(r)} /> : null}
                </div>
              )} />
            </DataTable>
          </TabPanel>
          <TabPanel header={t("distribution.cp.consents", "Marketing consents")}>
            <p className="pe-muted mt-0">{t("distribution.cp.consentsHelp", "A campaign reaches only the clients and prospects whose agreement to receive offers is recorded here. Record what the person told us and how (the signed form, a call, an e-mail).")}</p>
            <div className="dist-toolbar">
              <span className="p-input-icon-left"><i className="pi pi-search" />
                <InputText value={consentFilters.search} placeholder={t("distribution.cp.consentSearch", "Name, code or e-mail")} aria-label={t("distribution.cp.consentSearch", "Name, code or e-mail")}
                  onChange={(e) => setConsentFilters({ ...consentFilters, search: e.target.value })} /></span>
              <Dropdown value={consentFilters.partyType} options={partyOptions.filter((o) => o.value !== "both")} showClear placeholder={t("distribution.cp.partyType", "Who")}
                onChange={(e) => setConsentFilters({ ...consentFilters, partyType: e.value || null })} />
              <Dropdown value={consentFilters.status} options={consentStatusOptions} showClear placeholder={t("distribution.cp.consent", "Consent")}
                onChange={(e) => setConsentFilters({ ...consentFilters, status: e.value || null })} />
            </div>
            <DataTable value={consents} dataKey="partyId" size="small" stripedRows paginator rows={20} emptyMessage={t("distribution.common.none", "Nothing to show")}>
              <Column field="name" header={t("distribution.common.name", "Name")} />
              <Column field="code" header={t("distribution.common.code", "Code")} />
              <Column header={t("distribution.cp.partyType", "Who")} body={(r) => t(`distribution.cp.party.${r.partyType}`, r.partyType)} />
              <Column field="email" header={t("distribution.cp.email", "E-mail")} />
              <Column header={t("distribution.cp.consent", "Consent")} body={(r) => <StatusTag status={r.status} />} />
              <Column header={t("distribution.cp.consentHow", "How")} body={(r) => [r.channel, r.evidence].filter(Boolean).join(": ")} />
              <Column header={t("distribution.cp.recordedAt", "Recorded")} body={(r) => dateTime(r.recordedAt)} />
              {write ? <Column body={(r) => (
                <div className="dist-actions">
                  <Button icon="pi pi-check" text size="small" tooltip={t("distribution.cp.agreed", "Agreed to receive offers")} aria-label={t("distribution.cp.agreed", "Agreed to receive offers")}
                    onClick={() => openConsent({ party: r, granted: true, channel: "Form", evidence: "" })} />
                  <Button icon="pi pi-ban" text size="small" severity="danger" tooltip={t("distribution.cp.refused", "Refused offers")} aria-label={t("distribution.cp.refused", "Refused offers")}
                    onClick={() => openConsent({ party: r, granted: false, channel: "Form", evidence: "" })} />
                </div>
              )} /> : null}
            </DataTable>
          </TabPanel>
        </TabView>
      </div>

      <Dialog className="pe-dialog" header={campaign?.id ? campaign.name : t("distribution.cp.new", "New campaign")} visible={!!campaign} style={{ width: "min(620px, 96vw)" }} onHide={() => openCampaign(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => openCampaign(null)} />
          <Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={saveCampaign} /></div>}>
        {campaign && (
          <div className="dist-grid">
            <Field label={t("distribution.common.name", "Name")} full required error={errors.name}>
              <InputText value={campaign.name} onChange={(e) => setCampaign({ ...campaign, name: e.target.value })} />
            </Field>
            <Field label={t("distribution.cp.segment", "Segment")} required error={errors.segmentId}>
              <Dropdown value={campaign.segmentId} options={segmentOptions} onChange={(e) => setCampaign({ ...campaign, segmentId: e.value })} filter />
            </Field>
            <Field label={t("distribution.cp.template", "Template")} required error={errors.templateId}>
              <Dropdown value={campaign.templateId} options={templateOptions} onChange={(e) => setCampaign({ ...campaign, templateId: e.value })} filter />
            </Field>
            <Field label={t("distribution.common.notes", "Notes")} full><InputTextarea rows={2} value={campaign.notes || ""} onChange={(e) => setCampaign({ ...campaign, notes: e.target.value })} /></Field>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={t("distribution.cp.schedule", "Schedule")} visible={!!schedule} style={{ width: "min(460px, 96vw)" }} onHide={() => setSchedule(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => setSchedule(null)} />
          <Button label={t("distribution.cp.schedule", "Schedule")} icon="pi pi-clock" disabled={!schedule?.at}
            onClick={() => act(() => service.scheduleCampaign(schedule.id, schedule.at.toISOString()), () => setSchedule(null))} /></div>}>
        {schedule && (
          <Field label={t("distribution.cp.sendAt", "Send at")} full required help={t("distribution.cp.sendAtHelp", "The campaign-dispatch job sends it at that time")}>
            <Calendar value={schedule.at} onChange={(e) => setSchedule({ ...schedule, at: e.value })} showTime hourFormat="12" minDate={new Date()} />
          </Field>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={segment?.id ? segment.name : t("distribution.cp.newSegment", "New segment")} visible={!!segment} style={{ width: "min(760px, 96vw)" }} onHide={() => openSegment(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => openSegment(null)} />
          <Button label={t("distribution.cp.whoIsReached", "Who is reached")} icon="pi pi-users" outlined onClick={previewSegment} />
          <Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={saveSegment} /></div>}>
        {segment && (
          <div>
            <div className="dist-grid">
              <Field label={t("distribution.common.name", "Name")} required error={errors.name}><InputText value={segment.name} onChange={(e) => setSegment({ ...segment, name: e.target.value })} /></Field>
              <Field label={t("distribution.common.status", "Status")}><Dropdown value={segment.status} options={activeOptions} onChange={(e) => setSegment({ ...segment, status: e.value })} /></Field>
              <Field label={t("distribution.common.description", "Description")} full><InputText value={segment.description || ""} onChange={(e) => setSegment({ ...segment, description: e.target.value })} /></Field>
              <Field label={t("distribution.cp.partyType", "Who")}><Dropdown value={segment.criteria.partyType} options={partyOptions} onChange={(e) => setCriteria("partyType", e.value)} /></Field>
              <Field label={t("distribution.cp.lob", "Line of business")}><Dropdown value={segment.criteria.lob} options={segmentLobOptions(segment.criteria.lob)} showClear onChange={(e) => setLob(e.value || "")} /></Field>
              <Field label={t("distribution.cp.product", "Product")} help={t("distribution.cp.productHelp", "Clients insured for the product, prospects interested in it")}>
                <Dropdown value={segment.criteria.productId} options={productOptions(segment.criteria.lob)} showClear filter onChange={(e) => setCriteria("productId", e.value ?? null)} />
              </Field>
              <Field label={t("distribution.cp.province", "Province")}><InputText value={segment.criteria.province} onChange={(e) => setCriteria("province", e.target.value)} /></Field>
              <Field label={t("distribution.cp.city", "City / municipality")}><InputText value={segment.criteria.city} onChange={(e) => setCriteria("city", e.target.value)} /></Field>
              <Field label={t("distribution.cp.channel", "Distribution channel")}>
                <Dropdown value={segment.criteria.channelId} options={channels.map((c) => ({ value: c.id, label: c.label || c.name }))} showClear filter onChange={(e) => setCriteria("channelId", e.value || "")} />
              </Field>
              <Field label={t("distribution.cp.clientType", "Client type")}><InputText value={segment.criteria.clientType} onChange={(e) => setCriteria("clientType", e.target.value)} placeholder="Individual / Corporate" /></Field>
              <Field label={t("distribution.cp.leadStatus", "Prospect status")}><InputText value={segment.criteria.leadStatus} onChange={(e) => setCriteria("leadStatus", e.target.value)} /></Field>
              <Field label={t("distribution.cp.expiringWithin", "Policy expiring within (days)")}>
                <InputNumber value={segment.criteria.expiringWithinDays} onValueChange={(e) => setCriteria("expiringWithinDays", e.value)} min={0} max={366} />
              </Field>
            </div>
            {segmentPreview && (
              <div className="mt-3">
                <div className="pe-kpis">
                  <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.cp.matching", "Matching")}</div><div className="pe-kpi-value">{segmentPreview.total}</div></div>
                  <div className="pe-kpi"><div className="pe-kpi-label">{t("distribution.cp.reachable", "Reachable (consent and e-mail)")}</div><div className="pe-kpi-value">{segmentPreview.eligible}</div></div>
                </div>
                <DataTable value={Object.entries(segmentPreview.excluded || {}).map(([reason, count]) => ({ reason, count }))} dataKey="reason" size="small" className="mt-2"
                  emptyMessage={t("distribution.cp.noneExcluded", "Nobody is left out")}>
                  <Column field="reason" header={t("distribution.cp.leftOut", "Left out because")} />
                  <Column field="count" header={t("distribution.cp.people", "People")} className="bv-num" headerClassName="bv-num" />
                </DataTable>
                {segmentPreview.excluded?.["No marketing consent recorded"] ? (
                  <p className="pe-muted">{t("distribution.cp.recordConsents", "Record the consents people gave on the Marketing consents tab.")}</p>
                ) : null}
              </div>
            )}
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={template?.id ? template.name : t("distribution.cp.newTemplate", "New template")} visible={!!template} style={{ width: "min(920px, 96vw)" }} onHide={() => openTemplate(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => openTemplate(null)} />
          <Button label={t("distribution.cp.preview", "Preview")} icon="pi pi-eye" outlined onClick={previewDraft} />
          <Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={saveTemplate} /></div>}>
        {template && (
          <div className="dist-grid">
            <Field label={t("distribution.common.code", "Code")} required error={errors.code}>
              <InputText value={template.code} maxLength={40} onChange={(e) => setTemplate({ ...template, code: e.target.value.toUpperCase() })} placeholder="MOTOR-RENEW" />
            </Field>
            <Field label={t("distribution.common.name", "Name")} required error={errors.name}><InputText value={template.name} maxLength={120} onChange={(e) => setTemplate({ ...template, name: e.target.value })} /></Field>
            <Field label={t("distribution.cp.subject", "Subject")} full required error={errors.subject} help={t("distribution.cp.subjectHelp", "{{firstName}} in the subject is replaced by the recipient's first name")}>
              <InputText value={template.subject} maxLength={200} onChange={(e) => setTemplate({ ...template, subject: e.target.value })} />
            </Field>
            <Field label={t("distribution.cp.message", "Message")} full required error={errors.bodyHtml}
              help={t("distribution.cp.placeholders", "The buttons insert the recipient's first name, full name, our company name and the opt-out link where the cursor is.")}>
              <RichTextEditor value={template.bodyHtml} onChange={(bodyHtml) => setTemplate((x) => ({ ...x, bodyHtml }))} placeholders={placeholders} invalid={!!errors.bodyHtml}
                ariaLabel={t("distribution.cp.message", "Message")} />
            </Field>
            {!HAS_OPT_OUT.test(template.bodyHtml || "") ? (
              <div className="dist-field--full">
                <Message severity="warn" text={t("distribution.cp.noOptOut", "The message has no opt-out link: the unsubscribe paragraph is added at the end of every e-mail. Use Opt-out link to place it yourself.")} />
              </div>
            ) : null}
            <Field label={t("distribution.common.status", "Status")}><Dropdown value={template.status} options={activeOptions} onChange={(e) => setTemplate({ ...template, status: e.value })} /></Field>
          </div>
        )}
      </Dialog>

      <Dialog className="pe-dialog" header={consent ? `${consent.granted ? t("distribution.cp.agreed", "Agreed to receive offers") : t("distribution.cp.refused", "Refused offers")}: ${consent.party.name}` : ""}
        visible={!!consent} style={{ width: "min(520px, 96vw)" }} onHide={() => openConsent(null)}
        footer={<div><Button label={t("distribution.common.cancel", "Cancel")} text onClick={() => openConsent(null)} />
          <Button label={t("distribution.common.save", "Save")} icon="pi pi-save" onClick={saveConsent} /></div>}>
        {consent && (
          <div className="dist-grid">
            <Field label={t("distribution.cp.consentChannel", "How the person told us")} required error={errors.channel}>
              <Dropdown value={consent.channel} options={CONSENT_CHANNELS.map((v) => ({ value: v, label: t(`distribution.cp.channels.${v}`, v) }))} onChange={(e) => setConsent({ ...consent, channel: e.value })} />
            </Field>
            <Field label={t("distribution.cp.evidence", "Evidence")} help={t("distribution.cp.evidenceHelp", "The signed form, the call or the e-mail")}>
              <InputText value={consent.evidence} maxLength={500} onChange={(e) => setConsent({ ...consent, evidence: e.target.value })} />
            </Field>
          </div>
        )}
      </Dialog>

      <DetailDialog visible={!!templatePreview} onHide={() => setTemplatePreview(null)} size="lg" header={templatePreview ? `${t("distribution.cp.preview", "Preview")} · ${templatePreview.name}` : ""}>
        {templatePreview && (
          <>
            <KeyValueGrid columns={2} className="mb-3" items={[{ label: t("distribution.cp.subject", "Subject"), value: templatePreview.subject, span: "full" }]} />
            <iframe title={t("distribution.cp.preview", "Preview")} sandbox="" srcDoc={templatePreview.html} className="dist-mail-preview" />
            <small className="pe-muted">{t("distribution.cp.previewHelp", "Shown for a sample recipient, Maria Santos; the opt-out link of each e-mail is personal to its recipient.")}</small>
          </>
        )}
      </DetailDialog>

      <DetailDialog visible={!!results} onHide={() => setResults(null)} size="xl" header={results ? `${t("distribution.cp.results", "Results")} · ${results.campaign.campaignNumber}` : ""}>
        {results && (
          <>
            <DetailHeader title={results.campaign.campaignNumber} status={{ code: results.campaign.status, label: t(`distribution.status.${results.campaign.status}`, results.campaign.status) }}
              subtitle={results.campaign.name}
              meta={[
                { label: t("distribution.cp.segment", "Segment"), value: results.campaign.segmentName },
                { label: t("distribution.cp.template", "Template"), value: results.campaign.templateName },
                { label: t("distribution.cp.sentAt", "Sent"), value: results.campaign.sentAt, type: "datetime" },
                { label: t("distribution.cp.conversionWindow", "Conversion window (days)"), value: results.conversionWindowDays, type: "number" },
              ]} />
            <DetailSection title={t("distribution.cp.summary", "Summary")}>
              <KeyValueGrid columns={4} items={["recipients", "sent", "queued", "failed", "excluded", "optedOut", "quoted", "insured"].map((k) => ({
                key: k, label: t(`distribution.cp.totals.${k}`), value: results.totals[k], type: "number",
              }))} />
            </DetailSection>
            <DetailSection title={t("distribution.cp.recipients", "Recipients")} flush>
              <DataTable value={results.recipients} dataKey="id" size="small" stripedRows paginator rows={15}>
                <Column field="partyName" header={t("distribution.cp.recipient", "Recipient")} />
                <Column header={t("distribution.cp.partyType", "Who")} body={(r) => t(`distribution.cp.party.${r.partyType}`, r.partyType)} />
                <Column field="email" header={t("distribution.cp.email", "E-mail")} />
                <Column header={t("distribution.common.status", "Status")} body={(r) => <StatusTag status={r.status} />} />
                <Column header={t("distribution.cp.delivery", "Delivery")} body={(r) => (r.delivery ? (
                  <div>
                    <StatusTag status={r.delivery} />
                    {r.deliveryError ? <div className="pe-muted">{r.deliveryError}</div> : null}
                  </div>
                ) : r.excludedReason || "")} />
                <Column header={t("distribution.cp.totals.quoted", "Quoted")} body={(r) => (r.quoted ? t("distribution.common.yes", "Yes") : "")} />
                <Column header={t("distribution.cp.totals.insured", "Insured")} body={(r) => (r.insured ? t("distribution.common.yes", "Yes") : "")} />
              </DataTable>
            </DetailSection>
          </>
        )}
      </DetailDialog>
    </div>
  );
};

export default Campaigns;
