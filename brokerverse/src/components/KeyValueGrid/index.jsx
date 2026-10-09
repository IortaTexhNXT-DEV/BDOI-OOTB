/**
 * Facts of a record as a grid of label above value: 2, 3 or 4 columns (two on a tablet, one on a phone; `auto` fits as
 * many as the width allows), the same type on every detail view. An empty value shows "—"; amounts, numbers and dates
 * are formatted by `type` (./formatValue).
 *
 *   <KeyValueGrid columns={3} items={[
 *     { label: dateLabel, value: r.remittanceDate, type: "date" },
 *     { label: netAmountLabel, value: r.netAmount, type: "amount" },
 *     { label: remarksLabel, value: r.remarks, span: "full" },
 *   ]} />
 */
import React from "react";
import PropTypes from "prop-types";
import { formatValue, isEmptyValue, NUMERIC_TYPES } from "./formatValue";
import "./keyValueGrid.scss";

const cx = (...names) => names.filter(Boolean).join(" ");

const KeyValueGrid = ({ items, columns, className }) => (
  <dl className={cx("bv-kv", `bv-kv--cols-${columns}`, className)}>
    {items
      .filter((item) => item && !item.hidden)
      .map((item, i) => (
        <div key={item.key || (typeof item.label === "string" ? item.label : i)}
          className={cx("bv-kv__item", item.span === "full" && "bv-kv__item--full", item.span === 2 && "bv-kv__item--span-2")}>
          <dt className="bv-kv__label">{item.label}</dt>
          <dd className={cx("bv-kv__value", NUMERIC_TYPES.has(item.type) && "bv-kv__value--num", isEmptyValue(item.value) && "bv-kv__value--empty")}>
            {formatValue(item.value, item)}
          </dd>
        </div>
      ))}
  </dl>
);

export const itemShape = PropTypes.shape({
  label: PropTypes.node.isRequired,
  /** the value, or a node (a status chip, a link) */
  value: PropTypes.any,
  /** text (default), amount, number, percent, date, datetime, boolean */
  type: PropTypes.string,
  currency: PropTypes.string,
  decimals: PropTypes.number,
  /** 2: two columns; "full": the whole row (remarks, addresses) */
  span: PropTypes.oneOf([2, "full"]),
  hidden: PropTypes.bool,
  key: PropTypes.string,
});

KeyValueGrid.propTypes = {
  items: PropTypes.arrayOf(itemShape).isRequired,
  columns: PropTypes.oneOf([2, 3, 4, "auto"]),
  className: PropTypes.string,
};

KeyValueGrid.defaultProps = { columns: 3, className: null };

export { formatValue, EMPTY_VALUE } from "./formatValue";
export default KeyValueGrid;
