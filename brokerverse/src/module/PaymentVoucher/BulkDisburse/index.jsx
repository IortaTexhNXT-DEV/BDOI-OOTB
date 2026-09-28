import React, { useEffect, useRef, useState } from "react";
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
import { formatBaht } from "../../Commission/utils/formatBaht";
import "./index.scss";

const BulkDisburse = () => {
  const navigate = useNavigate();
  const toast = useRef(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agents, setAgents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState([]);

  const home = { label: "Accounts" };
  const items = [
    {
      label: "Payment Voucher",
      command: () => navigate("/accounts/paymentvoucher"),
    },
    { label: "Bulk Disburse" },
  ];

  const loadAgents = async () => {
    setLoading(true);
    try {
      const res = await CommissionService.getAgentsReadyToPay();
      const data = res?.data || res;
      setAgents(data?.agents || []);
      setSummary(data?.summary || null);
      setSelected([]);
    } catch (err) {
      console.error("Failed to load agents ready to pay", err);
      setAgents([]);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "Failed to load agents with approved commission",
        life: 4000,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleDisburse = async () => {
    if (!selected.length) return;
    setSubmitting(true);
    try {
      const result = await disbursementService.bulkAgentDisburse({
        referrerIds: selected.map((a) => a.id),
        transactionCode: "COMSUB",
        instrumentCurrency: "THB",
      });
      if (!result.success) {
        throw new Error(result.error || "Bulk disburse failed");
      }
      const payload = result.data?.data || result.data;
      const vouchers = payload?.vouchers || [];
      const errors = payload?.errors || [];
      toast.current?.show({
        severity: vouchers.length ? "success" : "warn",
        summary: "Bulk Disburse",
        detail: `${vouchers.length} voucher(s) created${
          errors.length ? `, ${errors.length} failed` : ""
        }`,
        life: 5000,
      });
      await loadAgents();
    } catch (err) {
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: err.message || "Bulk disburse failed",
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
        <label className="label_header">Bulk Disburse</label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <Card className="mt-3">
        <p className="bulk-disburse-desc">
          Agents with approved commission ready to pay. Tick agents and disburse
          — each agent gets their own voucher (net of WHT).
        </p>
        {summary ? (
          <div className="bulk-disburse-summary">
            <span>
              Agents: <strong>{summary.agentCount}</strong>
            </span>
            <span>
              COMSUB (GROSS): <strong>{formatBaht(summary.totalComsubGross)}</strong>
            </span>
            <span>
              Net payable: <strong>{formatBaht(summary.totalNet)}</strong>
            </span>
          </div>
        ) : null}

        <DataTable
          value={agents}
          loading={loading}
          selection={selected}
          onSelectionChange={(e) => setSelected(e.value)}
          dataKey="id"
          emptyMessage="No agents with approved commission"
          paginator={agents.length > 10}
          rows={10}
        >
          <Column selectionMode="multiple" headerStyle={{ width: "3rem" }} />
          <Column field="name" header="Agent / Referrer" />
          <Column field="type" header="Type" />
          <Column field="level" header="Level" />
          <Column field="approvedLineCount" header="Approved lines" />
          <Column
            field="comsubGross"
            header="COMSUB (GROSS)"
            body={(row) => formatBaht(row.comsubGross)}
          />
          <Column
            field="netPayable"
            header="Net payable"
            body={(row) => formatBaht(row.netPayable)}
          />
          <Column field="bankAccount" header="Bank account" />
        </DataTable>
      </Card>

      <div className="next_container">
        <Button
          className="submit_button p-0"
          label={
            submitting
              ? "Disbursing…"
              : `Disburse selected (${selected.length})`
          }
          disabled={!selected.length || submitting}
          onClick={handleDisburse}
        />
      </div>
    </div>
  );
};

export default BulkDisburse;
