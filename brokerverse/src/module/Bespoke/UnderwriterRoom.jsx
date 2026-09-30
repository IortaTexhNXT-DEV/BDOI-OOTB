import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { InputNumber } from "primereact/inputnumber";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { Checkbox } from "primereact/checkbox";
import { Calendar } from "primereact/calendar";
import { SelectButton } from "primereact/selectbutton";
import { TabView, TabPanel } from "primereact/tabview";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import bespokeService from "../../services/bespokeService";
import placementService from "../../services/placementService";
import { BespokeTag, PageHeader, amount, formatDate, percent } from "./shared";
import { LinkPicker } from "./SlipComposer";
import { isoDate } from "../Placement/dates";
import "../Placement/index.scss";
import "./index.scss";

const EMPTY_BID = { insuranceCompanyId: null, status: "quoted", premium: null, rate: null, capacityPercent: 100, deductibles: "", validityDate: null, remarks: "", deviations: [] };

/** Bid form shared by "record bid" (broker) and the public underwriter page. */
export const BidForm = ({ value, onChange, insurers = null }) => {
  const { t } = useTranslation();
  const set = (patch) => onChange({ ...value, ...patch });
  const setDeviation = (i, patch) => set({ deviations: value.deviations.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  return (
    <div className="grid">
      {insurers && (
        <div className="col-12 md:col-6">
          <label htmlFor="bid-insurer">{t("bespoke.room.insurer")}</label>
          <Dropdown inputId="bid-insurer" value={value.insuranceCompanyId} options={insurers.map((i) => ({ label: i.name, value: i.insuranceCompanyId }))} onChange={(e) => set({ insuranceCompanyId: e.value })} className="w-full" />
        </div>
      )}
      <div className="col-12 md:col-6">
        <label htmlFor="bid-status">{t("bespoke.room.answer")}</label>
        <SelectButton id="bid-status" value={value.status} options={[{ label: t("bespoke.status.quoted"), value: "quoted" }, { label: t("bespoke.status.declined"), value: "declined" }]}
          onChange={(e) => e.value && set({ status: e.value })} />
      </div>
      {value.status === "quoted" ? (
        <>
          <div className="col-12 md:col-4">
            <label htmlFor="bid-premium">{t("bespoke.room.premium")}</label>
            <InputNumber inputId="bid-premium" value={value.premium} onValueChange={(e) => set({ premium: e.value })} minFractionDigits={2} maxFractionDigits={2} className="w-full" />
          </div>
          <div className="col-12 md:col-4">
            <label htmlFor="bid-rate">{t("bespoke.room.rate")}</label>
            <InputNumber inputId="bid-rate" value={value.rate} onValueChange={(e) => set({ rate: e.value })} maxFractionDigits={6} suffix="%" className="w-full" placeholder={t("bespoke.room.rateHint")} />
          </div>
          <div className="col-12 md:col-4">
            <label htmlFor="bid-cap">{t("bespoke.room.capacity")}</label>
            <InputNumber inputId="bid-cap" value={value.capacityPercent} onValueChange={(e) => set({ capacityPercent: e.value })} min={0} max={100} maxFractionDigits={4} suffix="%" className="w-full" />
          </div>
          <div className="col-12 md:col-8">
            <label htmlFor="bid-ded">{t("bespoke.room.deductibles")}</label>
            <InputText id="bid-ded" value={value.deductibles || ""} onChange={(e) => set({ deductibles: e.target.value })} className="w-full" />
          </div>
          <div className="col-12 md:col-4">
            <label htmlFor="bid-valid">{t("bespoke.room.validity")}</label>
            <Calendar inputId="bid-valid" value={value.validityDate} onChange={(e) => set({ validityDate: e.value })} dateFormat="yy-mm-dd" showIcon className="w-full" />
          </div>
          <div className="col-12">
            <label>{t("bespoke.room.deviations")}</label>
            {value.deviations.map((d, i) => (
              <div key={i} className="grid align-items-center">
                <div className="col-12 md:col-3"><InputText value={d.clause || ""} onChange={(e) => setDeviation(i, { clause: e.target.value })} placeholder={t("bespoke.room.deviationClause")} className="w-full" /></div>
                <div className="col-12 md:col-4"><InputText value={d.requested || ""} onChange={(e) => setDeviation(i, { requested: e.target.value })} placeholder={t("bespoke.room.deviationRequested")} className="w-full" /></div>
                <div className="col-10 md:col-4"><InputText value={d.offered || ""} onChange={(e) => setDeviation(i, { offered: e.target.value })} placeholder={t("bespoke.room.deviationOffered")} className="w-full" /></div>
                <div className="col-2 md:col-1"><Button icon="pi pi-times" text rounded severity="secondary" onClick={() => set({ deviations: value.deviations.filter((_, j) => j !== i) })} aria-label={t("bespoke.actions.remove")} /></div>
              </div>
            ))}
            <Button label={t("bespoke.room.addDeviation")} icon="pi pi-plus" text size="small" onClick={() => set({ deviations: [...value.deviations, { clause: "", requested: "", offered: "" }] })} />
          </div>
        </>
      ) : (
        <div className="col-12">
          <label htmlFor="bid-reason">{t("bespoke.room.declineReason")}</label>
          <InputText id="bid-reason" value={value.declineReason || ""} onChange={(e) => set({ declineReason: e.target.value })} className="w-full" />
        </div>
      )}
      <div className="col-12">
        <label htmlFor="bid-remarks">{t("bespoke.room.remarks")}</label>
        <InputTextarea id="bid-remarks" value={value.remarks || ""} onChange={(e) => set({ remarks: e.target.value })} rows={2} autoResize className="w-full" />
      </div>
    </div>
  );
};
export const bidPayload = (b) => ({ ...b, validityDate: isoDate(b.validityDate) || undefined, deviations: (b.deviations || []).filter((d) => d.clause || d.offered || d.requested) });

/** SOV locations with totals. */
export const SovTable = ({ sov }) => {
  const { t } = useTranslation();
  if (!sov) return <p className="muted">{t("bespoke.room.noSov")}</p>;
  const cols = ["building", "contents", "stocks", "machinery", "businessInterruption", "other", "totalValue"];
  return (
    <div className="table-scroll">
      <table className="participant-table">
        <thead>
          <tr>
            <th>#</th><th>{t("bespoke.room.location")}</th><th>{t("bespoke.room.city")}</th><th>{t("bespoke.room.occupancy")}</th>
            {cols.map((c) => <th key={c} className="num">{t(`bespoke.sov.${c}`)}</th>)}
          </tr>
        </thead>
        <tbody>
          {sov.locations.map((l) => (
            <tr key={l.lineNo}>
              <td>{l.lineNo}</td><td>{l.locationName}</td><td>{l.city || "-"}</td><td>{l.occupancy || "-"}</td>
              {cols.map((c) => <td key={c} className="num">{amount(l[c])}</td>)}
            </tr>
          ))}
          <tr className="totals-row">
            <td colSpan={4}>{t("bespoke.room.total", { count: sov.locationCount })}</td>
            {cols.map((c) => <td key={c} className="num">{amount(sov.totals?.[c])}</td>)}
          </tr>
        </tbody>
      </table>
      {(sov.warnings || []).map((w) => <div key={w} className="problem">{w}</div>)}
    </div>
  );
};

const RoomList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("open");
  const [creating, setCreating] = useState(null);
  const [insurers, setInsurers] = useState([]);
  const load = useCallback(async () => {
    try {
      setRows(await bespokeService.listRooms({ status: status || undefined }));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 5000 });
    }
  }, [status, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { placementService.options().then((o) => setInsurers(o.insurers || [])).catch(() => {}); }, []);
  const create = async () => {
    try {
      const body = { insurerIds: creating.insurerIds?.length ? creating.insurerIds : undefined, responseDueDate: isoDate(creating.responseDueDate) };
      body[creating.link?.kind === "placement" ? "placementId" : "brokerSlipId"] = creating.link?.id;
      const r = await bespokeService.createRoom(body);
      navigate(`/placement/bespoke/rooms/${r.id}`);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 5000 });
    }
  };
  return (
    <div className="placement-page bespoke-page">
      <Toast ref={toast} />
      <PageHeader title={t("bespoke.room.title")} subtitle={t("bespoke.room.subtitle")}>
        <Button label={t("bespoke.room.new")} icon="pi pi-plus" onClick={() => setCreating({ link: { kind: "brokerSlip", id: null }, insurerIds: [] })} />
      </PageHeader>
      <div className="placement-card">
        <div className="toolbar">
          <Dropdown value={status} options={[{ label: t("bespoke.status.open"), value: "open" }, { label: t("bespoke.status.awarded"), value: "awarded" }, { label: t("bespoke.status.closed"), value: "closed" }, { label: t("bespoke.library.allStatuses"), value: "" }]}
            onChange={(e) => setStatus(e.value)} />
        </div>
        <DataTable value={rows} dataKey="id" stripedRows size="small" className="placement-grid" paginator rows={15} emptyMessage={t("bespoke.room.empty")}
          onRowClick={(e) => navigate(`/placement/bespoke/rooms/${e.data.id}`)} rowClassName={() => "clickable"}>
          <Column field="roomNumber" header={t("bespoke.fields.number")} body={(r) => <span className="doc-number">{r.roomNumber}</span>} />
          <Column field="title" header={t("bespoke.fields.title")} />
          <Column header={t("bespoke.fields.link")} body={(r) => r.brokerSlipNumber || r.placementNumber} />
          <Column header={t("bespoke.room.sumInsured")} body={(r) => `${r.currency} ${amount(r.sumInsured)}`} className="num" />
          <Column field="insurerCount" header={t("bespoke.room.insurers")} className="num" />
          <Column field="quotedCount" header={t("bespoke.room.quotes")} className="num" />
          <Column field="currentRound" header={t("bespoke.room.round")} className="num" />
          <Column header={t("bespoke.fields.status")} body={(r) => <BespokeTag status={r.status} />} />
        </DataTable>
      </div>
      <Dialog header={t("bespoke.room.new")} visible={!!creating} style={{ width: "min(640px, 96vw)" }} onHide={() => setCreating(null)} className="placement-dialog"
        footer={<Button label={t("bespoke.room.open")} icon="pi pi-check" onClick={create} disabled={!creating?.link?.id} />}>
        {creating && (
          <div className="grid">
            <div className="col-12"><LinkPicker value={creating.link} onChange={(link) => setCreating({ ...creating, link })} /></div>
            <div className="col-12">
              <label htmlFor="room-ins">{t("bespoke.room.insurers")}</label>
              <MultiSelect inputId="room-ins" value={creating.insurerIds} options={insurers.map((i) => ({ label: i.name, value: i.id }))} onChange={(e) => setCreating({ ...creating, insurerIds: e.value })}
                filter display="chip" className="w-full" placeholder={t("bespoke.room.insurersHint")} />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="room-due">{t("bespoke.room.dueDate")}</label>
              <Calendar inputId="room-due" value={creating.responseDueDate} onChange={(e) => setCreating({ ...creating, responseDueDate: e.value })} dateFormat="yy-mm-dd" showIcon className="w-full" />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

const RoomDetail = ({ id }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const sovInput = useRef(null);
  const fileInput = useRef(null);
  const [room, setRoom] = useState(null);
  const [insurers, setInsurers] = useState([]);
  const [invite, setInvite] = useState([]);
  const [bid, setBid] = useState(null);
  const [counter, setCounter] = useState(null);
  const [award, setAward] = useState(null);
  const [message, setMessage] = useState({ insuranceCompanyId: null, body: "", internal: false });
  const [attachKind, setAttachKind] = useState("loss_run");
  const [link, setLink] = useState(null);

  const fail = (e) => toast.current?.show({ severity: "error", summary: t("common.error"), detail: e.message, life: 6000 });
  const done = (text) => toast.current?.show({ severity: "success", summary: text, life: 3500 });
  const load = useCallback(async () => {
    try {
      setRoom(await bespokeService.getRoom(id));
    } catch (e) {
      fail(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { placementService.options().then((o) => setInsurers(o.insurers || [])).catch(() => {}); }, []);
  const run = async (fn, text) => {
    try {
      await fn();
      if (text) done(text);
      await load();
    } catch (e) {
      fail(e);
    }
  };
  if (!room) return <div className="placement-page"><Toast ref={toast} /></div>;
  const open = room.status === "open";
  const invited = room.insurers.filter((i) => i.status === "invited");
  const bidActions = (b) => (
    <span className="row-actions">
      {open && b.status === "quoted" && <Button label={t("bespoke.room.accept")} size="small" text onClick={() => run(() => bespokeService.bidAction(room.id, b.id, "accept"), t("bespoke.room.accepted"))} />}
      {open && b.status === "quoted" && <Button label={t("bespoke.room.counter")} size="small" text onClick={() => setCounter({ bid: b, premium: b.premium, capacityPercent: b.capacityPercent, terms: "" })} />}
      {open && ["requested", "quoted"].includes(b.status) && <Button label={t("bespoke.room.decline")} size="small" text severity="danger" onClick={() => run(() => bespokeService.bidAction(room.id, b.id, "decline"))} />}
      {open && ["quoted", "accepted"].includes(b.status) && <Button label={t("bespoke.room.withdraw")} size="small" text severity="secondary" onClick={() => run(() => bespokeService.bidAction(room.id, b.id, "withdraw"))} />}
      {open && b.status === "accepted" && <Button label={t("bespoke.room.undoAccept")} size="small" text severity="secondary" onClick={() => run(() => bespokeService.bidAction(room.id, b.id, "reopen"))} />}
    </span>
  );
  const upload = async (e, kind) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (kind === "sov") await run(async () => { const r = await bespokeService.uploadSov(room.id, file); done(r.message); });
    else await run(() => bespokeService.uploadAttachment(room.id, file, { kind, shared: "true" }), t("bespoke.room.attached"));
  };
  const accepted = room.bids.filter((b) => b.status === "accepted");

  return (
    <div className="placement-page bespoke-page">
      <Toast ref={toast} />
      <input ref={sovInput} type="file" className="hidden-file" accept=".xlsx,.csv" onChange={(e) => upload(e, "sov")} />
      <input ref={fileInput} type="file" className="hidden-file" onChange={(e) => upload(e, attachKind)} />
      <PageHeader title={`${room.roomNumber} ${room.title}`} subtitle={`${room.insuredName || ""} | ${room.currency} ${amount(room.sumInsured)} | ${t("bespoke.room.round")} ${room.currentRound}`}
        onBack={() => navigate("/placement/bespoke/rooms")}>
        <BespokeTag status={room.status} />
        {open && <Button label={t("bespoke.room.requestBids")} icon="pi pi-send" text onClick={() => run(() => bespokeService.requestBids(room.id, {}), t("bespoke.room.requested"))} />}
        {open && <Button label={t("bespoke.room.recordBid")} icon="pi pi-pencil" text onClick={() => setBid({ ...EMPTY_BID, insuranceCompanyId: invited[0]?.insuranceCompanyId || null })} />}
        {open && room.brokerSlipId && <Button label={t("bespoke.room.award")} icon="pi pi-check-circle" onClick={() => setAward({ target: "quotation", leadBidId: accepted[0]?.id || null, inceptionDate: null })} disabled={!accepted.length} />}
        {room.status !== "closed" && <Button label={t("bespoke.room.close")} icon="pi pi-times" text severity="secondary" onClick={() => run(() => bespokeService.closeRoom(room.id), t("bespoke.room.closed"))} />}
      </PageHeader>
      {(room.quotationNumber || room.awardPlacementNumber) && (
        <div className="placement-card">
          {room.quotationNumber && <span>{t("bespoke.room.awardedQuotation")} <strong>{room.quotationNumber}</strong> </span>}
          {room.awardPlacementNumber && <Button label={`${t("bespoke.room.awardedPlacement")} ${room.awardPlacementNumber}`} link onClick={() => navigate(`/placement/placement-slips/${room.awardPlacementId}`)} />}
        </div>
      )}
      <TabView>
        <TabPanel header={t("bespoke.room.bidsTab")}>
          <div className="placement-card">
            <div className="section-title mt-0">{t("bespoke.room.comparison")}</div>
            <DataTable value={room.comparison.rows} dataKey="id" size="small" stripedRows emptyMessage={t("bespoke.room.noBids")}>
              <Column field="rank" header="#" />
              <Column field="insuranceCompanyName" header={t("bespoke.room.insurer")} />
              <Column field="round" header={t("bespoke.room.round")} className="num" />
              <Column header={t("bespoke.fields.status")} body={(b) => <BespokeTag status={b.status} />} />
              <Column header={t("bespoke.room.premium")} body={(b) => amount(b.premium)} className="num" />
              <Column header={t("bespoke.room.rate")} body={(b) => percent(b.rate)} className="num" />
              <Column header={t("bespoke.room.capacity")} body={(b) => percent(b.capacityPercent)} className="num" />
              <Column header={t("bespoke.room.difference")} body={(b) => (b.differenceFromBest === null ? "-" : amount(b.differenceFromBest))} className="num" />
              <Column header={t("bespoke.room.deviations")} body={(b) => (b.deviations || []).map((d) => `${d.clause || ""}: ${d.offered || ""}`).join("; ") || "-"} />
              <Column header={t("bespoke.room.validity")} body={(b) => formatDate(b.validityDate)} />
              <Column body={bidActions} />
            </DataTable>
            <div className="hint">{t("bespoke.room.summary", room.comparison.summary)}</div>
            <div className="section-title">{t("bespoke.room.allRounds")}</div>
            <DataTable value={room.bids} dataKey="id" size="small" stripedRows>
              <Column field="bidNumber" header={t("bespoke.fields.number")} />
              <Column field="insuranceCompanyName" header={t("bespoke.room.insurer")} />
              <Column field="round" header={t("bespoke.room.round")} className="num" />
              <Column header={t("bespoke.fields.status")} body={(b) => <BespokeTag status={b.status} />} />
              <Column header={t("bespoke.room.premium")} body={(b) => amount(b.premium)} className="num" />
              <Column header={t("bespoke.room.counterPremium")} body={(b) => amount(b.counterPremium)} className="num" />
              <Column field="counterTerms" header={t("bespoke.room.counterTerms")} />
              <Column header={t("bespoke.room.via")} body={(b) => t(`bespoke.room.via_${b.submittedVia}`)} />
              <Column header={t("bespoke.fields.updated")} body={(b) => formatDate(b.respondedAt || b.requestedAt)} />
            </DataTable>
          </div>
          <div className="placement-card">
            <div className="section-title mt-0">{t("bespoke.room.insurers")}</div>
            <DataTable value={room.insurers} dataKey="insuranceCompanyId" size="small">
              <Column field="name" header={t("bespoke.room.insurer")} />
              <Column header={t("bespoke.fields.status")} body={(i) => <BespokeTag status={i.status === "invited" ? "invited" : "withdrawn"} />} />
              <Column header={t("bespoke.room.latestBid")} body={(i) => <BespokeTag status={i.latestBidStatus} />} />
              <Column header={t("bespoke.room.lastViewed")} body={(i) => formatDate(i.lastViewedAt)} />
              <Column body={(i) => open && i.status === "invited" && (
                <span className="row-actions">
                  <Button label={t("bespoke.room.copyLink")} size="small" text onClick={() => run(async () => { const l = await bespokeService.underwriterLink(room.id, i.insuranceCompanyId); setLink(l); })} />
                  <Button label={t("bespoke.room.emailLink")} size="small" text onClick={() => run(() => bespokeService.underwriterLink(room.id, i.insuranceCompanyId, { sendEmail: true }), t("bespoke.room.linkEmailed"))} />
                </span>
              )} />
            </DataTable>
            {open && (
              <div className="flex gap-2 align-items-center mt-2">
                <MultiSelect value={invite} options={insurers.filter((i) => !invited.some((x) => x.insuranceCompanyId === i.id)).map((i) => ({ label: i.name, value: i.id }))}
                  onChange={(e) => setInvite(e.value)} filter display="chip" className="flex-1" placeholder={t("bespoke.room.inviteMore")} />
                <Button label={t("bespoke.room.invite")} icon="pi pi-user-plus" disabled={!invite.length} onClick={() => run(async () => { await bespokeService.inviteInsurers(room.id, invite); setInvite([]); })} />
              </div>
            )}
          </div>
        </TabPanel>
        <TabPanel header={t("bespoke.room.sovTab")}>
          <div className="placement-card">
            <div className="flex justify-content-between align-items-center">
              <div className="section-title mt-0">{t("bespoke.room.sovTitle", { version: room.sov.current?.version || "-" })}</div>
              {open && <Button label={t("bespoke.room.uploadSov")} icon="pi pi-upload" outlined onClick={() => sovInput.current?.click()} />}
            </div>
            <span className="hint">{t("bespoke.room.sovHint")}</span>
            <SovTable sov={room.sov.current} />
            {room.sov.versions?.length > 1 && (
              <ul className="change-list">
                {room.sov.versions.map((v) => <li key={v.version}>{t("bespoke.fields.version")} {v.version}: {v.fileName} | {v.locationCount} | {amount(v.totals?.totalValue)} | {v.uploadedBy} {formatDate(v.uploadedAt)}</li>)}
              </ul>
            )}
          </div>
        </TabPanel>
        <TabPanel header={t("bespoke.room.filesTab")}>
          <div className="placement-card">
            {open && (
              <div className="flex gap-2 align-items-center mb-2">
                <Dropdown value={attachKind} options={["loss_run", "survey", "slip", "other"].map((k) => ({ label: t(`bespoke.attachment.${k}`), value: k }))} onChange={(e) => setAttachKind(e.value)} />
                <Button label={t("bespoke.room.attach")} icon="pi pi-paperclip" outlined onClick={() => fileInput.current?.click()} />
              </div>
            )}
            <DataTable value={room.attachments} dataKey="id" size="small" emptyMessage={t("bespoke.room.noFiles")}>
              <Column header={t("bespoke.room.kind")} body={(a) => t(`bespoke.attachment.${a.kind}`, { defaultValue: a.kind })} />
              <Column header={t("bespoke.room.file")} body={(a) => <a href={a.fileUrl} target="_blank" rel="noopener noreferrer">{a.fileName}</a>} />
              <Column field="description" header={t("bespoke.fields.description")} />
              <Column header={t("bespoke.room.shared")} body={(a) => (a.shared ? t("common.yes", { defaultValue: "Yes" }) : t("common.no", { defaultValue: "No" }))} />
              <Column header={t("bespoke.fields.updated")} body={(a) => `${a.uploadedBy || ""} ${formatDate(a.uploadedAt)}`} />
            </DataTable>
          </div>
        </TabPanel>
        <TabPanel header={t("bespoke.room.messagesTab")}>
          <div className="placement-card">
            {room.messages.map((m) => (
              <div key={m.id} className={`message ${m.authorType === "underwriter" ? "from-underwriter" : ""}`}>
                <div className="meta">{m.author} {m.insuranceCompanyName ? `> ${m.insuranceCompanyName}` : ""} {m.internal ? `(${t("bespoke.room.internal")})` : ""} | {formatDate(m.createdAt)}</div>
                <div>{m.body}</div>
              </div>
            ))}
            {room.status !== "closed" && (
              <div className="grid mt-2">
                <div className="col-12 md:col-4">
                  <Dropdown value={message.insuranceCompanyId} options={[{ label: t("bespoke.room.allUnderwriters"), value: null }, ...invited.map((i) => ({ label: i.name, value: i.insuranceCompanyId }))]}
                    onChange={(e) => setMessage({ ...message, insuranceCompanyId: e.value })} className="w-full" />
                  <div className="flex align-items-center gap-2 mt-2">
                    <Checkbox inputId="msg-internal" checked={message.internal} onChange={(e) => setMessage({ ...message, internal: e.checked })} />
                    <label htmlFor="msg-internal" className="m-0">{t("bespoke.room.internalNote")}</label>
                  </div>
                </div>
                <div className="col-12 md:col-6"><InputTextarea value={message.body} onChange={(e) => setMessage({ ...message, body: e.target.value })} rows={2} autoResize className="w-full" aria-label={t("bespoke.room.message")} /></div>
                <div className="col-12 md:col-2">
                  <Button label={t("bespoke.room.send")} icon="pi pi-send" disabled={!message.body.trim()} onClick={() => run(async () => { await bespokeService.postMessage(room.id, message); setMessage({ ...message, body: "" }); })} />
                </div>
              </div>
            )}
          </div>
        </TabPanel>
        <TabPanel header={t("bespoke.room.timelineTab")}>
          <div className="placement-card">
            <ul className="timeline-list">
              {room.timeline.map((e) => (
                <li key={e.id}>
                  <strong>{t(`bespoke.event.${e.event}`, { defaultValue: e.event })}</strong> {e.insurer ? `| ${e.insurer}` : ""}
                  <div className="muted small">{e.actor || t(`bespoke.room.actor_${e.actorType}`)} | {new Date(e.at).toLocaleString()}</div>
                  {e.detail && Object.keys(e.detail).length > 0 && <div className="small">{Object.entries(e.detail).filter(([, v]) => v !== null && typeof v !== "object").map(([k, v]) => `${k}: ${v}`).join(", ")}</div>}
                </li>
              ))}
            </ul>
          </div>
        </TabPanel>
      </TabView>

      <Dialog header={t("bespoke.room.recordBid")} visible={!!bid} style={{ width: "min(860px, 96vw)" }} onHide={() => setBid(null)} className="placement-dialog"
        footer={<Button label={t("bespoke.actions.save")} icon="pi pi-check" onClick={() => run(async () => { await bespokeService.recordBid(room.id, bidPayload(bid)); setBid(null); }, t("bespoke.room.bidSaved"))} />}>
        {bid && <BidForm value={bid} onChange={setBid} insurers={invited} />}
      </Dialog>
      <Dialog header={t("bespoke.room.counter")} visible={!!counter} style={{ width: "min(640px, 96vw)" }} onHide={() => setCounter(null)} className="placement-dialog"
        footer={<Button label={t("bespoke.room.sendCounter")} icon="pi pi-send" onClick={() => run(async () => { await bespokeService.counterBid(room.id, counter.bid.id, { premium: counter.premium, capacityPercent: counter.capacityPercent, terms: counter.terms }); setCounter(null); }, t("bespoke.room.countered"))} />}>
        {counter && (
          <div className="grid">
            <div className="col-12"><span className="muted">{counter.bid.insuranceCompanyName}: {amount(counter.bid.premium)} / {percent(counter.bid.capacityPercent)}</span></div>
            <div className="col-12 md:col-6">
              <label htmlFor="ct-premium">{t("bespoke.room.counterPremium")}</label>
              <InputNumber inputId="ct-premium" value={counter.premium} onValueChange={(e) => setCounter({ ...counter, premium: e.value })} minFractionDigits={2} maxFractionDigits={2} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="ct-cap">{t("bespoke.room.capacity")}</label>
              <InputNumber inputId="ct-cap" value={counter.capacityPercent} onValueChange={(e) => setCounter({ ...counter, capacityPercent: e.value })} suffix="%" maxFractionDigits={4} className="w-full" />
            </div>
            <div className="col-12">
              <label htmlFor="ct-terms">{t("bespoke.room.counterTerms")}</label>
              <InputTextarea id="ct-terms" value={counter.terms} onChange={(e) => setCounter({ ...counter, terms: e.target.value })} rows={3} autoResize className="w-full" />
            </div>
          </div>
        )}
      </Dialog>
      <Dialog header={t("bespoke.room.award")} visible={!!award} style={{ width: "min(640px, 96vw)" }} onHide={() => setAward(null)} className="placement-dialog"
        footer={<Button label={t("bespoke.room.award")} icon="pi pi-check" onClick={() => run(async () => {
          const r = await bespokeService.award(room.id, { target: award.target, leadBidId: award.leadBidId, inceptionDate: isoDate(award.inceptionDate) });
          setAward(null);
          done(r.message);
          if (r.data.placementId) navigate(`/placement/placement-slips/${r.data.placementId}`);
        })} />}>
        {award && (
          <div className="grid">
            <div className="col-12">
              <SelectButton value={award.target} options={[{ label: t("bespoke.room.toQuotation"), value: "quotation" }, { label: t("bespoke.room.toPlacement"), value: "placement" }]} onChange={(e) => e.value && setAward({ ...award, target: e.value })} />
            </div>
            <div className="col-12">
              <table className="participant-table">
                <tbody>
                  {accepted.map((b) => <tr key={b.id}><td>{b.insuranceCompanyName}</td><td className="num">{percent(b.acceptedShare)}</td><td className="num">{amount(b.premium)}</td></tr>)}
                </tbody>
              </table>
              <div className={Math.abs(accepted.reduce((s, b) => s + (b.acceptedShare || 0), 0) - 100) < 0.0001 ? "ok" : "problem"}>
                {t("bespoke.room.sharesTotal", { total: accepted.reduce((s, b) => s + (b.acceptedShare || 0), 0) })}
              </div>
            </div>
            <div className="col-12 md:col-6">
              <label htmlFor="aw-lead">{t("bespoke.room.lead")}</label>
              <Dropdown inputId="aw-lead" value={award.leadBidId} options={accepted.map((b) => ({ label: b.insuranceCompanyName, value: b.id }))} onChange={(e) => setAward({ ...award, leadBidId: e.value })} className="w-full" />
            </div>
            {award.target === "placement" && (
              <div className="col-12 md:col-6">
                <label htmlFor="aw-inc">{t("bespoke.room.inception")}</label>
                <Calendar inputId="aw-inc" value={award.inceptionDate} onChange={(e) => setAward({ ...award, inceptionDate: e.value })} dateFormat="yy-mm-dd" showIcon className="w-full" />
              </div>
            )}
          </div>
        )}
      </Dialog>
      <Dialog header={t("bespoke.room.linkTitle")} visible={!!link} style={{ width: "min(640px, 96vw)" }} onHide={() => setLink(null)} className="placement-dialog">
        {link && (
          <div>
            <InputText value={link.url} readOnly className="w-full" onFocus={(e) => e.target.select()} />
            <p className="hint">{t("bespoke.room.linkExpires", { date: formatDate(link.expiresAt) })}</p>
            <Button label={t("bespoke.room.copy")} icon="pi pi-copy" onClick={() => navigator.clipboard?.writeText(link.url).then(() => done(t("bespoke.room.copied")))} />
          </div>
        )}
      </Dialog>
    </div>
  );
};

/** Operations > Placement > Underwriter Room. */
const UnderwriterRoom = () => {
  const { id } = useParams();
  return id ? <RoomDetail id={id} /> : <RoomList />;
};

export default UnderwriterRoom;
