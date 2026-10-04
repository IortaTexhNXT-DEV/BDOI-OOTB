import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { TabPanel, TabView } from "primereact/tabview";
import { Toast } from "primereact/toast";
import amlService, { errorMessage } from "../../services/amlService";
import { hasPermission } from "../../utils/canOpen";
import { AmlTag, PageHeader, isoDay, showDate, showDateTime, useOptionList } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

/**
 * Compliance > Screening Lists: the sanctions, designation, PEP and negative lists screened against. A new version is
 * uploaded from the published file (UN consolidated list XML, CSV or XLSX) or made by adding or removing an entry on
 * screen; every version is kept and followed by a rescreen of all clients, owners and signatories. The Provider tab
 * shows the commercial screening provider (configured on AML Settings) and its request outbox with retry.
 */
const ScreeningLists = () => {
  const { t } = useTranslation();
  const toast = useRef(null);
  const fileRef = useRef(null);
  const listTypes = useOptionList(["sanctions", "designation", "pep", "negative", "other"], "listType");
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(null);
  const [versions, setVersions] = useState(null);
  const [entries, setEntries] = useState(null);
  const [adding, setAdding] = useState(null);
  const [newList, setNewList] = useState(null);
  const [provider, setProvider] = useState(null);
  const [requests, setRequests] = useState([]);
  const [saving, setSaving] = useState(false);
  const canWrite = hasPermission("write:aml");

  const fail = (e) => toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.saveFailed")) });
  const done = (m, severity = "success") => toast.current?.show({ severity, summary: m });
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, p, r] = await Promise.all([amlService.lists(), amlService.provider(), amlService.providerRequests({})]);
      setLists(l);
      setProvider(p);
      setRequests(r);
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, after) => {
    setSaving(true);
    try {
      const r = await fn();
      done(r.message);
      after?.(r);
      load();
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };
  const loadEntries = async (list, search = "") => {
    try {
      setEntries({ list, search, rows: await amlService.entries(list.id, { search }) });
    } catch (e) {
      fail(e);
    }
  };
  const rescreenText = (s) => (s ? t("aml.rescreenSummary", { clients: s.clients, parties: s.parties, hits: s.newOpenHits }) : "");

  return (
    <div className="admin__page access__page aml__page">
      <Toast ref={toast} />
      <PageHeader title={t("aml.listsTitle")} intro={t("aml.listsIntro")}
        actions={canWrite ? <>
          <Button icon="pi pi-refresh" outlined label={t("aml.rescreenAll")} loading={saving} onClick={() => run(() => amlService.rescreen())} />
          <Button icon="pi pi-plus" label={t("aml.addList")} onClick={() => setNewList({ code: "", name: "", listType: "sanctions", source: "" })} />
        </> : null} />
      <TabView>
        <TabPanel header={t("aml.tabLists")}>
          <DataTable value={lists} dataKey="id" loading={loading} size="small" stripedRows className="access__table" emptyMessage={t("aml.none")}>
            <Column field="code" header={t("aml.colCode")} />
            <Column header={t("aml.colName")} body={(l) => <div className="access__user"><span className="access__user-name">{l.name}</span><span className="access__muted">{l.source}</span></div>} />
            <Column header={t("aml.colListType")} body={(l) => t(`aml.listType.${l.listType}`)} />
            <Column header={t("aml.colVersion")} body={(l) => (l.versionNo ? `v${l.versionNo} · ${showDateTime(l.loadedAt)}` : <span className="access__muted">{t("aml.noVersion")}</span>)} />
            <Column field="entries" header={t("aml.colEntries")} />
            <Column header={t("aml.colActive")} body={(l) => (
              <InputSwitch checked={l.active} disabled={!canWrite} onChange={(e) => run(() => amlService.saveList(l.id, { active: e.value }))} />
            )} />
            <Column header="" style={{ width: "22rem" }} body={(l) => (
              <div className="aml__row-actions">
                <Button label={t("aml.entries")} text size="small" onClick={() => loadEntries(l)} />
                <Button label={t("aml.versions")} text size="small" onClick={async () => { try { setVersions({ list: l, rows: await amlService.versions(l.id) }); } catch (e) { fail(e); } }} />
                {canWrite ? <Button icon="pi pi-upload" label={t("aml.uploadVersion")} size="small" onClick={() => setUploading({ list: l, file: null, publicationDate: null, notes: "", rescreen: true })} /> : null}
              </div>
            )} />
          </DataTable>
          <small className="access__muted">{t("aml.listFormats")}</small>
        </TabPanel>
        <TabPanel header={t("aml.tabProvider")}>
          {provider ? (
            <>
              <div className="aml__summary">
                <div><label>{t("aml.provider")}</label>{t(`aml.providerName.${provider.provider}`, { defaultValue: provider.provider })}</div>
                <div><label>{t("aml.mode")}</label>{provider.mode}</div>
                <div><label>{t("aml.endpoint")}</label>{provider.endpoint || "-"}</div>
                <div><label>{t("aml.apiKeyEnv")}</label>{provider.apiKeyEnv || "-"} {provider.apiKeySet ? <AmlTag value="complete" group="kycStatus" /> : null}</div>
              </div>
              <Message severity="info" className="w-full mb-2" text={t("aml.providerNote")} />
              {canWrite && provider.provider !== "lists" ? <Button className="mb-2" icon="pi pi-bolt" outlined label={t("aml.testProvider")} loading={saving} onClick={() => run(() => amlService.testProvider("TEST NAME"))} /> : null}
              <DataTable value={requests} dataKey="id" size="small" className="access__table" emptyMessage={t("aml.none")}>
                <Column field="id" header="#" />
                <Column header={t("aml.colDate")} body={(r) => showDateTime(r.createdAt)} />
                <Column field="partyName" header={t("aml.colParty")} />
                <Column field="provider" header={t("aml.provider")} />
                <Column field="mode" header={t("aml.mode")} />
                <Column header={t("aml.colStatus")} body={(r) => <AmlTag value={r.status} group="requestStatus" />} />
                <Column field="attempts" header={t("aml.colAttempts")} />
                <Column field="lastError" header={t("aml.colMessage")} />
                <Column header="" body={(r) => (canWrite && ["failed", "abandoned"].includes(r.status) ? <Button label={t("aml.retry")} text size="small" onClick={() => run(() => amlService.retryRequest(r.id))} /> : null)} />
              </DataTable>
            </>
          ) : null}
        </TabPanel>
      </TabView>

      <Dialog header={uploading ? `${t("aml.uploadVersion")}: ${uploading.list.name}` : ""} visible={!!uploading} style={{ width: "34rem" }} modal onHide={() => setUploading(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setUploading(null)} />
          <Button label={t("aml.upload")} icon="pi pi-upload" loading={saving} disabled={!uploading?.file}
            onClick={() => run(() => amlService.uploadVersion(uploading.list.id, uploading.file, { publicationDate: isoDay(uploading.publicationDate), notes: uploading.notes, rescreen: String(uploading.rescreen) }),
              (r) => { setUploading(null); if (r.data?.rescreen) done(rescreenText(r.data.rescreen), r.data.rescreen.newOpenHits ? "warn" : "info"); })} />
        </>}>
        {uploading ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field">
              <label htmlFor="lv-file">{t("aml.listFile")}</label>
              <input id="lv-file" ref={fileRef} type="file" accept=".xml,.csv,.xlsx" onChange={(e) => setUploading((u) => ({ ...u, file: e.target.files?.[0] || null }))} />
              <small>{t("aml.listFormats")}</small>
            </div>
            <div className="admin__field">
              <label htmlFor="lv-date">{t("aml.publicationDate")}</label>
              <Calendar inputId="lv-date" value={uploading.publicationDate} onChange={(e) => setUploading((u) => ({ ...u, publicationDate: e.value }))} showIcon dateFormat="dd M yy" />
            </div>
            <div className="admin__field">
              <label htmlFor="lv-notes">{t("aml.notes")}</label>
              <InputTextarea id="lv-notes" rows={2} value={uploading.notes} onChange={(e) => setUploading((u) => ({ ...u, notes: e.target.value }))} />
            </div>
            <div className="access__toggle">
              <InputSwitch inputId="lv-rescreen" checked={uploading.rescreen} onChange={(e) => setUploading((u) => ({ ...u, rescreen: e.value }))} />
              <label htmlFor="lv-rescreen">{t("aml.rescreenAfter")}</label>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog header={versions ? `${t("aml.versions")}: ${versions.list.name}` : ""} visible={!!versions} style={{ width: "56rem" }} modal onHide={() => setVersions(null)}>
        {versions ? (
          <DataTable value={versions.rows} dataKey="id" size="small" className="access__table" emptyMessage={t("aml.noVersion")}>
            <Column header={t("aml.colVersion")} body={(v) => `v${v.versionNo}${v.current ? ` (${t("aml.current")})` : ""}`} />
            <Column field="fileName" header={t("aml.listFile")} />
            <Column field="format" header={t("aml.colFormat")} />
            <Column field="entries" header={t("aml.colEntries")} />
            <Column header={t("aml.publicationDate")} body={(v) => showDate(v.publicationDate)} />
            <Column header={t("aml.colLoaded")} body={(v) => `${showDateTime(v.loadedAt)} ${v.loadedBy || ""}`} />
            <Column header={t("aml.colRescreen")} body={(v) => rescreenText(v.rescreen)} />
            <Column field="notes" header={t("aml.notes")} />
            <Column header={t("aml.checksum")} body={(v) => <span className="aml__mono" title={v.checksum || ""}>{(v.checksum || "").slice(0, 12)}</span>} />
          </DataTable>
        ) : null}
      </Dialog>

      <Dialog header={entries ? `${t("aml.entries")}: ${entries.list.name}` : ""} visible={!!entries} style={{ width: "56rem" }} modal onHide={() => setEntries(null)}
        footer={entries && canWrite ? <Button icon="pi pi-plus" label={t("aml.addEntry")} onClick={() => setAdding({ fullName: "", aliases: "", entityType: "individual", birthDate: "", nationality: "", entryRef: "", reason: "" })} /> : null}>
        {entries ? (
          <>
            <div className="admin__filters">
              <span className="p-input-icon-left">
                <i className="pi pi-search" />
                <InputText value={entries.search} placeholder={t("aml.searchEntries")} onChange={(e) => loadEntries(entries.list, e.target.value)} />
              </span>
            </div>
            <DataTable value={entries.rows} dataKey="id" size="small" className="access__table" paginator rows={15} emptyMessage={t("aml.none")}>
              <Column field="entryRef" header={t("aml.colReference")} />
              <Column field="fullName" header={t("aml.colName")} />
              <Column header={t("aml.aliases")} body={(e) => e.aliases.join("; ")} />
              <Column header={t("aml.colType")} body={(e) => t(`aml.entityType.${e.entityType}`)} />
              <Column field="birthDate" header={t("aml.birthYear")} />
              <Column field="nationality" header={t("aml.colNationality")} />
              <Column header="" body={(e) => (canWrite ? <Button icon="pi pi-trash" text rounded size="small" aria-label={t("aml.removeEntry")} tooltip={t("aml.removeEntry")}
                onClick={() => setAdding({ remove: e, reason: "" })} /> : null)} />
            </DataTable>
          </>
        ) : null}
      </Dialog>

      <Dialog header={adding?.remove ? `${t("aml.removeEntry")}: ${adding.remove.fullName}` : t("aml.addEntry")} visible={!!adding} style={{ width: "34rem" }} modal onHide={() => setAdding(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setAdding(null)} />
          <Button label={t("aml.save")} icon="pi pi-check" loading={saving}
            disabled={adding?.remove ? (adding?.reason || "").trim().length < 5 : (adding?.fullName || "").trim().length < 2}
            onClick={() => run(() => (adding.remove ? amlService.removeEntry(entries.list.id, adding.remove.id, adding.reason.trim())
              : amlService.addEntry(entries.list.id, { fullName: adding.fullName.trim(), aliases: adding.aliases.split(";").map((x) => x.trim()).filter(Boolean), entityType: adding.entityType,
                birthDate: adding.birthDate || null, nationality: adding.nationality || null, entryRef: adding.entryRef || null, reason: adding.reason || undefined })),
            () => { setAdding(null); loadEntries(entries.list); })} />
        </>}>
        {adding && !adding.remove ? (
          <div className="admin__grid admin__grid--single">
            {[["fullName", "colName"], ["aliases", "aliasesHint"], ["entryRef", "colReference"], ["birthDate", "birthYear"], ["nationality", "colNationality"], ["reason", "colReason"]].map(([k, label]) => (
              <div className="admin__field" key={k}>
                <label htmlFor={`ae-${k}`}>{t(`aml.${label}`)}</label>
                <InputText id={`ae-${k}`} value={adding[k]} onChange={(e) => setAdding((a) => ({ ...a, [k]: e.target.value }))} />
              </div>
            ))}
            <div className="admin__field">
              <label htmlFor="ae-type">{t("aml.colType")}</label>
              <Dropdown inputId="ae-type" value={adding.entityType} options={entityTypeOptions(t)} onChange={(e) => setAdding((a) => ({ ...a, entityType: e.value }))} />
            </div>
          </div>
        ) : null}
        {adding?.remove ? (
          <div className="admin__field">
            <label htmlFor="re-reason">{t("aml.colReason")}</label>
            <InputTextarea id="re-reason" rows={2} value={adding.reason} onChange={(e) => setAdding((a) => ({ ...a, reason: e.target.value }))} />
          </div>
        ) : null}
      </Dialog>

      <Dialog header={t("aml.addList")} visible={!!newList} style={{ width: "32rem" }} modal onHide={() => setNewList(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setNewList(null)} />
          <Button label={t("aml.save")} icon="pi pi-check" loading={saving} disabled={!/^[A-Za-z0-9_-]{2,30}$/.test(newList?.code || "") || (newList?.name || "").trim().length < 3}
            onClick={() => run(() => amlService.addList({ ...newList, code: newList.code.toUpperCase(), source: newList.source || undefined }), () => setNewList(null))} />
        </>}>
        {newList ? (
          <div className="admin__grid admin__grid--single">
            <div className="admin__field"><label htmlFor="nl-code">{t("aml.colCode")}</label><InputText id="nl-code" value={newList.code} onChange={(e) => setNewList((l) => ({ ...l, code: e.target.value }))} /></div>
            <div className="admin__field"><label htmlFor="nl-name">{t("aml.colName")}</label><InputText id="nl-name" value={newList.name} onChange={(e) => setNewList((l) => ({ ...l, name: e.target.value }))} /></div>
            <div className="admin__field"><label htmlFor="nl-type">{t("aml.colListType")}</label><Dropdown inputId="nl-type" value={newList.listType} options={listTypes} onChange={(e) => setNewList((l) => ({ ...l, listType: e.value }))} /></div>
            <div className="admin__field"><label htmlFor="nl-source">{t("aml.source")}</label><InputText id="nl-source" value={newList.source} onChange={(e) => setNewList((l) => ({ ...l, source: e.target.value }))} /></div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

const entityTypeOptions = (t) => ["individual", "entity"].map((value) => ({ value, label: t(`aml.entityType.${value}`) }));

export default ScreeningLists;
