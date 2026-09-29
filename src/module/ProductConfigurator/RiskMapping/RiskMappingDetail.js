import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { Message } from "primereact/message";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import productConfiguratorService from "../../../services/productConfiguratorService";
import IarRiskSectionsEditor from "./IarRiskSectionsEditor";
import GenericRiskConfigPlaceholder from "./GenericRiskConfigPlaceholder";
import "./RiskMapping.scss";

const RiskMappingDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useRef(null);
  const [mapping, setMapping] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await productConfiguratorService.getRiskMappingById(id);
      setMapping(data);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("productRiskMapping.error", "Error"),
        detail:
          error.message ||
          t("productRiskMapping.failedLoadDetail", "Failed to load product"),
      });
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpdateMapping = async (payload) => {
    try {
      const data = await productConfiguratorService.updateRiskMapping(id, payload);
      setMapping(data);
      toast.current?.show({
        severity: "success",
        summary: t("productRiskMapping.success", "Success"),
        detail: t("productRiskMapping.updated", "Product updated"),
      });
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("productRiskMapping.error", "Error"),
        detail: error.message,
      });
    }
  };

  if (!mapping && loading) {
    return (
      <div className="risk-mapping-detail p-3">
        <Card>{t("productRiskMapping.loading", "Loading...")}</Card>
      </div>
    );
  }

  if (!mapping) {
    return (
      <div className="risk-mapping-detail p-3">
        <Toast ref={toast} />
        <Card>
          <Button
            label={t("productRiskMapping.back", "← Products")}
            className="p-button-text mb-3"
            onClick={() => navigate("/product-configurator/risk-mapping")}
          />
          <Message
            severity="warn"
            text={t("productRiskMapping.notFound", "Product not found")}
          />
        </Card>
      </div>
    );
  }

  const isIar = mapping.definitionType === "RISK_SECTIONS";

  return (
    <div className="risk-mapping-detail p-3">
      <Toast ref={toast} />
      <ConfirmDialog />
      <Card>
        <Button
          label={t("productRiskMapping.back", "← Products")}
          className="p-button-text mb-3"
          onClick={() => navigate("/product-configurator/risk-mapping")}
        />
        <div className="flex align-items-center gap-2 mb-2 flex-wrap">
          <h2 className="m-0">{mapping.productName}</h2>
          <Tag
            value={mapping.status}
            severity={mapping.status === "Active" ? "success" : "warning"}
          />
        </div>
        <p className="text-color-secondary mb-4">
          {mapping.productCode} · {mapping.lineOfBusiness} ·{" "}
          {t("productRiskMapping.definedBy", "defined by")}{" "}
          {(mapping.definitionLabel || "").toLowerCase()}.
        </p>

        {isIar ? (
          <IarRiskSectionsEditor
            mapping={mapping}
            onReload={load}
            toastRef={toast}
            confirmDialog={confirmDialog}
          />
        ) : (
          <GenericRiskConfigPlaceholder
            mapping={mapping}
            onSave={handleUpdateMapping}
          />
        )}
      </Card>
    </div>
  );
};

export default RiskMappingDetail;
