import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { InputTextarea } from "primereact/inputtextarea";

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
      <p className="text-color-secondary mb-3">
        {t(
          "productRiskMapping.genericHelp",
          "Definition: {{definition}}. Configuration for this LOB will be defined here and integrated into create-lead later.",
          { definition: mapping.definitionLabel }
        )}
      </p>
      <Message
        className="w-full mb-3"
        severity="info"
        text={t(
          "productRiskMapping.notIntegrated",
          "Not integrated into create-lead / quote flows yet."
        )}
      />
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
          rows={8}
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
