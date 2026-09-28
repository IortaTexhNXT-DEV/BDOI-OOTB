import React, { useEffect, useMemo, useState } from "react";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/button";
import CommissionService from "../../../services/commissionService";
import { formatCurrency } from "../../../utility/currencyConverter";
import "./CommissionReferralSection.scss";

const DIRECT_ID = "direct";
const DIRECT_OPTION = {
  value: DIRECT_ID,
  label: "Direct — broker's own lead",
};

const LEVEL_OPTIONS = [
  { label: "L1", value: "L1" },
  { label: "L2", value: "L2" },
];

const DEFAULT_RATE_BY_LEVEL = { L1: 8, L2: 5 };
export const DEFAULT_BROKERAGE_PCT = 18;

export const defaultCommissionDetails = () => ({
  brokeragePct: DEFAULT_BROKERAGE_PCT,
  commissionCode: "COMM001",
  productLabel: "Motor · All insurers",
  primary: {
    referrerId: DIRECT_ID,
    referrerName: DIRECT_OPTION.label,
    level: null,
    comsubFixed: 0,
    comsubPct: 0,
  },
  chain: [],
});

const toNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null || value === "") return 0;
  const parsed = parseFloat(String(value).replace(/[,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatBaht = (n) => formatCurrency(toNumber(n));

const comsubAmount = (fixed, pct, netPremium) => {
  const f = toNumber(fixed);
  const p = toNumber(pct);
  const net = toNumber(netPremium);
  return Number((f + net * (p / 100)).toFixed(2));
};

const CommissionReferralSection = ({ value, onChange, netPremium, discount }) => {
  const details = value || defaultCommissionDetails();
  const [referrerOptions, setReferrerOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    CommissionService.getReferrerAccounts()
      .then((res) => {
        const data = res?.data || res;
        const list = (data?.referrers || []).map((r) => ({
          value: r.id,
          label: r.name,
          level: r.level,
          whtPct: r.whtApplicable === false ? 0 : Number(r.whtPct ?? 0),
        }));
        if (!cancelled) setReferrerOptions(list);
      })
      .catch(() => {
        // no invented referrers: without the list only "Direct" can be chosen
        if (!cancelled) setReferrerOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const primaryOptions = useMemo(
    () => [DIRECT_OPTION, ...referrerOptions],
    [referrerOptions]
  );
  const chainOptions = referrerOptions;

  const isDirect = details.primary?.referrerId === DIRECT_ID;
  const net = toNumber(netPremium);
  const disc = toNumber(discount);
  const brokeragePct = details.brokeragePct ?? DEFAULT_BROKERAGE_PCT;
  const brokerageAmount = Number(((net * brokeragePct) / 100).toFixed(2));

  const primaryComsub = isDirect
    ? 0
    : comsubAmount(
        details.primary?.comsubFixed,
        details.primary?.comsubPct,
        net
      );
  const chainComsubTotal = (details.chain || []).reduce(
    (sum, row) =>
      sum + comsubAmount(row.comsubFixed, row.comsubPct, net),
    0
  );
  const comsubGross = Number((primaryComsub + chainComsubTotal).toFixed(2));
  const margin = Number((brokerageAmount - comsubGross - disc).toFixed(2));
  // withholding at each referrer's configured rate (Individual / Company, from Commission settings)
  const whtOf = (referrerId) => referrerOptions.find((o) => o.value === referrerId)?.whtPct || 0;
  const wht = Number(
    (
      (isDirect ? 0 : (primaryComsub * whtOf(details.primary?.referrerId)) / 100) +
      (details.chain || []).reduce(
        (sum, row) => sum + (comsubAmount(row.comsubFixed, row.comsubPct, net) * whtOf(row.referrerId)) / 100,
        0
      )
    ).toFixed(2)
  );
  const netPayable = Number((comsubGross - wht).toFixed(2));

  const patch = (next) => onChange({ ...details, ...next });

  const setPrimary = (patchPrimary) => {
    patch({ primary: { ...details.primary, ...patchPrimary } });
  };

  const onPrimaryReferrerChange = (referrerId) => {
    if (referrerId === DIRECT_ID) {
      patch({
        primary: {
          referrerId: DIRECT_ID,
          referrerName: DIRECT_OPTION.label,
          level: null,
          comsubFixed: 0,
          comsubPct: 0,
        },
        chain: [],
      });
      return;
    }
    const opt = referrerOptions.find((o) => o.value === referrerId);
    const level = opt?.level || "L1";
    setPrimary({
      referrerId,
      referrerName: opt?.label || referrerId,
      level,
      comsubFixed: 0,
      comsubPct: DEFAULT_RATE_BY_LEVEL[level] ?? 8,
    });
  };

  const onPrimaryLevelChange = (level) => {
    setPrimary({
      level,
      comsubPct: DEFAULT_RATE_BY_LEVEL[level] ?? details.primary.comsubPct,
    });
  };

  const addChain = () => {
    const first = chainOptions[0];
    if (!first) return;
    const level = first.level || "L2";
    patch({
      chain: [
        ...(details.chain || []),
        {
          id: `chain-${Date.now()}`,
          referrerId: first.value,
          referrerName: first.label,
          level,
          comsubFixed: 0,
          comsubPct: DEFAULT_RATE_BY_LEVEL[level] ?? 5,
        },
      ],
    });
  };

  const updateChain = (id, changes) => {
    patch({
      chain: (details.chain || []).map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...changes };
        if (changes.referrerId) {
          const opt = chainOptions.find((o) => o.value === changes.referrerId);
          next.referrerName = opt?.label || changes.referrerId;
          if (opt?.level && !changes.level) {
            next.level = opt.level;
            next.comsubPct = DEFAULT_RATE_BY_LEVEL[opt.level] ?? next.comsubPct;
          }
        }
        if (changes.level && changes.comsubPct === undefined) {
          next.comsubPct =
            DEFAULT_RATE_BY_LEVEL[changes.level] ?? next.comsubPct;
        }
        return next;
      }),
    });
  };

  const removeChain = (id) => {
    patch({ chain: (details.chain || []).filter((row) => row.id !== id) });
  };

  return (
    <div className="commission-referral-section">
      <div className="cr-header">
        <div className="cr-title-row">
          <h3>COMMISSION &amp; REFERRAL</h3>
          <span className="cr-badge">auto-filled · editable</span>
        </div>
        <p className="cr-help">
          Comsub rate auto-fills from{" "}
          <strong>{details.commissionCode || "COMM001"}</strong> (
          {details.productLabel || "Motor · All insurers"}) when you pick a
          referrer + level, and can be adjusted below. Brokerage{" "}
          <strong>{brokeragePct}%</strong> is the income from the insurer;
          comsub is payable to the referrer.
        </p>
      </div>

      <div className={`cr-row-card ${isDirect ? "is-direct" : ""}`}>
        <span className="cr-tag primary">PRIMARY</span>
        <div className="cr-row-controls">
          <Dropdown
            value={details.primary?.referrerId}
            options={primaryOptions}
            optionLabel="label"
            optionValue="value"
            onChange={(e) => onPrimaryReferrerChange(e.value)}
            className="cr-referrer-dd"
            placeholder="Select referrer"
          />
          {!isDirect && (
            <Dropdown
              value={details.primary?.level}
              options={LEVEL_OPTIONS}
              optionLabel="label"
              optionValue="value"
              onChange={(e) => onPrimaryLevelChange(e.value)}
              className="cr-level-dd"
            />
          )}
        </div>
        {isDirect ? (
          <div className="cr-direct-line">
            <em>no comsub — broker keeps the full brokerage</em>
            <span className="cr-amount">{formatBaht(0)}</span>
          </div>
        ) : (
          <div className="cr-comsub-line">
            <span className="cr-comsub-label">comsub ₱</span>
            <InputNumber
              value={details.primary?.comsubFixed ?? 0}
              onValueChange={(e) =>
                setPrimary({ comsubFixed: e.value ?? 0 })
              }
              min={0}
              className="cr-fixed-input"
            />
            <span className="cr-plus">+</span>
            <InputNumber
              value={details.primary?.comsubPct ?? 0}
              onValueChange={(e) => setPrimary({ comsubPct: e.value ?? 0 })}
              min={0}
              max={100}
              className="cr-pct-input"
            />
            <span className="cr-pct-label">% of net</span>
            <span className="cr-amount">{formatBaht(primaryComsub)}</span>
          </div>
        )}
      </div>

      {!isDirect &&
        (details.chain || []).map((row) => (
          <div className="cr-row-card" key={row.id}>
            <div className="cr-chain-head">
              <span className="cr-tag chain">CHAIN</span>
              <button
                type="button"
                className="cr-remove"
                onClick={() => removeChain(row.id)}
                aria-label="Remove chain referrer"
              >
                ×
              </button>
            </div>
            <div className="cr-row-controls">
              <Dropdown
                value={row.referrerId}
                options={chainOptions}
                optionLabel="label"
                optionValue="value"
                onChange={(e) =>
                  updateChain(row.id, { referrerId: e.value })
                }
                className="cr-referrer-dd"
              />
              <Dropdown
                value={row.level}
                options={LEVEL_OPTIONS}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => updateChain(row.id, { level: e.value })}
                className="cr-level-dd"
              />
            </div>
            <div className="cr-comsub-line">
              <span className="cr-comsub-label">comsub ₱</span>
              <InputNumber
                value={row.comsubFixed ?? 0}
                onValueChange={(e) =>
                  updateChain(row.id, { comsubFixed: e.value ?? 0 })
                }
                min={0}
                className="cr-fixed-input"
              />
              <span className="cr-plus">+</span>
              <InputNumber
                value={row.comsubPct ?? 0}
                onValueChange={(e) =>
                  updateChain(row.id, { comsubPct: e.value ?? 0 })
                }
                min={0}
                max={100}
                className="cr-pct-input"
              />
              <span className="cr-pct-label">% of net</span>
              <span className="cr-amount">
                {formatBaht(comsubAmount(row.comsubFixed, row.comsubPct, net))}
              </span>
            </div>
          </div>
        ))}

      {!isDirect && (
        <Button
          type="button"
          label="+ Add referrer (chain)"
          className="p-button-outlined cr-add-chain"
          onClick={addChain}
        />
      )}

      <div className="cr-summary">
        <div className="cr-metric">
          <span className="cr-metric-label">Brokerage</span>
          <span className="cr-metric-value brokerage">
            {formatBaht(brokerageAmount)}
          </span>
          <span className="cr-metric-sub">income</span>
        </div>
        <div className="cr-metric">
          <span className="cr-metric-label">Comsub (gross)</span>
          <span className="cr-metric-value comsub">
            {formatBaht(comsubGross)}
          </span>
          <span className="cr-metric-sub">payable</span>
        </div>
        <div className="cr-metric">
          <span className="cr-metric-label">– Discount</span>
          <span className="cr-metric-value discount">{formatBaht(disc)}</span>
          <span className="cr-metric-sub">out of broker</span>
        </div>
        <div className="cr-metric">
          <span className="cr-metric-label">Margin</span>
          <span className="cr-metric-value margin">{formatBaht(margin)}</span>
          <span className="cr-metric-sub">brk — comsub — disc</span>
        </div>
      </div>

      <p className="cr-footnote">
        Comsub is on the <strong>full net</strong> premium ({formatBaht(net)}) —
        the customer discount comes <strong>out of the broker&apos;s commission</strong>
        , not the referrer&apos;s comsub. Margin = brokerage – comsub – discount.
        Withholding tax ({formatBaht(wht)}) is deducted at payout at each referrer&apos;s configured rate → net payable {formatBaht(netPayable)}.
      </p>
    </div>
  );
};

export default CommissionReferralSection;
