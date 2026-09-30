import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import bespokeService from "../../services/bespokeService";
import { BespokeTag, amount, formatDate, percent } from "./shared";
import { BidForm, SovTable, bidPayload } from "./UnderwriterRoom";
import "../Placement/index.scss";
import "./index.scss";

/**
 * Public page of an invited underwriter (/underwriter-room?token=...): the slip, the statement of values, the shared
 * files, its bids and the message thread with the broker. The signed link is the credential; no sign-in.
 */
const UnderwriterRoomPublic = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [bid, setBid] = useState({ status: "quoted", premium: null, rate: null, capacityPercent: 100, deductibles: "", validityDate: null, remarks: "", deviations: [] });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await bespokeService.linkView(token));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  const act = async (fn) => {
    setBusy(true);
    try {
      const r = await fn();
      setNotice(r?.message || t("bespoke.public.saved"));
      await load();
    } catch (e) {
      setNotice(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !data) return <div className="placement-page bespoke-page"><Message severity="error" text={error} /></div>;
  if (!data) return <div className="placement-page bespoke-page">{t("bespoke.public.loading")}</div>;
  const { room, slip } = data;
  const open = room.status === "open";
  const hasQuote = data.bids.some((b) => ["quoted", "accepted"].includes(b.status));

  return (
    <div className="placement-page bespoke-page">
      <div className="placement-header">
        <div className="placement-header-text">
          <div>
            <h2>{room.roomNumber} {room.insuredName}</h2>
            <p className="subtitle">{t("bespoke.public.for", { insurer: data.insurer.name })} | {room.currency} {amount(room.sumInsured)} | {t("bespoke.room.dueDate")}: {formatDate(room.responseDueDate)}</p>
          </div>
        </div>
        <BespokeTag status={room.status} />
      </div>
      {notice && <Message severity="success" text={notice} className="mb-2" />}
      {error && <Message severity="error" text={error} className="mb-2" />}
      {slip && (
        <div className="placement-card">
          <div className="section-title mt-0">{t("bespoke.public.slip", { number: slip.slipNumber, version: slip.version })}</div>
          {slip.sections.filter((s) => s.text).map((s) => <p key={s.heading}><strong>{s.heading}:</strong> {s.text}</p>)}
          {slip.clauses.map((c, i) => <p key={`${c.code}-${i}`}><strong>{i + 1}. {c.title}</strong> <span className="muted small">({t(`bespoke.clauseType.${c.clauseType}`, { defaultValue: c.clauseType })})</span><br />{c.text}</p>)}
        </div>
      )}
      <div className="placement-card">
        <div className="section-title mt-0">{t("bespoke.room.sovTab")}</div>
        <SovTable sov={data.sov} />
        {data.attachments.length > 0 && (
          <ul className="change-list">
            {data.attachments.map((a) => <li key={a.id}><a href={a.fileUrl} target="_blank" rel="noopener noreferrer">{a.fileName}</a> {a.description ? `| ${a.description}` : ""}</li>)}
          </ul>
        )}
      </div>
      <div className="placement-card">
        <div className="section-title mt-0">{t("bespoke.public.yourBids")}</div>
        <table className="participant-table">
          <thead><tr><th>{t("bespoke.room.round")}</th><th>{t("bespoke.fields.status")}</th><th className="num">{t("bespoke.room.premium")}</th><th className="num">{t("bespoke.room.capacity")}</th><th>{t("bespoke.room.counterTerms")}</th></tr></thead>
          <tbody>
            {data.bids.map((b) => (
              <tr key={b.id}>
                <td>{b.round}</td><td><BespokeTag status={b.status} /></td><td className="num">{amount(b.premium ?? b.counterPremium)}</td><td className="num">{percent(b.capacityPercent ?? b.counterCapacityPercent)}</td>
                <td>{b.counterTerms || b.remarks || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {open && (
          <>
            <div className="section-title">{t("bespoke.public.submit")}</div>
            <BidForm value={bid} onChange={setBid} />
            <div className="flex gap-2">
              <Button label={t("bespoke.public.send")} icon="pi pi-send" loading={busy} onClick={() => act(async () => { await bespokeService.linkBid(token, bidPayload(bid)); return { message: t("bespoke.public.received") }; })} />
              {hasQuote && <Button label={t("bespoke.public.withdraw")} severity="secondary" outlined onClick={() => act(async () => { await bespokeService.linkBid(token, { status: "withdrawn" }); return { message: t("bespoke.public.withdrawn") }; })} />}
            </div>
          </>
        )}
      </div>
      <div className="placement-card">
        <div className="section-title mt-0">{t("bespoke.room.messagesTab")}</div>
        {data.messages.map((m) => (
          <div key={m.id} className={`message ${m.authorType === "underwriter" ? "from-underwriter" : ""}`}>
            <div className="meta">{m.author} | {formatDate(m.createdAt)}</div>
            <div>{m.body}</div>
          </div>
        ))}
        {open && (
          <div className="flex gap-2 align-items-start">
            <InputTextarea value={text} onChange={(e) => setText(e.target.value)} rows={2} autoResize className="flex-1" aria-label={t("bespoke.room.message")} />
            <Button label={t("bespoke.room.send")} icon="pi pi-send" disabled={!text.trim()} onClick={() => act(async () => { await bespokeService.linkMessage(token, text); setText(""); return { message: t("bespoke.public.messageSent") }; })} />
          </div>
        )}
      </div>
    </div>
  );
};

export default UnderwriterRoomPublic;
