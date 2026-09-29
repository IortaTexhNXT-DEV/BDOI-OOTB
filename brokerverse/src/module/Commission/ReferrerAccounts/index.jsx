import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import CommissionService from "../../../services/commissionService";
import { formatAmount } from "../utils/formatAmount";
import "./style.scss";
import logger from "../../../utility/logger";

const ReferrerAccounts = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState({
    cycleLabel: "Jun 2026",
    dueThisCycle: 0,
    readyToPay: 0,
  });
  const [referrers, setReferrers] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await CommissionService.getReferrerAccounts();
      const data = res?.data || res;
      setSummary(data?.summary || summary);
      setReferrers(data?.referrers || []);
    } catch (err) {
      logger.error("Failed to load referrer accounts", err);
      setReferrers([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return referrers;
    return referrers.filter((r) => r.name?.toLowerCase().includes(q));
  }, [referrers, search]);

  const statusBody = (row) => {
    const isActive = row.status === "Active";
    return (
      <span className={`ref-status ${isActive ? "active" : "on-hold"}`}>
        {row.status}
      </span>
    );
  };

  const netBody = (row) => (
    <span className="net-payable">{formatAmount(row.netPayable)}</span>
  );

  const levelBody = (row) => row.level || "—";

  return (
    <div className="referrer-accounts-page">
      <div className="page-header">
        <h1>Agents / Referrer Accounts</h1>
        <p className="page-desc">
          Click a referrer to open their account — policies split by payment
          cycle (current / future / past). Run the lifecycle (mark eligible →
          approve → generate payout) and override per-policy rates from inside
          the account. Identity only — <strong>no fixed rate</strong> (rates
          live on each policy line).
        </p>
      </div>

      <div className="referrer-card">
        <div className="toolbar">
          <span className="p-input-icon-left search-wrap">
            <i className="pi pi-search" />
            <InputText
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search referrer..."
              className="search-input"
            />
          </span>
          <div className="toolbar-stats">
            <span className="stat">
              Due this cycle ({summary.cycleLabel}){" "}
              <strong className="due">
                {formatAmount(summary.dueThisCycle)}
              </strong>
            </span>
            <span className="stat">
              Ready to pay{" "}
              <strong className="ready">
                {formatAmount(summary.readyToPay)}
              </strong>
            </span>
          </div>
        </div>

        <DataTable
          value={filtered}
          loading={loading}
          paginator={false}
          emptyMessage="No referrers found"
          className="referrer-table"
          rowClassName={() => "clickable-row"}
          onRowClick={(e) =>
            navigate(`/commission/referrer-accounts/${e.data.id}`)
          }
        >
          <Column field="name" header="REFERRER" bodyClassName="name-cell" />
          <Column field="type" header="TYPE" />
          <Column field="level" header="LEVEL" body={levelBody} />
          <Column field="policies" header="POLICIES" />
          <Column
            field="netPayable"
            header="NET PAYABLE (OPEN)"
            body={netBody}
          />
          <Column
            field="whtType"
            header="WHT TYPE"
            body={(row) =>
              row.whtApplicable === false ? "Not applied" : row.whtType
            }
          />
          <Column field="bankAccount" header="BANK ACCOUNT" />
          <Column field="status" header="STATUS" body={statusBody} />
        </DataTable>
      </div>
    </div>
  );
};

export default ReferrerAccounts;
