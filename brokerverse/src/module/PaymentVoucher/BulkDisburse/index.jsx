import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgBackicon from "../../../assets/icons/SvgBackicon";
import CommissionService from "../../../services/commissionService";
import disbursementService from "../../../services/disbursementService";
import { formatAmount } from "../../Commission/utils/formatAmount";
import "./index.scss";
import logger from "../../../utility/logger";
import { openConfirm } from "../../../components/ConfirmDialog";

const BulkDisburse = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agents, setAgents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState([]);

  const home = { label: t("paymentVoucher.accounts") };
  const items = [
    {
      label: t("paymentVoucher.title"),
      command: () => navigate("/accounts/paymentvoucher"),
    },
    { label: t("paymentVoucher.bulkDisburse.title") },
  ];

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await CommissionService.getAgentsReadyToPay();
      const data = res?.data || res;
      setAgents(data?.agents || []);
      setSummary(data?.summary || null);
      setSelected([]);
    } catch (err) {
      logger.error("Failed to load agents ready to pay", err);
      setAgents([]);
      toast.current?.show({
        severity: "error",
        summary: t("common.error"),
        detail: t("paymentVoucher.bulkDisburse.loadFailed"),
        life: 4000,
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleDisburse = async () => {
    if (!selected.length) return;
    const sum = (key) => selected.reduce((total, a) => total + (Number(a[key]) || 0), 0);
    const ok = await openConfirm({
      title: t("paymentVoucher.bulkDisburse.confirmTitle"),
      message: t("paymentVoucher.bulkDisburse.confirmMessage"),
      facts: [
        { label: t("paymentVoucher.bulkDisburse.agents"), value: selected.length, type: "number" },
        { label: t("paymentVoucher.bulkDisburse.approvedLines"), value: sum("approvedLineCount"), type: "number" },
        { label: t("paymentVoucher.bulkDisburse.gross"), value: sum("comsubGross"), type: "amount" },
        { label: t("paymentVoucher.bulkDisburse.net"), value: sum("netPayable"), type: "amount", emphasis: true },
      ],
      note: t("paymentVoucher.bulkDisburse.confirmNote"),
      confirmLabel: t("paymentVoucher.bulkDisburse.create", { count: selected.length }),
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      const result = await disbursementService.bulkAgentDisburse({
        referrerIds: selected.map((a) => a.id),
      });
      if (!result.success) {
        throw new Error(result.error || t("paymentVoucher.bulkDisburse.failed"));
      }
      const payload = result.data?.data || result.data;
      const vouchers = payload?.vouchers || [];
      const errors = payload?.errors || [];
      toast.current?.show({
        severity: vouchers.length ? "success" : "warn",
        summary: t("paymentVoucher.bulkDisburse.title"),
        detail: errors.length
          ? t("paymentVoucher.bulkDisburse.createdWithErrors", { count: vouchers.length, failed: errors.length })
          : t("paymentVoucher.bulkDisburse.created", { count: vouchers.length }),
        life: 5000,
      });
      await loadAgents();
    } catch (err) {
      toast.current?.show({
        severity: "error",
        summary: t("common.error"),
        detail: err.message || t("paymentVoucher.bulkDisburse.failed"),
        life: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="overall__bulk-disburse__container">
      <Toast ref={toast} />
      <div>
        <span
          onClick={() => navigate("/accounts/paymentvoucher")}
          style={{ cursor: "pointer" }}
        >
          <SvgBackicon />
        </span>
        <label className="label_header">{t("paymentVoucher.bulkDisburse.title")}</label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <Card className="mt-3">
        {summary ? (
          <div className="bulk-disburse-summary">
            <span>
              {t("paymentVoucher.bulkDisburse.agents")}: <strong>{summary.agentCount}</strong>
            </span>
            <span>
              {t("paymentVoucher.bulkDisburse.gross")}: <strong>{formatAmount(summary.totalComsubGross)}</strong>
            </span>
            <span>
              {t("paymentVoucher.bulkDisburse.net")}: <strong>{formatAmount(summary.totalNet)}</strong>
            </span>
          </div>
        ) : null}

        <DataTable
          value={agents}
          loading={loading}
          selection={selected}
          onSelectionChange={(e) => setSelected(e.value)}
          dataKey="id"
          emptyMessage={t("paymentVoucher.bulkDisburse.empty")}
          paginator={agents.length > 10}
          rows={20}
        >
          <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
          <Column field="name" header={t("paymentVoucher.bulkDisburse.agent")} />
          <Column field="type" header={t("paymentVoucher.bulkDisburse.type")} />
          <Column field="level" header={t("paymentVoucher.bulkDisburse.level")} />
          <Column field="approvedLineCount" header={t("paymentVoucher.bulkDisburse.approvedLines")} />
          <Column
            field="comsubGross"
            header={t("paymentVoucher.bulkDisburse.gross")}
            body={(row) => formatAmount(row.comsubGross)}
          />
          <Column
            field="netPayable"
            header={t("paymentVoucher.bulkDisburse.net")}
            body={(row) => formatAmount(row.netPayable)}
          />
          <Column field="bankAccount" header={t("paymentVoucher.bulkDisburse.bankAccount")} />
        </DataTable>
      </Card>

      <div className="next_container">
        <Button
          className="submit_button p-0"
          label={t("paymentVoucher.bulkDisburse.disburse", { count: selected.length })}
          loading={submitting}
          disabled={!selected.length || submitting}
          onClick={handleDisburse}
        />
      </div>
    </div>
  );
};

export default BulkDisburse;
