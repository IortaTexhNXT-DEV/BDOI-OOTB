import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { BreadCrumb } from "primereact/breadcrumb";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import SvgDot from "../../../assets/icons/SvgDot";
import reportsService from "../../../services/reportsService";
import ReportScreen from "../ReportScreen";
import "../ReportScreen/index.scss";
import { FieldsSkeleton } from "../../../components/Skeletons";

const GROUPS = [
  ["operational", "Operational Reports"],
  ["financial", "Financial Reports"],
];

/**
 * Reports > All Reports: every report of the catalogue the signed-in user's roles may run (GET /reports filters by role
 * and permission), grouped by category; each opens the report screen (/reports/run/:code).
 */
export const ReportCatalogue = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reports, setReports] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    reportsService
      .getCatalogue()
      .then(setReports)
      .catch((e) => setError(e.message));
  }, []);

  const term = search.trim().toLowerCase();
  const visible = (reports || []).filter((r) => !term || `${r.name} ${r.description || ""}`.toLowerCase().includes(term));

  return (
    <div className="report-screen report-catalogue">
      <div className="report-screen__header">
        <div>
          <h1 className="page-title">{t("reports.heading")}</h1>
          <BreadCrumb model={[{ label: "All Reports" }]} home={{ label: t("reports.heading") }} separatorIcon={<SvgDot color={"#000"} />} />
        </div>
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports" aria-label="Search reports" />
        </span>
      </div>
      {error && <Message severity="warn" text={error} className="w-full mb-3" />}
      {!reports && !error && <FieldsSkeleton rows={4} columns={3} />}
      {reports &&
        GROUPS.map(([category, label]) => {
          const list = visible.filter((r) => r.category === category);
          if (!list.length) return null;
          return (
            <section key={category} className="report-catalogue__group">
              <h2 className="report-catalogue__group-title">{label}</h2>
              <div className="report-catalogue__grid">
                {list.map((r) => (
                  <button key={r.code} type="button" className="report-catalogue__item" onClick={() => navigate(`/reports/run/${r.code}`)}>
                    <span className="report-catalogue__name">{r.name}</span>
                    <span className="report-catalogue__text">{r.description}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      {reports && !visible.length && <Message severity="info" text="No reports match your search." />}
    </div>
  );
};

/** /reports/run/:code - one catalogue report. */
export const ReportRunner = () => {
  const { code } = useParams();
  return <ReportScreen code={code} group="All Reports" groupPath="/reports/catalogue" />;
};

export default ReportCatalogue;
