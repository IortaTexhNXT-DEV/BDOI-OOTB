import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import amlService, { errorMessage } from "../../services/amlService";
import { AmlTag, PageHeader, PartyCell, RATINGS, showDate, useOptionList } from "./common";
import "../Administration/index.scss";
import "../AccessControl/index.scss";
import "./index.scss";

/**
 * Compliance > KYC Refresh: clients whose periodic KYC refresh is due (aml.kyc_refresh_months per rating, listed
 * aml.kyc_refresh_notice_days ahead) or overdue. Complete refresh rates the client again and sets the next date.
 */
const KycRefresh = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useRef(null);
  const ratings = useOptionList(RATINGS, "rating");
  const [filters, setFilters] = useState({ rating: null, overdue: params.get("overdue") === "true" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await amlService.refreshDue({ rating: filters.rating, overdue: filters.overdue ? "true" : undefined }));
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.loadFailed")) });
    } finally {
      setLoading(false);
    }
  }, [filters, t]);
  useEffect(() => { load(); }, [load]);

  const complete = async () => {
    setSaving(true);
    try {
      const r = await amlService.completeRefresh(refresh.clientId, refresh.notes);
      toast.current?.show({ severity: "success", summary: r.message });
      setRefresh(null);
      load();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: errorMessage(e, t("aml.saveFailed")) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin__page access__page aml__page">
      <Toast ref={toast} />
      <PageHeader title={t("aml.refreshTitle")} intro={t("aml.refreshIntro")} />
      <div className="admin__filters">
        <Dropdown value={filters.rating} options={ratings} showClear placeholder={t("aml.colRating")} onChange={(e) => setFilters((f) => ({ ...f, rating: e.value || null }))} />
        <div className="access__toggle">
          <InputSwitch inputId="kr-overdue" checked={filters.overdue} onChange={(e) => setFilters((f) => ({ ...f, overdue: e.value }))} />
          <label htmlFor="kr-overdue">{t("aml.overdueOnly")}</label>
        </div>
      </div>
      <DataTable value={rows} dataKey="clientId" loading={loading} size="small" stripedRows paginator rows={20} className="access__table" emptyMessage={t("aml.noneDue")}>
        <Column header={t("aml.colClient")} body={(r) => <PartyCell name={r.clientName} code={r.clientCode} />} />
        <Column header={t("aml.colRating")} body={(r) => <AmlTag value={r.riskRating} group="rating" />} />
        <Column header={t("aml.colKycStatus")} body={(r) => <AmlTag value={r.kycStatus} group="kycStatus" />} />
        <Column header={t("aml.lastReviewed")} body={(r) => showDate(r.lastReviewedOn)} />
        <Column field="nextReviewOn" header={t("aml.colNextReview")} sortable body={(r) => (
          <span className="aml__due">{showDate(r.nextReviewOn)}{r.overdue ? <Tag value={t("aml.overdue")} severity="danger" /> : null}</span>
        )} />
        <Column header="" style={{ width: "16rem" }} body={(r) => (
          <div className="aml__row-actions">
            <Button label={t("aml.openProfile")} text size="small" onClick={() => navigate(`/compliance/aml/clients/${r.clientId}`)} />
            <Button label={t("aml.completeRefresh")} size="small" onClick={() => setRefresh({ clientId: r.clientId, name: r.clientName, notes: "" })} />
          </div>
        )} />
      </DataTable>
      <Dialog header={`${t("aml.completeRefresh")}: ${refresh?.name || ""}`} visible={!!refresh} style={{ width: "30rem" }} modal onHide={() => setRefresh(null)}
        footer={<>
          <Button label={t("aml.cancel")} text onClick={() => setRefresh(null)} />
          <Button label={t("aml.save")} icon="pi pi-check" loading={saving} onClick={complete} />
        </>}>
        {refresh ? (
          <div className="admin__field">
            <label htmlFor="kr-notes">{t("aml.notes")}</label>
            <InputTextarea id="kr-notes" rows={3} value={refresh.notes} onChange={(e) => setRefresh((x) => ({ ...x, notes: e.target.value }))} />
            <small>{t("aml.refreshNote")}</small>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
};

export default KycRefresh;
