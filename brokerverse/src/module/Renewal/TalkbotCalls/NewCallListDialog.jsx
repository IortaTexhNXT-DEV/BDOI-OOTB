import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import DateField from "../../../components/DateField";
import KeyValueGrid from "../../../components/KeyValueGrid";
import "./talkbot.scss";
import FieldError from "../../../components/FieldError";
import talkbotService from "../../../services/talkbotService";
import distributionService from "../../../services/distributionService";

const EMPTY = { expiryFrom: "", expiryTo: "", insurerId: null, includeExpired: false, recallOf: null, includeCallBack: false, salesPersonId: null, channelId: null };

/** The criteria as the API takes them (empty choices left out). */
export const criteriaOf = (c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== null && v !== "" && v !== undefined));

/**
 * New call list (FR-TBT-001, 002, 015): the Motor policies due for renewal to be called by Talkbot. The expiry dates
 * default to the list of the day; as the criteria change, the count of accounts that can be called and of those left
 * out (by reason) follows. Create call list makes the list in Draft and opens it.
 */
const NewCallListDialog = ({ visible, onHide, onCreated }) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState(null);
  const [channels, setChannels] = useState([]);
  const [c, setC] = useState(EMPTY);
  const [count, setCount] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setError(null);
    setCount(null);
    talkbotService.options().then((o) => {
      setOptions(o);
      setC({ ...EMPTY, expiryFrom: o.expiryFrom, expiryTo: o.expiryTo });
    }).catch((e) => setError(e.message));
    distributionService.channelOptions().then(setChannels).catch(() => setChannels([]));
  }, [visible]);

  const datesWrong = c.expiryFrom && c.expiryTo && c.expiryTo < c.expiryFrom;
  useEffect(() => {
    if (!visible || !c.expiryFrom || !c.expiryTo || datesWrong) return undefined;
    const timer = setTimeout(() => {
      talkbotService.preview(criteriaOf(c)).then(setCount).catch(() => setCount(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [visible, c, datesWrong]);

  const set = (key) => (value) => setC((prev) => ({ ...prev, [key]: value }));
  const create = async () => {
    const found = {};
    if (!c.expiryFrom) found.expiryFrom = t("talkbot.new.required");
    if (!c.expiryTo) found.expiryTo = t("talkbot.new.required");
    if (datesWrong) found.expiryTo = t("talkbot.new.datesWrong");
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setError(null);
    try {
      const r = await talkbotService.create(criteriaOf(c));
      onCreated(r.data, r.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const all = (label) => [{ label, value: null }];
  const footer = (
    <>
      <Button type="button" label={t("talkbot.cancel")} text onClick={onHide} disabled={busy} />
      <Button type="button" label={t("talkbot.new.create")} icon="pi pi-check" onClick={create} loading={busy} disabled={!options} />
    </>
  );
  return (
    <Dialog header={t("talkbot.new.title")} visible={visible} onHide={onHide} footer={footer} style={{ width: "min(860px, 96vw)" }} className="talkbot-dialog" draggable={false}>
      <div className="grid">
        <div className="col-12 md:col-6 lg:col-3">
          <label htmlFor="tb-from" className="talkbot-label">{t("talkbot.new.expiryFrom")} *</label>
          <DateField id="tb-from" value={c.expiryFrom} onChange={(e) => set("expiryFrom")(e.target.value)} invalid={!!errors.expiryFrom} />
          <FieldError error={errors.expiryFrom} />
        </div>
        <div className="col-12 md:col-6 lg:col-3">
          <label htmlFor="tb-to" className="talkbot-label">{t("talkbot.new.expiryTo")} *</label>
          <DateField id="tb-to" value={c.expiryTo} onChange={(e) => set("expiryTo")(e.target.value)} invalid={!!errors.expiryTo || datesWrong} />
          <FieldError error={errors.expiryTo || (datesWrong ? t("talkbot.new.datesWrong") : null)} />
        </div>
        <div className="col-12 md:col-6 lg:col-3">
          <label htmlFor="tb-insurer" className="talkbot-label">{t("talkbot.new.insurer")}</label>
          <Dropdown inputId="tb-insurer" value={c.insurerId} onChange={(e) => set("insurerId")(e.value)} filter className="w-full"
            options={[...all(t("talkbot.all")), ...(options?.insurers || []).map((i) => ({ label: i.name, value: i.id }))]} />
        </div>
        <div className="col-12 md:col-6 lg:col-3">
          <span className="talkbot-label">{t("talkbot.new.productType")}</span>
          <p className="talkbot-dialog__fixed">{t("talkbot.new.motor")}</p>
        </div>
        <div className="col-12 md:col-6 lg:col-3">
          <label htmlFor="tb-sales" className="talkbot-label">{t("talkbot.new.salesPerson")}</label>
          <Dropdown inputId="tb-sales" value={c.salesPersonId} onChange={(e) => set("salesPersonId")(e.value)} filter className="w-full"
            options={[...all(t("talkbot.all")), ...(options?.salesPersons || []).map((u) => ({ label: u.name, value: u.id }))]} />
        </div>
        <div className="col-12 md:col-6 lg:col-3">
          <label htmlFor="tb-channel" className="talkbot-label">{t("talkbot.new.source")}</label>
          <Dropdown inputId="tb-channel" value={c.channelId} onChange={(e) => set("channelId")(e.value)} filter className="w-full"
            options={[...all(t("talkbot.all")), ...(channels || []).map((ch) => ({ label: ch.label || ch.name, value: ch.id }))]} />
        </div>
        <div className="col-12 md:col-6 lg:col-3">
          <label htmlFor="tb-recall" className="talkbot-label">{t("talkbot.new.recallOf")}</label>
          <Dropdown inputId="tb-recall" value={c.recallOf} onChange={(e) => set("recallOf")(e.value)} className="w-full" showClear
            placeholder={t("talkbot.new.none")} options={(options?.recallLists || []).map((l) => ({ label: l.taskName ? `${l.listNumber} · ${l.taskName}` : l.listNumber, value: l.listNumber }))} />
        </div>
        <div className="col-12 md:col-6 lg:col-3 talkbot-dialog__checks">
          <span className="talkbot-dialog__check">
            <Checkbox inputId="tb-expired" checked={c.includeExpired} onChange={(e) => set("includeExpired")(e.checked)} />
            <label htmlFor="tb-expired">{t("talkbot.new.includeExpired")}</label>
          </span>
          {c.recallOf ? (
            <span className="talkbot-dialog__check">
              <Checkbox inputId="tb-callback" checked={c.includeCallBack} onChange={(e) => set("includeCallBack")(e.checked)} />
              <label htmlFor="tb-callback">{t("talkbot.new.includeCallBack")}</label>
            </span>
          ) : null}
        </div>
      </div>
      <KeyValueGrid columns={2} items={[
        { label: t("talkbot.new.canBeCalled"), value: count ? t("talkbot.new.accounts", { count: count.eligible }) : "-" },
        { label: t("talkbot.new.leftOut"), value: count?.leftOut || t("talkbot.new.noneLeftOut") },
      ]} />
      {error ? <p className="talkbot-error" role="alert">{error}</p> : null}
    </Dialog>
  );
};

NewCallListDialog.propTypes = {
  visible: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  /** (list, message): the list created in Draft */
  onCreated: PropTypes.func.isRequired,
};
NewCallListDialog.defaultProps = { visible: false };

export default NewCallListDialog;
