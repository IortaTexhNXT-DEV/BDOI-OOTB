import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import { Message } from "primereact/message";
import productConfiguratorService from "../../../services/productConfiguratorService";
import IarRiskSectionsEditor from "./IarRiskSectionsEditor";
import GenericRiskConfigPlaceholder from "./GenericRiskConfigPlaceholder";
import { ConfiguratorPage, StatusTag } from "../shared/ConfiguratorPage";
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

  const back = <Button label={t("productRiskMapping.back")} icon="pi pi-arrow-left" className="p-button-text" onClick={() => navigate("/product-configurator/risk-mapping")} />;

  if (!mapping) {
    return (
      <ConfiguratorPage screen="riskMapping" actions={back}>
        <Toast ref={toast} />
        {loading ? <p>{t("productRiskMapping.loading")}</p> : <Message severity="warn" text={t("productRiskMapping.notFound")} />}
      </ConfiguratorPage>
    );
  }

  const isIar = mapping.definitionType === "RISK_SECTIONS";

  return (
    <ConfiguratorPage screen="riskMapping" actions={back}>
      <Toast ref={toast} />
      <div className="flex align-items-center gap-2 mb-2 flex-wrap">
        <h2 className="m-0">{mapping.productCode} · {mapping.productName}</h2>
        <StatusTag status={mapping.status} />
      </div>
      <p className="pc-muted mb-4">
        {mapping.lineOfBusiness || mapping.lobCode} · {t("productRiskMapping.definedBy")} {(mapping.definitionLabel || "").toLowerCase()}.
      </p>
      {isIar ? (
        <IarRiskSectionsEditor mapping={mapping} onReload={load} toastRef={toast} />
      ) : (
        <GenericRiskConfigPlaceholder mapping={mapping} onSave={handleUpdateMapping} />
      )}
    </ConfiguratorPage>
  );
};

export default RiskMappingDetail;
