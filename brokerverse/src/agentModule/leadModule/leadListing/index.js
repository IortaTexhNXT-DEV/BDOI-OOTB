import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/agentIcon/SvgDots";
import ProspectTable from "./ProspectTable";
import LeadStatsCards from "./LeadStatsCards";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { useNavigate } from "react-router-dom";
import ImportDialog from "../../../components/ImportDialog";
import leadService from "../../../services/leadService";
import CreateProspectDialog from "./CreateProspectDialog";
import useProspectStart from "./useProspectStart";

/** Bulk upload: template and importer of the API (Data, Columns and Instructions sheets; failed rows listed). */
const UPLOAD_TARGETS = [{ label: "Prospects", templatePath: "/leads/bulk-upload/template", uploadPath: "/leads/bulk-upload" }];

const LeadListing = () => {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedReportCategory, setSelectedReportCategory] = useState("All");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const toast = useRef(null);
  const navigate = useNavigate();
  const { openProduct, skipProduct, productRequired } = useProspectStart();

  const items = [
    { label: t("leads.title"), command: () => navigate("/agent/leadlisting") },
  ];
  const Initiate = { label: t("sidebar.Operations") };


  const handleBulkUploadSuccess = () => {
    // Refresh the leads table by updating key
    setRefreshKey((prev) => prev + 1);
  };

  const reportCategoryOptions = [
    { label: t("leads.allCategories"), value: "All" },
    { label: t("leads.new"), value: "New" },
    { label: t("leads.contacted"), value: "Contacted" },
    { label: t("leads.qualified"), value: "Qualified" },
    { label: t("leads.quoteGenerated"), value: "QuoteGenerated" },
    { label: t("leads.converted"), value: "Converted" },
    { label: t("leads.lost"), value: "Lost" },
    { label: t("leads.draft"), value: "Draft" },
    { label: t("leads.pendingCustomer"), value: "PendingCustomer" },
    { label: t("leads.customerAccepted"), value: "CustomerAccepted" },
    { label: t("leads.submittedToInsurer"), value: "SubmittedToInsurer" },
    { label: t("leads.approved"), value: "Approved" },
    { label: t("leads.convertedToPolicy"), value: "ConvertedToPolicy" },
    { label: t("leads.rejected"), value: "Rejected" },
    { label: t("leads.dropped"), value: "Dropped" },
  ];

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);

    try {
      const result = await leadService.generateLeadReport(
        selectedReportCategory
      );

      if (result.success) {
        toast.current.show({
          severity: "success",
          summary: t("leads.reportGenerated"),
          detail: `${t("leads.reportGeneratedDetail")}${
            selectedReportCategory ? ` ${selectedReportCategory}` : ""
          }`,
          life: 3000,
        });
        // Close modal after successful generation
        setShowReportModal(false);
        setSelectedReportCategory(null);
      } else {
        throw new Error(result.error || t("leads.reportFailedDetail"));
      }
    } catch (error) {
      toast.current.show({
        severity: "error",
        summary: t("leads.reportFailed"),
        detail:
          error.message || t("leads.reportFailedDetail"),
        life: 3000,
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleOpenReportModal = () => {
    setShowReportModal(true);
  };

  const handleCloseReportModal = () => {
    if (!isGeneratingReport) {
      setShowReportModal(false);
      setSelectedReportCategory(null);
    }
  };

  const handleReportSubmit = () => {
    handleGenerateReport();
  };

  return (
    <div className="leadlisting__overal__container">
      <Toast ref={toast} />
      <div className="grid mt-3">
        <div className="col-12 md:col-4 lg:col-4">
          <label className="leadlisting__overal__container__title">{t("leads.title")}</label>
        </div>
        <div className="col-12 md:col-8 lg:col-8">
          <div
            className="btn_lable_save_container"
            style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}
          >
            <Button
              label={t("leads.bulkUpload")}
              className="p-button-outlined"
              onClick={() => setShowBulkUpload(true)}
            />

            <Button
              label={isGeneratingReport ? t("leads.generatingReport") : t("leads.generateReport")}
              className="p-button-outlined"
              icon={
                isGeneratingReport
                  ? "pi pi-spin pi-spinner"
                  : "pi pi-file-excel"
              }
              onClick={handleOpenReportModal}
              disabled={isGeneratingReport}
              loading={isGeneratingReport}
            />
            <Button label={t("leads.createLead")} icon="pi pi-plus" onClick={() => setShowCreate(true)} />
          </div>
        </div>
      </div>
      <div>
        <BreadCrumb
          model={items}
          home={Initiate}
          className="breadCrums bg-transparent"
          separatorIcon={<SvgDot color={"#000"} />}
        />
      </div>
      <LeadStatsCards />
      <ProspectTable key={refreshKey} />
      <CreateProspectDialog visible={showCreate} onHide={() => setShowCreate(false)} onProduct={openProduct} onSkip={skipProduct} productRequired={productRequired} />
      <ImportDialog
        visible={showBulkUpload}
        onHide={() => setShowBulkUpload(false)}
        title={"Bulk upload prospects"}
        targets={UPLOAD_TARGETS}
        onDone={handleBulkUploadSuccess}
      />
      <Dialog
        visible={showReportModal}
        onHide={handleCloseReportModal}
        header={t("leads.generateReport")}
        className="report-generation-modal bv-centered"
        style={{ width: "32rem" }}
        breakpoints={{ "640px": "95vw" }}
        modal
        closable={!isGeneratingReport}
        footer={(
          <div className="flex justify-content-end gap-2">
            <Button
              label={t("common.cancel")}
              className="p-button-text"
              onClick={handleCloseReportModal}
              disabled={isGeneratingReport}
            />
            <Button
              label={t("leads.generateAndDownload")}
              icon="pi pi-file-excel"
              onClick={handleReportSubmit}
              disabled={isGeneratingReport}
              loading={isGeneratingReport}
            />
          </div>
        )}
      >
        <div className="report-generation-container">
          <div className="report-generation-content">
            <div className="form-field">
              <label htmlFor="reportCategory" className="form-label">
                {t("leads.selectReportCategory")}
              </label>
              <Dropdown
                inputId="reportCategory"
                value={selectedReportCategory}
                options={reportCategoryOptions}
                onChange={(e) => setSelectedReportCategory(e.value)}
                placeholder={t("leads.selectCategoryPlaceholder")}
                className="w-full"
                disabled={isGeneratingReport}
              />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default LeadListing;
