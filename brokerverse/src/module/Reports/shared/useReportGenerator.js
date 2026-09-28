import { useEffect, useState } from "react";
import reportsService from "../../../services/reportsService";

const pad = (n) => String(n).padStart(2, "0");

const toIsoDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const toReportParams = (values) => ({
  ...values,
  FromDate: toIsoDate(values.FromDate),
  ToDate: toIsoDate(values.ToDate),
});

const openDownload = (url) => {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const showError = (toastRef, error) =>
  toastRef.current?.showToast({ severity: "error", detail: error.message });

/** Agent / Company / Branch / Client dropdown options for the report filter forms. */
export const useReportFilterOptions = (toastRef) => {
  const [options, setOptions] = useState({
    AgentCode: [],
    CompanyCode: [],
    BranchCode: [],
    ClientCode: [],
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      reportsService.getAgentOptions(),
      reportsService.getInsuranceCompanyOptions(),
      reportsService.getBranchOptions(),
      reportsService.getClientOptions(),
    ])
      .then(([AgentCode, CompanyCode, BranchCode, ClientCode]) => {
        if (active) setOptions({ AgentCode, CompanyCode, BranchCode, ClientCode });
      })
      .catch((error) => active && showError(toastRef, error));
    return () => {
      active = false;
    };
  }, [toastRef]);

  return options;
};

/** Generates the report file on the server and opens its signed download link. */
export const useReportGenerator = (code, toastRef, format = "xlsx") => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = async (values) => {
    setIsGenerating(true);
    try {
      const report = await reportsService.generateReport(code, toReportParams(values), format);
      toastRef.current?.showToast();
      openDownload(report.downloadUrl);
    } catch (error) {
      showError(toastRef, error);
    } finally {
      setIsGenerating(false);
    }
  };

  return { generate, isGenerating };
};
