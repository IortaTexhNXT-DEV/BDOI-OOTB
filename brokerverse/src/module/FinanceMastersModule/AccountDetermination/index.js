import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { TabView, TabPanel } from "primereact/tabview";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import SvgDot from "../../../assets/icons/SvgDot";
import postingRulesService from "../../../services/postingRulesService";
import CommissionTaxes from "./CommissionTaxes";
import "../PostingRules/index.scss";

const SECTIONS = ["premium", "customer", "miscellaneous", "ri-claims", "other"];
const EMPTY_REASON = { code: "", name: "", glAccount: null, maxAmount: "", description: "", status: "active", isNew: true };

/**
 * Master > Finance > Account Determination (replaces the Premium / Customer / Miscellaneous / RI-Claims account setup
 * screens): the GL account behind every account role the posting rules use, the payable account per payee type, the
 * cash account per payment mode and the write-off reasons. What this screen shows is what posting uses.
 */
const AccountDetermination = ({ section = "premium" }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [data, setData] = useState(null);
  const [gl, setGl] = useState([]);
  const [loading, setLoading] = useState(false);
  const [maps, setMaps] = useState({ payable: {}, cash: {} });
  const [reason, setReason] = useState(null);
  const sections = useMemo(() => SECTIONS.filter((s) => data?.sections?.some((x) => x.section === s)), [data]);
  const [tab, setTab] = useState(0);

  const fail = (e) => toast.current?.show({ severity: "error", summary: t("postingRules.error"), detail: e.message, life: 8000 });
  const done = (msg) => toast.current?.show({ severity: "success", summary: t("postingRules.saved"), detail: msg, life: 3000 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await postingRulesService.accountDetermination();
      setData(d);
      setMaps({ payable: { ...d.payableByPayee }, cash: { ...d.cashByPaymentMode } });
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    postingRulesService.glAccounts().then((rows) => setGl(rows || [])).catch(() => setGl([]));
  }, [load]);
  useEffect(() => {
    const i = sections.indexOf(section);
    if (i >= 0) setTab(i);
  }, [sections, section]);

  const glOptions = useMemo(() => gl.map((a) => ({ label: `${a.code} – ${a.name}`, value: a.code })), [gl]);

  const setRole = async (row, glCode) => {
    try {
      const out = await postingRulesService.setRole(row.role, glCode);
      done(out.change ? t("postingRules.changePending") : t("postingRules.roleSaved", { role: row.role, gl: glCode }));
      load();
    } catch (e) {
      fail(e);
    }
  };
  const saveMap = async (name, map) => {
    try {
      const out = await postingRulesService.setMap(name, map);
      done(out.change ? t("postingRules.changePending") : t("postingRules.mapSaved"));
      load();
    } catch (e) {
      fail(e);
    }
  };
  const saveReason = async () => {
    const r = reason;
    const body = { name: r.name, glAccount: r.glAccount, maxAmount: r.maxAmount === "" || r.maxAmount === null ? null : Number(r.maxAmount), description: r.description || null, status: r.status };
    try {
      if (r.isNew) await postingRulesService.addWriteOffReason({ code: r.code, ...body });
      else await postingRulesService.updateWriteOffReason(r.code, body);
      setReason(null);
      done(t("postingRules.reasonSaved", { code: r.code }));
      load();
    } catch (e) {
      fail(e);
    }
  };

  const rolesTable = (rows) => (
    <DataTable value={rows} loading={loading} dataKey="role" size="small" stripedRows>
      <Column header={t("postingRules.role")} body={(r) => (<div><div className="font-semibold">{r.label}</div><code className="text-500">{r.role}</code></div>)} />
      <Column header={t("postingRules.glAccount")} body={(r) => (
        <Dropdown value={r.glCode} options={glOptions} filter onChange={(e) => setRole(r, e.value)} className={`account-determination__gl ${r.glActive ? "" : "p-invalid"}`} />
      )} />
      <Column header={t("postingRules.usedBy")} body={(r) => (r.usedBy || []).map((ev) => (
        <Tag key={ev} value={ev} severity="info" className="mr-1 mb-1 cursor-pointer" onClick={() => navigate("/master/finance/posting-rules")} />
      ))} />
    </DataTable>
  );

  const mapTable = (name, key) => {
    const rows = Object.entries(maps[key]).map(([k, v]) => ({ key: k, gl: v }));
    return (
      <div className="mb-4">
        <DataTable value={rows} dataKey="key" size="small" stripedRows>
          <Column field="key" header={key === "payable" ? t("postingRules.payeeType") : t("postingRules.paymentMode")} style={{ width: "14rem" }} />
          <Column header={t("postingRules.glAccount")} body={(r) => (
            <Dropdown value={r.gl} options={glOptions} filter className="account-determination__gl"
              onChange={(e) => setMaps((m) => ({ ...m, [key]: { ...m[key], [r.key]: e.value } }))} />
          )} />
        </DataTable>
        <div className="flex justify-content-end mt-2">
          <Button label={t("postingRules.saveMap")} icon="pi pi-save" onClick={() => saveMap(name, maps[key])} />
        </div>
      </div>
    );
  };

  return (
    <div className="account-determination">
      <Toast ref={toast} />
      <div className="posting-rules__title">{t("postingRules.accountDetermination")}</div>
      <BreadCrumb home={{ label: t("postingRules.master") }} className="posting-rules__crumbs" separatorIcon={<SvgDot color={"#000"} />}
        model={[{ label: t("postingRules.finance") }, { label: t("postingRules.accountDetermination"), url: "/master/finance/account-determination" }]} />
      <p className="posting-rules__intro">{t("postingRules.accountDeterminationIntro")}</p>
      {/* the row is there before the data arrives, so the tabs below do not move */}
      <div className="mb-2 bv-tag-row">
        {data && (
          <Tag value={data.splitPremiumTaxes ? t("postingRules.taxesSplit") : t("postingRules.taxesNotSplit")} severity={data.splitPremiumTaxes ? "success" : "secondary"} icon="pi pi-percentage" />
        )}
      </div>
      {data?.pendingChanges?.length > 0 && (
        <div className="p-message p-message-warn p-3 mb-2">
          <div className="font-semibold mb-1">{t("postingRules.pendingChanges")}</div>
          {data.pendingChanges.map((c) => (
            <div key={c.id}>{c.kindLabel} · {c.target} · {c.requestedBy} <Button label={t("postingRules.reviewChanges")} className="p-button-text p-button-sm" onClick={() => navigate("/master/finance/configuration-approvals")} /></div>
          ))}
        </div>
      )}
      <div className="posting-rules__card">
        <TabView activeIndex={tab} onTabChange={(e) => setTab(e.index)}>
          {sections.map((s) => (
            <TabPanel key={s} header={t(`postingRules.section.${s}`)}>
              {rolesTable(data.sections.find((x) => x.section === s)?.roles || [])}
            </TabPanel>
          ))}
          <TabPanel header={t("postingRules.maps")}>
            <h4>{t("postingRules.payableByPayee")}</h4>
            {mapTable("payable-by-payee", "payable")}
            <h4>{t("postingRules.cashByPaymentMode")}</h4>
            {mapTable("cash-by-payment-mode", "cash")}
          </TabPanel>
          <TabPanel header={t("postingRules.commissionTaxes.title")}>
            <CommissionTaxes onSaved={(msg) => done(msg)} onError={fail} />
          </TabPanel>
          <TabPanel header={t("postingRules.writeOffReasons")}>
            <div className="flex justify-content-end mb-2">
              <Button label={t("postingRules.addReason")} icon="pi pi-plus" onClick={() => setReason({ ...EMPTY_REASON })} />
            </div>
            <DataTable value={data?.writeOffReasons || []} dataKey="code" size="small" stripedRows>
              <Column field="code" header={t("postingRules.reasonCode")} style={{ width: "10rem" }} />
              <Column field="name" header={t("postingRules.reason")} />
              <Column header={t("postingRules.glAccount")} body={(r) => `${r.glAccount} ${r.glName || ""}`} />
              <Column header={t("postingRules.maxAmount")} body={(r) => (r.maxAmount === null ? "—" : r.maxAmount.toLocaleString("en-US", { minimumFractionDigits: 2 }))} />
              <Column header={t("postingRules.status")} body={(r) => <Tag value={r.status} severity={r.status === "active" ? "success" : "secondary"} />} />
              <Column style={{ width: "4rem" }} body={(r) => <Button icon="pi pi-pencil" className="p-button-text p-button-sm" onClick={() => setReason({ ...r, maxAmount: r.maxAmount ?? "", isNew: false })} />} />
            </DataTable>
          </TabPanel>
        </TabView>
      </div>

      <Dialog header={reason?.isNew ? t("postingRules.addReason") : reason?.code} visible={!!reason} style={{ width: "min(560px, 95vw)" }} onHide={() => setReason(null)}
        footer={<div><Button label={t("postingRules.cancel")} className="p-button-text" onClick={() => setReason(null)} /><Button label={t("postingRules.save")} icon="pi pi-save" onClick={saveReason} /></div>}>
        {reason && (
          <div className="grid posting-rules__editor">
            <div className="col-12 md:col-4">
              <label>{t("postingRules.reasonCode")}</label>
              <InputText value={reason.code} disabled={!reason.isNew} onChange={(e) => setReason({ ...reason, code: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-8">
              <label>{t("postingRules.reason")}</label>
              <InputText value={reason.name} onChange={(e) => setReason({ ...reason, name: e.target.value })} className="w-full" />
            </div>
            <div className="col-12">
              <label>{t("postingRules.glAccount")}</label>
              <Dropdown value={reason.glAccount} options={glOptions} filter onChange={(e) => setReason({ ...reason, glAccount: e.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label>{t("postingRules.maxAmount")}</label>
              <InputText value={reason.maxAmount} keyfilter="money" onChange={(e) => setReason({ ...reason, maxAmount: e.target.value })} className="w-full" />
            </div>
            <div className="col-12 md:col-6">
              <label>{t("postingRules.status")}</label>
              <Dropdown value={reason.status} options={[{ label: "active", value: "active" }, { label: "inactive", value: "inactive" }]} onChange={(e) => setReason({ ...reason, status: e.value })} className="w-full" />
            </div>
            <div className="col-12">
              <label>{t("postingRules.description")}</label>
              <InputText value={reason.description || ""} onChange={(e) => setReason({ ...reason, description: e.target.value })} className="w-full" />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default AccountDetermination;
