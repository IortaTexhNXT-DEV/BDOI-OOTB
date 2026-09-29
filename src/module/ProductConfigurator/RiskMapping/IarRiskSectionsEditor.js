import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import productConfiguratorService from "../../../services/productConfiguratorService";

const IarRiskSectionsEditor = ({ mapping, onReload, toastRef, confirmDialog }) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState([]);
  const [sectionCode, setSectionCode] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [defaultRatePercent, setDefaultRatePercent] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadOptions = async () => {
    try {
      const data = await productConfiguratorService.getRiskSectionOptions(
        mapping.id
      );
      setOptions(
        (Array.isArray(data) ? data : []).map((o) => ({
          label: o.sectionLabel,
          value: o.sectionCode,
        }))
      );
    } catch (error) {
      toastRef.current?.show({
        severity: "error",
        summary: t("productRiskMapping.error", "Error"),
        detail: error.message,
      });
    }
  };

  useEffect(() => {
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapping.id, mapping.sectionCount]);

  const handleAdd = async () => {
    if (!sectionCode) {
      toastRef.current?.show({
        severity: "warn",
        summary: t("productRiskMapping.validation", "Validation"),
        detail: t(
          "productRiskMapping.selectSection",
          "Select a section to add"
        ),
      });
      return;
    }
    setSaving(true);
    try {
      await productConfiguratorService.addRiskSection(mapping.id, {
        sectionCode,
        remarks: remarks || undefined,
        defaultRatePercent:
          defaultRatePercent !== null && defaultRatePercent !== undefined
            ? defaultRatePercent
            : undefined,
      });
      setSectionCode(null);
      setRemarks("");
      setDefaultRatePercent(null);
      toastRef.current?.show({
        severity: "success",
        summary: t("productRiskMapping.success", "Success"),
        detail: t("productRiskMapping.sectionAdded", "Section added"),
      });
      await onReload();
    } catch (error) {
      toastRef.current?.show({
        severity: "error",
        summary: t("productRiskMapping.error", "Error"),
        detail: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (section) => {
    confirmDialog({
      message: t(
        "productRiskMapping.confirmRemove",
        "Remove section {{name}}? It will be deactivated (soft delete).",
        { name: section.sectionLabel }
      ),
      header: t("productRiskMapping.confirmHeader", "Confirm"),
      icon: "pi pi-exclamation-triangle",
      acceptClassName: "p-button-danger",
      accept: async () => {
        try {
          await productConfiguratorService.deactivateRiskSection(
            mapping.id,
            section.id
          );
          toastRef.current?.show({
            severity: "success",
            summary: t("productRiskMapping.success", "Success"),
            detail: t("productRiskMapping.sectionRemoved", "Section removed"),
          });
          await onReload();
        } catch (error) {
          toastRef.current?.show({
            severity: "error",
            summary: t("productRiskMapping.error", "Error"),
            detail: error.message,
          });
        }
      },
    });
  };

  const activeSections = (mapping.sections || []).filter((s) => s.isActive);

  return (
    <div>
      <h3 className="mt-0">
        {t("productRiskMapping.riskSectionsTitle", "Risk Sections")}
      </h3>
      <p className="text-color-secondary">
        {t(
          "productRiskMapping.riskSectionsHelp",
          "An IAR policy is made of many independent sections. Define which sections this product offers. Risk location, perils and sums insured are captured per section when quoting."
        )}
      </p>

      <div
        className="iar-section-add-row mb-3"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          width: "100%",
          gap: 16,
        }}
      >
        <div
          className="iar-section-add-field"
          style={{ flex: "1 1 0", minWidth: 140 }}
        >
          <label className="font-bold">
            {t("productRiskMapping.addSection", "Add section")}
          </label>
          <Dropdown
            className="w-full"
            value={sectionCode}
            options={options}
            onChange={(e) => setSectionCode(e.value)}
            placeholder={t(
              "productRiskMapping.selectSectionPh",
              "Select section"
            )}
          />
        </div>
        <div
          className="iar-section-add-field"
          style={{ flex: "1 1 0", minWidth: 140 }}
        >
          <label className="font-bold">
            {t("productRiskMapping.remarks", "Remarks")}
          </label>
          <InputText
            className="w-full"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
        <div
          className="iar-section-add-field"
          style={{ flex: "1 1 0", minWidth: 140 }}
        >
          <label className="font-bold">
            {t("productRiskMapping.defaultRate", "Default rate %")}
          </label>
          <InputNumber
            className="w-full"
            value={defaultRatePercent}
            onValueChange={(e) => setDefaultRatePercent(e.value)}
            minFractionDigits={0}
            maxFractionDigits={4}
            min={0}
          />
        </div>
        <div style={{ flexShrink: 0, paddingTop: 4 }}>
          <Button
            label={t("productRiskMapping.addSectionBtn", "Add section")}
            icon="pi pi-plus"
            loading={saving}
            onClick={handleAdd}
          />
        </div>
      </div>

      <DataTable
        value={activeSections}
        emptyMessage={t(
          "productRiskMapping.noSections",
          "No sections configured"
        )}
      >
        <Column
          field="sectionLabel"
          header={t("productRiskMapping.section", "Section")}
        />
        <Column
          field="remarks"
          header={t("productRiskMapping.remarks", "Remarks")}
          body={(row) => row.remarks || "—"}
        />
        <Column
          field="defaultRatePercent"
          header={t("productRiskMapping.defaultRate", "Default rate %")}
          headerStyle={{ whiteSpace: "nowrap", minWidth: "9rem" }}
          style={{ whiteSpace: "nowrap", minWidth: "9rem" }}
          body={(row) =>
            row.defaultRatePercent != null ? row.defaultRatePercent : "—"
          }
        />
        <Column
          header={t("productRiskMapping.updatedColumn", "Updated")}
          headerStyle={{ whiteSpace: "nowrap", minWidth: "7rem" }}
          style={{ whiteSpace: "nowrap", minWidth: "7rem" }}
          body={(row) => {
            if (!row.updatedAt) return "—";
            const d = new Date(row.updatedAt);
            return Number.isNaN(d.getTime())
              ? "—"
              : d.toLocaleDateString();
          }}
        />
        <Column
          header={t("productRiskMapping.actions", "Actions")}
          body={(row) => (
            <Button
              label={t("productRiskMapping.remove", "Remove")}
              className="p-button-text p-button-danger"
              onClick={() => handleRemove(row)}
            />
          )}
        />
      </DataTable>

      <p className="mt-3 text-color-secondary">
        {t(
          "productRiskMapping.sectionsConfigured",
          "{{count}} sections configured.",
          { count: activeSections.length }
        )}
      </p>

      <div className="iar-deferred-callout mt-3">
        <div className="iar-deferred-callout__title">
          {t(
            "productRiskMapping.deferredTitle",
            "Deferred for production"
          )}
        </div>
        <p className="iar-deferred-callout__intro">
          {t(
            "productRiskMapping.deferredIntro",
            "This is a prototype of Industrial All Risks, not the specification. A production IAR product still needs:"
          )}
        </p>
        <ul className="iar-deferred-callout__list">
          <li>
            <strong>
              {t(
                "productRiskMapping.deferredTailoredTitle",
                "Tailored section fields."
              )}
            </strong>{" "}
            {t(
              "productRiskMapping.deferredTailoredBody",
              "Sections are generic here — every section has the same fields. Motor, Marine and PA sections need their own."
            )}
          </li>
          <li>
            <strong>
              {t(
                "productRiskMapping.deferredDeductiblesTitle",
                "Deductibles."
              )}
            </strong>{" "}
            {t(
              "productRiskMapping.deferredDeductiblesBody",
              "No per-section deductible is captured."
            )}
          </li>
          <li>
            <strong>
              {t(
                "productRiskMapping.deferredMeasureTitle",
                "Measure types."
              )}
            </strong>{" "}
            {t(
              "productRiskMapping.deferredMeasureBody",
              "A peril's cover is a plain typed sum insured — no per-occurrence / aggregate / first-loss distinction."
            )}
          </li>
          <li>
            <strong>
              {t("productRiskMapping.deferredPremiumTitle", "Premium.")}
            </strong>{" "}
            {t(
              "productRiskMapping.deferredPremiumBody",
              "Typed once at policy level. There is no rate × sum-insured calculation, and none is implied."
            )}
          </li>
          <li>
            <strong>
              {t(
                "productRiskMapping.deferredBindingTitle",
                "Product ↔ quote binding."
              )}
            </strong>{" "}
            {t(
              "productRiskMapping.deferredBindingBody",
              "A quote can add any section; this definition does not constrain it yet."
            )}
          </li>
          <li>
            <strong>
              {t(
                "productRiskMapping.deferredCommissionTitle",
                "Per-section commission."
              )}
            </strong>{" "}
            {t(
              "productRiskMapping.deferredCommissionBody",
              "Out of scope — commission is one blended line on the policy premium."
            )}
          </li>
        </ul>
      </div>
    </div>
  );
};

export default IarRiskSectionsEditor;
