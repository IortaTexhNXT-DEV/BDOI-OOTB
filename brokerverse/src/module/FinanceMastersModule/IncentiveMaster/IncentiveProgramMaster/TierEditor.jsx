import { useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { InputText } from "primereact/inputtext";
import KeyValueGrid from "../../../../components/KeyValueGrid";
import "./TierEditor.scss";

const TIER_TYPE = { fixed: "Fixed Amount", perUnit: "Fixed Amount", percentOfAchieved: "Percentage", percentOfTarget: "Percentage" };

/** The payout bases a measure offers: a % of the premium achieved for premium, an amount per policy for a count. */
export const basesFor = (metric) => {
  if (metric === "premium") return ["percentOfAchieved", "fixed"];
  if (metric === "policies") return ["perUnit", "fixed"];
  return ["fixed"];
};

/** Bands are a count of policies for the policy count measure and a % of the target otherwise. */
export const bandKind = (metric, structure = []) => {
  const first = structure.find((tier) => tier.level);
  if (first) return String(first.level).includes("%") ? "percent" : "count";
  return metric === "policies" ? "count" : "percent";
};

// the same reading of an achievement band as the server: "80-90%", "110%+", "0-10 policies", "31+"
const parseLevel = (level) => {
  const s = String(level || "");
  const range = s.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
  if (range) return { from: Number(range[1]), to: Number(range[2]) };
  const plus = s.match(/(\d+(?:\.\d+)?)\s*%?\s*\+/);
  if (plus) return { from: Number(plus[1]), to: null };
  return { from: null, to: null };
};

const basisOf = (tier, metric) => {
  if (tier.basis) return tier.basis;
  if (tier.type === "Percentage") return metric === "premium" ? "percentOfAchieved" : "percentOfTarget";
  return metric === "policies" ? "perUnit" : "fixed";
};

const levelOf = (row, kind) => {
  if (row.from == null) return "";
  const unit = kind === "percent" ? "%" : "";
  return row.to == null ? `${row.from}${unit}+` : `${row.from}-${row.to}${unit}`;
};

const toRows = (structure, metric) => structure.map((tier) => ({
  name: tier.name || "", ...parseLevel(tier.level), level: tier.level, basis: basisOf(tier, metric),
  value: tier.value ?? null, maxPayout: tier.maxPayout ?? null,
}));

// a band keeps its stored wording ("0-10 policies") until its limits change
const toStructure = (rows, kind) => rows.map((row) => {
  const same = row.level && (() => { const p = parseLevel(row.level); return p.from === row.from && p.to === row.to; })();
  return {
    ...(row.name ? { name: row.name } : {}), level: same ? row.level : levelOf(row, kind), basis: row.basis,
    type: TIER_TYPE[row.basis], value: row.value, maxPayout: row.maxPayout,
  };
});

/**
 * The first problem of a tier list, as the server checks it: limits and a payout on every tier, ascending bands each
 * starting where the one before ends (a % band shares the edge, a count follows on by one), and an open band only
 * at the top. Returns { index, key, values } or null.
 */
export const tierProblem = (structure, kind) => {
  const rows = structure.map((tier) => parseLevel(tier.level));
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    if (r.from == null) return { index: i, key: "tierFromRequired" };
    if (r.to != null && r.to < r.from) return { index: i, key: "tierToBelowFrom" };
    if (structure[i].value == null) return { index: i, key: "tierValueRequired" };
    if (i > 0) {
      const prev = rows[i - 1];
      if (prev.to == null) return { index: i, key: "tierOpenNotLast" };
      const expected = kind === "percent" ? prev.to : prev.to + 1;
      if (r.from < expected) return { index: i, key: "tierOverlap" };
      if (r.from > expected) return { index: i, key: "tierGap", values: { from: prev.to, to: r.from } };
    }
  }
  return null;
};

/** What a tier list pays for an achievement (a % of the target or a count), by the rules of the server. */
export const previewPayout = (structure, kind, achievement, target) => {
  const count = kind === "count" ? achievement : null;
  const pct = kind === "percent" ? achievement : null;
  const hit = [...structure].reverse().find((tier) => {
    const r = parseLevel(tier.level);
    const x = kind === "percent" ? pct : count;
    if (r.from == null || x == null || x < r.from) return false;
    return r.to == null || x < r.to || (kind === "count" && x === r.to);
  });
  if (!hit) return { tier: null, amount: 0 };
  const achieved = kind === "percent" ? (Number(target) || 0) * pct / 100 : count;
  const value = Number(hit.value) || 0;
  let amount = value;
  if (hit.basis === "percentOfAchieved") amount = achieved * value / 100;
  else if (hit.basis === "percentOfTarget") amount = (Number(target) || 0) * value / 100;
  else if (hit.basis === "perUnit") amount = value * achieved;
  if (hit.maxPayout) amount = Math.min(amount, Number(hit.maxPayout));
  return { tier: hit, amount: Math.round(amount * 100) / 100 };
};

/**
 * The tiers of an incentive program: one row per tier with its name, achievement band (from and to, a % of the target
 * or a count of policies; an empty "to" leaves the top band open), how it pays and the maximum payout, and a preview
 * of the payout for a sample achievement.
 */
const TierEditor = ({ value, onChange, metric, target, error }) => {
  const { t } = useTranslation();
  const k = (key, opts) => t(`incentiveProgramMaster.${key}`, opts);
  const [rows, setRows] = useState(() => toRows(value || [], metric));
  const [sample, setSample] = useState(null);
  const kind = bandKind(metric, value || []);
  const bases = basesFor(metric);
  const basisOptions = [...new Set([...bases, ...rows.map((r) => r.basis)])].map((b) => ({ value: b, label: k(`basis.${b}`) }));

  const update = (next) => {
    setRows(next);
    onChange(toStructure(next, kind));
  };
  const setCell = (i, field, v) => update(rows.map((r, j) => (j === i ? { ...r, [field]: v } : r)));
  const add = () => {
    const last = rows[rows.length - 1];
    const from = last ? (last.to == null ? null : (kind === "percent" ? last.to : last.to + 1)) : 0;
    update([...rows, { name: "", from, to: null, level: "", basis: bases[0], value: null, maxPayout: null }]);
  };
  const remove = (i) => update(rows.filter((_, j) => j !== i));

  const structure = toStructure(rows, kind);
  const problem = tierProblem(structure, kind);
  const unit = kind === "percent" ? "%" : "";
  const preview = sample == null || problem ? null : previewPayout(structure, kind, sample, target);
  const isPercentBasis = (b) => TIER_TYPE[b] === "Percentage";

  return (
    <div className="ipm-tiers">
      <table className="ipm-tiers__table">
        <thead>
          <tr>
            <th>{k("tierName")}</th>
            <th className="ipm-tiers__num">{kind === "percent" ? k("bandFromPercent") : k("bandFromCount")}</th>
            <th className="ipm-tiers__num">{kind === "percent" ? k("bandToPercent") : k("bandToCount")}</th>
            <th>{k("payoutBasis")}</th>
            <th className="ipm-tiers__num">{k("payoutValue")}</th>
            <th className="ipm-tiers__num">{k("maxPayout")}</th>
            <th aria-label={k("actions")} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={problem && problem.index === i ? "ipm-tiers__row--invalid" : undefined}>
              <td>
                <InputText value={r.name} onChange={(e) => setCell(i, "name", e.target.value)} placeholder={k("tierNumber", { n: i + 1 })}
                  aria-label={k("tierName")} />
              </td>
              <td>
                <InputNumber value={r.from} onValueChange={(e) => setCell(i, "from", e.value)} min={0} maxFractionDigits={kind === "percent" ? 2 : 0}
                  suffix={unit} inputClassName="ipm-tiers__input-num" aria-label={k("bandFrom")} />
              </td>
              <td>
                <InputNumber value={r.to} onValueChange={(e) => setCell(i, "to", e.value)} min={0} maxFractionDigits={kind === "percent" ? 2 : 0}
                  suffix={unit} placeholder={i === rows.length - 1 ? k("andAbove") : undefined} inputClassName="ipm-tiers__input-num" aria-label={k("bandTo")} />
              </td>
              <td>
                <Dropdown value={r.basis} options={basisOptions} onChange={(e) => setCell(i, "basis", e.value)} aria-label={k("payoutBasis")} />
              </td>
              <td>
                <InputNumber value={r.value} onValueChange={(e) => setCell(i, "value", e.value)} min={0} minFractionDigits={isPercentBasis(r.basis) ? 0 : 2}
                  maxFractionDigits={2} suffix={isPercentBasis(r.basis) ? "%" : undefined} inputClassName="ipm-tiers__input-num" aria-label={k("payoutValue")} />
              </td>
              <td>
                <InputNumber value={r.maxPayout} onValueChange={(e) => setCell(i, "maxPayout", e.value)} min={0} minFractionDigits={2} maxFractionDigits={2}
                  inputClassName="ipm-tiers__input-num" aria-label={k("maxPayout")} />
              </td>
              <td>
                <Button type="button" icon="pi pi-trash" text rounded onClick={() => remove(i)} aria-label={k("removeTier")} tooltip={k("removeTier")} />
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr><td colSpan={7} className="ipm-tiers__empty">{k("noTiers")}</td></tr>
          ) : null}
        </tbody>
      </table>
      <div className="ipm-tiers__footer">
        <Button type="button" label={k("addTier")} icon="pi pi-plus" outlined onClick={add} disabled={rows.length > 0 && rows[rows.length - 1].to == null} />
        {problem ? <small className="p-error">{k("tierRow", { n: problem.index + 1 })}: {k(problem.key, problem.values)}</small> : null}
        {!problem && error ? <small className="p-error">{error}</small> : null}
      </div>
      {rows.length ? (
        <div className="ipm-tiers__preview">
          <div className="ipm-tiers__sample">
            <label htmlFor="ipm-sample">{kind === "percent" ? k("sampleAchievementPercent") : k("sampleAchievementCount")}</label>
            <InputNumber inputId="ipm-sample" value={sample} onValueChange={(e) => setSample(e.value)} min={0} maxFractionDigits={2} suffix={unit}
              inputClassName="ipm-tiers__input-num" />
          </div>
          <KeyValueGrid columns={2} items={[
            { label: k("previewTier"), value: preview ? (preview.tier ? preview.tier.name || preview.tier.level : k("noTierReached")) : null },
            { label: k("previewPayout"), value: preview ? preview.amount : null, type: "amount" },
          ]} />
        </div>
      ) : null}
    </div>
  );
};

TierEditor.propTypes = {
  value: PropTypes.arrayOf(PropTypes.object),
  onChange: PropTypes.func.isRequired,
  metric: PropTypes.string,
  target: PropTypes.number,
  error: PropTypes.string,
};

TierEditor.defaultProps = { value: [], metric: "", target: null, error: null };

export default TierEditor;
