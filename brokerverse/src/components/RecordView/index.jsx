/**
 * The view of a master record drawn from its own add / edit form. Inside a RecordViewProvider the shared form fields
 * (InputField, DropDowns) show their label above the value as text instead of a disabled input: an empty value is a
 * dash (never the "Enter" / "Select" placeholder), a date is written dd/mm/yyyy and a choice shows its option label.
 * MasterRecordView wraps such a page for its view route and adds the record's history below it.
 *
 *   <MasterRecordView entity="master:insurance-company">
 *     <InsuranceDetailsAction action="view" />
 *   </MasterRecordView>
 *
 * The record is the route's :id, or `recordId`, or what `selectRecordId(state)` reads from the store for a view
 * opened without an id in its address.
 */
import React, { createContext, useContext } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import DetailSection from "../DetailSection";
import { RecordActivityLog } from "../ActivityLog";
import { EMPTY_VALUE } from "../KeyValueGrid/formatValue";
import { formatDate } from "../../utility/dateFormat";
import "./recordView.scss";

const RecordViewContext = createContext(false);

/** Whether the fields are shown as a record (read only, as text). */
export const useRecordView = () => useContext(RecordViewContext);

export const RecordViewProvider = ({ readOnly, children }) => (
  <RecordViewContext.Provider value={!!readOnly}>{children}</RecordViewContext.Provider>
);
RecordViewProvider.propTypes = { readOnly: PropTypes.bool, children: PropTypes.node };
RecordViewProvider.defaultProps = { readOnly: true, children: null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

/** The text of a value: a dash when empty, a date in the configured format, an object by its label or name. */
export const recordText = (value, labelKey = "label") => {
  if (value === null || value === undefined || value === "") return EMPTY_VALUE;
  if (value instanceof Date) return formatDate(value, { empty: EMPTY_VALUE });
  if (typeof value === "object") return recordText(value[labelKey] ?? value.label ?? value.name ?? value.value, labelKey);
  if (typeof value === "string" && ISO_DATE.test(value.trim())) return formatDate(value.trim(), { empty: EMPTY_VALUE });
  return String(value);
};

/** One field of a record: its label above its value. */
export const RecordValue = ({ label, value, labelKey }) => (
  <div className="bv-record-field">
    <span className="bv-record-field__label">{label}</span>
    <span className={recordText(value, labelKey) === EMPTY_VALUE ? "bv-record-field__value bv-record-field__value--empty" : "bv-record-field__value"}>
      {recordText(value, labelKey)}
    </span>
  </div>
);
RecordValue.propTypes = { label: PropTypes.node, value: PropTypes.any, labelKey: PropTypes.string };
RecordValue.defaultProps = { label: null, value: null, labelKey: "label" };

const MasterRecordView = ({ entity, recordId, selectRecordId, children }) => {
  const { t } = useTranslation();
  const { id } = useParams();
  const stored = useSelector((state) => (selectRecordId ? selectRecordId(state) : null));
  const record = recordId ?? id ?? stored;
  return (
    <RecordViewProvider readOnly>
      <div className="bv-record-view">
        {children}
        {entity && record ? (
          <DetailSection title={t("detailView.activity")} className="bv-record-view__activity">
            <RecordActivityLog entity={entity} recordId={record} />
          </DetailSection>
        ) : null}
      </div>
    </RecordViewProvider>
  );
};

MasterRecordView.propTypes = {
  /** audit trail record type: master:<type>, user, role ... */
  entity: PropTypes.string,
  recordId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** (state) => the record id, for a view without :id in its address */
  selectRecordId: PropTypes.func,
  children: PropTypes.node,
};
MasterRecordView.defaultProps = { entity: null, recordId: null, selectRecordId: null, children: null };

export default MasterRecordView;
