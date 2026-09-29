import { Card } from "primereact/card";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PolicyTable from "../policyModule/policyTable/index";
import "../claimModule/index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import SvgDot from "../../assets/agentIcon/SvgDots";
import SvgMotor from "../../assets/agentIcon/SvgMotor";
import SvgFire from "../../assets/agentIcon/SvgFire";
import SvgAdd from "../../assets/agentIcon/SvgAdd";
import BulkUploadModal from "./BulkUploadModal";
import { useLocation, useNavigate } from "react-router-dom";

const ClientListingCard = () => {
  const { t } = useTranslation();
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const navigate = useNavigate();
  const { state } = useLocation();
  const [displayDialog, setDisplayDialog] = useState({
    display: false,
    policyId: null,
  });
  const items = [{ label: t("policyList.policy"), url: "/agent/clientlisting" }];
  const Initiate = { label: t("policyList.home") };

  const handleBulkUploadSuccess = () => {
    // Refresh the policies table by updating key
    setRefreshKey((prev) => prev + 1);
  };

  const handleCreatePolicy = () => {
    // Navigate to lead listing to select a lead for policy creation
    navigate("/agent/leadlisting");
  };

  const dropdownOptions = [
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => handleCreatePolicy()}
        >
          <div>
            <SvgMotor />
          </div>
          <div
            style={{
              fontFamily: "Inter var",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("policyList.motorPolicy")}
          </div>
        </div>
      ),
      value: "Motor",
    },
    {
      label: (
        <div
          style={{ display: "flex", alignItems: "center", gap: "10px" }}
          onClick={() => handleCreatePolicy()}
        >
          <div>
            <SvgFire />
          </div>
          <div
            style={{
              fontFamily: "Inter var",
              fontWeight: 400,
              fontSize: "16px",
              color: "#111927",
              width: "100%",
            }}
          >
            {t("policyList.fireAndAlliedPerils")}
          </div>
        </div>
      ),
      value: "FireAndAlliedPerils",
    },
  ];

  useEffect(() => {
    if (state?.showEndorsementDialog) {
      setDisplayDialog({
        display: true,
        policyId: state.policyId,
        lob: state.productType || state.lob,
        productType: state.productType || state.lob,
      });
    }
  }, [state?.showEndorsementDialog, state?.policyId, state?.productType, state?.lob]);

  return (
    <div className="policy__table__container mt-4">
      <div class="grid mt-3">
        <div class="col-12 md:col-6 lg:col-6">
          <label className="leadlisting__overal__container__title">
            {t("policyList.title")}
          </label>
          <div className="mt-3">
            <BreadCrumb
              model={items}
              home={Initiate}
              className="breadCrums"
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
        <div class="col-12 md:col-6 lg:col-6">
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Button
              label={t("policies.bulkUpload")}
              className="p-button-outlined"
              onClick={() => setShowBulkUpload(true)}
            />
            <Dropdown
              value={selectedOption}
              options={dropdownOptions}
              placeholder={t("policies.createPolicy")}
              dropdownIcon={<SvgAdd />}
            />
          </div>
        </div>

        {/* Policy Statistics Cards */}
        {/* <div className="col-12">
          <PolicyStatsCards />
        </div> */}

        <div className="card__container__outer">
          <Card style={{ borderRadius: "20px" }}>
            <PolicyTable
              key={refreshKey}
              setDisplayDialog={setDisplayDialog}
              displayDialog={displayDialog}
            />
          </Card>
        </div>
      </div>
      <BulkUploadModal
        visible={showBulkUpload}
        onHide={() => setShowBulkUpload(false)}
        onUploadSuccess={handleBulkUploadSuccess}
      />
    </div>
  );
};

export default ClientListingCard;
