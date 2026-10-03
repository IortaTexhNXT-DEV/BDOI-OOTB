// Consolidated Product Configurator Screens Implementation
// Comprehensive product management for insurance brokers

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../hooks/useFormatCurrency";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Calendar } from "primereact/calendar";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Checkbox } from "primereact/checkbox";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { Accordion, AccordionTab } from "primereact/accordion";
import { Chips } from "primereact/chips";
import { ProgressBar } from "primereact/progressbar";
import { Chart } from "primereact/chart";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import FieldError from "../../components/FieldError";
import productConfiguratorService from "../../services/productConfiguratorService";
import mastersService from "../../services/mastersService";
import s3Service from "../../services/s3Service";
import ProductConfiguratorTab from "./ProductConfiguratorTab/ProductConfiguratorTab";
import { fetchProductTemplateByIdMiddleware } from "./store/productConfiguratorMiddleware";
import { clearProductTemplate } from "./store/productConfiguratorSlice";
import { cleanMotorTariff } from "./ProductConfiguratorTab/MotorTariffEditor";
import { numberLocale } from "../../utility/currencyConverter";
import { calendarDateFormat, toIsoDate } from "../../utility/dateFormat";
import { requiredErrors, hasErrors, errorSummary } from "../../utility/requiredFields";
/** Product templates as dropdown options for attaching a component to a product. */
const useProductOptions = () => {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    productConfiguratorService
      .getProductTemplates()
      .then((rows) =>
        setOptions(
          rows
            .filter((row) => row.status !== "Retired")
            .map((row) => ({ label: `${row.templateCode} - ${row.name}`, value: row.id }))
        )
      )
      .catch(() => setOptions([]));
  }, []);
  return options;
};

/** Loads the configuration components of one kind (coverages, rating-factors, ...). */
const useComponentList = (kind, toast, errorSummary, errorDetail) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const messages = useRef({});
  messages.current = { errorSummary, errorDetail };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await productConfiguratorService.listComponents(kind));
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: messages.current.errorSummary,
        detail: error?.message || messages.current.errorDetail,
      });
    } finally {
      setLoading(false);
    }
  }, [kind, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, load };
};

/** Runs a save/delete call and shows the outcome on the screen's toast; resolves to true on success. */
const persist = async (action, toast, { success, successDetail, error, errorDetail }) => {
  try {
    await action();
    toast.current?.show({ severity: "success", summary: success, detail: successDetail });
    return true;
  } catch (err) {
    toast.current?.show({ severity: "error", summary: error, detail: err?.message || errorDetail });
    return false;
  }
};

const ProductField = ({ value, options, onChange }) => {
  const { t } = useTranslation();
  return (
    <div className="field">
      <label>{t("marketMapping.product")}</label>
      <Dropdown
        value={value}
        options={options}
        filter
        placeholder={t("marketMapping.product")}
        onChange={(e) => onChange(e.value)}
      />
    </div>
  );
};

const confirmDelete = (t, name, onAccept) =>
  confirmDialog({
    message: t("productConfigurator.confirmDelete", "Delete {{name}}?", { name }),
    header: t("common.confirm"),
    icon: "pi pi-exclamation-triangle",
    acceptClassName: "p-button-danger",
    accept: onAccept,
  });

// PC-2: Product Template Management
/** Template column of the component lists: global rows apply to every product. */
const TemplateCell = ({ code }) => {
  const { t } = useTranslation();
  return code || t("productConfigurator.allProducts", "All products");
};
const templateCell = (row) => <TemplateCell code={row.templateCode} />;

export const ProductTemplateManager = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateErrors, setTemplateErrors] = useState({});

  const [showDialog, setShowDialog] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const toast = useRef(null);
  const navigate = useNavigate();
  const { id } = useParams();
  const dispatch = useDispatch();
  const {
    template: templateFromStore,
    loading: templateLoading,
    error: templateError,
  } = useSelector((state) => state.productConfiguratorReducer || {});

  const [categoryOptions, setCategoryOptions] = useState([]);
  // line of business and product come from the masters (Line of Business master, products), so the codes match
  const [lobOptions, setLobOptions] = useState([]);
  const [productRows, setProductRows] = useState([]);

  const productOptions = productRows.map((p) => ({ label: `${p.productCode} - ${p.productName}`, value: p.id }));

  const statusOptions = [
    { label: t("productTemplateManager.active"), value: "Active" },
    { label: t("productTemplateManager.inactive"), value: "Inactive" },
    { label: t("productTemplateManager.draft"), value: "Draft" },
  ];

  useEffect(() => {
    loadTemplates();
    mastersService
      .options("product-category")
      .then((options) => setCategoryOptions(options.map((o) => ({ label: o.label, value: o.value }))))
      .catch(() => setCategoryOptions([]));
    mastersService
      .options("line-of-business")
      .then((options) => setLobOptions(options.map((o) => ({ label: `${o.code} - ${o.label}`, value: o.code }))))
      .catch(() => setLobOptions([]));
    mastersService
      .list("product", { status: "Active" })
      .then((rows) => setProductRows(rows))
      .catch(() => setProductRows([]));

    return () => {
      dispatch(clearProductTemplate());
    };
  }, [dispatch]);

  useEffect(() => {
    if (id) {
      dispatch(
        fetchProductTemplateByIdMiddleware({
          templateId: id,
        })
      );
    } else {
      dispatch(clearProductTemplate());
      setSelectedTemplate(null);
    }
  }, [id, dispatch]);

  useEffect(() => {
    if (id && templateFromStore) {
      setSelectedTemplate(templateFromStore);
    }
  }, [id, templateFromStore]);

  useEffect(() => {
    if (templateError) {
      toast.current?.show({
        severity: "error",
        summary: t("productTemplateManager.error"),
        detail: templateError,
      });
    }
  }, [templateError, t]);

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const data = await productConfiguratorService.getProductTemplates();

      setTemplates(data);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("productTemplateManager.error"),
        detail: t("productTemplateManager.failedToLoadTemplates"),
      });
    } finally {
      setTemplatesLoading(false);
    }
  };

  const setLifecycle = (template, action) => {
    const retire = action === "retire";
    confirmDialog({
      message: `${retire ? t("productTemplateManager.retire", "Retire") : t("productTemplateManager.reactivate", "Reactivate")} ${template.templateCode}?`,
      header: t("common.confirm"),
      icon: "pi pi-exclamation-triangle",
      accept: async () => {
        const done = await persist(
          () =>
            retire
              ? productConfiguratorService.retireProductTemplate(template.id)
              : productConfiguratorService.reactivateProductTemplate(template.id),
          toast,
          {
            success: t("productTemplateManager.success"),
            successDetail: t("productTemplateManager.templateUpdated"),
            error: t("productTemplateManager.error"),
            errorDetail: t("productTemplateManager.failedToSaveTemplate"),
          }
        );
        if (done) loadTemplates();
      },
    });
  };

  const saveTemplate = async () => {
    try {
      if (!selectedTemplate) {
        return;
      }

      const fieldLabels = {
        templateCode: t("productTemplateManager.templateCode"),
        name: t("productTemplateManager.productName"),
        category: t("productTemplateManager.category"),
        lineOfBusiness: t("productTemplateManager.lineOfBusiness"),
        effectiveDate: t("productTemplateManager.effectiveDate"),
        status: t("productTemplateManager.status"),
      };

      const requiredFields = Object.keys(fieldLabels);

      const missingFields = requiredFields.filter((field) => {
        const value = selectedTemplate[field];
        if (field === "effectiveDate") {
          if (!value) {
            return true;
          }
          if (value instanceof Date) {
            return Number.isNaN(value.getTime());
          }
          return typeof value !== "string" || value.trim() === "";
        }
        if (typeof value === "string") {
          return value.trim() === "";
        }
        return value === undefined || value === null;
      });

      setTemplateErrors(Object.fromEntries(missingFields.map((field) => [field, `${fieldLabels[field] || field} is required`])));
      if (missingFields.length) {
        const formattedFields = missingFields.map(
          (field) => fieldLabels[field] || field
        );
        toast.current?.show({
          severity: "warn",
          summary: t("productTemplateManager.validation"),
          detail: t("productTemplateManager.pleaseFillIn", {
            fields: formattedFields.join(", "),
          }),
        });
        return;
      }

      const {
        templateCode,
        name,
        category,
        lineOfBusiness,
        productId,
        effectiveDate,
        status,
        description,
      } = selectedTemplate;

      // local calendar date (toISOString would give the previous day east of UTC)
      const formattedEffectiveDate = toIsoDate(effectiveDate);

      const payload = {
        templateCode,
        name,
        category,
        lineOfBusiness,
        productId: productId ?? null,
        effectiveDate: formattedEffectiveDate,
        status,
        description: description || "",
      };

      if (selectedTemplate?.id) {
        await productConfiguratorService.updateProductTemplate({
          ...selectedTemplate,
          configuration: cleanMotorTariff(selectedTemplate.configuration),
          ...payload,
        });
      } else {
        await productConfiguratorService.createProductTemplate(payload);
      }

      toast.current?.show({
        severity: "success",
        summary: t("productTemplateManager.success"),
        detail: selectedTemplate?.id
          ? t("productTemplateManager.templateUpdated")
          : t("productTemplateManager.templateSaved"),
      });
      setShowDialog(false);
      if (selectedTemplate?.id) {
        // an update stays on the template (as saved), so the user can keep working on it
        setSelectedTemplate({
          ...selectedTemplate,
          configuration: cleanMotorTariff(selectedTemplate.configuration),
        });
      } else {
        setSelectedTemplate(null);
        dispatch(clearProductTemplate());
      }
      loadTemplates();
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: t("productTemplateManager.error"),
        detail: error?.message || t("productTemplateManager.failedToSaveTemplate"),
      });
    }
  };

  return (
    <div className="product-template-manager p-3">
      <Toast ref={toast} />
      <ConfirmDialog />
      <Card title={t("productTemplateManager.cardTitle")}>
        {!id ? (
          <>
            <div>
              <div className="mb-3 flex justify-content-between">
                <h3>{t("productTemplateManager.productTemplates")}</h3>
                <Button
                  label={t("productTemplateManager.createTemplate")}
                  icon="pi pi-plus"
                  onClick={() => {
                    setSelectedTemplate({ status: "Active" });
                    setTemplateErrors({});
                    setShowDialog(true);
                  }}
                />
              </div>
              <DataTable
                value={templates}
                loading={templatesLoading}
                paginator
                rows={20}
              >
                <Column field="templateCode" header={t("productTemplateManager.templateCode")} sortable />
                <Column field="name" header={t("productTemplateManager.productName")} sortable />
                <Column field="category" header={t("productTemplateManager.category")} sortable />
                <Column field="version" header={t("productTemplateManager.version")} sortable />
                <Column
                  field="status"
                  header={t("productTemplateManager.status")}
                  body={(rowData) => (
                    <Tag
                      value={rowData.status}
                      severity={
                        rowData.status === "Active" ? "success" : "warning"
                      }
                    />
                  )}
                />
                <Column
                  body={(rowData) => (
                    <div className="flex gap-2">
                      <Button
                        icon="pi pi-pencil"
                        className="p-button-text"
                        onClick={() => {
                          navigate(
                            `/product-configurator/template/${rowData.id}`
                          );
                          setSelectedTemplate(rowData);
                        }} aria-label="Edit" tooltip="Edit" tooltipOptions={{ position: "top" }} />
                      {rowData.status === "Retired" ? (
                        <Button
                          icon="pi pi-replay"
                          className="p-button-text"
                          tooltip={t("productTemplateManager.reactivate", "Reactivate")}
                          onClick={() => setLifecycle(rowData, "reactivate")} aria-label={t("productTemplateManager.reactivate", "Reactivate")}
                        />
                      ) : (
                        <Button
                          icon="pi pi-ban"
                          className="p-button-text p-button-danger"
                          tooltip={t("productTemplateManager.retire", "Retire")}
                          onClick={() => setLifecycle(rowData, "retire")} aria-label={t("productTemplateManager.retire", "Retire")}
                        />
                      )}
                    </div>
                  )}
                />
              </DataTable>
            </div>
          </>
        ) : (
          <div>
            <Button
              label={t("productTemplateManager.back")}
              icon="pi pi-arrow-left"
              className="mb-3 p-button-text"
              onClick={() => navigate("/product-configurator/templates")}
            />
            {selectedTemplate && (
              <ProductConfiguratorTab
                selectedTemplate={selectedTemplate}
                setSelectedTemplate={setSelectedTemplate}
                saveTemplate={saveTemplate}
              />
            )}
          </div>
        )}
      </Card>

      <Dialog
        header={t("productTemplateManager.createProductTemplate")}
        visible={showDialog}
        style={{ width: "50vw" }}
        onHide={() => {
          setShowDialog(false);
          setSelectedTemplate(null);
        }}
      >
        <div className="p-fluid">
          <div className="field">
            <label>{t("productTemplateManager.templateCode")} *</label>
            <InputText
              value={selectedTemplate?.templateCode || ""}
              onChange={(e) =>
                setSelectedTemplate({
                  ...selectedTemplate,
                  templateCode: e.target.value,
                })
              }
            />
            <FieldError error={templateErrors.templateCode} />
          </div>
          <div className="field">
            <label>{t("productTemplateManager.productName")} *</label>
            <InputText
              value={selectedTemplate?.name || ""}
              onChange={(e) =>
                setSelectedTemplate({
                  ...selectedTemplate,
                  name: e.target.value,
                })
              }
            />
            <FieldError error={templateErrors.name} />
          </div>
          <div className="field">
            <label>{t("productTemplateManager.description")}</label>
            <InputTextarea
              value={selectedTemplate?.description || ""}
              rows={3}
              onChange={(e) =>
                setSelectedTemplate({
                  ...selectedTemplate,
                  description: e.target.value,
                })
              }
            />
          </div>
          <div className="formgrid grid">
            <div className="field col-12 md:col-6">
              <label>{t("productTemplateManager.category")} *</label>
              <Dropdown
                value={selectedTemplate?.category || null}
                options={categoryOptions}
                placeholder={t("productTemplateManager.selectCategory")}
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate,
                    category: e.value,
                  })
                }
                showClear
              />
              <FieldError error={templateErrors.category} />
            </div>
            <div className="field col-12 md:col-6">
              <label>{t("productTemplateManager.product")}</label>
              <Dropdown
                value={selectedTemplate?.productId ?? null}
                options={productOptions}
                filter
                showClear
                placeholder={t("productTemplateManager.selectProduct")}
                onChange={(e) => {
                  const product = productRows.find((p) => p.id === e.value);
                  const lob = product && lobOptions.find((o) => o.value === String(product.lineofBusiness || "").toUpperCase());
                  setSelectedTemplate({
                    ...selectedTemplate,
                    productId: e.value ?? null,
                    ...(lob ? { lineOfBusiness: lob.value } : {}),
                  });
                }}
              />
            </div>
            <div className="field col-12 md:col-6">
              <label>{t("productTemplateManager.lineOfBusiness")} *</label>
              <Dropdown
                value={selectedTemplate?.lineOfBusiness || null}
                options={lobOptions}
                filter
                placeholder={t("productTemplateManager.selectLineOfBusiness")}
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate,
                    lineOfBusiness: e.value,
                  })
                }
              />
              <FieldError error={templateErrors.lineOfBusiness} />
            </div>
            <div className="field col-12 md:col-6">
              <label>{t("productTemplateManager.effectiveDate")} *</label>
              <Calendar
                value={
                  selectedTemplate?.effectiveDate
                    ? new Date(selectedTemplate.effectiveDate)
                    : null
                }
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate,
                    effectiveDate: e.value,
                  })
                }
                showIcon
                dateFormat={calendarDateFormat()}
                placeholder={t("productTemplateManager.selectEffectiveDate")}
              />
              <FieldError error={templateErrors.effectiveDate} />
            </div>
            <div className="field col-12 md:col-6">
              <label>{t("productTemplateManager.status")} *</label>
              <Dropdown
                value={selectedTemplate?.status || "Active"}
                options={statusOptions}
                onChange={(e) =>
                  setSelectedTemplate({
                    ...selectedTemplate,
                    status: e.value,
                  })
                }
              />
              <FieldError error={templateErrors.status} />
            </div>
          </div>
          <Button
            label={selectedTemplate?.id ? t("productTemplateManager.update") : t("productTemplateManager.create")}
            icon={selectedTemplate?.id ? "pi pi-save" : "pi pi-plus"}
            onClick={saveTemplate}
            disabled={templateLoading}
          />
        </div>
      </Dialog>
    </div>
  );
};

// PC-3: Coverage Builder
export const CoverageBuilder = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const [selectedCoverage, setSelectedCoverage] = useState(null);
  const [coverageErrors, setCoverageErrors] = useState({});
  const [showDialog, setShowDialog] = useState(false);
  const toast = useRef(null);
  const productOptions = useProductOptions();
  const { rows: coverages, loading, load: loadCoverages } = useComponentList(
    "coverages",
    toast,
    t("coverageBuilder.error"),
    t("coverageBuilder.failedToLoad")
  );
  const messages = {
    success: t("coverageBuilder.success"),
    successDetail: t("coverageBuilder.saved"),
    error: t("coverageBuilder.error"),
    errorDetail: t("coverageBuilder.failedToSave"),
  };

  const typeOptions = [
    { label: t("coverageBuilder.mandatory"), value: "Mandatory" },
    { label: t("coverageBuilder.optional"), value: "Optional" },
  ];

  const openCoverage = (coverage) => {
    setSelectedCoverage(coverage);
    setShowDialog(true);
  };

  useEffect(() => {
    if (showDialog) setCoverageErrors({});
  }, [showDialog]);

  const saveCoverage = async () => {
    const errors = requiredErrors(selectedCoverage, [["coverageCode", t("coverageBuilder.coverageCode")], ["coverageName", t("coverageBuilder.coverageName")], ["type", t("coverageBuilder.type")]]);
    setCoverageErrors(errors);
    if (hasErrors(errors)) {
      toast.current?.show({ severity: "warn", summary: t("common.validation", "Validation"), detail: errorSummary(errors) });
      return;
    }
    const saved = await persist(
      () => productConfiguratorService.saveComponent("coverages", selectedCoverage),
      toast,
      messages
    );
    if (saved) {
      setShowDialog(false);
      loadCoverages();
    }
  };

  const deleteCoverage = (coverage) =>
    confirmDelete(t, coverage.coverageName, async () => {
      const deleted = await persist(
        () => productConfiguratorService.deleteComponent("coverages", coverage.id),
        toast,
        messages
      );
      if (deleted) loadCoverages();
    });

  const typeBodyTemplate = (rowData) => {
    const severity = rowData.type === "Mandatory" ? "danger" : "info";
    const label = rowData.type === "Mandatory" ? t("coverageBuilder.mandatory") : t("coverageBuilder.optional");
    return <Tag value={label} severity={severity} />;
  };

  return (
    <div className="coverage-builder p-3">
      <Toast ref={toast} />
      <ConfirmDialog />
      <Card title={t("coverageBuilder.cardTitle")}>
        <div className="mb-3 flex justify-content-between">
          <h3>{t("coverageBuilder.pageTitle")}</h3>
          <Button
            label={t("coverageBuilder.addCoverage")}
            icon="pi pi-plus"
            onClick={() => openCoverage({ limits: [], exclusions: [] })}
          />
        </div>

        <DataTable value={coverages} loading={loading} paginator rows={20}>
          <Column field="coverageCode" header={t("coverageBuilder.code")} sortable />
          <Column field="templateCode" header={t("productConfigurator.template", "Template")} sortable body={templateCell} />
          <Column field="coverageName" header={t("coverageBuilder.coverageName")} sortable />
          <Column header={t("coverageBuilder.type")} body={typeBodyTemplate} sortable />
          <Column
            field="deductible"
            header={t("coverageBuilder.deductible")}
            sortable
            body={(rowData) => formatCurrency(rowData.deductible ?? 0)}
          />
          <Column field="premiumImpact" header={t("coverageBuilder.premiumImpact")} sortable />
          <Column
            header={t("coverageBuilder.actions")}
            body={(rowData) => (
              <div className="flex gap-2">
                <Button
                  icon="pi pi-pencil"
                  className="p-button-text"
                  onClick={() => openCoverage(rowData)} aria-label="Edit" tooltip="Edit" tooltipOptions={{ position: "top" }} />
                <Button
                  icon="pi pi-copy"
                  className="p-button-text"
                  onClick={() =>
                    openCoverage({ ...rowData, id: undefined, coverageCode: `${rowData.coverageCode}-COPY` })
                  } aria-label="Copy" tooltip="Copy" tooltipOptions={{ position: "top" }} />
                <Button
                  icon="pi pi-trash"
                  className="p-button-text p-button-danger"
                  onClick={() => deleteCoverage(rowData)} aria-label="Delete" tooltip="Delete" tooltipOptions={{ position: "top" }} />
              </div>
            )}
          />
        </DataTable>
      </Card>

      <Dialog
        header={t("coverageBuilder.configureCoverage")}
        visible={showDialog}
        style={{ width: "60vw" }}
        onHide={() => setShowDialog(false)}
      >
        <div className="p-fluid">
          {!selectedCoverage?.id && (
            <ProductField
              value={selectedCoverage?.productId}
              options={productOptions}
              onChange={(productId) => setSelectedCoverage({ ...selectedCoverage, productId })}
            />
          )}
          <div className="grid">
            <div className="col-6">
              <div className="field">
                <label>{t("coverageBuilder.coverageCode")} *</label>
                <InputText
                  value={selectedCoverage?.coverageCode}
                  onChange={(e) =>
                    setSelectedCoverage({
                      ...selectedCoverage,
                      coverageCode: e.target.value,
                    })
                  }
                />
                <FieldError error={coverageErrors.coverageCode} />
              </div>
              <div className="field">
                <label>{t("coverageBuilder.coverageName")} *</label>
                <InputText
                  value={selectedCoverage?.coverageName}
                  onChange={(e) =>
                    setSelectedCoverage({
                      ...selectedCoverage,
                      coverageName: e.target.value,
                    })
                  }
                />
                <FieldError error={coverageErrors.coverageName} />
              </div>
              <div className="field">
                <label>{t("coverageBuilder.type")} *</label>
                <Dropdown
                  value={selectedCoverage?.type}
                  options={typeOptions}
                  optionLabel="label"
                  optionValue="value"
                  onChange={(e) =>
                    setSelectedCoverage({ ...selectedCoverage, type: e.value })
                  }
                />
                <FieldError error={coverageErrors.type} />
              </div>
            </div>
            <div className="col-6">
              <div className="field">
                <label>{t("coverageBuilder.deductibleAmount")}</label>
                <InputNumber
                  value={selectedCoverage?.deductible}
                  mode="currency"
                  currency={currencyCode}
                  onChange={(e) =>
                    setSelectedCoverage({
                      ...selectedCoverage,
                      deductible: e.value,
                    })
                  }
                />
              </div>
              <div className="field">
                <label>{t("coverageBuilder.waitingPeriodDays")}</label>
                <InputNumber
                  value={selectedCoverage?.waitingPeriod}
                  onChange={(e) =>
                    setSelectedCoverage({
                      ...selectedCoverage,
                      waitingPeriod: e.value,
                    })
                  }
                />
              </div>
              <div className="field">
                <label>{t("coverageBuilder.premiumImpact")}</label>
                <InputText
                  value={selectedCoverage?.premiumImpact}
                  onChange={(e) =>
                    setSelectedCoverage({
                      ...selectedCoverage,
                      premiumImpact: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
          <div className="field">
            <label>{t("coverageBuilder.description")}</label>
            <InputTextarea
              value={selectedCoverage?.description}
              rows={3}
              onChange={(e) =>
                setSelectedCoverage({
                  ...selectedCoverage,
                  description: e.target.value,
                })
              }
            />
          </div>
          <div className="field">
            <label>{t("coverageBuilder.exclusions")}</label>
            <Chips
              value={selectedCoverage?.exclusions}
              onChange={(e) =>
                setSelectedCoverage({
                  ...selectedCoverage,
                  exclusions: e.value,
                })
              }
            />
          </div>
          <Button
            label={t("coverageBuilder.saveCoverage")}
            icon="pi pi-check"
            onClick={saveCoverage}
          />
        </div>
      </Dialog>
    </div>
  );
};

// PC-4: Rating Engine
export const RatingEngine = () => {
  const { t } = useTranslation();
  const [selectedFactor, setSelectedFactor] = useState(null);
  const [factorErrors, setFactorErrors] = useState({});
  const [showDialog, setShowDialog] = useState(false);
  const [expandedRows, setExpandedRows] = useState(null);
  const toast = useRef(null);
  const productOptions = useProductOptions();
  const { rows: ratingFactors, loading, load: loadRatingFactors } = useComponentList(
    "rating-factors",
    toast,
    t("ratingEngine.error"),
    t("ratingEngine.failedToLoad")
  );

  const typeOptions = [
    { label: t("ratingEngine.multiplicative"), value: "Multiplicative" },
    { label: t("ratingEngine.additive"), value: "Additive" },
    { label: t("ratingEngine.discount"), value: "Discount" },
  ];

  const openFactor = (factor) => {
    setSelectedFactor(factor);
    setShowDialog(true);
  };

  useEffect(() => {
    if (showDialog) setFactorErrors({});
  }, [showDialog]);

  const saveFactor = async () => {
    const errors = requiredErrors(selectedFactor, [["factorCode", t("ratingEngine.factorCode")], ["factorName", t("ratingEngine.factorName")], ["type", t("ratingEngine.type")]]);
    setFactorErrors(errors);
    if (hasErrors(errors)) {
      toast.current?.show({ severity: "warn", summary: t("common.validation", "Validation"), detail: errorSummary(errors) });
      return;
    }
    const saved = await persist(
      () => productConfiguratorService.saveComponent("rating-factors", selectedFactor),
      toast,
      {
        success: t("ratingEngine.success"),
        successDetail: t("ratingEngine.saved"),
        error: t("ratingEngine.error"),
        errorDetail: t("ratingEngine.failedToSave"),
      }
    );
    if (saved) {
      setShowDialog(false);
      loadRatingFactors();
    }
  };

  const expandedRowTemplate = (data) => {
    return (
      <div className="p-3">
        <h5>{t("ratingEngine.ratingRules")}</h5>
        <DataTable value={data.rules}>
          <Column field="condition" header={t("ratingEngine.condition")} />
          <Column field="factor" header={t("ratingEngine.factor")} />
          <Column field="description" header={t("ratingEngine.description")} />
        </DataTable>
      </div>
    );
  };

  return (
    <div className="rating-engine p-3">
      <Toast ref={toast} />
      <Card title={t("ratingEngine.cardTitle")}>
        <div className="mb-3 flex justify-content-between">
          <h3>{t("ratingEngine.pageTitle")}</h3>
          <div className="flex gap-2">
            <Button
              label={t("ratingEngine.testCalculator")}
              icon="pi pi-calculator"
              className="p-button-secondary"
            />
            <Button
              label={t("ratingEngine.addFactor")}
              icon="pi pi-plus"
              onClick={() => openFactor({ rules: [] })}
            />
          </div>
        </div>

        <DataTable
          value={ratingFactors}
          loading={loading}
          paginator
          rows={20}
          dataKey="id"
          expandedRows={expandedRows}
          onRowToggle={(e) => setExpandedRows(e.data)}
          rowExpansionTemplate={expandedRowTemplate}
        >
          <Column expander style={{ width: "3em" }} />
          <Column field="factorCode" header={t("ratingEngine.factorCode")} sortable />
          <Column field="templateCode" header={t("productConfigurator.template", "Template")} sortable body={templateCell} />
          <Column field="factorName" header={t("ratingEngine.factorName")} sortable />
          <Column
            field="type"
            header={t("ratingEngine.type")}
            sortable
            body={(rowData) => <Tag value={rowData.type} />}
          />
          <Column
            field="status"
            header={t("ratingEngine.status")}
            sortable
            body={(rowData) => (
              <Tag
                value={rowData.status}
                severity={rowData.status === "Active" ? "success" : "warning"}
              />
            )}
          />
          <Column
            header={t("ratingEngine.rulesCount")}
            body={(rowData) => rowData.rules?.length || 0}
          />
          <Column
            header={t("ratingEngine.actions")}
            body={(rowData) => (
              <div className="flex gap-2">
                <Button
                  icon="pi pi-pencil"
                  className="p-button-text"
                  onClick={() => openFactor(rowData)} aria-label="Edit" tooltip="Edit" tooltipOptions={{ position: "top" }} />
                <Button
                  icon="pi pi-copy"
                  className="p-button-text"
                  onClick={() =>
                    openFactor({ ...rowData, id: undefined, factorCode: `${rowData.factorCode}-COPY` })
                  } aria-label="Copy" tooltip="Copy" tooltipOptions={{ position: "top" }} />
              </div>
            )}
          />
        </DataTable>
      </Card>

      <Dialog
        header={t("ratingEngine.configureFactor")}
        visible={showDialog}
        style={{ width: "50vw" }}
        onHide={() => setShowDialog(false)}
      >
        <div className="p-fluid">
          {!selectedFactor?.id && (
            <ProductField
              value={selectedFactor?.productId}
              options={productOptions}
              onChange={(productId) => setSelectedFactor({ ...selectedFactor, productId })}
            />
          )}
          <div className="field">
            <label>{t("ratingEngine.factorCode")} *</label>
            <InputText
              value={selectedFactor?.factorCode}
              onChange={(e) =>
                setSelectedFactor({
                  ...selectedFactor,
                  factorCode: e.target.value,
                })
              }
            />
            <FieldError error={factorErrors.factorCode} />
          </div>
          <div className="field">
            <label>{t("ratingEngine.factorName")} *</label>
            <InputText
              value={selectedFactor?.factorName}
              onChange={(e) =>
                setSelectedFactor({
                  ...selectedFactor,
                  factorName: e.target.value,
                })
              }
            />
            <FieldError error={factorErrors.factorName} />
          </div>
          <div className="field">
            <label>{t("ratingEngine.type")} *</label>
            <Dropdown
              value={selectedFactor?.type}
              options={typeOptions}
              optionLabel="label"
              optionValue="value"
              onChange={(e) =>
                setSelectedFactor({ ...selectedFactor, type: e.value })
              }
            />
            <FieldError error={factorErrors.type} />
          </div>
          <Button label={t("ratingEngine.saveFactor")} icon="pi pi-check" onClick={saveFactor} />
        </div>
      </Dialog>
    </div>
  );
};

// PC-5: Underwriting Rules
export const UnderwritingRules = () => {
  const { t } = useTranslation();
  const [selectedRule, setSelectedRule] = useState(null);
  const [ruleErrors, setRuleErrors] = useState({});
  const [showDialog, setShowDialog] = useState(false);
  const toast = useRef(null);
  const productOptions = useProductOptions();
  const { rows: rules, loading, load: loadRules } = useComponentList(
    "underwriting-rules",
    toast,
    t("underwritingRules.error"),
    t("underwritingRules.failedToLoad")
  );

  const typeOptions = [
    { label: t("underwritingRules.acceptance"), value: "Acceptance" },
    { label: t("underwritingRules.validation"), value: "Validation" },
    { label: t("underwritingRules.loading"), value: "Loading" },
  ];
  const actionOptions = [
    { label: t("underwritingRules.autoAccept"), value: "Auto-Accept" },
    { label: t("underwritingRules.refer"), value: "Refer" },
    { label: t("underwritingRules.decline"), value: "Decline" },
    { label: t("underwritingRules.applyLoading"), value: "Apply Loading" },
  ];

  useEffect(() => {
    if (showDialog) setRuleErrors({});
  }, [showDialog]);

  const saveRule = async () => {
    const errors = requiredErrors(selectedRule, [["ruleCode", t("underwritingRules.ruleCode")], ["ruleName", t("underwritingRules.ruleName")], ["type", t("underwritingRules.type")], ["condition", t("ratingEngine.condition")], ["action", t("underwritingRules.action")]]);
    setRuleErrors(errors);
    if (hasErrors(errors)) {
      toast.current?.show({ severity: "warn", summary: t("common.validation", "Validation"), detail: errorSummary(errors) });
      return;
    }
    const saved = await persist(
      () => productConfiguratorService.saveComponent("underwriting-rules", selectedRule),
      toast,
      {
        success: t("underwritingRules.success"),
        successDetail: t("underwritingRules.saved"),
        error: t("underwritingRules.error"),
        errorDetail: t("underwritingRules.failedToSave"),
      }
    );
    if (saved) {
      setShowDialog(false);
      loadRules();
    }
  };

  const actionBodyTemplate = (rowData) => {
    const severity =
      rowData.action === "Auto-Accept"
        ? "success"
        : rowData.action === "Refer"
        ? "warning"
        : "danger";
    const actionLabel = actionOptions.find((o) => o.value === rowData.action)?.label ?? rowData.action;
    return <Tag value={actionLabel} severity={severity} />;
  };

  return (
    <div className="underwriting-rules p-3">
      <Toast ref={toast} />
      <Card title={t("underwritingRules.cardTitle")}>
        <div className="mb-3 flex justify-content-between">
          <h3>{t("underwritingRules.pageTitle")}</h3>
          <Button
            label={t("underwritingRules.addRule")}
            icon="pi pi-plus"
            onClick={() => {
              setSelectedRule({});
              setShowDialog(true);
            }}
          />
        </div>

        <Accordion multiple>
          <AccordionTab
            header={t("underwritingRules.acceptanceRules", {
              count: rules.filter((r) => r.type === "Acceptance").length,
            })}
          >
            <DataTable
              value={rules.filter((r) => r.type === "Acceptance")}
              loading={loading}
              onRowClick={(e) => {
                setSelectedRule(e.data);
                setShowDialog(true);
              }}
            >
              <Column field="ruleCode" header={t("underwritingRules.ruleCode")} sortable />
              <Column field="templateCode" header={t("productConfigurator.template", "Template")} sortable body={templateCell} />
              <Column field="ruleName" header={t("underwritingRules.ruleName")} sortable />
              <Column field="condition" header={t("ratingEngine.condition")} />
              <Column header={t("underwritingRules.action")} body={actionBodyTemplate} />
              <Column field="authority" header={t("underwritingRules.authorityLevel")} />
              <Column
                field="status"
                header={t("ratingEngine.status")}
                body={(rowData) => (
                  <Tag
                    value={rowData.status}
                    severity={
                      rowData.status === "Active" ? "success" : "warning"
                    }
                  />
                )}
              />
            </DataTable>
          </AccordionTab>
          <AccordionTab
            header={t("underwritingRules.validationRules", {
              count: rules.filter((r) => r.type === "Validation").length,
            })}
          >
            <DataTable
              value={rules.filter((r) => r.type === "Validation")}
              loading={loading}
              onRowClick={(e) => {
                setSelectedRule(e.data);
                setShowDialog(true);
              }}
            >
              <Column field="ruleCode" header={t("underwritingRules.ruleCode")} sortable />
              <Column field="templateCode" header={t("productConfigurator.template", "Template")} sortable body={templateCell} />
              <Column field="ruleName" header={t("underwritingRules.ruleName")} sortable />
              <Column field="condition" header={t("ratingEngine.condition")} />
              <Column header={t("underwritingRules.action")} body={actionBodyTemplate} />
              <Column field="authority" header={t("underwritingRules.authorityLevel")} />
            </DataTable>
          </AccordionTab>
          <AccordionTab
            header={t("underwritingRules.loadingRules", {
              count: rules.filter((r) => r.type === "Loading").length,
            })}
          >
            <DataTable
              value={rules.filter((r) => r.type === "Loading")}
              loading={loading}
              onRowClick={(e) => {
                setSelectedRule(e.data);
                setShowDialog(true);
              }}
            >
              <Column field="ruleCode" header={t("underwritingRules.ruleCode")} sortable />
              <Column field="templateCode" header={t("productConfigurator.template", "Template")} sortable body={templateCell} />
              <Column field="ruleName" header={t("underwritingRules.ruleName")} sortable />
              <Column field="condition" header={t("ratingEngine.condition")} />
              <Column field="message" header={t("underwritingRules.loadingDescription")} />
              <Column field="authority" header={t("underwritingRules.authorityLevel")} />
            </DataTable>
          </AccordionTab>
        </Accordion>
      </Card>

      <Dialog
        header={t("underwritingRules.configureRule")}
        visible={showDialog}
        style={{ width: "50vw" }}
        onHide={() => setShowDialog(false)}
      >
        <div className="p-fluid">
          {!selectedRule?.id && (
            <ProductField
              value={selectedRule?.productId}
              options={productOptions}
              onChange={(productId) => setSelectedRule({ ...selectedRule, productId })}
            />
          )}
          <div className="field">
            <label>{t("underwritingRules.ruleCode")} *</label>
            <InputText
              value={selectedRule?.ruleCode}
              onChange={(e) =>
                setSelectedRule({ ...selectedRule, ruleCode: e.target.value })
              }
            />
            <FieldError error={ruleErrors.ruleCode} />
          </div>
          <div className="field">
            <label>{t("underwritingRules.ruleName")} *</label>
            <InputText
              value={selectedRule?.ruleName}
              onChange={(e) =>
                setSelectedRule({ ...selectedRule, ruleName: e.target.value })
              }
            />
            <FieldError error={ruleErrors.ruleName} />
          </div>
          <div className="field">
            <label>{t("underwritingRules.type")} *</label>
            <Dropdown
              value={selectedRule?.type}
              options={typeOptions}
              optionLabel="label"
              optionValue="value"
              onChange={(e) =>
                setSelectedRule({ ...selectedRule, type: e.value })
              }
            />
            <FieldError error={ruleErrors.type} />
          </div>
          <div className="field">
            <label>{t("ratingEngine.condition")} *</label>
            <InputTextarea
              value={selectedRule?.condition}
              rows={3}
              onChange={(e) =>
                setSelectedRule({ ...selectedRule, condition: e.target.value })
              }
            />
            <FieldError error={ruleErrors.condition} />
          </div>
          <div className="field">
            <label>{t("underwritingRules.action")} *</label>
            <Dropdown
              value={selectedRule?.action}
              options={actionOptions}
              optionLabel="label"
              optionValue="value"
              onChange={(e) =>
                setSelectedRule({ ...selectedRule, action: e.value })
              }
            />
            <FieldError error={ruleErrors.action} />
          </div>
          <Button label={t("underwritingRules.saveRule")} icon="pi pi-check" onClick={saveRule} />
        </div>
      </Dialog>
    </div>
  );
};

// PC-7: Market Mapping
export const MarketMapping = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [insurerOptions, setInsurerOptions] = useState([]);
  const toast = useRef(null);
  const productOptions = useProductOptions();
  const { rows: mappings, loading, load: loadMappings } = useComponentList(
    "market-mappings",
    toast,
    t("marketMapping.error"),
    t("marketMapping.failedToLoad")
  );

  useEffect(() => {
    mastersService
      .options("insurance-company")
      .then((options) => setInsurerOptions(options.map((o) => ({ label: o.label, value: o.label }))))
      .catch(() => setInsurerOptions([]));
  }, []);

  const saveMapping = async () => {
    const saved = await persist(
      () => productConfiguratorService.saveComponent("market-mappings", selectedMapping),
      toast,
      {
        success: t("common.success"),
        successDetail: selectedMapping.insurerName,
        error: t("marketMapping.error"),
        errorDetail: t("marketMapping.failedToSave", "Failed to save mapping"),
      }
    );
    if (saved) {
      setSelectedMapping(null);
      loadMappings();
    }
  };

  const progressBodyTemplate = (rowData) => {
    const percentage = rowData.targetPremium ? (rowData.ytdPremium / rowData.targetPremium) * 100 : 0;
    return (
      <div>
        <ProgressBar
          value={percentage}
          showValue={false}
          style={{ height: "20px" }}
        />
        <small>{percentage.toFixed(1)}% {t("marketMapping.ofTarget")}</small>
      </div>
    );
  };

  const numberField = (field, label, props = {}) => (
    <div className="field col-12 md:col-6">
      <label>{label}</label>
      <InputNumber
        value={selectedMapping?.[field]}
        onValueChange={(e) => setSelectedMapping({ ...selectedMapping, [field]: e.value })}
        {...props}
      />
    </div>
  );

  return (
    <div className="market-mapping p-3">
      <Toast ref={toast} />
      <Card title={t("marketMapping.cardTitle")}>
        <div className="mb-3 flex justify-content-between">
          <h3>{t("marketMapping.pageTitle")}</h3>
          <Button
            label={t("marketMapping.mapProduct")}
            icon="pi pi-plus"
            onClick={() => setSelectedMapping({ status: "Active" })}
          />
        </div>

        <DataTable
          value={mappings}
          loading={loading}
          paginator
          rows={20}
          onRowClick={(e) => setSelectedMapping(e.data)}
        >
          <Column field="templateCode" header={t("marketMapping.product")} />
          <Column field="insurerName" header={t("marketMapping.insurer")} sortable />
          <Column field="productCode" header={t("marketMapping.insurerCode")} />
          <Column
            field="commissionRate"
            header={t("marketMapping.commissionPercent")}
            sortable
            body={(rowData) => `${rowData.commissionRate ?? 0}%`}
          />
          <Column
            field="overrideRate"
            header={t("marketMapping.overridePercent")}
            sortable
            body={(rowData) => `${rowData.overrideRate ?? 0}%`}
          />
          <Column
            field="targetPremium"
            header={t("marketMapping.target")}
            sortable
            body={(rowData) => formatCurrency(rowData.targetPremium ?? 0)}
          />
          <Column header={t("marketMapping.ytdPerformance")} body={progressBodyTemplate} />
          <Column
            field="status"
            header={t("marketMapping.status")}
            body={(rowData) => (
              <Tag value={rowData.status} severity="success" />
            )}
          />
        </DataTable>
      </Card>

      <Dialog
        header={t("marketMapping.mapProduct")}
        visible={!!selectedMapping}
        style={{ width: "50vw" }}
        onHide={() => setSelectedMapping(null)}
      >
        {selectedMapping && (
          <div className="p-fluid">
            {!selectedMapping.id && (
              <ProductField
                value={selectedMapping.productId}
                options={productOptions}
                onChange={(productId) => setSelectedMapping({ ...selectedMapping, productId })}
              />
            )}
            <div className="field">
              <label>{t("marketMapping.insurer")}</label>
              <Dropdown
                value={selectedMapping.insurerName}
                options={insurerOptions}
                filter
                onChange={(e) => setSelectedMapping({ ...selectedMapping, insurerName: e.value })}
              />
            </div>
            <div className="field">
              <label>{t("marketMapping.insurerCode")}</label>
              <InputText
                value={selectedMapping.productCode || ""}
                onChange={(e) => setSelectedMapping({ ...selectedMapping, productCode: e.target.value })}
              />
            </div>
            <div className="formgrid grid">
              {numberField("commissionRate", t("marketMapping.commissionPercent"), { suffix: "%", maxFractionDigits: 2 })}
              {numberField("overrideRate", t("marketMapping.overridePercent"), { suffix: "%", maxFractionDigits: 2 })}
              {numberField("targetPremium", t("marketMapping.target"), { maxFractionDigits: 2 })}
              {numberField("ytdPremium", t("marketMapping.ytdPerformance"), { maxFractionDigits: 2 })}
            </div>
            <Button
              label={t("common.save")}
              icon="pi pi-check"
              onClick={saveMapping}
              disabled={!selectedMapping.insurerName || !selectedMapping.productCode}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
};

// PC-8: Document Manager
export const DocumentManager = () => {
  const { t } = useTranslation();
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploading, setUploading] = useState(false);
  const toast = useRef(null);
  const productOptions = useProductOptions();
  const { rows: documents, loading, load: loadDocuments } = useComponentList(
    "documents",
    toast,
    t("documentManager.error"),
    t("documentManager.failedToLoad")
  );

  const formatOptions = ["PDF", "Excel", "Word"];

  const uploadTemplateFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await s3Service.uploadFile(file, "product-documents");
      if (!result?.url) throw new Error(result?.error || t("documentManager.uploadFailed", "Upload failed"));
      setSelectedDocument((prev) => ({ ...prev, template: result.url }));
    } catch (error) {
      toast.current?.show({ severity: "error", summary: t("documentManager.error"), detail: error.message });
    } finally {
      setUploading(false);
    }
  };

  const saveDocument = async () => {
    const saved = await persist(
      () => productConfiguratorService.saveComponent("documents", selectedDocument),
      toast,
      {
        success: t("common.success"),
        successDetail: selectedDocument.documentName,
        error: t("documentManager.error"),
        errorDetail: t("documentManager.failedToSave", "Failed to save document"),
      }
    );
    if (saved) {
      setSelectedDocument(null);
      loadDocuments();
    }
  };

  const openTemplate = (rowData) => {
    if (/^https?:\/\//.test(rowData.template || "")) {
      window.open(rowData.template, "_blank", "noopener");
    } else {
      toast.current?.show({
        severity: "info",
        summary: rowData.documentName,
        detail: t("documentManager.noFile", "No template file uploaded"),
      });
    }
  };

  const formatBodyTemplate = (rowData) => {
    const icon =
      rowData.format === "PDF"
        ? "pi pi-file-pdf"
        : rowData.format === "Excel"
        ? "pi pi-file-excel"
        : "pi pi-file";
    return <i className={icon} style={{ fontSize: "1.5rem" }}></i>;
  };

  return (
    <div className="document-manager p-3">
      <Toast ref={toast} />
      <Card title={t("documentManager.cardTitle")}>
        <div className="mb-3 flex justify-content-between">
          <h3>{t("documentManager.pageTitle")}</h3>
          <Button
            label={t("documentManager.uploadTemplate")}
            icon="pi pi-upload"
            onClick={() => setSelectedDocument({ format: "PDF", mandatory: false, variables: [] })}
          />
        </div>

        <DataTable value={documents} loading={loading} paginator rows={20}>
          <Column header={t("documentManager.format")} body={formatBodyTemplate} />
          <Column field="documentCode" header={t("documentManager.documentCode")} sortable />
          <Column field="templateCode" header={t("productConfigurator.template", "Template")} sortable body={templateCell} />
          <Column field="documentName" header={t("documentManager.documentName")} sortable />
          <Column field="type" header={t("documentManager.type")} sortable />
          <Column field="stage" header={t("documentManager.stage")} sortable />
          <Column
            field="mandatory"
            header={t("documentManager.required")}
            body={(rowData) =>
              rowData.mandatory ? (
                <i className="pi pi-check text-green-500"></i>
              ) : (
                <i className="pi pi-times text-red-500"></i>
              )
            }
          />
          <Column
            header={t("documentManager.actions")}
            body={(rowData) => (
              <div className="flex gap-2">
                <Button
                  icon="pi pi-download"
                  className="p-button-text"
                  tooltip={t("documentManager.download")}
                  onClick={() => openTemplate(rowData)} aria-label={t("documentManager.download")}
                />
                <Button
                  icon="pi pi-pencil"
                  className="p-button-text"
                  tooltip={t("documentManager.edit")}
                  onClick={() => setSelectedDocument(rowData)} aria-label={t("documentManager.edit")}
                />
                <Button
                  icon="pi pi-eye"
                  className="p-button-text"
                  tooltip={t("documentManager.preview")}
                  onClick={() => openTemplate(rowData)} aria-label={t("documentManager.preview")}
                />
              </div>
            )}
          />
        </DataTable>
      </Card>

      <Dialog
        header={t("documentManager.uploadTemplate")}
        visible={!!selectedDocument}
        style={{ width: "50vw" }}
        onHide={() => setSelectedDocument(null)}
      >
        {selectedDocument && (
          <div className="p-fluid">
            {!selectedDocument.id && (
              <ProductField
                value={selectedDocument.productId}
                options={productOptions}
                onChange={(productId) => setSelectedDocument({ ...selectedDocument, productId })}
              />
            )}
            <div className="formgrid grid">
              <div className="field col-12 md:col-6">
                <label>{t("documentManager.documentCode")}</label>
                <InputText
                  value={selectedDocument.documentCode || ""}
                  onChange={(e) => setSelectedDocument({ ...selectedDocument, documentCode: e.target.value })}
                />
              </div>
              <div className="field col-12 md:col-6">
                <label>{t("documentManager.documentName")}</label>
                <InputText
                  value={selectedDocument.documentName || ""}
                  onChange={(e) => setSelectedDocument({ ...selectedDocument, documentName: e.target.value })}
                />
              </div>
              <div className="field col-12 md:col-6">
                <label>{t("documentManager.type")}</label>
                <InputText
                  value={selectedDocument.type || ""}
                  onChange={(e) => setSelectedDocument({ ...selectedDocument, type: e.target.value })}
                />
              </div>
              <div className="field col-12 md:col-6">
                <label>{t("documentManager.stage")}</label>
                <InputText
                  value={selectedDocument.stage || ""}
                  onChange={(e) => setSelectedDocument({ ...selectedDocument, stage: e.target.value })}
                />
              </div>
              <div className="field col-12 md:col-6">
                <label>{t("documentManager.format")}</label>
                <Dropdown
                  value={selectedDocument.format}
                  options={formatOptions}
                  onChange={(e) => setSelectedDocument({ ...selectedDocument, format: e.value })}
                />
              </div>
              <div className="field col-12 md:col-6 flex align-items-center gap-2">
                <Checkbox
                  inputId="documentMandatory"
                  checked={!!selectedDocument.mandatory}
                  onChange={(e) => setSelectedDocument({ ...selectedDocument, mandatory: e.checked })}
                />
                <label htmlFor="documentMandatory">{t("documentManager.required")}</label>
              </div>
            </div>
            <div className="field">
              <label>{t("documentManager.uploadTemplate")}</label>
              <input type="file" onChange={(e) => uploadTemplateFile(e.target.files?.[0])} />
              {selectedDocument.template && <small className="block mt-1">{selectedDocument.template}</small>}
            </div>
            <Button
              label={t("common.save")}
              icon="pi pi-check"
              loading={uploading}
              onClick={saveDocument}
              disabled={!selectedDocument.documentCode || !selectedDocument.documentName || !selectedDocument.type}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
};

// PC-9: Product Analytics
export const ProductAnalytics = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [analytics, setAnalytics] = useState(null);
  const toast = useRef(null);

  useEffect(() => {
    productConfiguratorService
      .getProductAnalytics()
      .then(setAnalytics)
      .catch((error) =>
        toast.current?.show({
          severity: "error",
          summary: t("productAnalytics.error"),
          detail: error?.message || t("productAnalytics.failedToLoad"),
        })
      );
  }, [t]);

  const performanceChart = {
    labels: analytics?.performanceTrend?.map((tr) => tr.month) || [],
    datasets: [
      {
        label: t("productAnalytics.premiumPhpMillions"),
        data:
          analytics?.performanceTrend?.map((tr) => tr.premium / 1000000) || [],
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgb(54, 162, 235)",
        tension: 0.4,
      },
    ],
  };

  const categoryChart = {
    labels: Object.keys(analytics?.categoryBreakdown || {}),
    datasets: [
      {
        data: Object.values(analytics?.categoryBreakdown || {}).map(
          (c) => c.premium / 1000000
        ),
        backgroundColor: [
          "#FF6384",
          "#36A2EB",
          "#FFCE56",
          "#4BC0C0",
          "#9966FF",
        ],
      },
    ],
  };

  return (
    <div className="product-analytics p-3">
      <Toast ref={toast} />
      <Card title={t("productAnalytics.cardTitle")}>
        <div className="grid">
          <div className="col-8">
            <Card title={t("productAnalytics.premiumTrend")}>
              <Chart type="line" data={performanceChart} />
            </Card>
          </div>
          <div className="col-4">
            <Card title={t("productAnalytics.categoryDistribution")}>
              <Chart type="pie" data={categoryChart} />
            </Card>
          </div>
        </div>

        <Card title={t("productAnalytics.topProductsPerformance")} className="mt-3">
          <DataTable value={analytics?.topProducts || []}>
            <Column field="productName" header={t("productAnalytics.product")} />
            <Column
              field="totalPolicies"
              header={t("productAnalytics.policies")}
              sortable
              body={(rowData) => rowData.totalPolicies.toLocaleString(numberLocale())}
            />
            <Column
              field="totalPremium"
              header={t("productAnalytics.premium")}
              sortable
              body={(rowData) => formatCurrency(rowData.totalPremium)}
            />
            <Column
              field="avgPremium"
              header={t("productAnalytics.avgPremium")}
              sortable
              body={(rowData) => formatCurrency(rowData.avgPremium)}
            />
            <Column
              field="lossRatio"
              header={t("productAnalytics.lossRatio")}
              sortable
              body={(rowData) => (
                <div>
                  <ProgressBar value={rowData.lossRatio} showValue={false} />
                  <small>{rowData.lossRatio}%</small>
                </div>
              )}
            />
            <Column
              field="profitMargin"
              header={t("productAnalytics.profitMargin")}
              sortable
              body={(rowData) => (
                <Tag
                  value={`${rowData.profitMargin}%`}
                  severity={rowData.profitMargin >= 0 ? "success" : "danger"}
                />
              )}
            />
          </DataTable>
        </Card>
      </Card>
    </div>
  );
};
