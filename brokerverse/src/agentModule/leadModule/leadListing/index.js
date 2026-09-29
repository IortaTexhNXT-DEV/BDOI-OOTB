import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import SvgAdd from "../../../assets/agentIcon/SvgAdd";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/agentIcon/SvgDots";
import LeadListingCard from "./leadListingCard";
import LeadStatsCards from "./LeadStatsCards";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import SvgMotor from "../../../assets/agentIcon/SvgMotor";
import { useNavigate } from "react-router-dom";
import BulkUploadModal from "./BulkUploadModal";
import SvgTravel from "../../../assets/agentIcon/SvgTravel";
import SvgHome from "../../../assets/agentIcon/SvgHome";
import SvgFire from "../../../assets/agentIcon/SvgFire";
import EmployeeBenefitIcon from "../../EmployeeFlow/EmployeeBenefitIcon";
import leadService from "../../../services/leadService";

const LeadListing = () => {
  const { t } = useTranslation();
  const [selectedOption] = useState(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedReportCategory, setSelectedReportCategory] = useState("All");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const toast = useRef(null);
  const navigate = useNavigate();

  const items = [
    { label: t("leads.title"), command: () => navigate("/agent/leadlisting") },
  ];
  const Initiate = { label: t("sidebar.Home") };

  const dropdownOptions = [
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
            handleClickMotor();
          }}
        >
          <div>
            <SvgMotor />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("dashboard.Motor")}
          </div>
        </div>
      ),
      value: "Motor",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
            handleClickFireAndAlliedPerils();
          }}
        >
          <div>
            <SvgFire />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("dashboard.Fire and Allied Perils")}
          </div>
        </div>
      ),
      value: "FireAndAlliedPerils",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
            handleClickIar();
          }}
        >
          <div>
            <SvgHome />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("dashboard.Industrial All Risks", "Industrial All Risks")}
          </div>
        </div>
      ),
      value: "IndustrialAllRisks",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
            handleClickEmployeeBenefit();
          }}
        >
          <div>
            <EmployeeBenefitIcon />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("dashboard.Employee Benefit")}
          </div>
        </div>
      ),
      value: "EmployeeBenefit",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
            // handleClickMotor();
          }}
        >
          <div>
            <SvgTravel />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("dashboard.Travel")}
          </div>
        </div>
      ),
      value: "Travel",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => {
            // handleClickMotor();
          }}
        >
          <div>
            <SvgHome />
          </div>
          <div
            style={{
              fontFamily: "Nunito, Arial, sans-serif",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("dashboard.Property")}
          </div>
        </div>
      ),
      value: "Property",
    },
  ];

  const handleClickMotor = () => {
    navigate("/agent/createlead");
  };

  const handleClickFireAndAlliedPerils = () => {
    navigate("/agent/createlead/fire-allied-perils");
  };

  const handleClickIar = () => {
    navigate("/agent/createlead/iar");
  };

  const handleClickEmployeeBenefit = () => {
    navigate("/agent/createlead/employee-benefit");
  };

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
      console.error("Generate report error:", error);
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
        <div className="col-12 md:col-6 lg:col-6">
          <label className="leadlisting__overal__container__title">{t("leads.title")}</label>
        </div>
        <div className="col-12 md:col-6 lg:col-6">
          <div
            className="btn_lable_save_container"
            style={{ display: "flex", gap: "10px" }}
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
            <Dropdown
              value={selectedOption}
              options={dropdownOptions}
              // onChange={(e) => setSelectedOption(e.value)}
              placeholder={t("leads.createLead")}
              dropdownIcon={<SvgAdd />}
            />
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
      <LeadListingCard key={refreshKey} />
      <BulkUploadModal
        visible={showBulkUpload}
        onHide={() => setShowBulkUpload(false)}
        onUploadSuccess={handleBulkUploadSuccess}
      />
      <Dialog
        visible={showReportModal}
        onHide={handleCloseReportModal}
        header={t("leads.generateReport")}
        className="report-generation-modal"
        style={{ width: "500px" }}
        modal
        closable={!isGeneratingReport}
      >
        <div className="report-generation-container">
          <div className="report-generation-content">
            <div className="form-field">
              <label htmlFor="reportCategory" className="form-label">
                {t("leads.selectReportCategory")}
              </label>
              <Dropdown
                id="reportCategory"
                value={selectedReportCategory}
                options={reportCategoryOptions}
                onChange={(e) => setSelectedReportCategory(e.value)}
                placeholder={t("leads.selectCategoryPlaceholder")}
                className="w-full"
                disabled={isGeneratingReport}
              />
              <small className="form-help-text">
                {t("leads.reportCategoryHelp")}
              </small>
            </div>
          </div>
          <div
            className="report-generation-footer"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "20px",
            }}
          >
            <Button
              label={t("common.cancel")}
              className="p-button-text"
              onClick={handleCloseReportModal}
              disabled={isGeneratingReport}
            />
            <Button
              label={
                isGeneratingReport ? t("leads.generatingReport") : t("leads.generateAndDownload")
              }
              icon={
                isGeneratingReport
                  ? "pi pi-spin pi-spinner"
                  : "pi pi-file-excel"
              }
              onClick={handleReportSubmit}
              disabled={isGeneratingReport}
              loading={isGeneratingReport}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default LeadListing;
