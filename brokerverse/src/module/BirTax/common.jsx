import React from "react";
import { useTranslation } from "react-i18next";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import SharedPageHeader from "../../components/PageHeader";
import StatusChip from "../../components/StatusChip";
import { date, money, showError, showSuccess } from "../PeriodEnd/common";
import "../PeriodEnd/index.scss";

export { date, money, showError, showSuccess };

/** Page header with the Accounts > Tax breadcrumb (or the given section); `subtitle` is the help behind the info icon. */
export const PageHeader = ({ section, ...props }) => {
  const { t } = useTranslation();
  return <SharedPageHeader home={t("periodEnd.accounts")} {...props} section={section || t("periodEnd.tax")} />;
};

const SEVERITY = {
  filed: "success", not_filed: "warning", superseded: "secondary", cancelled: "secondary", issued: "success", posted: "success",
  queued: "info", sending: "info", accepted: "success", rejected: "danger", failed: "danger", manual: "success", printed: "success", voided: "secondary",
  draft: "info", submitted: "warning", approved: "success", partially_settled: "warning", settled: "secondary", active: "success", inactive: "secondary",
};
/** Status chip (the shared StatusChip) with a translated label (birTax.status.<status>). */
export const BirTag = ({ status }) => {
  const { t } = useTranslation();
  if (!status) return null;
  return <StatusChip code={status} label={t(`birTax.status.${status}`, { defaultValue: String(status).replace(/[_-]/g, " ") })} severity={SEVERITY[status] || "info"} />;
};

/** Roles that see the technical details of the tax files and e-invoices (file content, payloads), besides administrators. */
export const TECHNICAL_ROLES = ["accounting", "tis-finance", "tis-it-admin"];

const thisYear = () => new Date().getFullYear();
export const yearOptions = (back = 5) => Array.from({ length: back + 1 }, (_, i) => thisYear() + 1 - i).map((y) => ({ label: String(y), value: y }));
export const quarterOptions = [1, 2, 3, 4].map((q) => ({ label: `Q${q}`, value: q }));
export const currentQuarter = () => Math.floor(new Date().getMonth() / 3) + 1;

export const YearPicker = ({ value, onChange }) => <Dropdown value={value} options={yearOptions()} onChange={(e) => onChange(e.value)} aria-label="Year" />;
export const QuarterPicker = ({ value, onChange }) => <Dropdown value={value} options={quarterOptions} onChange={(e) => onChange(e.value)} aria-label="Quarter" />;

/** Value of a schedule cell by the column type. */
export const cellValue = (row, c) => {
  const v = row[c.key];
  if (v === null || v === undefined || v === "") return "";
  if (c.type === "money") return money(v);
  if (c.type === "date") return date(v);
  if (c.type === "number") return Number(v).toLocaleString("en-PH", { maximumFractionDigits: 4 });
  return String(v);
};
const numeric = (c) => ["money", "number", "integer"].includes(c.type);

/** One schedule of a return or a book: columns from the server, totals in the footer. */
export const ScheduleTable = ({ schedule, paginator = true }) => {
  const { t } = useTranslation();
  return (
    <DataTable value={schedule.rows} size="small" stripedRows paginator={paginator && schedule.rows.length > 15} rows={15} emptyMessage={t("birTax.noRows")} scrollable>
      {schedule.columns.map((c, i) => (
        <Column key={c.key} header={c.label} body={(r) => cellValue(r, c)} className={numeric(c) ? "bv-num" : undefined} headerClassName={numeric(c) ? "bv-num" : undefined}
          footer={i === 0 ? t("birTax.total") : schedule.totals && schedule.totals[c.key] !== undefined ? money(schedule.totals[c.key]) : ""} footerClassName={numeric(c) ? "bv-num" : undefined} />
      ))}
    </DataTable>
  );
};

/** Key figures row. */
export const Kpis = ({ items }) => (
  <div className="pe-kpis">
    {items.map((k) => (
      <div className="pe-kpi" key={k.label}><div className="pe-kpi-label">{k.label}</div><div className="pe-kpi-value">{k.value}</div></div>
    ))}
  </div>
);
