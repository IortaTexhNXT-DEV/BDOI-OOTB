import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { InputTextarea } from "primereact/inputtextarea";
import KeyValueGrid from "../../../components/KeyValueGrid";

const GenericRiskConfigPlaceholder = ({ mapping, onSave }) => {
  const { t } = useTranslation();
  const [configText, setConfigText] = useState(
    JSON.stringify(mapping.configuration || { type: mapping.lobCode }, null, 2)
  );
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSave = async () => {
    setLocalError("");
    setSaving(true);
    try {
      let configuration;
      try {
        configuration = JSON.parse(configText);
      } catch {
        setLocalError(
          t("productRiskMapping.invalidJson", "Configuration must be valid JSON")
        );
        return;
      }
      if (!configuration?.type) {
        configuration = { ...configuration, type: mapping.lobCode };
      }
      await onSave({ configuration });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="mt-0">
        {t("productRiskMapping.configuration", "Configuration")}
      </h3>
      <KeyValueGrid columns={2} className="mb-3" items={[
        { label: t("productRiskMapping.definition", "Definition"), value: mapping.definitionLabel },
        { label: t("productRiskMapping.usedBy", "Used by"), value: t("productRiskMapping.referenceOnly", "Reference only") },
      ]} />
      {localError ? (
        <Message className="w-full mb-3" severity="error" text={localError} />
      ) : null}
      <div className="field">
        <label htmlFor="rm-config">
          {t("productRiskMapping.typedConfig", "Typed configuration (JSON)")}
        </label>
        <InputTextarea
          id="rm-config"
          className="w-full"
          rows={14}
          style={{ minHeight: "16rem", fontFamily: "monospace" }}
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
        />
      </div>
      <Button
        label={t("productRiskMapping.saveConfig", "Save configuration")}
        loading={saving}
        onClick={handleSave}
      />
    </div>
  );
};

export default GenericRiskConfigPlaceholder;
